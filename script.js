// script.js (v5.5.1 - Fix missing return + Prev changes)

// --- Variables Globales ---
let charts = {};
let sentimentAnalyzer = null;
let isLoadingModel = false;
let currentAnalysisResults = {};

// --- Constantes y Keywords ---
const AFFECTION_INDEX_MAX_FOR_100_PERCENT = 4;
const MIN_MESSAGE_LENGTH_FOR_AI = 5;
const AFFECTION_KEYWORD_WEIGHT = 2.0;
const POSITIVE_EMOJI_WEIGHT = 0.5;
const POSITIVE_SENTIMENT_WEIGHT = 1.0;
const BATCH_SIZE_AI = 25;
const greenKeywords = ['gracias', 'por favor', 'de nada', 'disculpa', 'perdón', 'lo siento', 'te quiero', 'tq', 'te amo', 'genial', 'excelente', 'buena idea', 'felicidades', 'ánimo', 'apoyo', 'cuenta conmigo', 'entiendo', 'comprendo', '❤️', '😊', '👍', '🙏', '🎉', 'jajaja', 'jejeje', 'jiji', '😂', '🤣', '😍'];
const redKeywords = ['nunca', 'jamas', 'siempre haces', 'tu culpa', 'culpa tuya', 'odio', 'detesto', 'estúpido', 'imbécil', 'idiota', 'jódete', 'mierda', 'carajo', 'problema', 'discutir', 'pelear', 'harto', 'harta', 'molesto', 'molesta', 'cállate', 'dejame en paz', 'no me importa', '😠', '😡', '👎', '🤬', '😤', '😒', '💔'];
const affectionKeywords = ['te quiero', 'tq', 'tk', 'te amo', 'mi amor', 'amor mío', 'cariño', 'cielo', 'corazón', 'mi vida', 'precioso', 'preciosa', 'guapo', 'guapa', 'hermoso', 'hermosa', 'te adoro', 'te extraño', 'mucho', 'besos', 'abrazos', '❤️', '😍', '😘', '🥰', '💕', '💖', '💗', '💓', '💞', ' L '];
const positiveEmojis = ['😊', '😂', '🤣', '👍', '🎉', '🙏', '✨', '😄', '😁', '😀', '😉', '🥳', '😌', '👌'];

// --- Regex para Parseo (v5.2) ---
const regexPatterns = [
    /^\[(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(?<time>\d{1,2}:\d{2}:\d{2})\s+(?<ampm>[ap]\.\s?m\.)\]\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
    /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<time>\d{1,2}:\d{2})\s?-\s(?<author>[^:]+):\s+(?<message>.*)$/i,
    /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(?<time>\d{1,2}:\d{2})\u202F(?<ampm>[ap]m)\s+-\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
    /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<time>\d{1,2}:\d{2})\s+(?<ampm>[ap]\.\s?m\.)\s+-\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
    /^\[(?<date>\d{1,2}\/\d{1,2}\/\d{4}),\s+(?<time>\d{1,2}:\d{2}:\d{2})\]\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
    /^(?<date>\d{1,2}\/\d{1,2}\/\d{4}),\s+(?<time>\d{1,2}:\d{2})\s+-\s+(?<author>[^:]+):\s+(?<message>.*)$/i,
];
console.log(`Regex Patterns Loaded (v${regexPatterns.length}):`, regexPatterns.map(r => r.source));

// --- Indicadores de Mensajes de Sistema ---
const systemMessageIndicators = ["cifrado de extremo a extremo", "Los mensajes y las llamadas están cifrados", "Messages and calls are end-to-end encrypted","creó el grupo", "You created group", "añadió a", "You added","cambió el asunto", "changed the subject", "cambió el ícono", "changed this group's icon","saliste del grupo", "You left", "salió del grupo", "eliminó a", "removed","cambió tu código de seguridad", "changed your security code", "cambió su código de seguridad", "changed their security code","mensajes temporales", "disappearing messages", "activaron los mensajes temporales", "turned on disappearing messages", "desactivó los mensajes temporales", "turned off disappearing messages","llamada perdida", "Missed voice call", "videollamada perdida", "Missed video call", "Llamada,", "Videollamada,","uniste usando el enlace", "te uniste usando el enlace", "joined using this group's invite link", "You joined using this group's link","sticker omitido", "imagen omitida", "video omitido", "audio omitido", "documento omitido", "GIF omitido", "<Media omitted>","mensaje eliminado", "Eliminaste este mensaje", "This message was deleted","Bloqueaste a este contacto", "Desbloqueaste a este contacto", "You blocked this contact", "You unblocked this contact","Tap to change.","cambió a mensajes temporales", "se unió usando el enlace de invitación"];

// --- Helper para Actualizar Estado UI ---
function updateStatus(text, isError = false) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
        statusElement.textContent = text;
        statusElement.style.color = isError ? 'var(--red-flag)' : 'var(--light-text-color)';
        if (text.includes('¡Análisis completado!')) statusElement.style.color = 'var(--green-dark)';
        else if (text.includes('Analizando')||text.includes('Cargando')||text.includes('Generando imagen') || text.includes('Procesando') || text.includes('Parseando')) statusElement.style.color = 'var(--primary-color)';
        console.log(`Status Update: ${text}`);
    }
}

// --- Event Listener Principal (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Chart === 'undefined') console.error("Error: Chart.js no cargado.");
    if (typeof html2canvas === 'undefined') console.error("Error: html2canvas no cargado.");
    const fileInput = document.getElementById('chatfile');
    const imageButton = document.getElementById('image-button');
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (imageButton) imageButton.addEventListener('click', handleImageExport);
    else console.warn("Botón de descarga no encontrado.");
});

// --- Manejador de Selección de Archivo ---
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) { updateStatus("No se seleccionó archivo."); return; }
    updateStatus('Leyendo archivo...');
    resetUI();
    const reader = new FileReader();
    const fileReadPromise = new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(new Error(`Error al leer archivo: ${err.name || '?'}`));
    });
    reader.readAsText(file, 'UTF-8');
    try {
        const chatText = await fileReadPromise;
        updateStatus('Archivo leído. Procesando chat...');
        await new Promise(resolve => setTimeout(resolve, 50));
        await processChat(chatText);
    } catch (error) {
        console.error("Error lectura/proceso:", error);
        alert(`Error: ${error.message}`);
        updateStatus(`Error: ${error.message}`, true);
        resetUI();
    }
}

// --- Función para Resetear la UI ---
function resetUI() {
    currentAnalysisResults = {};
    Object.values(charts).forEach(chart => { if (chart?.destroy) chart.destroy(); });
    charts = {};
    const els = [ document.getElementById('summary-cards-container'), document.getElementById('affection-bars-container'), /* ID Correcto */ document.getElementById('positive-patterns-list'), document.getElementById('attention-patterns-list'), document.getElementById('compatibility-summary') ];
    els.forEach(el => { if (el) el.innerHTML = ''; });
    const canvases = [ document.getElementById('participation-chart'), document.getElementById('timeline-chart') ];
    canvases.forEach(c => { if (c?.getContext) c.getContext('2d').clearRect(0, 0, c.width, c.height); });
    const reportContainer = document.getElementById('report-container'); if (reportContainer) reportContainer.style.display = 'none';
    const imageButton = document.getElementById('image-button'); if (imageButton) imageButton.disabled = true;
    console.log("UI reseteada.");
}

// --- Función Principal de Procesamiento del Chat ---
async function processChat(text) {
    console.log("--- Iniciando processChat (v5.5.1) ---"); // Versión actualizada
    let analysisFlags = { green: [], red: [] };
    try {
        updateStatus("Parseando líneas del chat...");
        const { messages, parseStats } = parseChatLines(text); // v5.2
        console.log(`Parseo terminado: ${messages.length} mensajes reconocidos de ${parseStats.totalLines} líneas. ${parseStats.failedLines} líneas problemáticas.`);
        if (messages.length === 0) throw new Error(`No se reconocieron mensajes válidos (${parseStats.failedLines} líneas?). Verifica formato.`);

        updateStatus(`Chat parseado (${messages.length} msjs). Calculando métricas...`);
        await new Promise(resolve => setTimeout(resolve, 20));
        const metrics = calculateMetrics(messages); // v5.4 (Unilateral por Retraso Respuesta)
        if (!metrics || metrics.participants.length === 0) throw new Error("No se pudieron calcular métricas.");
        console.log("Métricas calculadas.");

        updateStatus('Métricas OK. Analizando sentimiento/afecto...');
        await new Promise(resolve => setTimeout(resolve, 20));
        const { affectionIndex } = await analyzeSentimentAndAffection(messages, metrics, analysisFlags); // v5.5.1 (Fix + Oculta error IA de flags)
        console.log("Análisis IA (o intento) completado.");

        updateStatus('Análisis completo. Generando interpretación...');
        await new Promise(resolve => setTimeout(resolve, 20));
        const interpretationData = generateInterpretation(metrics, analysisFlags, affectionIndex); // v5.4 (Interpretación unilateral ajustada)
        console.log("Interpretación generada.");

        currentAnalysisResults = { messages, metrics, analysisFlags, affectionIndex, interpretationData };
        displayResults(currentAnalysisResults); // v5.5 (Llama a displayAffectionBars)

        updateStatus('¡Análisis completado!');
        console.log("--- Proceso de Análisis Completo ---");

    } catch (error) {
        console.error("Error durante el procesamiento:", error); // Muestra el error en consola
        alert(`Error: ${error.message}`); // Muestra alerta al usuario
        updateStatus(`Error: ${error.message}`, true); // Muestra error en la UI
        resetUI(); // Limpia la UI
    }
}


