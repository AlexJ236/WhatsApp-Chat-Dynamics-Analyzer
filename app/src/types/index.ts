/**
 * Represents a single parsed chat message from the user.
 */
export interface ChatMessage {
  line?: number; // Original line number, optional
  author: string;
  content: string;
  timestamp: Date;
}

/**
 * Statistics related to the chat parsing process.
 */
export interface ParseStats {
  totalLines: number;
  validMessages: number;
  failedLines: number;
}

/**
 * Represents the output of the chat parsing service.
 */
export interface ParsedChatData {
  messages: ChatMessage[];
  parseStats: ParseStats;
}

/**
 * A map of emojis to their counts for a participant.
 * e.g., { '😊': 10, '😂': 5 }
 */
export type EmojiCountMap = Record<string, number>;

/**
 * Data for average response time of a participant.
 */
export interface ParticipantAvgResponseTime {
  count: number;
  averageMinutes: number;
}

export interface ParticipantMetricsData {
  messageCount: number;
  wordCount: number;
  avgWordsPerMessage: number;
  conversationStarters: number;
  avgResponseTime: ParticipantAvgResponseTime;
  unilateralSegments: number;
  emojiCounts: EmojiCountMap;
}

/**
 * Defines a date range with start and end Date objects.
 */
export interface DateRange {
  start: Date | null;
  end: Date | null;
}

/**
 * Data for the timeline chart (activity per day).
 */
export interface TimeSeriesData {
  labels: string[]; // Dates as strings (e.g., "YYYY-MM-DD")
  data: number[];   // Message counts for corresponding labels
}

/**
 * Overall metrics calculated for the entire chat.
 */
export interface GlobalMetricsData {
  participants: string[];
  totalMessageCount: number;
  dateRange: DateRange;
  timeSeries: TimeSeriesData;
  mediaMessagesCount: number;
}

/**
 * Structure to hold all calculated metrics.
 * Participant-specific metrics are keyed by participant name.
 */
export interface CalculatedMetrics {
  global: GlobalMetricsData;
  participants: Record<string, ParticipantMetricsData>; // Keyed by participant name
}

/**
 * Data for the affection index of a participant.
 */
export interface AffectionIndexData {
  score: number;             // Raw score from keywords and AI
  analyzedCountIA: number;   // Number of messages analyzed by AI for this user
  keywordCount: number;      // Number of affection keywords found for this user
  positiveLabelCount: number;// Number of messages labeled as POSITIVE by AI for this user
  normalized: number;        // Normalized score (0-15, or as per your scale)
}

/**
 * Affection analysis results, keyed by participant name.
 */
export type AffectionAnalysis = Record<string, AffectionIndexData>;

/**
 * Represents the output of sentiment analysis for a single message by the AI.
 */
export interface SentimentAIData {
  author: string;
  label: 'POS' | 'NEG' | 'NEU'; // Sentiment label (Positive, Negative, Neutral)
  confidence: number;           // Confidence score from the model
}

/**
 * Lists of observed communication patterns.
 */
export interface AnalysisFlags {
  positive: string[]; // Positive patterns observed
  attention: string[]; // Patterns for reflection or attention
}

/**
 * Detailed interpretation generated from the analysis.
 */
export interface InterpretationDetails {
  positivePoints: string[];
  attentionPoints: string[];
  summary: string; // Textual summary of the interpretation
}

/**
 * Represents the complete result of a chat analysis.
 */
export interface FullAnalysisResult {
  parsedChatData: ParsedChatData;
  calculatedMetrics: CalculatedMetrics;
  affectionAnalysis: AffectionAnalysis;
  analysisFlags: AnalysisFlags; // This might be generated alongside interpretation
  interpretationDetails: InterpretationDetails;
}