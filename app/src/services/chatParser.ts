import type { ChatMessage, ParseStats, ParsedChatData } from '../types';

// --- Regex Patterns ---
const REGEX_PATTERNS: RegExp[] = [
  // DD/MM/YY, HH:MM:SS AM/PM (con corchetes y autor)
  /^\[(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(?<time>\d{1,2}:\d{2}:\d{2})\s+(?<ampm>[ap]\.\s?m\.)\]\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
  // DD/MM/YYYY, HH:MM - Autor: Mensaje (formato común sin corchetes, a veces sin segundos)
  /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(?<time>\d{1,2}:\d{2})\s*-\s*(?<author>[^:]+):\s*(?<message>.*)$/i,
  // DD/MM/YY, HH:MM AM/PM - Autor: Mensaje (formato iOS con \u202F NARROW NO-BREAK SPACE)
  /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(?<time>\d{1,2}:\d{2})\u202F(?<ampm>[ap]m)\s+-\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
  // DD/MM/YYYY, HH:MM AM/PM - Autor: Mensaje (similar a iOS pero con espacio normal y punto en AM/PM)
  /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<time>\d{1,2}:\d{2})\s+(?<ampm>[ap]\.\s?m\.)\s+-\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
  // DD/MM/YY [HH:MM:SS] Autor: Mensaje (formato alternativo con corchetes solo en la hora)
  /^\[(?<date>\d{1,2}\/\d{1,2}\/\d{4}),\s+(?<time>\d{1,2}:\d{2}:\d{2})\]\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
  // DD.MM.YYYY, HH:MM - Autor: Mensaje (formato con puntos en fecha)
  /^(?<date>\d{1,2}\.\d{1,2}\.\d{2,4}),?\s+(?<time>\d{1,2}:\d{2})\s*-\s*(?<author>[^:]+):\s*(?<message>.*)$/i,
];

// --- System Message Indicators ---
const SYSTEM_MESSAGE_INDICATORS: string[] = [
  'cifrado de extremo a extremo',
  'los mensajes y las llamadas están cifrados',
  'messages and calls are end-to-end encrypted',
  'creó el grupo', 'creaste el grupo',
  'you created group',
  'añadió a', 'añadiste a',
  'you added',
  'cambió el asunto', 'cambiaste el asunto',
  'changed the subject',
  'cambió el ícono', "cambió el ícono de este grupo", "changed this group's icon",
  'saliste del grupo',
  'you left',
  'salió del grupo',
  'eliminó a', 'eliminaste a',
  'removed',
  'cambió tu código de seguridad',
  'changed your security code',
  'cambió su código de seguridad',
  'changed their security code',
  'mensajes temporales',
  'disappearing messages',
  'activaron los mensajes temporales', 'activaste los mensajes temporales',
  'turned on disappearing messages',
  'desactivó los mensajes temporales', 'desactivaste los mensajes temporales',
  'turned off disappearing messages',
  'llamada perdida', 'llamada de voz perdida',
  'missed voice call',
  'videollamada perdida',
  'missed video call',
  'llamada,',
  'videollamada,',
  'uniste usando el enlace', 'te uniste usando el enlace',
  "joined using this group's invite link",
  "you joined using this group's link",
  'sticker omitido',
  'imagen omitida',
  'video omitido',
  'audio omitido',
  'documento omitido',
  'gif omitido',
  '<media omitted>',
  'mensaje eliminado', 'eliminaste este mensaje',
  'this message was deleted', 'you deleted this message',
  'bloqueaste a este contacto',
  'desbloqueaste a este contacto',
  'you blocked this contact',
  'you unblocked this contact',
  'tap to change.',
  'cambió a mensajes temporales',
  'se unió usando el enlace de invitación',
  'la encuesta finalizó:',
  'poll ended:',
  'creaste una encuesta:',
  'you created a poll:',
];

/**
 * Parses a date string, time string, and AM/PM string into a Date object.
 * Handles various date formats (DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY).
 * Assumes UTC for creating the Date object.
 *
 * @param dateString The date part (e.g., "25/12/2023" or "25.12.23").
 * @param timeString The time part (e.g., "14:30" or "14:30:55").
 * @param ampmString Optional AM/PM string (e.g., "pm", "a. m.").
 * @returns A Date object if parsing is successful, otherwise null.
 */
