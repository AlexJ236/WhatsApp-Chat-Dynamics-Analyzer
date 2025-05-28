import type {
  ChatMessage,
  CalculatedMetrics,
  AffectionAnalysis,
  AffectionIndexData, // Used for type assertion and within AffectionAnalysis
  AnalysisFlags,
  SentimentAIData,    // Used as return type and for internal objects
} from '../types';

// --- Constants for Sentiment and Affection Analysis ---
export const AFFECTION_INDEX_MAX_FOR_100_PERCENT = 4; // Max normalized score for 100% UI display
export const MIN_MESSAGE_LENGTH_FOR_AI = 5;
export const AFFECTION_KEYWORD_WEIGHT = 2.0;
export const POSITIVE_EMOJI_WEIGHT = 0.5;
export const POSITIVE_SENTIMENT_WEIGHT = 1.0;
export const BATCH_SIZE_AI = 25;

const SENTIMENT_MODEL_NAME = 'Xenova/pysentimiento-robertuito-sentiment-analysis';

// --- Keyword Lists (for internal logic, should match language of chats being analyzed) ---
export const affectionKeywords: string[] = [
  'te quiero', 'tq', 'tk', 'te amo', 'mi amor', 'amor mío', 'cariño', 'cielo', 
  'corazón', 'mi vida', 'precioso', 'preciosa', 'guapo', 'guapa', 'hermoso', 
  'hermosa', 'te adoro', 'te extraño', 'mucho', 'besos', 'abrazos', 
  '❤️', '😍', '😘', '🥰', '💕', '💖', '💗', '💓', '💞', ' L ',
];

export const positiveEmojis: string[] = [
  '😊', '😂', '🤣', '👍', '🎉', '🙏', '✨', '😄', '😁', '😀', '😉', '🥳', '😌', '👌',
];

export const greenKeywords: string[] = [ 
  'gracias', 'por favor', 'de nada', 'disculpa', 'perdón', 'lo siento', 
  'te quiero', 'tq', 'te amo', 'genial', 'excelente', 'buena idea', 
  'felicidades', 'ánimo', 'apoyo', 'cuenta conmigo', 'entiendo', 'comprendo', 
  '❤️', '😊', '👍', '🙏', '🎉', 'jajaja', 'jejeje', 'jiji', '😂', '🤣', '😍',
];

export const redKeywords: string[] = [ 
  'nunca', 'jamas', 'siempre haces', 'tu culpa', 'culpa tuya', 'odio', 
  'detesto', 'estúpido', 'imbécil', 'idiota', 'jódete', 'mierda', 'carajo', 
  'problema', 'discutir', 'pelear', 'harto', 'harta', 'molesto', 'molesta', 
  'cállate', 'dejame en paz', 'no me importa', '😠', '😡', '👎', '🤬', '😤', '😒', '💔',
];

// --- Model Loading State and Instance ---
type SentimentAnalysisPipelineFunc = (
  texts: string | string[],
  options?: { topk?: number }
) => Promise<Array<{ label: string; score: number }>>;

let sentimentAnalyzer: SentimentAnalysisPipelineFunc | null = null;
let isLoadingModel = false;

export interface ModelLoadProgress {
  status: 'initializing' | 'downloading' | 'quantizing' | 'loading' | 'done' | 'error' | 'pending';
  name?: string; file?: string; progress?: number; loaded?: number; total?: number; error?: string;
}
export type ModelProgressCallback = (progress: ModelLoadProgress) => void;

/**
 * Loads the sentiment analysis model.
 * @param onProgress Callback to report loading progress.
 */