// --- Sub-función: Parsear Líneas del Chat (v5.2 - Múltiples Regex) ---
function parseChatLines(text) {
    console.log("--- Iniciando parseChatLines (v5.2 - Múltiples Regex) ---");
    const lines = text.split('\n');
    let messages = []; let currentMessage = null; let parseFailCount = 0; let linesProcessed = 0; let matchedLineCount = 0;
    lines.forEach((line, lineIndex) => {
        linesProcessed++; const trimmedLine = line.trim(); if (!trimmedLine) return;
        let matchFound = false; let extractedData = null;
        for (const regex of regexPatterns) {
            const match = regex.exec(trimmedLine);
            if (match?.groups) {
                const groups = match.groups; const dateStr = groups.date?.trim(); const timeStr = groups.time?.trim(); const ampmStr = groups.ampm?.trim(); const authorStr = groups.author?.trim(); let messageStr = groups.message?.trim() ?? '';
                const timestamp = parseDateTime(dateStr, timeStr, ampmStr);
                if (timestamp && authorStr) {
                    let contentSystemCheck = messageStr; if (contentSystemCheck.startsWith('\u200E') || contentSystemCheck.startsWith('\u200F')) contentSystemCheck = contentSystemCheck.substring(1).trim();
                    const isSystemContent = systemMessageIndicators.some(ind => contentSystemCheck.toLowerCase().startsWith(ind.toLowerCase()) || (contentSystemCheck.startsWith('<') && contentSystemCheck.endsWith('>')));
                    if (!isSystemContent) { extractedData = { line: lineIndex + 1, author: authorStr, content: messageStr, timestamp: timestamp }; matchFound = true; matchedLineCount++; break; }
                    else { matchFound = true; break; }
                }
            }
        }
        if (matchFound && extractedData) { currentMessage = extractedData; messages.push(currentMessage); }
        else if (!matchFound && currentMessage && trimmedLine.length > 0) { let continuationLine = trimmedLine; if (continuationLine.startsWith('\u200E') || continuationLine.startsWith('\u200F')) continuationLine = continuationLine.substring(1).trim(); messages[messages.length - 1].content += '\n' + continuationLine; }
        else if (!matchFound) { if (trimmedLine.length > 0 && !systemMessageIndicators.some(ind => trimmedLine.toLowerCase().includes(ind.toLowerCase()))) parseFailCount++; currentMessage = null; }
        else if (matchFound && !extractedData) { currentMessage = null; }
    });
    const validMessages = messages.filter(msg => msg.author && msg.timestamp && typeof msg.content === 'string');
    console.log("--- Fin parseChatLines (v5.2) ---"); console.log(`  Líneas totales: ${lines.length}`); console.log(`  Mensajes de usuario válidos finales: ${validMessages.length}`); console.log(`  Líneas fallidas/ignoradas (aprox): ${parseFailCount}`);
    return { messages: validMessages, parseStats: { totalLines: lines.length, validMessages: validMessages.length, failedLines: parseFailCount } };
}


// --- Sub-función: Parsear Fecha y Hora (v5.2 - Robusta) ---
function parseDateTime(dateString, timeString, ampmString) {
    if (!dateString || !timeString) return null; let year, month, day, hour, minute, second = 0;
    const timeParts = timeString.split(':'); if (timeParts.length < 2) return null;
    hour = parseInt(timeParts[0]); minute = parseInt(timeParts[1]); if (timeParts.length > 2) second = parseInt(timeParts[2]); else second = 0;
    if (isNaN(hour) || isNaN(minute) || isNaN(second)) return null;
    if (ampmString) { const lowerAmpm = ampmString.toLowerCase().replace(/\./g, '').replace(/\s/g, ''); if (lowerAmpm === 'pm' && hour >= 1 && hour <= 11) hour += 12; else if (lowerAmpm === 'am' && hour === 12) hour = 0; }
    const dateParts = dateString.split(/[-\/]/); if (dateParts.length !== 3) return null;
    let p1 = parseInt(dateParts[0]); let p2 = parseInt(dateParts[1]); let p3 = parseInt(dateParts[2]); if (isNaN(p1) || isNaN(p2) || isNaN(p3)) return null;
    if (p3 < 100) year = p3 + 2000; else year = p3; day = p1; month = p2 - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
    try { const dt = new Date(Date.UTC(year, month, day, hour, minute, second)); if (isNaN(dt.getTime()) || dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month || dt.getUTCDate() !== day) return null; return dt; }
    catch (e) { console.error("Excepción en parseDateTime:", e); return null; }
}


// --- Sub-función: Calcular Métricas (v5.4 - Lógica Unilateral por Retraso en Respuesta) ---
function calculateMetrics(messages) {
    console.log("Calculando métricas (v5.4 - Unilateral por Retraso Respuesta)...");
    const metrics = { participants: [], messageCounts: { total: 0 }, wordCounts: {}, avgWordsPerMessage: {}, conversationStarters: {}, avgResponseTimes: {}, unilateralSegments: {}, dateRange: { start: null, end: null }, timeSeries: { labels: [], data: [] }, emojiCounts: {}, mediaMessages: 0, };
    const UNILATERAL_THRESHOLD = 3; const UNILATERAL_RESPONSE_DELAY_MS = 2 * 60 * 60 * 1000;
    const validMessages = messages.filter(m => m?.author && m.timestamp && typeof m.content === 'string'); if (validMessages.length === 0) { console.warn("calculateMetrics: No valid messages received."); return metrics; }
    const authors = new Set(validMessages.map(m => m.author)); metrics.participants = Array.from(authors);
    metrics.participants.forEach(a => { metrics.messageCounts[a] = 0; metrics.wordCounts[a] = 0; metrics.avgWordsPerMessage[a] = 0; metrics.conversationStarters[a] = 0; metrics.avgResponseTimes[a] = { count: 0, averageMinutes: 0 }; metrics.unilateralSegments[a] = 0; metrics.emojiCounts[a] = {}; });
    let responseTimeData = {}; metrics.participants.forEach(p => { responseTimeData[p] = []; });
    let lastTimestamp = null; const CONVERSATION_THRESHOLD = 90 * 60 * 1000; let messagesPerDay = {}; const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
    let currentSegment = { author: null, count: 0, endTimestamp: null };
    validMessages.forEach((msg, index) => {
        const currentAuthor = msg.author; const currentTimestamp = msg.timestamp; const content = msg.content;
        metrics.messageCounts.total++; metrics.messageCounts[currentAuthor]++;
        const isMedia = content.startsWith('<Media omitted>') || content.startsWith('<Multimedia omitido>') || content.includes('omitido') || content.includes('omitted>'); if (isMedia) { metrics.mediaMessages++; } else { const words = content.split(/\s+/).filter(word => word.length > 0); metrics.wordCounts[currentAuthor] += words.length; const emojis = content.match(emojiRegex); if (emojis) { emojis.forEach(emoji => { metrics.emojiCounts[currentAuthor][emoji] = (metrics.emojiCounts[currentAuthor][emoji] || 0) + 1; }); } }
        if (!metrics.dateRange.start || currentTimestamp < metrics.dateRange.start) metrics.dateRange.start = currentTimestamp; if (!metrics.dateRange.end || currentTimestamp > metrics.dateRange.end) metrics.dateRange.end = currentTimestamp;
        const dateKey = `${currentTimestamp.getUTCFullYear()}-${(currentTimestamp.getUTCMonth() + 1).toString().padStart(2, '0')}-${currentTimestamp.getUTCDate().toString().padStart(2, '0')}`; messagesPerDay[dateKey] = (messagesPerDay[dateKey] || 0) + 1;
        const isNewConversation = index === 0 || (lastTimestamp && (currentTimestamp.getTime() - lastTimestamp.getTime()) > CONVERSATION_THRESHOLD); if (isNewConversation) metrics.conversationStarters[currentAuthor]++;
        if (index > 0) { const prevMessage = validMessages[index - 1]; if (prevMessage?.timestamp && currentAuthor !== prevMessage.author) { const diffMilliseconds = currentTimestamp.getTime() - prevMessage.timestamp.getTime(); if (diffMilliseconds > 1000 && diffMilliseconds < (6 * 3600 * 1000)) { responseTimeData[currentAuthor].push(diffMilliseconds); } } }
        const prevMessage = index > 0 ? validMessages[index - 1] : null;
        if (!prevMessage || prevMessage.author !== currentAuthor) {
            if (currentSegment.author && currentSegment.count >= UNILATERAL_THRESHOLD) { const responseDelay = currentTimestamp.getTime() - currentSegment.endTimestamp.getTime(); if (responseDelay >= UNILATERAL_RESPONSE_DELAY_MS) { metrics.unilateralSegments[currentSegment.author]++; console.log(`Segmento Unilateral (Retraso Resp > 2h) detectado para ${currentSegment.author}. Ráfaga terminó en msg ${index-1}, respuesta en msg ${index}. Retraso: ${(responseDelay / (1000 * 60 * 60)).toFixed(1)}h.`); } }
            currentSegment = { author: currentAuthor, count: 1, endTimestamp: currentTimestamp };
        } else { if (currentSegment.author === currentAuthor) { currentSegment.count++; currentSegment.endTimestamp = currentTimestamp; } else { currentSegment = { author: currentAuthor, count: 1, endTimestamp: currentTimestamp }; } }
        lastTimestamp = currentTimestamp;
    });
    metrics.participants.forEach(a => { const numMessages = metrics.messageCounts[a] || 0; const numWords = metrics.wordCounts[a] || 0; metrics.avgWordsPerMessage[a] = (numMessages > 0 && numWords > 0) ? parseFloat((numWords / numMessages).toFixed(2)) : 0; const responseTimes = responseTimeData[a]; if (responseTimes?.length > 0) { responseTimes.sort((x, y) => x - y); const medianMilliseconds = responseTimes[Math.floor(responseTimes.length / 2)]; metrics.avgResponseTimes[a] = { count: responseTimes.length, averageMinutes: parseFloat((medianMilliseconds / (1000 * 60)).toFixed(2)) }; } else { metrics.avgResponseTimes[a] = { count: 0, averageMinutes: 0 }; } });
    const sortedDates = Object.keys(messagesPerDay).sort(); metrics.timeSeries.labels = sortedDates; metrics.timeSeries.data = sortedDates.map(date => messagesPerDay[date]); // Corrección aplicada aquí
    console.log("Métricas calculadas (v5.4):", metrics); return metrics;
}