function parseDateTime(
  dateString?: string,
  timeString?: string,
  ampmString?: string
): Date | null {
  if (!dateString || !timeString) {
    return null;
  }

  let year: number, month: number, day: number;
  let hour: number, minute: number, second: number = 0;

  const timeParts = timeString.split(':');
  if (timeParts.length < 2) {
    return null;
  }

  hour = parseInt(timeParts[0], 10);
  minute = parseInt(timeParts[1], 10);
  if (timeParts.length > 2) {
    second = parseInt(timeParts[2], 10);
  }

  if (isNaN(hour) || isNaN(minute) || isNaN(second)) {
    return null;
  }

  if (ampmString) {
    const lowerAmpm = ampmString.toLowerCase().replace(/\./g, '').replace(/\s/g, '');
    if ((lowerAmpm === 'pm' || lowerAmpm === 'p') && hour >= 1 && hour <= 11) {
      hour += 12;
    } else if ((lowerAmpm === 'am' || lowerAmpm === 'a') && hour === 12) {
      hour = 0;
    }
  }

  const dateParts = dateString.split(/[\/\.]/);
  if (dateParts.length !== 3) {
    return null;
  }

  const p1 = parseInt(dateParts[0], 10);
  const p2 = parseInt(dateParts[1], 10);
  let p3 = parseInt(dateParts[2], 10);

  if (isNaN(p1) || isNaN(p2) || isNaN(p3)) {
    return null;
  }

  day = p1;
  month = p2 - 1; 

  if (p3 < 100) {
    year = p3 + 2000;
  } else {
    year = p3;
  }

  if (
    year < 2000 || year > new Date().getFullYear() + 5 ||
    month < 0 || month > 11 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    second < 0 || second > 59
  ) {
    return null;
  }

  try {
    const dt = new Date(Date.UTC(year, month, day, hour, minute, second));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month ||
      dt.getUTCDate() !== day
    ) {
      return null;
    }
    return dt;
  } catch (e) {
    return null;
  }
}

/**
 * Parses the raw text of a WhatsApp chat export into an array of ChatMessage objects.
 *
 * @param chatText The full raw text content of the exported chat file.
 * @returns An ParsedChatData object containing an array of messages and parsing statistics.
 */
export function parseChatExport(chatText: string): ParsedChatData {
  const lines = chatText.split('\n');
  const messages: ChatMessage[] = [];
  let parseFailCount = 0;
  let linesProcessed = 0;
  let matchedMessageLines = 0;

  console.log(`[ChatParser] Starting to parse ${lines.length} lines.`);

  for (let i = 0; i < lines.length; i++) {
    linesProcessed++;
    let line = lines[i].trim();

    if (line.startsWith('\u200E') || line.startsWith('\u200F')) {
      line = line.substring(1).trim();
    }

    if (!line) continue;

    let matchFoundThisLine = false;
    let newPotentialMessageData: { author: string; content: string; timestamp: Date } | null = null;

    for (const regex of REGEX_PATTERNS) {
      const match = regex.exec(line);
      if (match?.groups) {
        const { date, time, ampm, author, message: content } = match.groups;
        const timestamp = parseDateTime(date, time, ampm);

        if (timestamp && author && typeof content === 'string') {
          matchFoundThisLine = true; // A regex matched structure of a message line

          let systemCheckContent = content;
          if (systemCheckContent.startsWith('\u200E') || systemCheckContent.startsWith('\u200F')) {
            systemCheckContent = systemCheckContent.substring(1).trim();
          }
          const isSystemMsg = SYSTEM_MESSAGE_INDICATORS.some(indicator =>
            author.toLowerCase().includes(indicator.toLowerCase()) ||
            systemCheckContent.toLowerCase().includes(indicator.toLowerCase()) ||
            (systemCheckContent.startsWith('<') && systemCheckContent.endsWith('>') && systemCheckContent.includes('omitted'))
          );

          if (!isSystemMsg) {
            newPotentialMessageData = {
              author: author.trim(),
              content: content.trim(),
              timestamp,
            };
            matchedMessageLines++;
          } else {
          }
          break; 
        }
      }
    }

    if (newPotentialMessageData) {
      const newMessage: ChatMessage = {
        line: i + 1,
        author: newPotentialMessageData.author,
        content: newPotentialMessageData.content,
        timestamp: newPotentialMessageData.timestamp,
      };
      messages.push(newMessage);
    
    } else if (!matchFoundThisLine && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) { 
        const isLikelySystemContinuation = SYSTEM_MESSAGE_INDICATORS.some(indicator =>
          line.toLowerCase().includes(indicator.toLowerCase())
        );

        if (!isLikelySystemContinuation) {
          lastMessage.content += '\n' + line; 
        } else {
          parseFailCount++; 
        }
      } else {
         // Should not happen if messages.length > 0, but as a safeguard
        parseFailCount++;
      }
    
    } else if (!matchFoundThisLine) {
      if (line.length > 0 && !SYSTEM_MESSAGE_INDICATORS.some(ind => line.toLowerCase().includes(ind.toLowerCase()))) {
         parseFailCount++;
      }
    }
  }

  const finalMessages = messages.filter(msg => msg.content && msg.content.trim().length > 0);

  // Calculate accounted lines more directly
  let linesInValidMessages = 0;
  finalMessages.forEach(msg => {
    linesInValidMessages++; // For the initial line
    linesInValidMessages += (msg.content.match(/\n/g) || []).length; // For continuation lines
  });

  const stats: ParseStats = {
    totalLines: lines.length,
    validMessages: finalMessages.length,
    failedLines: parseFailCount, 
  };
  
  console.log(`[ChatParser] Parsing complete. Total lines: ${stats.totalLines}, Valid user messages: ${stats.validMessages}, Problematic/Skipped lines (parseFailCount): ${stats.failedLines}`);

  return {
    messages: finalMessages,
    parseStats: stats,
  };
}