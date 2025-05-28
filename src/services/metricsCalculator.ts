import type {
  ChatMessage,
  CalculatedMetrics,
  ParticipantMetricsData,
  ParticipantAvgResponseTime,
  EmojiCountMap,
} from '../types';

// Constants
const UNILATERAL_THRESHOLD_MESSAGES = 3;
const UNILATERAL_RESPONSE_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours
const CONVERSATION_START_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes
const MAX_RESPONSE_TIME_TO_CONSIDER_MS = 6 * 3600 * 1000; // 6 hours
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

// Internal type for processing participant metrics
type ProcessingParticipantMetrics = {
  messageCount: number;
  wordCount: number;
  avgWordsPerMessage: number;
  conversationStarters: number;
  avgResponseTime: Partial<ParticipantAvgResponseTime>;
  unilateralSegments: number;
  emojiCounts: EmojiCountMap;
  avgResponseTimeData: number[];
};

/**
 * Initializes the temporary metrics structure for a participant.
 */
const initialProcessingParticipantMetrics = (): ProcessingParticipantMetrics => ({
  messageCount: 0,
  wordCount: 0,
  avgWordsPerMessage: 0,
  conversationStarters: 0,
  avgResponseTime: { count: 0, averageMinutes: 0 },
  unilateralSegments: 0,
  emojiCounts: {},
  avgResponseTimeData: [],
});

/**
 * Calculates various metrics from an array of chat messages.
 *
 * @param messages - An array of ChatMessage objects.
 * @returns A CalculatedMetrics object containing global and participant-specific metrics.
 */
