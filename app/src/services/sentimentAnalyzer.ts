import type {
  ChatMessage,
  CalculatedMetrics,
  AffectionAnalysis,
  AffectionIndexData,
  AnalysisFlags,
  SentimentAIData,
} from '../types';

// --- Constants for Sentiment and Affection Analysis ---
export const AFFECTION_INDEX_MAX_FOR_100_PERCENT = 4;
export const MIN_MESSAGE_LENGTH_FOR_AI = 5;
export const AFFECTION_KEYWORD_WEIGHT = 2.0;
export const POSITIVE_EMOJI_WEIGHT = 0.5;
export const POSITIVE_SENTIMENT_WEIGHT = 1.0;
export const BATCH_SIZE_AI = 25;

const SENTIMENT_MODEL_NAME = 'Xenova/pysentimiento-robertuito-sentiment-analysis';

// --- Keyword Lists ---
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
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  error?: string;
}
export type ModelProgressCallback = (progress: ModelLoadProgress) => void;

export async function loadSentimentModel(onProgress?: ModelProgressCallback): Promise<void> {
  if (sentimentAnalyzer) {
    onProgress?.({ status: 'done', name: SENTIMENT_MODEL_NAME, progress: 100 });
    return;
  }
  if (isLoadingModel) {
    onProgress?.({ status: 'pending', name: SENTIMENT_MODEL_NAME });
    console.warn('[SentimentAnalyzer] Model loading is already in progress.');
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
  console.log('[SentimentAnalyzer] Initializing model load...');

  try {
    const { pipeline, env } = await import('@xenova/transformers');
    if (typeof pipeline !== 'function') throw new Error('Pipeline function not available.');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    onProgress?.({ status: 'loading', name: SENTIMENT_MODEL_NAME, progress: 0 });
    console.log(`[SentimentAnalyzer] Starting to load model: ${SENTIMENT_MODEL_NAME}`);
    sentimentAnalyzer = (await pipeline(
      'sentiment-analysis', SENTIMENT_MODEL_NAME, {
        progress_callback: (progressData: any) => {
          if (onProgress) {
            const currentStatus = progressData.status === 'progress' && progressData.progress
              ? 'quantizing' : progressData.status === 'download' 
              ? 'downloading' : progressData.status === 'done' || progressData.status === 'ready'
              ? 'done' : 'loading';
            onProgress({
              status: currentStatus, name: progressData.name || SENTIMENT_MODEL_NAME,
              file: progressData.file, progress: progressData.progress,
              loaded: progressData.loaded, total: progressData.total,
            });
          }
        },
      }
    )) as SentimentAnalysisPipelineFunc;
    if (!sentimentAnalyzer) throw new Error(`Failed to initialize pipeline.`);
    console.log('[SentimentAnalyzer] Model loaded successfully.');
    onProgress?.({ status: 'done', name: SENTIMENT_MODEL_NAME, progress: 100 });
  } catch (error) {
    sentimentAnalyzer = null;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SentimentAnalyzer] Error loading sentiment model:', errorMessage);
    onProgress?.({ status: 'error', error: errorMessage, name: SENTIMENT_MODEL_NAME });
    throw new Error(`Failed to load sentiment model: ${errorMessage}`);
  } finally {
    isLoadingModel = false;
  }
}

// --- Helper Functions ---
interface InitialAffectionCalculationResult {
  messagesToAnalyzeForAI: ChatMessage[];
  affectionKeywordCountsPerAuthor: Record<string, number>;
}

function calculateInitialAffectionAndSelectAIMessages(
  messages: ChatMessage[],
  participants: string[],
  affectionIndex: AffectionAnalysis
): InitialAffectionCalculationResult {
  const messagesToAnalyzeForAI: ChatMessage[] = [];
  const affectionKeywordCountsPerAuthor: Record<string, number> = {};
  participants.forEach(p => {
    affectionKeywordCountsPerAuthor[p] = 0;
    if (!affectionIndex[p]) {
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
      const keywordRegex = (keyword.length <= 3 || !keyword.match(/[a-z0-9]/i) )
        ? new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (keywordRegex.test(lowerContent)) {
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
  messagesToAnalyze: ChatMessage[],
  analyzer: SentimentAnalysisPipelineFunc,
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
        const originalMessage = batch[index];
        // Create an object that conforms to SentimentAIData
        const sentimentDataPoint: SentimentAIData = {
          author: originalMessage.author,
          label: result.label as 'POS' | 'NEG' | 'NEU', // Ensure label is one of the expected
          confidence: result.score,
        };
        results.push(sentimentDataPoint);
      });
    } catch (error) {
        console.error(`[SentimentAnalyzer] AI: Error processing batch ${i / BATCH_SIZE_AI + 1}`, error);
    }
    const processedCount = Math.min(i + batch.length, totalToProcess);
    onProgress?.(processedCount, totalToProcess);
    if (batch.length === BATCH_SIZE_AI) {
        await new Promise(r => setTimeout(r, 5)); // Small delay between batches
    }
  }
  return results;
}