// *** VERSIÓN CON DEBUGGING ***
async function analyzeSentimentAndAffection(messages, metrics, analysisFlags) {
    console.log("Iniciando análisis IA...");
    // ... (inicio sin cambios: obtener participants, inicializar affectionIndex) ...
    const participants = metrics.participants; if (!participants || participants.length === 0) return { affectionIndex: {} };
    let affectionIndex = {}; participants.forEach(p => { affectionIndex[p] = { score: 0, analyzedCountIA: 0, keywordCount: 0, positiveLabelCount: 0, normalized: 0 }; });

    generateMetricFlags(metrics, analysisFlags);
    const { messagesToAnalyzeForAI, affectionKeywordCounts } = calculateInitialAffectionAndSelectAIMessages(messages, metrics, affectionIndex);
    participants.forEach(p => { affectionIndex[p].keywordCount = affectionKeywordCounts[p] || 0 });
    // console.log(`Mensajes para IA: ${messagesToAnalyzeForAI.length} (largos y no media)`); // Ya se loguea dentro de la otra func

    let sentimentResultsIA = []; let sentimentCounts = { POS: 0, NEG: 0, NEU: 0 };
    let sentimentCountsByUser = {}; participants.forEach(p => { sentimentCountsByUser[p] = { POS: 0, NEG: 0, NEU: 0 }; });

    if (messagesToAnalyzeForAI.length > 0) {
        try {
            await loadSentimentModel(); if (!sentimentAnalyzer) throw new Error("Modelo IA no disponible o falló la carga.");
            updateStatus(`Analizando ${messagesToAnalyzeForAI.length} mensajes con IA...`); await new Promise(resolve => setTimeout(resolve, 20));
            sentimentResultsIA = await performSentimentAnalysisAI(messagesToAnalyzeForAI, sentimentAnalyzer);
            sentimentResultsIA.forEach(result => { const author = result.author; const label = result.label; if (sentimentCountsByUser[author]) { sentimentCountsByUser[author][label]++; sentimentCounts[label]++; } if (affectionIndex[author]) { affectionIndex[author].analyzedCountIA++; if(label === 'POS') affectionIndex[author].positiveLabelCount++; } });
            updateStatus(`Análisis IA completo (${sentimentResultsIA.length} procesados).`);
            // Log de resultados AI
            console.log("[DEBUG Affection] AI Results Summary:", sentimentCountsByUser);
        } catch (error) {
            console.error("Error durante el análisis de sentimiento IA:", error);
            console.log("[DEBUG Affection] AI analysis failed or was skipped due to error."); // Log específico
            updateStatus(`Error análisis IA: ${error.message}`, true);
        }
    } else {
         console.log("[DEBUG Affection] AI analysis skipped (0 messages met criteria)."); // Log específico
         analysisFlags.green.push("Análisis IA no realizado (mensajes muy cortos o solo media).");
     }
    // ... (resto de llamadas sin cambios: generateSentimentFlags, finalizeAffectionIndex, generateKeywordFlags) ...
    generateSentimentFlags(sentimentResultsIA.length, sentimentCounts, sentimentCountsByUser, metrics, affectionIndex, analysisFlags);
    finalizeAffectionIndex(affectionIndex, metrics); // Esta función ahora tendrá logs internos
    generateKeywordFlags(messages, affectionKeywordCounts, analysisFlags);
    console.log("Análisis de afecto y flags completado."); return { affectionIndex };
}


// --- Sub-función: Cargar Modelo de Sentimiento (Sin cambios) ---
async function loadSentimentModel() {
    if (sentimentAnalyzer || isLoadingModel) { if (isLoadingModel) { console.log("loadSentimentModel: Esperando carga previa..."); updateStatus("Esperando carga previa modelo IA..."); await new Promise(resolve => { let cI = setInterval(() => { if (!isLoadingModel) { clearInterval(cI); resolve(); } }, 300); }); if (!sentimentAnalyzer) { console.error("loadSentimentModel: La carga previa falló."); throw new Error("Fallo carga modelo IA en instancia previa."); } console.log("loadSentimentModel: Carga previa finalizada."); updateStatus('Modelo listo.'); } return; }
    isLoadingModel = true; updateStatus('Cargando modelo IA (puede tardar)...'); console.log("loadSentimentModel: Iniciando carga - Importando transformers.js...");
    try { const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1'); if (typeof pipeline === 'undefined') throw new Error("'pipeline' no fue importado."); console.log("loadSentimentModel: Transformers.js importado. Configurando entorno..."); env.allowLocalModels = false; env.useBrowserCache = true; console.log("loadSentimentModel: Entorno configurado. Iniciando pipeline..."); sentimentAnalyzer = await pipeline('sentiment-analysis', 'Xenova/pysentimiento-robertuito-sentiment-analysis', { progress_callback: (p) => { if(p.status === 'progress'){ const pct=p.total > 0 ? ((p.loaded/p.total)*100).toFixed(1) : '0.0'; updateStatus(`Cargando modelo IA... ${pct}%`); } else if (p.status === 'download') { updateStatus(`Descargando modelo IA: ${p.file}...`); } } }); console.log("loadSentimentModel: Pipeline creado. Modelo listo."); updateStatus('Modelo IA cargado. Listo para analizar.');
    } catch (error) { console.error("Error carga modelo IA:", error); sentimentAnalyzer = null; throw error; } finally { isLoadingModel = false; console.log("loadSentimentModel: Proceso finalizado (éxito o fallo)."); }
}

// --- Sub-función: Realizar Análisis Sentimiento IA en Lotes (Sin cambios) ---
async function performSentimentAnalysisAI(messagesToAnalyze, analyzer) {
    let results = []; let processedCount = 0; const totalToProcess = messagesToAnalyze.length; console.log(`performSentimentAnalysisAI: Procesando ${totalToProcess} mensajes en lotes de ${BATCH_SIZE_AI}`);
    for (let i = 0; i < totalToProcess; i += BATCH_SIZE_AI) { const batch = messagesToAnalyze.slice(i, i + BATCH_SIZE_AI); if (batch.length === 0) continue; const contents = batch.map(m => m.content); const batchResults = await analyzer(contents); batchResults.forEach((result, index) => { const originalMessage = batch[index]; results.push({ author: originalMessage.author, label: result.label, confidence: result.score }); }); processedCount += batch.length; if (processedCount % (BATCH_SIZE_AI * 4) === 0 || processedCount === totalToProcess) { updateStatus(`Análisis IA: ${processedCount}/${totalToProcess} mensajes`); await new Promise(r => setTimeout(r, 5)); } }
    console.log(`performSentimentAnalysisAI: Análisis completado. ${results.length} resultados.`); return results;
}