export function calculateChatMetrics(
  messages: ChatMessage[]
): CalculatedMetrics {
  const processingParticipantsMetrics: Record<string, ProcessingParticipantMetrics> = {};
  const finalMetrics: CalculatedMetrics = {
    global: {
      participants: [],
      totalMessageCount: 0,
      dateRange: { start: null, end: null },
      timeSeries: { labels: [], data: [] },
      mediaMessagesCount: 0,
    },
    participants: {}, // This will be Record<string, ParticipantMetricsData>
  };

  if (messages.length === 0) {
    console.warn('[MetricsCalculator] No messages provided to calculate metrics.');
    return finalMetrics;
  }

  const participantNames = Array.from(new Set(messages.map(m => m.author)));
  finalMetrics.global.participants = participantNames;
  participantNames.forEach(name => {
    processingParticipantsMetrics[name] = initialProcessingParticipantMetrics();
  });

  let lastTimestamp: Date | null = null;
  const messagesPerDay: Record<string, number> = {};
  let currentSegment = {
    author: null as string | null,
    count: 0,
    endTimestamp: null as Date | null,
  };

  messages.forEach((msg, index) => {
    const author = msg.author;
    const timestamp = msg.timestamp;
    const content = msg.content;
    const userMetrics = processingParticipantsMetrics[author];

    finalMetrics.global.totalMessageCount++;
    if (!finalMetrics.global.dateRange.start || timestamp < finalMetrics.global.dateRange.start) {
      finalMetrics.global.dateRange.start = timestamp;
    }
    if (!finalMetrics.global.dateRange.end || timestamp > finalMetrics.global.dateRange.end) {
      finalMetrics.global.dateRange.end = timestamp;
    }

    userMetrics.messageCount++;
    const isMedia =
      content.startsWith('<Media omitted>') ||
      content.startsWith('<Multimedia omitido>') ||
      content.includes('omitido') ||
      content.includes('omitted>');

    if (isMedia) {
      finalMetrics.global.mediaMessagesCount++;
    } else {
      const words = content.split(/\s+/).filter(word => word.length > 0);
      userMetrics.wordCount += words.length;
      const emojis = content.match(EMOJI_REGEX);
      if (emojis) {
        emojis.forEach(emoji => {
          userMetrics.emojiCounts[emoji] = (userMetrics.emojiCounts[emoji] || 0) + 1;
        });
      }
    }

    const dateKey = `${timestamp.getUTCFullYear()}-${(timestamp.getUTCMonth() + 1).toString().padStart(2, '0')}-${timestamp.getUTCDate().toString().padStart(2, '0')}`;
    messagesPerDay[dateKey] = (messagesPerDay[dateKey] || 0) + 1;

    const isNewConversation = index === 0 || (lastTimestamp && timestamp.getTime() - lastTimestamp.getTime() > CONVERSATION_START_THRESHOLD_MS);
    if (isNewConversation) {
      userMetrics.conversationStarters++;
    }

    if (index > 0) {
      const prevMessage = messages[index - 1];
      if (prevMessage?.timestamp && author !== prevMessage.author) {
        const diffMilliseconds = timestamp.getTime() - prevMessage.timestamp.getTime();
        if (diffMilliseconds > 1000 && diffMilliseconds < MAX_RESPONSE_TIME_TO_CONSIDER_MS) {
          userMetrics.avgResponseTimeData.push(diffMilliseconds);
        }
      }
    }

    const prevAuthor = index > 0 ? messages[index - 1]?.author : null;
    if (!prevAuthor || prevAuthor !== author) {
        if (currentSegment.author && currentSegment.count >= UNILATERAL_THRESHOLD_MESSAGES && currentSegment.endTimestamp) {
            const responseDelay = timestamp.getTime() - currentSegment.endTimestamp.getTime();
            if (responseDelay >= UNILATERAL_RESPONSE_DELAY_MS) {
                if(processingParticipantsMetrics[currentSegment.author]) {
                    processingParticipantsMetrics[currentSegment.author].unilateralSegments++;
                }
            }
        }
        currentSegment = { author: author, count: 1, endTimestamp: timestamp };
    } else { 
        if (currentSegment.author === author) {
            currentSegment.count++;
            currentSegment.endTimestamp = timestamp;
        } else {
            currentSegment = { author: author, count: 1, endTimestamp: timestamp };
        }
    }
    lastTimestamp = timestamp;
  });

  participantNames.forEach(name => {
    const userProcessingMetrics = processingParticipantsMetrics[name];
    let avgWordsPerMsg = 0;
    if (userProcessingMetrics.messageCount > 0 && userProcessingMetrics.wordCount > 0) {
      avgWordsPerMsg = parseFloat(
        (userProcessingMetrics.wordCount / userProcessingMetrics.messageCount).toFixed(2)
      );
    }

    const responseTimesMs = userProcessingMetrics.avgResponseTimeData;
    let medianResponseTimeMins = 0;
    let responseCount = 0;
    if (responseTimesMs.length > 0) {
      responseCount = responseTimesMs.length;
      responseTimesMs.sort((a: number, b: number) => a - b);
      const mid = Math.floor(responseTimesMs.length / 2);
      const medianMilliseconds =
        responseTimesMs.length % 2 !== 0
          ? responseTimesMs[mid]
          : (responseTimesMs[mid - 1] + responseTimesMs[mid]) / 2;
      medianResponseTimeMins = parseFloat((medianMilliseconds / (1000 * 60)).toFixed(2));
    }
    
    finalMetrics.participants[name] = {
      messageCount: userProcessingMetrics.messageCount,
      wordCount: userProcessingMetrics.wordCount,
      avgWordsPerMessage: avgWordsPerMsg,
      conversationStarters: userProcessingMetrics.conversationStarters,
      avgResponseTime: {
          count: responseCount,
          averageMinutes: medianResponseTimeMins,
      },
      unilateralSegments: userProcessingMetrics.unilateralSegments,
      emojiCounts: userProcessingMetrics.emojiCounts,
    } as ParticipantMetricsData;
  });

  const sortedDates = Object.keys(messagesPerDay).sort();
  finalMetrics.global.timeSeries.labels = sortedDates;
  finalMetrics.global.timeSeries.data = sortedDates.map(date => messagesPerDay[date]);

  console.log('[MetricsCalculator] Metrics calculation complete.');
  return finalMetrics;
}