export async function loadSentimentModel(onProgress?: ModelProgressCallback): Promise<void> {
  if (sentimentAnalyzer) {
    onProgress?.({ status: 'done', name: SENTIMENT_MODEL_NAME, progress: 100 });
    return;
  }
  if (isLoadingModel) {
    onProgress?.({ status: 'pending', name: SENTIMENT_MODEL_NAME });
    // console.warn('[SentimentAnalyzer] Model loading is already in progress.');
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            if (!isLoadingModel) {
                clearInterval(checkInterval);
                if (sentimentAnalyzer) {
                    onProgress?.({ status: 'done', name: SENTIMENT_MODEL_NAME, progress: 100 });
                    resolve();
                } else {
                    const errMessage = 'Previous model loading attempt finished but model is still not available.';
                    onProgress?.({ status: 'error', error: errMessage, name: SENTIMENT_MODEL_NAME });
                    reject(new Error(errMessage));
                }
            }
        }, 300);
    });
  }

  isLoadingModel = true;
  onProgress?.({ status: 'initializing', name: SENTIMENT_MODEL_NAME });
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    if (typeof pipeline !== 'function') throw new Error('Pipeline function not available.');
    env.allowLocalModels = false; env.useBrowserCache = true;
    onProgress?.({ status: 'loading', name: SENTIMENT_MODEL_NAME, progress: 0 });
    sentimentAnalyzer = (await pipeline('sentiment-analysis', SENTIMENT_MODEL_NAME, {
      progress_callback: (pData: any) => onProgress?.({
        status: pData.status === 'progress' && pData.progress ? 'quantizing' : pData.status === 'download' ? 'downloading' : pData.status === 'done' || pData.status === 'ready' ? 'done' : 'loading',
        name: pData.name || SENTIMENT_MODEL_NAME, file: pData.file, progress: pData.progress, loaded: pData.loaded, total: pData.total,
      }),
    })) as SentimentAnalysisPipelineFunc;
    if (!sentimentAnalyzer) throw new Error('Failed to initialize pipeline.');
    onProgress?.({ status: 'done', name: SENTIMENT_MODEL_NAME, progress: 100 });
  } catch (error) {
    sentimentAnalyzer = null;
    const errMsg = error instanceof Error ? error.message : String(error);
    onProgress?.({ status: 'error', error: errMsg, name: SENTIMENT_MODEL_NAME });
    throw new Error(`Failed to load sentiment model: ${errMsg}`);
  } finally { isLoadingModel = false; }
}

// --- Analysis Helper Functions ---
interface InitialAffectionCalculationResult {
  messagesToAnalyzeForAI: ChatMessage[];
  affectionKeywordCountsPerAuthor: Record<string, number>;
}

function calculateInitialAffectionAndSelectAIMessages(
  messages: ChatMessage[], participants: string[], affectionIndex: AffectionAnalysis
): InitialAffectionCalculationResult {
  const messagesToAnalyzeForAI: ChatMessage[] = [];
  const affectionKeywordCountsPerAuthor: Record<string, number> = {};
  participants.forEach(p => {
    affectionKeywordCountsPerAuthor[p] = 0;
    if (!affectionIndex[p]) { // Should be pre-initialized by caller
      affectionIndex[p] = { score: 0, analyzedCountIA: 0, keywordCount: 0, positiveLabelCount: 0, normalized: 0 } as AffectionIndexData;
    }
  });

  messages.forEach((msg) => {
    if (!msg.author || !msg.content || !affectionIndex[msg.author]) return;
    const author = msg.author;
    const lowerContent = msg.content.toLowerCase();
    let currentMsgAffectionScore = 0;
    let currentMsgKeywordCount = 0;

    affectionKeywords.forEach(keyword => {
      const kRegex = (keyword.length <= 3 || !keyword.match(/[a-z0-9]/i)) 
        ? new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') 
        : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (kRegex.test(lowerContent)) {
        currentMsgAffectionScore += AFFECTION_KEYWORD_WEIGHT;
        currentMsgKeywordCount++;
      }
    });
    positiveEmojis.forEach(emoji => {
      if (msg.content.includes(emoji) && !affectionKeywords.some(ak => ak.trim() === emoji.trim())) {
        currentMsgAffectionScore += POSITIVE_EMOJI_WEIGHT;
      }
    });

    affectionIndex[author].score += currentMsgAffectionScore;
    affectionIndex[author].keywordCount += currentMsgKeywordCount;
    if (currentMsgKeywordCount > 0) {
      affectionKeywordCountsPerAuthor[author] = (affectionKeywordCountsPerAuthor[author] || 0) + currentMsgKeywordCount;
    }

    const trimmedContent = msg.content.trim();
    const isMedia = trimmedContent.startsWith('<Media omitted>') || trimmedContent.startsWith('<Multimedia omitido>') ||
                    trimmedContent.includes(' omitido') || trimmedContent.includes(' omitted>');
    if (trimmedContent.length >= MIN_MESSAGE_LENGTH_FOR_AI && !isMedia) {
      messagesToAnalyzeForAI.push(msg);
    }
  });
  return { messagesToAnalyzeForAI, affectionKeywordCountsPerAuthor };
}