// --- Sub-funciones Generación de Flags y Afecto ---

// *** ACTUALIZADA v5.6: Flags más detallados ***
function generateMetricFlags(metrics, flags) {
    const participants = metrics.participants; if (!participants || participants.length === 0) return;
    console.log("generateMetricFlags (v5.6 - Detallado): Iniciando...");

    // --- Constantes usadas en flags (para claridad) ---
    const UNILATERAL_THRESHOLD = 3; // Re-definir o pasar como argumento si es necesario
    const UNILATERAL_RESPONSE_DELAY_HOURS = 2; // Re-definir o pasar como argumento si es necesario
    const RESP_TIME_SLOW_THRESHOLD_MIN = 90;
    const RESP_TIME_FAST_THRESHOLD_MIN = 10;
    const PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT = 25; // Diferencia del 50%
    const LENGTH_IMBALANCE_RATIO = 1.8;
    const STARTER_IMBALANCE_THRESHOLD_PERCENT = 15; // Diferencia del 50%

    // Comparaciones para 2 participantes
    if (participants.length === 2) {
        const [p1, p2] = participants; const totalMsgs = metrics.messageCounts.total;
        const countP1 = metrics.messageCounts[p1] || 0; const countP2 = metrics.messageCounts[p2] || 0;
        if (totalMsgs > 0) {
            const percentP1 = (countP1 / totalMsgs) * 100; const percentP2 = 100 - percentP1; const participationDiff = Math.abs(percentP1 - 50);
            if (participationDiff > PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT) {
                 flags.red.push(`Participación muy desigual: ${p1} (${Math.round(percentP1)}%) vs ${p2} (${Math.round(percentP2)}%) difiere más de ${PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT}% del 50/50.`);
            } else if (participationDiff > 10) { // Umbral moderado (podemos hacerlo más detallado también si quieres)
                 flags.red.push(`Participación moderadamente desigual en mensajes (${p1}: ${Math.round(percentP1)}%, ${p2}: ${Math.round(percentP2)}%).`);
            } else {
                 flags.green.push(`Participación relativamente equilibrada (${p1}: ${Math.round(percentP1)}%, ${p2}: ${Math.round(percentP2)}%).`);
            }
        }
        const avgWp1 = metrics.avgWordsPerMessage[p1] || 0; const avgWp2 = metrics.avgWordsPerMessage[p2] || 0;
        if (avgWp1 > 0 && avgWp2 > 0) {
            const ratio = Math.max(avgWp1 / avgWp2, avgWp2 / avgWp1);
            if (ratio > LENGTH_IMBALANCE_RATIO) {
                 const longerAuthor = avgWp1 > avgWp2 ? p1 : p2; const shorterAuthor = avgWp1 > avgWp2 ? p2 : p1;
                 const longerAvg = Math.max(avgWp1, avgWp2); const shorterAvg = Math.min(avgWp1, avgWp2);
                 flags.red.push(`Longitud media de msj. desigual: ${longerAuthor} (${longerAvg.toFixed(1)} pal.) vs ${shorterAuthor} (${shorterAvg.toFixed(1)} pal.), ratio > ${LENGTH_IMBALANCE_RATIO.toFixed(1)}.`);
            } else {
                 flags.green.push(`Longitud promedio de mensajes similar entre ${p1} (${avgWp1.toFixed(1)} pal.) y ${p2} (${avgWp2.toFixed(1)} pal.).`);
            }
        }
        const startsP1 = metrics.conversationStarters[p1] || 0; const startsP2 = metrics.conversationStarters[p2] || 0; const totalStarts = startsP1 + startsP2;
        if (totalStarts > 5) {
            const startPercentP1 = (startsP1 / totalStarts) * 100; const startDiff = Math.abs(startPercentP1 - 50);
            if (startDiff > STARTER_IMBALANCE_THRESHOLD_PERCENT) {
                 const initiator = startPercentP1 > 50 ? p1 : p2; const other = startPercentP1 > 50 ? p2 : p1;
                 const higherPercent = Math.round(Math.max(startPercentP1, 100 - startPercentP1));
                 flags.red.push(`${initiator} inicia la mayoría (${higherPercent}%) de las conversaciones (vs ${other}: ${100-higherPercent}%), difiere > ${STARTER_IMBALANCE_THRESHOLD_PERCENT}% del 50/50.`);
            } else {
                 flags.green.push(`Inicio de conversaciones relativamente equilibrado (${p1}: ${startsP1}, ${p2}: ${startsP2}).`);
            }
        }
    }
    // Métricas individuales
    participants.forEach(author => {
        const respTimeData = metrics.avgResponseTimes[author];
        if (respTimeData?.count > 5) {
            if (respTimeData.averageMinutes > RESP_TIME_SLOW_THRESHOLD_MIN) {
                 flags.red.push(`Tiempo de respuesta mediano de ${author} es largo (~${Math.round(respTimeData.averageMinutes)} min), superando los ${RESP_TIME_SLOW_THRESHOLD_MIN} min.`);
            } else if (respTimeData.averageMinutes < RESP_TIME_FAST_THRESHOLD_MIN) {
                 flags.green.push(`Tiempo de respuesta mediano de ${author} es rápido (~${Math.round(respTimeData.averageMinutes)} min), inferior a ${RESP_TIME_FAST_THRESHOLD_MIN} min.`);
            }
        }
        const unilateralCount = metrics.unilateralSegments[author] || 0;
        if (unilateralCount > 0) { // Siempre mostrar si existe, ajustando texto por frecuencia
            const freqText = unilateralCount >= 8 ? "MUY frecuentes" : (unilateralCount >= 4 ? "frecuentes" : "ocasionales");
             flags.red.push(`Episodios ${freqText} (${unilateralCount}) donde ${author} envió ${UNILATERAL_THRESHOLD}+ msjs seguidos y la respuesta posterior tardó >${UNILATERAL_RESPONSE_DELAY_HOURS}h.`);
        }
    });
    // Ya no añadimos el flag general de reciprocidad si usamos el texto anterior
    console.log("generateMetricFlags (v5.6 - Detallado): Finalizado.");
}

// *** VERSIÓN CON DEBUGGING ***
function calculateInitialAffectionAndSelectAIMessages(messages, metrics, affectionIndex) {
    console.log("[DEBUG Affection] Iniciando cálculo inicial..."); // Log inicio
    let messagesToAnalyzeForAI = [];
    let affectionKeywordCounts = {};
    metrics.participants.forEach(p => affectionKeywordCounts[p] = 0);
    let totalKeywordMatches = 0; // Contador para debug

    messages.forEach((msg) => {
        if (!msg.author || !msg.content || !affectionIndex[msg.author]) return;

        const author = msg.author;
        const lowerContent = msg.content.toLowerCase();
        let currentMsgAffectionScore = 0;

        // Debug: Keywords
        affectionKeywords.forEach(keyword => {
            const regex = (keyword.length <= 3) ? new RegExp(`\\b${keyword}\\b`, 'i') : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            if (regex.test(lowerContent)) {
                console.log(`[DEBUG Affection] Keyword match: '${keyword}' by ${author}`); // Log match
                currentMsgAffectionScore += AFFECTION_KEYWORD_WEIGHT;
                affectionKeywordCounts[author]++;
                totalKeywordMatches++; // Incrementar contador debug
            }
        });

        // Debug: Emojis
        positiveEmojis.forEach(emoji => {
            if (msg.content.includes(emoji) && !affectionKeywords.some(ak => ak.trim() === emoji.trim())) {
                console.log(`[DEBUG Affection] Emoji match: '${emoji}' by ${author}`); // Log match
                currentMsgAffectionScore += POSITIVE_EMOJI_WEIGHT;
                totalKeywordMatches++; // Incrementar contador debug
            }
        });

        if (currentMsgAffectionScore > 0) {
             console.log(`[DEBUG Affection] Msg Score (Keywords/Emojis) for ${author}: ${currentMsgAffectionScore.toFixed(1)}`); // Log score > 0
        }
        affectionIndex[author].score += currentMsgAffectionScore;

        // Selección para IA (sin cambios, pero importante para el log final)
        const contentTrimmed = msg.content?.trim();
        const isMedia = contentTrimmed && (contentTrimmed.startsWith('<Media omitted>') || contentTrimmed.startsWith('<Multimedia omitido>') || contentTrimmed.includes(' omitido') || contentTrimmed.includes(' omitted>'));
        if (msg.author && contentTrimmed && contentTrimmed.length >= MIN_MESSAGE_LENGTH_FOR_AI && !isMedia) {
            messagesToAnalyzeForAI.push(msg);
        }
    });

    // Logs finales de esta función
    console.log(`[DEBUG Affection] Total Keyword/Emoji matches found: ${totalKeywordMatches}`);
    console.log(`[DEBUG Affection] Messages selected for AI analysis: ${messagesToAnalyzeForAI.length}`);
    console.log("[DEBUG Affection] Finalizando cálculo inicial.");
    return { messagesToAnalyzeForAI, affectionKeywordCounts };
}