function finalizeAffectionIndex(
  affectionIndex: AffectionAnalysis,
  metrics: CalculatedMetrics
): void {
  metrics.global.participants.forEach(author => {
    const indexData = affectionIndex[author];
    if (indexData) {
      indexData.score += (indexData.positiveLabelCount || 0) * POSITIVE_SENTIMENT_WEIGHT;
      const totalMessagesByAuthor = metrics.participants[author]?.messageCount || 0;
      if (totalMessagesByAuthor > 0) {
        const normalizedScore = (indexData.score / totalMessagesByAuthor) * 10;
        indexData.normalized = parseFloat(Math.min(normalizedScore, 15).toFixed(2));
      } else {
        indexData.normalized = 0;
      }
    }
  });
}

function generateSentimentFlags(
    wasAIAnalysisPerformed: boolean,
    aiResultsCount: number,
    allSentimentLabels: Array<'POS' | 'NEG' | 'NEU'>,
    sentimentCountsByUser: Record<string, { POS: number; NEG: number; NEU: number }>,
    metrics: CalculatedMetrics,
    affectionIndex: AffectionAnalysis,
    flagsRef: AnalysisFlags
) {
    if (!wasAIAnalysisPerformed || aiResultsCount <= 10) {
      return;
    }
    const totalAnalyzedIA = allSentimentLabels.length;
    const overallSentimentCounts = { POS: 0, NEG: 0, NEU: 0 };
    allSentimentLabels.forEach(label => overallSentimentCounts[label]++);
    const positivePercent = (overallSentimentCounts.POS / totalAnalyzedIA) * 100;
    const negativePercent = (overallSentimentCounts.NEG / totalAnalyzedIA) * 100;
    const neutralPercent = 100 - positivePercent - negativePercent;

    if (positivePercent > 60) flagsRef.positive.push(`Overall tone (AI): Predominantly positive (~${Math.round(positivePercent)}% Pos vs ~${Math.round(negativePercent)}% Neg), a favorable sign.`);
    else if (positivePercent > negativePercent && positivePercent > 40) flagsRef.positive.push(`Overall tone (AI): Mostly positive (~${Math.round(positivePercent)}% Pos vs ~${Math.round(negativePercent)}% Neg).`);
    else if (negativePercent > positivePercent && negativePercent > 40) flagsRef.attention.push(`Overall tone (AI): Notable negative presence (~${Math.round(negativePercent)}% Neg vs ~${Math.round(positivePercent)}% Pos), suggests reflection.`);
    else if (negativePercent > 25) flagsRef.attention.push(`Overall tone (AI): Significant presence of negativity (~${Math.round(negativePercent)}% Neg vs ~${Math.round(positivePercent)}% Pos).`);
    else if (neutralPercent > 50 && positivePercent >= 10) flagsRef.positive.push(`Overall tone (AI): Mostly neutral (~${Math.round(neutralPercent)}% Neu) with some positive notes.`);
    else if (neutralPercent > 60) flagsRef.positive.push(`Overall tone (AI): Mostly neutral (~${Math.round(neutralPercent)}% Neu).`);

    if (metrics.global.participants.length === 2) {
        const [p1, p2] = metrics.global.participants;
        const analyzedP1 = affectionIndex[p1]?.analyzedCountIA || 0;
        const analyzedP2 = affectionIndex[p2]?.analyzedCountIA || 0;
        if (analyzedP1 > 5 && analyzedP2 > 5) {
            const negP1 = analyzedP1 > 0 ? ((sentimentCountsByUser[p1]?.NEG || 0) / analyzedP1) * 100 : 0;
            const negP2 = analyzedP2 > 0 ? ((sentimentCountsByUser[p2]?.NEG || 0) / analyzedP2) * 100 : 0;
            const posP1 = analyzedP1 > 0 ? ((sentimentCountsByUser[p1]?.POS || 0) / analyzedP1) * 100 : 0;
            const posP2 = analyzedP2 > 0 ? ((sentimentCountsByUser[p2]?.POS || 0) / analyzedP2) * 100 : 0;
            const negDiffThr = 1.8, minNegFlag = 15;
            if (negP1 > negP2 * negDiffThr && negP1 > minNegFlag) flagsRef.attention.push(`${p1} tends to more negativity (AI) than ${p2} (~${Math.round(negP1)}% vs ~${Math.round(negP2)}%).`);
            else if (negP2 > negP1 * negDiffThr && negP2 > minNegFlag) flagsRef.attention.push(`${p2} tends to more negativity (AI) than ${p1} (~${Math.round(negP2)}% vs ~${Math.round(negP1)}%).`);
            const posDiffThr = 1.5, minPosFlag = 30;
            if (!flagsRef.attention.some(f => f.includes('tends to more negativity'))) {
                if (posP1 > posP2 * posDiffThr && posP1 > minPosFlag) flagsRef.positive.push(`${p1} tends to more positivity (AI) than ${p2} (~${Math.round(posP1)}% vs ~${Math.round(posP2)}%).`);
                else if (posP2 > posP1 * posDiffThr && posP2 > minPosFlag) flagsRef.positive.push(`${p2} tends to more positivity (AI) than ${p1} (~${Math.round(posP2)}% vs ~${Math.round(posP1)}%).`);
            }
        }
    }
}