async function performSentimentAnalysisAI(
  messagesToAnalyze: ChatMessage[], analyzer: SentimentAnalysisPipelineFunc, 
  onProgress?: (processed: number, total: number) => void
): Promise<SentimentAIData[]> {
  const results: SentimentAIData[] = [];
  const totalToProcess = messagesToAnalyze.length;
  for (let i = 0; i < totalToProcess; i += BATCH_SIZE_AI) {
    const batch = messagesToAnalyze.slice(i, i + BATCH_SIZE_AI);
    if (batch.length === 0) continue;
    const contents = batch.map(m => m.content);
    try {
      const batchResults = await analyzer(contents);
      batchResults.forEach((result, index) => {
        const sentimentDataPoint: SentimentAIData = { // Explicitly typing for clarity
          author: batch[index].author,
          label: result.label as 'POS' | 'NEG' | 'NEU',
          confidence: result.score,
        };
        results.push(sentimentDataPoint);
      });
    } catch (error) { console.error(`[SentimentAnalyzer] AI Error processing batch`, error); }
    onProgress?.(Math.min(i + batch.length, totalToProcess), totalToProcess);
    if (batch.length === BATCH_SIZE_AI) await new Promise(r => setTimeout(r, 5));
  }
  return results;
}

function finalizeAffectionIndex(affectionIndex: AffectionAnalysis, metrics: CalculatedMetrics): void {
  metrics.global.participants.forEach(author => {
    const idxData = affectionIndex[author];
    if (idxData) {
      idxData.score += (idxData.positiveLabelCount || 0) * POSITIVE_SENTIMENT_WEIGHT;
      const msgCount = metrics.participants[author]?.messageCount || 0;
      idxData.normalized = msgCount > 0 ? parseFloat(Math.min((idxData.score / msgCount) * 10, 15).toFixed(2)) : 0;
    }
  });
}

// --- Flag Generation Functions (User-facing text in Spanish) ---

function generateSentimentFlags(
  wasAIPerformed: boolean, aiResultsCount: number, allAISentimentLabels: Array<'POS' | 'NEG' | 'NEU'>,
  sentimentCountsByUser: Record<string, { POS: number; NEG: number; NEU: number }>,
  metrics: CalculatedMetrics, affectionIndex: AffectionAnalysis, flagsRef: AnalysisFlags
) {
  if (!wasAIPerformed || aiResultsCount <= 10) {
    if (wasAIPerformed && aiResultsCount > 0) { 
        // This message could be a "neutral" observation or a point for reflection if desired.
        // flagsRef.positive.push(`El análisis de IA del tono se basó en pocos mensajes (${aiResultsCount}), por lo que la percepción general podría ser limitada.`);
    }
    return;
  }
  const totalAnalyzed = allAISentimentLabels.length;
  const overallCounts = { POS: 0, NEG: 0, NEU: 0 };
  allAISentimentLabels.forEach(label => overallCounts[label]++);
  const posPercent = (overallCounts.POS / totalAnalyzed) * 100;
  const negPercent = (overallCounts.NEG / totalAnalyzed) * 100;

  if (posPercent > 60) flagsRef.positive.push(`El tono general de la conversación, según la IA, tiende a ser predominantemente positivo (aprox. ${Math.round(posPercent)}% mensajes positivos).`);
  else if (posPercent > negPercent && posPercent > 40) flagsRef.positive.push(`En general, la IA percibe un tono mayormente positivo en los mensajes (aprox. ${Math.round(posPercent)}% positivos vs. ${Math.round(negPercent)}% negativos).`);
  else if (negPercent > posPercent && negPercent > 40) flagsRef.attention.push(`La IA detecta una notable presencia de mensajes con tono negativo (aprox. ${Math.round(negPercent)}% negativos vs. ${Math.round(posPercent)}% positivos), lo cual podría ser un punto para reflexionar.`);
  else if (negPercent > 25) flagsRef.attention.push(`Se observa una presencia significativa de mensajes con tono negativo según la IA (aprox. ${Math.round(negPercent)}%).`);
  else flagsRef.positive.push(`El tono general de la conversación, según la IA, parece ser mixto o mayormente neutral.`);

  if (metrics.global.participants.length === 2) {
    const [p1, p2] = metrics.global.participants;
    const analyzedP1 = affectionIndex[p1]?.analyzedCountIA || 0;
    const analyzedP2 = affectionIndex[p2]?.analyzedCountIA || 0;
    if (analyzedP1 > 5 && analyzedP2 > 5) {
      const negP1 = analyzedP1 > 0 ? ((sentimentCountsByUser[p1]?.NEG || 0) / analyzedP1) * 100 : 0;
      const negP2 = analyzedP2 > 0 ? ((sentimentCountsByUser[p2]?.NEG || 0) / analyzedP2) * 100 : 0;
      if (Math.abs(negP1 - negP2) > 20 && (negP1 > 15 || negP2 > 15)) {
        const moreNegP = negP1 > negP2 ? p1 : p2;
        const lessNegP = negP1 > negP2 ? p2 : p1;
        flagsRef.attention.push(`La IA sugiere que ${moreNegP} tiende a usar un tono negativo con más frecuencia (aprox. ${Math.round(Math.max(negP1,negP2))}%) que ${lessNegP} (aprox. ${Math.round(Math.min(negP1,negP2))}%) en los mensajes analizados.`);
      }
    }
  }
}