// *** ACTUALIZADA v5.6: Flags más detallados ***
function generateSentimentFlags(totalAnalyzedIA, sentimentCounts, sentimentCountsByUser, metrics, affectionIndex, flags) {
    console.log("generateSentimentFlags (v5.6 - Detallado): Iniciando...");
    const participants = metrics.participants;
    if (totalAnalyzedIA <= 10) { if (totalAnalyzedIA > 0) flags.green.push(`Análisis IA basado en pocos mensajes (${totalAnalyzedIA}); tono general estimado puede no ser representativo.`); console.log("generateSentimentFlags: Pocos mensajes para IA."); return; }

    const positivePercent = (sentimentCounts.POS / totalAnalyzedIA) * 100;
    const negativePercent = (sentimentCounts.NEG / totalAnalyzedIA) * 100;
    const neutralPercent = 100 - positivePercent - negativePercent;

    // Tono general: Incluir porcentajes comparativos
    if (positivePercent > 60) {
        flags.green.push(`Tono general (IA): Predominantemente positivo (~${Math.round(positivePercent)}% Pos vs ~${Math.round(negativePercent)}% Neg), señal favorable.`);
    } else if (positivePercent > negativePercent && positivePercent > 40) {
        flags.green.push(`Tono general (IA): Mayormente positivo (~${Math.round(positivePercent)}% Pos vs ~${Math.round(negativePercent)}% Neg).`);
    } else if (negativePercent > positivePercent && negativePercent > 40) {
        flags.red.push(`Tono general (IA): Notable presencia negativa (~${Math.round(negativePercent)}% Neg vs ~${Math.round(positivePercent)}% Pos), sugiere precaución.`);
    } else if (negativePercent > 25) {
        flags.red.push(`Tono general (IA): Presencia significativa de negatividad (~${Math.round(negativePercent)}% Neg vs ~${Math.round(positivePercent)}% Pos).`);
    } else if (neutralPercent > 50) {
        flags.green.push(`Tono general (IA): Mayormente neutral (~${Math.round(neutralPercent)}% Neu).`);
    } else {
         // Caso mixto/equilibrado sin predominancia clara
         flags.green.push(`Tono general (IA): Mixto (~${Math.round(positivePercent)}% Pos, ~${Math.round(negativePercent)}% Neg, ~${Math.round(neutralPercent)}% Neu).`);
    }

    // Comparación entre participantes (si son 2)
    if (participants.length === 2) {
        const [p1, p2] = participants;
        const analyzedP1 = affectionIndex[p1]?.analyzedCountIA || 0; const analyzedP2 = affectionIndex[p2]?.analyzedCountIA || 0;
        if (analyzedP1 > 5 && analyzedP2 > 5) {
            const negPercentP1 = analyzedP1 > 0 ? (sentimentCountsByUser[p1]?.NEG / analyzedP1) * 100 : 0; const negPercentP2 = analyzedP2 > 0 ? (sentimentCountsByUser[p2]?.NEG / analyzedP2) * 100 : 0;
            const posPercentP1 = analyzedP1 > 0 ? (sentimentCountsByUser[p1]?.POS / analyzedP1) * 100 : 0; const posPercentP2 = analyzedP2 > 0 ? (sentimentCountsByUser[p2]?.POS / analyzedP2) * 100 : 0;
            const negDiffThreshold = 1.8; const minNegPercentForFlag = 15;
            if (negPercentP1 > negPercentP2 * negDiffThreshold && negPercentP1 > minNegPercentForFlag) {
                 flags.red.push(`${p1} tiende a más negatividad (IA) que ${p2} (~${Math.round(negPercentP1)}% vs ~${Math.round(negPercentP2)}%, dif. >${negDiffThreshold.toFixed(1)}x).`);
            } else if (negPercentP2 > negPercentP1 * negDiffThreshold && negPercentP2 > minNegPercentForFlag) {
                 flags.red.push(`${p2} tiende a más negatividad (IA) que ${p1} (~${Math.round(negPercentP2)}% vs ~${Math.round(negPercentP1)}%, dif. >${negDiffThreshold.toFixed(1)}x).`);
            }
            // Comparación de positividad (solo si no hubo flag de negatividad comparativa)
            const posDiffThreshold = 1.5; const minPosPercentForFlag = 30;
            if (!flags.red.some(f => f.includes('tiende a más negatividad'))) { // Evitar redundancia
                 if (posPercentP1 > posPercentP2 * posDiffThreshold && posPercentP1 > minPosPercentForFlag) {
                      flags.green.push(`${p1} tiende a más positividad (IA) que ${p2} (~${Math.round(posPercentP1)}% vs ~${Math.round(posPercentP2)}%).`);
                 } else if (posPercentP2 > posPercentP1 * posDiffThreshold && posPercentP2 > minPosPercentForFlag) {
                      flags.green.push(`${p2} tiende a más positividad (IA) que ${p1} (~${Math.round(posPercentP2)}% vs ~${Math.round(posPercentP1)}%).`);
                 }
            }
        }
    }
    console.log("generateSentimentFlags (v5.6 - Detallado): Finalizado.");
}

function finalizeAffectionIndex(affectionIndex, metrics) {
    console.log("[DEBUG Affection] Iniciando finalización de índice..."); // Log inicio
    metrics.participants.forEach(author => {
        const indexData = affectionIndex[author];
        if (indexData) {
             // Log del score ANTES de añadir el puntaje IA
             console.log(`[DEBUG Affection] ${author}: Score Pre-IA = ${indexData.score.toFixed(2)}, AI Positives = ${indexData.positiveLabelCount || 0}`);

            // Sumar puntaje por sentimiento positivo detectado por IA
            indexData.score += (indexData.positiveLabelCount || 0) * POSITIVE_SENTIMENT_WEIGHT;

            // Log del score DESPUÉS de añadir el puntaje IA
            console.log(`[DEBUG Affection] ${author}: Score Post-IA = ${indexData.score.toFixed(2)}`);

            const totalMessagesByAuthor = metrics.messageCounts[author] || 0;
            if (totalMessagesByAuthor > 0) {
                const normalizedScore = (indexData.score / totalMessagesByAuthor) * 10;
                indexData.normalized = parseFloat(Math.min(normalizedScore, 15).toFixed(2));
                // Log de normalización
                console.log(`[DEBUG Affection] <span class="math-inline">\{author\}\: TotalMsgs\=</span>{totalMessagesByAuthor}, NormalizedScore=${indexData.normalized}`);
            } else {
                indexData.normalized = 0;
                console.log(`[DEBUG Affection] ${author}: TotalMsgs=0, NormalizedScore=0`);
            }
        }
    });
    console.log("[DEBUG Affection] Finalización de índice completada."); // Log fin
}

// *** ACTUALIZADA v5.6: Flags más detallados ***
function generateKeywordFlags(messages, affectionKeywordCounts, flags) {
    let greenKeywordCount = 0; let redKeywordCount = 0; let totalAffectionKeywords = Object.values(affectionKeywordCounts).reduce((sum, count) => sum + count, 0);
    messages.forEach(msg => {
        const lowerContent = msg.content.toLowerCase();
        greenKeywords.forEach(k => { if (!affectionKeywords.includes(k) && lowerContent.includes(k)) greenKeywordCount++; });
        redKeywords.forEach(k => { if (lowerContent.includes(k)) redKeywordCount++; });
    });
    const keywordThreshold = Math.max(5, Math.round(messages.length * 0.01)); // Umbral dinámico

    if (greenKeywordCount > keywordThreshold) {
        flags.green.push(`Uso frecuente (${greenKeywordCount} veces > umbral de ${keywordThreshold}) de palabras/emojis asociados a positividad o cortesía.`);
    }
    if (redKeywordCount > keywordThreshold) {
        flags.red.push(`Uso frecuente (${redKeywordCount} veces > umbral de ${keywordThreshold}) de palabras/emojis asociados a negatividad o conflicto.`);
    }
    if (totalAffectionKeywords > keywordThreshold && !flags.green.some(f => f.includes("afecto explícito"))) { // Evitar duplicados si ya hay otro flag similar
        flags.green.push(`Uso frecuente (${totalAffectionKeywords} veces > umbral de ${keywordThreshold}) de palabras/emojis asociados a afecto explícito.`);
    }
}