function generateKeywordFlags(
    totalMessagesInChat: number,
    affectionKeywordCountsPerAuthor: Record<string, number>,
    allChatMessages: ChatMessage[],
    flagsRef: AnalysisFlags
) {
    let greenKeywordOverallCount = 0;
    let redKeywordOverallCount = 0;
    const totalAffectionKeywordsOverall = Object.values(affectionKeywordCountsPerAuthor).reduce((sum, count) => sum + count, 0);
    allChatMessages.forEach(msg => {
        const lowerContent = msg.content.toLowerCase();
        greenKeywords.forEach(k => { if (!affectionKeywords.includes(k) && lowerContent.includes(k)) greenKeywordOverallCount++; });
        redKeywords.forEach(k => { if (lowerContent.includes(k)) redKeywordOverallCount++; });
    });
    const keywordThreshold = Math.max(5, Math.round(totalMessagesInChat * 0.01));
    if (greenKeywordOverallCount > keywordThreshold) flagsRef.positive.push(`Frequent use (${greenKeywordOverallCount} instances) of words/emojis for general positivity or politeness.`);
    if (redKeywordOverallCount > keywordThreshold) flagsRef.attention.push(`Frequent use (${redKeywordOverallCount} instances) of words/emojis for negativity or conflict.`);
    if (totalAffectionKeywordsOverall > keywordThreshold && !flagsRef.positive.some(f => f.includes("explicit affection"))) {
        flagsRef.positive.push(`Frequent use (${totalAffectionKeywordsOverall} instances) of words/emojis for explicit affection.`);
    }
}

// --- Main Orchestrator Function ---
export async function analyzeChatSentimentAndAffection(
  messages: ChatMessage[],
  metrics: CalculatedMetrics,
  analysisFlagsRef: AnalysisFlags,
  onProgress?: ModelProgressCallback,
  onAIAnalysisProgress?: (processed: number, total: number) => void
): Promise<AffectionAnalysis> {
  // console.log('[SentimentAnalyzer] Starting full sentiment and affection analysis...');
  if (!messages.length || !metrics.global.participants.length) {
    console.warn('[SentimentAnalyzer] No messages or participants to analyze.');
    return {};
  }

  if (!sentimentAnalyzer) {
    try { await loadSentimentModel(onProgress); } 
    catch (error) {
      console.error('[SentimentAnalyzer] Model loading failed. Proceeding without AI features.', error);
      analysisFlagsRef.attention.push("AI sentiment analysis could not be performed: model loading error.");
    }
  }

  const affectionIndex: AffectionAnalysis = {};
  metrics.global.participants.forEach(p => {
    affectionIndex[p] = {
        score: 0, analyzedCountIA: 0, keywordCount: 0,
        positiveLabelCount: 0, normalized: 0
    } as AffectionIndexData; // Explicit cast to ensure AffectionIndexData type is "used"
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
      analysisFlagsRef.attention.push("AI sentiment analysis skipped: AI model not loaded.");
    }
  }

  generateSentimentFlags(aiSentimentResults.length > 0, aiSentimentResults.length, allAISentimentLabels, sentimentCountsByUser, metrics, affectionIndex, analysisFlagsRef);
  finalizeAffectionIndex(affectionIndex, metrics);
  generateKeywordFlags(messages.length, affectionKeywordCountsPerAuthor, messages, analysisFlagsRef);

  // console.log('[SentimentAnalyzer] Full sentiment and affection analysis process complete.');
  return affectionIndex;
}