function generateKeywordFlags(
  totalMessagesInChat: number, affectionKeywordCountsPerAuthor: Record<string, number>,
  allChatMessages: ChatMessage[], flagsRef: AnalysisFlags
) {
  let generalPositiveKwCount = 0;
  let generalNegativeKwCount = 0;
  const totalAffectionKeywordsOverall = Object.values(affectionKeywordCountsPerAuthor).reduce((s, c) => s + c, 0);

  allChatMessages.forEach(msg => {
    const lc = msg.content.toLowerCase();
    greenKeywords.forEach(k => { if (!affectionKeywords.includes(k) && lc.includes(k)) generalPositiveKwCount++; });
    redKeywords.forEach(k => { if (lc.includes(k)) generalNegativeKwCount++; });
  });
  
  const threshold = Math.max(5, Math.round(totalMessagesInChat * 0.015));

  if (generalPositiveKwCount > threshold) {
    flagsRef.positive.push(`Se aprecia un uso recurrente (${generalPositiveKwCount} veces) de palabras o emojis que denotan cortesía o un ambiente positivo en general.`);
  }
  if (generalNegativeKwCount > threshold) {
    flagsRef.attention.push(`Se observa un uso notable (${generalNegativeKwCount} veces) de expresiones que podrían indicar negatividad, conflicto o tensión.`);
  }
  if (totalAffectionKeywordsOverall > threshold) {
    flagsRef.positive.push(`Hay expresiones frecuentes (${totalAffectionKeywordsOverall} veces) de afecto explícito en la conversación.`);
  }
}

// --- Main Orchestrator Function ---
export async function analyzeChatSentimentAndAffection(
  messages: ChatMessage[], metrics: CalculatedMetrics, analysisFlagsRef: AnalysisFlags,
  onProgress?: ModelProgressCallback, onAIAnalysisProgress?: (processed: number, total: number) => void
): Promise<AffectionAnalysis> {
  if (!messages.length || !metrics.global.participants.length) return {};

  if (!sentimentAnalyzer) {
    try { 
      await loadSentimentModel(onProgress); 
    } catch (error) {
      // Error is caught by App.tsx and updates appStatusMessage.
      // No flag pushed here for model loading errors.
      console.error('[SentimentAnalyzer] Model loading failed during main analysis. AI features will be skipped.', error);
    }
  }

  const affectionIndex: AffectionAnalysis = {};
  metrics.global.participants.forEach(p => {
    affectionIndex[p] = { score: 0, analyzedCountIA: 0, keywordCount: 0, positiveLabelCount: 0, normalized: 0 } as AffectionIndexData;
  });

  const { messagesToAnalyzeForAI, affectionKeywordCountsPerAuthor } =
    calculateInitialAffectionAndSelectAIMessages(messages, metrics.global.participants, affectionIndex);
  
  let aiSentimentResults: SentimentAIData[] = [];
  const sentimentCountsByUser: Record<string, { POS: number; NEG: number; NEU: number }> = {};
  metrics.global.participants.forEach(p => { sentimentCountsByUser[p] = { POS: 0, NEG: 0, NEU: 0 }; });
  let allAISentimentLabels: Array<'POS' | 'NEG' | 'NEU'> = [];

  if (messagesToAnalyzeForAI.length > 0 && sentimentAnalyzer) {
    aiSentimentResults = await performSentimentAnalysisAI(messagesToAnalyzeForAI, sentimentAnalyzer, onAIAnalysisProgress);
    aiSentimentResults.forEach(result => {
      if (affectionIndex[result.author]) {
        affectionIndex[result.author].analyzedCountIA++;
        if (result.label === 'POS') affectionIndex[result.author].positiveLabelCount++;
        if (sentimentCountsByUser[result.author]) sentimentCountsByUser[result.author][result.label]++;
        allAISentimentLabels.push(result.label);
      }
    });
  } else {
    if (messagesToAnalyzeForAI.length > 0 && !sentimentAnalyzer) {
      // AI was applicable but model wasn't ready. App.tsx's status message handles this.
      // No flag pushed here for AI skipped due to no model.
      console.warn('[SentimentAnalyzer] Messages were eligible for AI, but the sentiment model is not loaded.');
    }
  }

  generateSentimentFlags(aiSentimentResults.length > 0, aiSentimentResults.length, allAISentimentLabels, sentimentCountsByUser, metrics, affectionIndex, analysisFlagsRef);
  finalizeAffectionIndex(affectionIndex, metrics);
  generateKeywordFlags(messages.length, affectionKeywordCountsPerAuthor, messages, analysisFlagsRef);

  return affectionIndex;
}