function generateInterpretation(metrics, analysisFlags, affectionIndex) {
    console.log("Generando interpretación (v5.6 - Mejorada)...");
    const interpretationData = { positivePoints: [], attentionPoints: [], summary: "" };
    const participants = metrics.participants;
    if (!participants || participants.length === 0) {
         interpretationData.summary = "No hay suficientes datos o participantes para generar una interpretación.";
         return interpretationData;
     }

    // 1. Recolectar y limpiar flags (usando un helper)
    const { positivePoints, attentionPoints, addedKeys } = collectAndCleanFlags(analysisFlags);
    interpretationData.positivePoints = positivePoints;
    interpretationData.attentionPoints = attentionPoints;

    // 2. --- NUEVA SECCIÓN DE SÍNTESIS ---
    let summaryElements = [];
    summaryElements.push("<strong>Interpretación Detallada:</strong>"); // Título

    // 2a. Perfil de Balance y Participación (Más útil para 2 participantes)
    if (participants.length === 2) {
        const balanceProfile = generateBalanceProfile(metrics, addedKeys);
        if (balanceProfile) summaryElements.push(balanceProfile);

        // 2b. Perfil de Afecto (Comparativo para 2 participantes)
        const affectionProfile = generateAffectionProfile(affectionIndex, addedKeys, participants);
        if (affectionProfile) summaryElements.push(affectionProfile);

    } else if (participants.length > 2) {
         // Mensaje para grupos
         summaryElements.push("<strong>Balance y Afecto:</strong> El análisis detallado de equilibrio y comparación de afecto aplica principalmente a chats de 2 personas. Para grupos, considera la participación individual y el tono general.");
         // Podríamos añadir lógica para destacar al más/menos activo o afectivo del grupo aquí.
    } else {
         // Chat individual?
         summaryElements.push("<strong>Balance y Afecto:</strong> Parece ser un chat individual o no se detectaron suficientes participantes.");
    }

    // 2c. Perfil de Tono (General)
    const toneProfile = generateToneProfile(addedKeys);
    if (toneProfile) summaryElements.push(toneProfile);

    // 2d. Perfil de Flujo de Comunicación (General)
    const communicationFlowProfile = generateCommunicationFlowProfile(metrics, addedKeys, participants);
    if (communicationFlowProfile) summaryElements.push(communicationFlowProfile);

    // 3. Combinar elementos en un texto coherente
    // Quitar el título si no se generó ningún otro elemento
    if (summaryElements.length <= 1) {
         interpretationData.summary = "No se generaron suficientes insights para una interpretación detallada, revisa los patrones observados.";
    } else {
        // Unir con párrafos HTML (<p>) para mejor espaciado visual
        interpretationData.summary = summaryElements.map(el => `<p>${el}</p>`).join("");
         // Quitar <p> inicial y final si el primero es el título
         if (interpretationData.summary.startsWith("<p><strong>Interpretación Detallada:</strong></p>")) {
              interpretationData.summary = interpretationData.summary.replace("<p><strong>Interpretación Detallada:</strong></p>", "<strong>Interpretación Detallada:</strong><br>"); // Reemplazar primer <p> por título + <br>
         }
    }

    // --- FIN NUEVA SECCIÓN ---

    console.log("Interpretación Final (v5.6):", interpretationData);
    return interpretationData;
}

// --- NUEVO HELPER: Recolecta, limpia flags y retorna claves detectadas ---
function collectAndCleanFlags(analysisFlags) {
    const positivePoints = [];
    const attentionPoints = [];
    const addedKeys = new Set(); // Rastrear claves únicas

    // Mapeo (igual que antes, asegurando que 'delayed_response' esté presente)
    const flagMappings = {
         green: [ { keywords: ["equilibrada en mensajes"], key: "bal_msg" }, { keywords: ["longitud promedio de mensajes similar"], key: "bal_len" }, { keywords: ["inicio de conversaciones relativamente equilibrado"], key: "bal_start" }, { keywords: ["rápido"], key: "resp_fast" }, { keywords: ["recíproca", "pocos segmentos unilaterales"], key: "reciprocal" }, { keywords: ["predominantemente positivo"], key: "tone_v_pos" }, { keywords: ["mayormente positivo"], key: "tone_m_pos" }, { keywords: ["mayormente neutral"], key: "tone_neu" }, { keywords: ["tiende a expresar más sentimiento positivo"], key: "tone_p_more" }, { keywords: ["positividad o cortesía"], key: "kw_pos" }, { keywords: ["afecto explícito"], key: "kw_aff" }, ],
         red: [ { keywords: ["muy desigual", "moderadamente desigual"], key: "imbal_msg" }, { keywords: ["notablemente más largos"], key: "imbal_len" }, { keywords: ["inicia la mayoría"], key: "imbal_start" }, { keywords: ["largo (~"], key: "resp_slow" }, { keywords: ["respuesta posterior tardó", "retraso resp >"], key: "delayed_response" }, /* Clave v5.4 */ { keywords: ["notable presencia negativa"], key: "tone_v_neg" }, { keywords: ["presencia significativa de negatividad"], key: "tone_m_neg" }, { keywords: ["tiende a expresar más sentimiento negativo"], key: "tone_n_more" }, { keywords: ["negatividad o conflicto"], key: "kw_neg" }, ]
    };

    const addPointLocal = (listType, key, text, pointsList) => {
        let cleanText = text.replace(/^(Obs:|Patrón:|Observación:|Nota:|Tono general \(IA\):)\s*/i, '').trim();
        cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
        cleanText = cleanText.endsWith('.') ? cleanText : cleanText + '.';
        // Añadir solo si la clave conceptual es nueva para evitar redundancia en los puntos listados
        if (key && !addedKeys.has(key + "_" + listType)) { // Usar tipo para diferenciar keys iguales en pos/att
             pointsList.push(cleanText);
             addedKeys.add(key); // Añadir clave conceptual general detectada
             addedKeys.add(key + "_" + listType); // Añadir clave específica de lista
        } else if (!key) { // Añadir si no tiene clave (flags genéricos)
             pointsList.push(cleanText);
        }
    };

    // Procesar flags verdes
    (analysisFlags.green || []).forEach(flagText => { let mappedKey = null; for (const mapping of flagMappings.green) { if (mapping.keywords.some(kw => flagText.toLowerCase().includes(kw))) { mappedKey = mapping.key; break; } } addPointLocal('pos', mappedKey, flagText, positivePoints); });
    // Procesar flags rojos
    (analysisFlags.red || []).forEach(flagText => { let mappedKey = null; for (const mapping of flagMappings.red) { if (mapping.keywords.some(kw => flagText.toLowerCase().includes(kw))) { mappedKey = mapping.key; break; } } addPointLocal('att', mappedKey, flagText, attentionPoints); });

    return { positivePoints, attentionPoints, addedKeys };
}


// --- NUEVAS FUNCIONES HELPER PARA SÍNTESIS ---

function generateBalanceProfile(metrics, addedKeys) {
    let text = "<strong>Balance y Participación:</strong> ";
    let findings = [];
    const hasImbalMsg = addedKeys.has('imbal_msg');
    const hasBalMsg = addedKeys.has('bal_msg');
    const hasImbalLen = addedKeys.has('imbal_len');
    const hasBalLen = addedKeys.has('bal_len');
    const hasImbalStart = addedKeys.has('imbal_start');
    const hasBalStart = addedKeys.has('bal_start');

    if (hasBalMsg) findings.push("la cantidad de mensajes parece equilibrada");
    else if (hasImbalMsg) findings.push("se observa desequilibrio en la cantidad de mensajes");

    if (hasBalLen) findings.push("la longitud promedio de mensajes es similar");
    else if (hasImbalLen) findings.push("existe diferencia en la longitud promedio de mensajes");

    if (hasBalStart) findings.push("el inicio de conversaciones es compartido");
    else if (hasImbalStart) findings.push("uno de los participantes inicia más conversaciones");

    if (findings.length === 0) return ""; // No hay insights de balance
    if (findings.length === 1) text += `Principalmente, ${findings[0]}.`;
    if (findings.length === 2) text += `${findings[0].charAt(0).toUpperCase() + findings[0].slice(1)} y ${findings[1]}.`;
    if (findings.length === 3) text += `${findings[0].charAt(0).toUpperCase() + findings[0].slice(1)}, ${findings[1]}, y ${findings[2]}.`;

    return text;
}

function generateAffectionProfile(affectionIndex, addedKeys, participants) {
    let text = "<strong>Afecto Estimado:</strong> ";
    let findings = [];
    const [p1, p2] = participants;
    const affP1 = affectionIndex[p1]?.normalized || 0;
    const affP2 = affectionIndex[p2]?.normalized || 0;
    const totalAff = affP1 + affP2;
    const hasKwAff = addedKeys.has('kw_aff');
    const hasLowAff = addedKeys.has('low_aff'); // Nota: este flag no se añade explícitamente ahora, se infiere
    const hasImbalAff = addedKeys.has('imbal_aff'); // Nota: este flag no se añade explícitamente ahora, se infiere
    const hasBalAff = addedKeys.has('bal_aff'); // Nota: este flag no se añade explícitamente ahora, se infiere

    const affectionDifference = Math.abs(affP1 - affP2);
    const significantAffectionDifference = totalAff > 1.0 && affectionDifference > (totalAff * 0.5) && affectionDifference > 1.5;

    if (significantAffectionDifference) findings.push(`existe una diferencia notable (${affP1 > affP2 ? p1 : p2} muestra índice ${Math.max(affP1, affP2).toFixed(1)} vs ${Math.min(affP1, affP2).toFixed(1)})`);
    else if (totalAff >= 1.0) findings.push(`los niveles parecen relativamente similares (${p1}: ${affP1.toFixed(1)}, ${p2}: ${affP2.toFixed(1)})`);
    //else findings.push("el índice general es bajo"); // Evitar si kw_aff está presente

    if (hasKwAff) findings.push("se detectó uso frecuente de lenguaje afectivo explícito");
    else if (totalAff < 1.0) findings.push("la expresión de afecto explícito parece baja o poco frecuente");


    if (findings.length === 0) return "";
    text += findings.join(". ").replace(/^\w/, c => c.toUpperCase()) + "."; // Unir con puntos y capitalizar inicio
    return text;
}

 function generateToneProfile(addedKeys) {
    let text = "<strong>Tono General:</strong> ";
    let findings_tone = [];
    let findings_kw = [];
    const hasToneVPos = addedKeys.has('tone_v_pos'); const hasToneMPos = addedKeys.has('tone_m_pos');
    const hasToneNeu = addedKeys.has('tone_neu'); const hasToneVNeg = addedKeys.has('tone_v_neg');
    const hasToneMNeg = addedKeys.has('tone_m_neg'); const hasKwPos = addedKeys.has('kw_pos');
    const hasKwNeg = addedKeys.has('kw_neg');

    // Tono IA
    if (hasToneVPos) findings_tone.push("predominantemente positivo (según IA)");
    else if (hasToneMPos) findings_tone.push("mayormente positivo (según IA)");
    else if (hasToneVNeg) findings_tone.push("notable presencia negativa (según IA)");
    else if (hasToneMNeg) findings_tone.push("presencia significativa de negatividad (según IA)");
    else if (hasToneNeu) findings_tone.push("mayormente neutral (según IA)");
    else findings_tone.push("sin un tono dominante claro detectado por IA");

    // Keywords
    if (hasKwPos && hasKwNeg) findings_kw.push("uso frecuente de palabras tanto positivas/corteses como negativas/conflicto");
    else if (hasKwPos) findings_kw.push("uso frecuente de lenguaje asociado a positividad/cortesía");
    else if (hasKwNeg) findings_kw.push("uso frecuente de lenguaje asociado a negatividad/conflicto");

    if (findings_tone.length === 0 && findings_kw.length === 0) return "";

    text += (findings_tone[0] || "El tono general") + ". ";
    if(findings_kw.length > 0) {
        text += (findings_kw[0].charAt(0).toUpperCase() + findings_kw[0].slice(1)) + ". ";
    }

    // Nota sobre contradicciones
    if ((hasToneVPos || hasToneMPos) && hasKwNeg) text += " (Nota: Se observan palabras de conflicto a pesar del tono general positivo).";
    if ((hasToneVNeg || hasToneMNeg) && hasKwPos) text += " (Nota: Se observan palabras positivas/corteses a pesar del tono general negativo).";

    return text;
 }

 function generateCommunicationFlowProfile(metrics, addedKeys, participants) {
    let text = "<strong>Fluidez y Respuesta:</strong> ";
    let findings = [];
    const hasReciprocal = addedKeys.has('reciprocal');
    const hasDelayedResp = addedKeys.has('delayed_response');
    const hasRespSlow = addedKeys.has('resp_slow');
    const hasRespFast = addedKeys.has('resp_fast');
    const hasImbalResp = addedKeys.has('imbal_resp');

    if (hasReciprocal) findings.push("la comunicación parece bastante recíproca");
    else if (hasDelayedResp) findings.push("se detectaron episodios de ráfagas de mensajes seguidas por respuestas tardías (>2h)");

    if (hasRespFast && !hasRespSlow && !hasImbalResp) findings.push("los tiempos de respuesta tienden a ser rápidos");
    else if (hasRespSlow && !hasRespFast && !hasImbalResp) findings.push("se observan tiempos de respuesta medianos largos");
    else if (hasImbalResp) findings.push("hay diferencia notable en los tiempos de respuesta");
    else if (!hasRespFast && !hasRespSlow && !hasImbalResp) findings.push("los tiempos de respuesta son variables");


    if (findings.length === 0) return "";
    text += findings.join(" y ") + ".";
    text = text.replace(/^\w/, c => c.toUpperCase()); // Capitalizar inicio
    return text;
 }

// --- Función Principal para Mostrar Resultados (v5.5 - Llama a displayAffectionBars) ---
function displayResults(results) {
    console.log("Mostrando resultados..."); const { metrics, analysisFlags, affectionIndex, interpretationData } = results;
    if (!metrics || !analysisFlags || !affectionIndex || !interpretationData) { console.error("displayResults: Faltan datos para mostrar."); updateStatus('Error: Datos de análisis incompletos.', true); resetUI(); return; }
    resetUI();
    try {
        displaySummaryCards(metrics);
        displayParticipationChart(metrics); // Muestra barra horizontal
        displayTimelineChart(metrics);
        displayAffectionBars(metrics, affectionIndex); // *** Llama a la nueva función de barras ***
        displayPatternLists(analysisFlags, interpretationData);
        displayInterpretationSummary(interpretationData);
        const reportContainer = document.getElementById('report-container'); if (reportContainer) { reportContainer.style.display = 'block'; } else { console.error("displayResults: Contenedor 'report-container' no encontrado."); updateStatus('Error: No se puede mostrar el reporte (falta contenedor).', true); return; }
        const imageButton = document.getElementById('image-button'); if (imageButton) { if (typeof html2canvas !== 'undefined') imageButton.disabled = false; else { imageButton.disabled = true; console.warn("Botón descarga deshabilitado (html2canvas no encontrado)."); } }
        console.log("Resultados mostrados en la UI.");
    } catch (error) { console.error("Error durante displayResults:", error); updateStatus(`Error al mostrar resultados: ${error.message}`, true); resetUI(); const reportContainer = document.getElementById('report-container'); if(reportContainer) reportContainer.style.display = 'none'; }
}


// --- Sub-funciones para Mostrar Resultados (Actualizadas v5.5) ---
// *** ACTUALIZADO v5.5: Texto tarjeta unilateral ***
function displaySummaryCards(metrics) {
    const container = document.getElementById('summary-cards-container'); if (!container || !metrics.participants) return; container.innerHTML = '';
    const createCard = (title, value) => { const cardDiv = document.createElement('div'); cardDiv.className = 'stat-card'; const titleSpan = document.createElement('span'); titleSpan.className = 'stat-card-title'; titleSpan.textContent = title; const valueSpan = document.createElement('span'); valueSpan.className = 'stat-card-value'; let displayValue = value; if (Array.isArray(value)) { displayValue = value.join(', '); if (displayValue.length > 50) displayValue = displayValue.substring(0, 47) + '...'; } else if (typeof value === 'number' && value > 1000000) displayValue = value.toLocaleString('es-PE'); else if (value === null || typeof value === 'undefined') displayValue = 'N/A'; valueSpan.textContent = displayValue; cardDiv.append(titleSpan, valueSpan); container.appendChild(cardDiv); };
    createCard('Participantes', metrics.participants); createCard('Msjs Totales', metrics.messageCounts.total || 0);
    let dateRangeString = 'N/D'; if (metrics.dateRange.start && metrics.dateRange.end) { const options = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }; try { const startDate = metrics.dateRange.start.toLocaleDateString('es-PE', options); const endDate = metrics.dateRange.end.toLocaleDateString('es-PE', options); dateRangeString = `${startDate} - ${endDate}`; } catch(e) { console.warn("Error formateando fechas:", e); dateRangeString = `${metrics.dateRange.start.toISOString().split('T')[0]} - ${metrics.dateRange.end.toISOString().split('T')[0]}`; } } createCard('Periodo', dateRangeString);
    metrics.participants.forEach(p => createCard(`Msjs ${p}`, metrics.messageCounts[p] || 0)); metrics.participants.forEach(p => createCard(`Pal/Msj ${p}`, metrics.avgWordsPerMessage[p] || 0));
    metrics.participants.forEach(p => { const respTime = metrics.avgResponseTimes[p]; createCard(`Tpo Resp (med) ${p}`, (respTime?.count > 0) ? `${respTime.averageMinutes} min` : 'N/A'); });
    metrics.participants.forEach(p => createCard(`Inicios ${p}`, metrics.conversationStarters[p] || 0));
    metrics.participants.forEach(p => createCard(`Episodios (>2h delay) ${p}`, metrics.unilateralSegments[p] || 0)); // *** Texto ajustado ***
    console.log("Tarjetas de resumen creadas.");
}

// *** ACTUALIZADO v5.5: Muestra Barra Horizontal Apilada ***
function displayParticipationChart(metrics) {
    const canvas = document.getElementById('participation-chart'); if (!canvas || !metrics.participants?.length || typeof Chart === 'undefined') { console.warn("No se puede crear gráfico de participación: falta canvas, datos o Chart.js."); const container = canvas.closest('.results-block'); if (container) container.style.display = 'none'; return; } const container = canvas.closest('.results-block'); if (container) container.style.display = 'block';
    if (charts.participation) { charts.participation.destroy(); console.log("Gráfico de participación anterior destruido."); }
    try {
        const ctx = canvas.getContext('2d'); const participantData = metrics.participants.map(p => metrics.messageCounts[p] || 0); const totalMessages = participantData.reduce((sum, count) => sum + count, 0); const participantPercentages = participantData.map(count => totalMessages > 0 ? parseFloat(((count / totalMessages) * 100).toFixed(1)) : 0);
        const explicitChartColors = ['#007aff', '#34c759', '#ff9500', '#5ac8fa', '#af52de', '#ff3b30', '#ffcc00', '#8e8e93'];
        charts.participation = new Chart(ctx, { type: 'bar', data: { labels: [' '], datasets: metrics.participants.map((p, index) => ({ label: p, data: [participantPercentages[index]], backgroundColor: explicitChartColors[index % explicitChartColors.length] + 'CC', borderColor: explicitChartColors[index % explicitChartColors.length], borderWidth: 1, })) }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, title: { display: false }, max: 100, min: 0, ticks: { callback: value => `${value}%`, font: { size: 9 }, } }, y: { stacked: true, display: false } }, plugins: { legend: { position: 'bottom', align: 'center', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } }, title: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.x !== null) { const participantName = context.dataset.label; const messageCount = metrics.messageCounts[participantName] || 0; label += `${context.parsed.x.toFixed(1)}% (${messageCount} msjs)`; } return label; } } } } } });
        console.log("Gráfico de participación (barra horizontal) creado.");
    } catch (e) { console.error("Error al crear gráfico de participación:", e); if (container) container.style.display = 'none'; }
}

// (Función displayTimelineChart sin cambios)
function displayTimelineChart(metrics) {
    const canvas = document.getElementById('timeline-chart'); if (!canvas || !metrics.timeSeries?.labels.length || typeof Chart === 'undefined') { console.warn("No se puede crear gráfico de línea de tiempo."); const container = canvas.closest('.results-block'); if (container) container.style.display = 'none'; return; } const container = canvas.closest('.results-block'); if (container) container.style.display = 'block';
    if (charts.timeline) { charts.timeline.destroy(); console.log("Gráfico de línea de tiempo anterior destruido."); }
    try { const ctx = canvas.getContext('2d'); const lineColor = '#34c759'; const fillColor = '#34c75933'; charts.timeline = new Chart(ctx, { type: 'line', data: { labels: metrics.timeSeries.labels, datasets: [{ label: 'Msjs/Día', data: metrics.timeSeries.data, fill: true, borderColor: lineColor, backgroundColor: fillColor, tension: 0.1, pointRadius: 1, pointHoverRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false }, tooltip: { callbacks: { title: function(tooltipItems) { try { const date = new Date(tooltipItems[0].label + 'T00:00:00Z'); return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return tooltipItems[0].label; } }, label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += context.parsed.y; return label; } } } }, scales: { x: { title: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 10, font: { size: 9 }, maxRotation: 0, minRotation: 0 } }, y: { title: { display: false }, beginAtZero: true, ticks: { precision: 0, padding: 5 } } } } }); console.log("Gráfico de línea de tiempo creado.");
    } catch (e) { console.error("Error al crear gráfico de línea de tiempo:", e); if (container) container.style.display = 'none'; }
}

// *** VERSIÓN CON DEBUGGING ***
function displayAffectionBars(metrics, affectionIndex) {
    const container = document.getElementById('affection-bars-container');
    if (!container || !affectionIndex || !metrics.participants?.length) { /* ... (manejo de error sin cambios) ... */ return; }
    container.innerHTML = '';
    metrics.participants.forEach(participant => {
        const indexData = affectionIndex[participant];
        const normalizedScore = indexData?.normalized || 0;
        // *** Usar el valor que ajustaste para el 100% ***
        const maxNorm = AFFECTION_INDEX_MAX_FOR_100_PERCENT; // Leer la constante
        const percentage = Math.max(0, Math.min(100, (normalizedScore / maxNorm) * 100));

        // Log final antes de mostrar
        console.log(`[DEBUG Display Affection] <span class="math-inline">\{participant\}\: NormScore\=</span>{normalizedScore}, MaxNorm=<span class="math-inline">\{maxNorm\}, Percent\=</span>{percentage.toFixed(1)}%`);

        const wrapper = document.createElement('div'); wrapper.className = 'affection-bar-wrapper';
        const label = document.createElement('div'); label.className = 'affection-bar-label'; label.textContent = `${participant}: ${percentage.toFixed(0)}%`;
        const barContainer = document.createElement('div'); barContainer.className = 'affection-bar-container'; barContainer.title = `Índice estimado: ${normalizedScore.toFixed(2)}`;
        const barFill = document.createElement('div'); barFill.className = 'affection-bar-fill'; barFill.style.width = `${percentage}%`;
        barContainer.appendChild(barFill); wrapper.appendChild(label); wrapper.appendChild(barContainer); container.appendChild(wrapper);
    });
    console.log("Indicadores de afecto (barras) creados.");
}

// (Función displayPatternLists sin cambios)
function displayPatternLists(analysisFlags, interpretationData) {
    const positiveList = document.getElementById('positive-patterns-list'); const attentionList = document.getElementById('attention-patterns-list');
    const fillList = (listElement, points, defaultText) => { if (!listElement) { console.warn(`Elemento lista no encontrado para: ${defaultText}`); return; } listElement.innerHTML = ''; if (points && points.length > 0) { points.forEach(text => { const li = document.createElement('li'); li.textContent = text; listElement.appendChild(li); }); } else { const li = document.createElement('li'); li.textContent = defaultText; li.className = 'default-pattern-item'; listElement.appendChild(li); } };
    fillList(positiveList, interpretationData?.positivePoints, "No se destacaron patrones positivos específicos."); fillList(attentionList, interpretationData?.attentionPoints, "No se identificaron patrones específicos para reflexión.");
    console.log("Listas de patrones positivos y de atención pobladas.");
}

// (Función displayInterpretationSummary sin cambios)
function displayInterpretationSummary(interpretationData) {
    const summaryElement = document.getElementById('compatibility-summary'); if (summaryElement && interpretationData?.summary) { summaryElement.innerHTML = interpretationData.summary; } else if (summaryElement) { summaryElement.innerHTML = "<i>No se pudo generar una interpretación general basada en los patrones detectados.</i>"; console.warn("displayInterpretationSummary: No se encontró resumen en interpretationData."); } else { console.error("displayInterpretationSummary: Elemento 'compatibility-summary' no encontrado en el DOM."); }
}

// --- Manejador para Exportar Imagen (Sin cambios) ---
function handleImageExport() {
    const reportContainer = document.getElementById('report-container'); const imageButton = document.getElementById('image-button');
    if (!reportContainer || reportContainer.style.display === 'none') { alert("No hay resultados visibles para exportar."); console.warn("handleImageExport: Intento de exportar sin resultados visibles."); return; } if (typeof html2canvas === 'undefined') { alert("Error: La librería para generar imágenes (html2canvas) no está disponible."); console.error("handleImageExport: html2canvas is missing!"); return; }
    if (imageButton) imageButton.disabled = true; updateStatus('Generando imagen del reporte...'); console.log("handleImageExport: Iniciando html2canvas...");
    const options = { scale: window.devicePixelRatio || 2, useCORS: true, logging: false, backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff', windowWidth: reportContainer.scrollWidth, windowHeight: reportContainer.scrollHeight, scrollX: 0, scrollY: -window.scrollY };
    html2canvas(reportContainer, options) .then(canvas => { console.log("handleImageExport: Canvas generado por html2canvas."); const link = document.createElement('a'); const timestamp = new Date().toISOString().split('T')[0]; link.download = `analisis_chat_${timestamp}.png`; link.href = canvas.toDataURL('image/png'); link.click(); console.log("handleImageExport: Descarga iniciada."); updateStatus('Imagen generada y descarga iniciada.'); }) .catch(err => { console.error("Error durante html2canvas:", err); alert(`Error al generar la imagen: ${err.message}`); updateStatus(`Error al generar imagen: ${err.message}`, true); }) .finally(() => { if (imageButton) imageButton.disabled = false; console.log("handleImageExport: Proceso finalizado."); });
}

// --- Función Helper findLastTimestampNotFrom (No usada activamente en v5.4/v5.5 pero puede dejarse) ---
function findLastTimestampNotFrom(messages, startIndex, authorToExclude) { for (let i = startIndex; i >= 0; i--) { if (messages[i].author !== authorToExclude) return messages[i].timestamp; } return null; }