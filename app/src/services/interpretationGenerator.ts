import type {
  CalculatedMetrics,
  AffectionAnalysis,
  AnalysisFlags,
  InterpretationDetails,
} from '../types';

// --- Constants for Metric Flags ---
const METRIC_FLAGS_PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT = 25;
const METRIC_FLAGS_LENGTH_IMBALANCE_RATIO = 1.8;
const METRIC_FLAGS_STARTER_IMBALANCE_THRESHOLD_PERCENT = 15;
const METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN = 90;
const METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN = 10;
const METRIC_FLAGS_UNILATERAL_THRESHOLD_MESSAGES = 3;
const METRIC_FLAGS_UNILATERAL_RESPONSE_DELAY_HOURS = 2;

/**
 * Generates flags based on quantitative metrics.
 * Mutates the provided analysisFlagsRef object.
 */
export function generateMetricBasedFlags(
  metrics: CalculatedMetrics,
  flagsRef: AnalysisFlags
): void {
  const participants = metrics.global.participants;
  if (!participants || participants.length === 0) return;

  if (participants.length === 2) {
    const [p1, p2] = participants;
    const totalMsgs = metrics.global.totalMessageCount;
    const countP1 = metrics.participants[p1]?.messageCount || 0;
    const countP2 = metrics.participants[p2]?.messageCount || 0;

    if (totalMsgs > 0) {
      const percentP1 = (countP1 / totalMsgs) * 100;
      const percentP2 = (countP2 / totalMsgs) * 100; // Use countP2 for percentP2
      const participationDiff = Math.abs(percentP1 - 50);

      if (participationDiff > METRIC_FLAGS_PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT) {
        flagsRef.attention.push(
          `Message participation very unequal: ${p1} (${Math.round(percentP1)}%) vs ${p2} (${Math.round(percentP2)}%) ` +
          `differs more than ${METRIC_FLAGS_PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT}% from 50/50.`
        );
      } else if (participationDiff > 10) {
        flagsRef.attention.push(
          `Message participation moderately unequal (${p1}: ${Math.round(percentP1)}%, ${p2}: ${Math.round(percentP2)}%).`
        );
      } else {
        flagsRef.positive.push(
          `Message participation relatively balanced (${p1}: ${Math.round(percentP1)}%, ${p2}: ${Math.round(percentP2)}%).`
        );
      }
    }

    const avgWp1 = metrics.participants[p1]?.avgWordsPerMessage || 0;
    const avgWp2 = metrics.participants[p2]?.avgWordsPerMessage || 0;
    if (avgWp1 > 0 && avgWp2 > 0) {
      const ratio = Math.max(avgWp1 / avgWp2, avgWp2 / avgWp1);
      if (ratio > METRIC_FLAGS_LENGTH_IMBALANCE_RATIO) {
        const longerAuthor = avgWp1 > avgWp2 ? p1 : p2;
        const shorterAuthor = avgWp1 > avgWp2 ? p2 : p1;
        const longerAvg = Math.max(avgWp1, avgWp2);
        const shorterAvg = Math.min(avgWp1, avgWp2);
        flagsRef.attention.push(
          `Avg. message length unequal: ${longerAuthor} (${longerAvg.toFixed(1)} words) vs ${shorterAuthor} (${shorterAvg.toFixed(1)} words), ` +
          `ratio > ${METRIC_FLAGS_LENGTH_IMBALANCE_RATIO.toFixed(1)}.`
        );
      } else {
        flagsRef.positive.push(
          `Avg. message length similar between ${p1} (${avgWp1.toFixed(1)} words) and ${p2} (${avgWp2.toFixed(1)} words).`
        );
      }
    }

    const startsP1 = metrics.participants[p1]?.conversationStarters || 0;
    const startsP2 = metrics.participants[p2]?.conversationStarters || 0;
    const totalStarts = startsP1 + startsP2;
    if (totalStarts > 5) {
      const startPercentP1 = totalStarts > 0 ? (startsP1 / totalStarts) * 100 : 0;
      const startDiff = Math.abs(startPercentP1 - 50);
      if (startDiff > METRIC_FLAGS_STARTER_IMBALANCE_THRESHOLD_PERCENT) {
        const initiator = startPercentP1 > 50 ? p1 : p2;
        const other = startPercentP1 > 50 ? p2 : p1;
        const higherPercent = Math.round(Math.max(startPercentP1, 100 - startPercentP1));
        flagsRef.attention.push(
          `${initiator} initiates most (${higherPercent}%) of conversations (vs ${other}: ${100-higherPercent}%), ` +
          `differs > ${METRIC_FLAGS_STARTER_IMBALANCE_THRESHOLD_PERCENT}% from 50/50.`
        );
      } else {
        flagsRef.positive.push(`Conversation starting relatively balanced (${p1}: ${startsP1} starts, ${p2}: ${startsP2} starts).`);
      }
    }
  }

  participants.forEach(author => {
    const respTimeData = metrics.participants[author]?.avgResponseTime;
    if (respTimeData && respTimeData.count > 5) {
      if (respTimeData.averageMinutes > METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN) {
        flagsRef.attention.push(
          `Median response time for ${author} is long (~${Math.round(respTimeData.averageMinutes)} min), exceeding ${METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN} min.`
        );
      } else if (respTimeData.averageMinutes < METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN) {
        flagsRef.positive.push(
          `Median response time for ${author} is fast (~${Math.round(respTimeData.averageMinutes)} min), below ${METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN} min.`
        );
      }
    }

    const unilateralCount = metrics.participants[author]?.unilateralSegments || 0;
    if (unilateralCount > 0) {
      const freqText = unilateralCount >= 8 ? "VERY frequent" : (unilateralCount >= 4 ? "frequent" : "occasional");
      flagsRef.attention.push(
        `${freqText} episodes (${unilateralCount}) where ${author} sent ${METRIC_FLAGS_UNILATERAL_THRESHOLD_MESSAGES}+ messages and the reply took >${METRIC_FLAGS_UNILATERAL_RESPONSE_DELAY_HOURS}h.`
      );
    }
  });
}

interface CleanedFlagsResult {
  positivePoints: string[];
  attentionPoints: string[];
  addedKeys: Set<string>;
}

function collectAndCleanFlags(analysisFlags: AnalysisFlags): CleanedFlagsResult {
  const positivePoints: string[] = [];
  const attentionPoints: string[] = [];
  const addedKeys = new Set<string>();

  const flagMappings = {
    positive: [
      { keywords: ["balanced", "equilibrada en mensajes"], key: "bal_msg" },
      { keywords: ["similar average message length", "longitud promedio de mensajes similar"], key: "bal_len" },
      { keywords: ["conversation starting relatively balanced", "inicio de conversaciones relativamente equilibrado"], key: "bal_start" },
      { keywords: ["fast response time", "rápido"], key: "resp_fast" },
      { keywords: ["reciprocal", "pocos segmentos unilaterales"], key: "reciprocal" },
      { keywords: ["predominantly positive (ai)"], key: "tone_v_pos" },
      { keywords: ["mostly positive (ai)"], key: "tone_m_pos" },
      { keywords: ["mostly neutral (ai)"], key: "tone_neu" },
      { keywords: ["tends to more positivity (ai)"], key: "tone_p_more" },
      { keywords: ["frequent use", "positividad o cortesía", "positivity or politeness"], key: "kw_pos" },
      { keywords: ["frequent use", "afecto explícito", "explicit affection"], key: "kw_aff" },
    ],
    attention: [
      { keywords: ["unequal", "desigual"], key: "imbal_msg" },
      { keywords: ["avg. message length unequal", "notablemente más largos"], key: "imbal_len" },
      { keywords: ["initiates most", "inicia la mayoría"], key: "imbal_start" },
      { keywords: ["long response time", "largo (~"], key: "resp_slow" },
      { keywords: ["episodes where", "reply took >", "retraso resp >"], key: "delayed_response" },
      { keywords: ["notable negative presence (ai)"], key: "tone_v_neg" },
      { keywords: ["significant presence of negativity (ai)"], key: "tone_m_neg" },
      { keywords: ["tends to more negativity (ai)"], key: "tone_n_more" },
      { keywords: ["frequent use", "negatividad o conflicto", "negativity or conflict"], key: "kw_neg" },
    ],
  };

  const processFlagList = (
    list: string[],
    mappings: Array<{ keywords: string[]; key: string }>,
    targetPointList: string[],
    type: 'pos' | 'att'
  ) => {
    list.forEach(flagText => {
      let cleanText = flagText.replace(/^(Obs:|Patrón:|Observación:|Nota:|Overall tone \(AI\):|Metric-based:)\s*/i, '').trim();
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
      cleanText = cleanText.endsWith('.') ? cleanText : cleanText + '.';
      let mappedKey: string | null = null;
      for (const mapping of mappings) {
        if (mapping.keywords.some(kw => cleanText.toLowerCase().includes(kw.toLowerCase()))) {
          mappedKey = mapping.key;
          break;
        }
      }
      if (mappedKey && !addedKeys.has(mappedKey + "_" + type)) {
        targetPointList.push(cleanText);
        addedKeys.add(mappedKey);
        addedKeys.add(mappedKey + "_" + type);
      } else if (!mappedKey && !targetPointList.includes(cleanText)) {
        targetPointList.push(cleanText);
      }
    });
  };

  processFlagList(analysisFlags.positive, flagMappings.positive, positivePoints, 'pos');
  processFlagList(analysisFlags.attention, flagMappings.attention, attentionPoints, 'att');
  
  return { positivePoints, attentionPoints, addedKeys };
}

function generateBalanceProfile(addedKeys: Set<string>): string {
  let text = "<strong>Balance & Participation:</strong> ";
  const findings: string[] = [];
  if (addedKeys.has('bal_msg')) findings.push("message quantity appears balanced");
  else if (addedKeys.has('imbal_msg')) findings.push("imbalance in message quantity is observed");
  if (addedKeys.has('bal_len')) findings.push("average message length is similar");
  else if (addedKeys.has('imbal_len')) findings.push("difference in average message length exists");
  if (addedKeys.has('bal_start')) findings.push("conversation starting is shared");
  else if (addedKeys.has('imbal_start')) findings.push("one participant initiates more conversations");
  
  if (findings.length === 0) return ""; // Return empty string if no relevant findings
  text += findings.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join(", ") + ".";
  return text;
}

function generateAffectionProfile(
  affectionAnalysis: AffectionAnalysis,
  participants: string[], // Takes participants list directly
  addedKeys: Set<string>
): string {
  let text = "<strong>Estimated Affection:</strong> ";
  const findings: string[] = [];

  if (participants.length === 2) {
    const [p1, p2] = participants;
    const affP1 = affectionAnalysis[p1]?.normalized || 0;
    const affP2 = affectionAnalysis[p2]?.normalized || 0;
    const totalAff = affP1 + affP2;
    const affectionDifference = Math.abs(affP1 - affP2);
    const significantAffectionDifference = totalAff > 1.0 && affectionDifference > (totalAff * 0.4) && affectionDifference > 1.0;

    if (significantAffectionDifference) {
      findings.push(
        `a notable difference is observed (${affP1 > affP2 ? p1 : p2} shows index ${Math.max(affP1, affP2).toFixed(1)} vs ${Math.min(affP1, affP2).toFixed(1)})`
      );
    } else if (totalAff >= 1.0) {
      findings.push(`levels appear relatively similar (${p1}: ${affP1.toFixed(1)}, ${p2}: ${affP2.toFixed(1)})`);
    }
  }
  
  if (addedKeys.has('kw_aff')) findings.push("frequent use of explicit affectionate language detected");
  else if (Object.values(affectionAnalysis).every(a => a.normalized < 0.5)) {
      findings.push("explicit affection expression appears low or infrequent");
  }

  if (findings.length === 0) return "";
  text += findings.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join(". ") + ".";
  return text;
}

function generateToneProfile(addedKeys: Set<string>): string {
  let text = "<strong>Overall Tone (AI-based):</strong> ";
  const findings_tone: string[] = [];
  if (addedKeys.has('tone_v_pos')) findings_tone.push("predominantly positive");
  else if (addedKeys.has('tone_m_pos')) findings_tone.push("mostly positive");
  else if (addedKeys.has('tone_v_neg')) findings_tone.push("notable negative presence");
  else if (addedKeys.has('tone_m_neg')) findings_tone.push("significant presence of negativity");
  else if (addedKeys.has('tone_neu')) findings_tone.push("mostly neutral");
  else findings_tone.push("no clear dominant tone detected by AI");

  let combinedText = findings_tone.length > 0 ? findings_tone[0].charAt(0).toUpperCase() + findings_tone[0].slice(1) : "The AI-based tone assessment was inconclusive";
  
  const findings_kw: string[] = [];
  if (addedKeys.has('kw_pos') && addedKeys.has('kw_neg')) findings_kw.push("frequent use of both positive/polite and negative/conflict words was noted");
  else if (addedKeys.has('kw_pos')) findings_kw.push("frequent use of language associated with positivity/politeness was noted");
  else if (addedKeys.has('kw_neg')) findings_kw.push("frequent use of language associated with negativity/conflict was noted");

  if(findings_kw.length > 0) {
    combinedText += ". " + (findings_kw[0].charAt(0).toUpperCase() + findings_kw[0].slice(1));
  }
   combinedText += ".";


  if ((addedKeys.has('tone_v_pos') || addedKeys.has('tone_m_pos')) && addedKeys.has('kw_neg')) {
    combinedText += " (Note: Conflict-associated words observed despite a generally positive AI tone).";
  } else if ((addedKeys.has('tone_v_neg') || addedKeys.has('tone_m_neg')) && addedKeys.has('kw_pos')) {
    combinedText += " (Note: Positive/polite words observed despite a generally negative AI tone).";
  }
  return text + combinedText;
}

function generateCommunicationFlowProfile(metrics: CalculatedMetrics, addedKeys: Set<string>): string {
  let text = "<strong>Communication Flow & Responsiveness:</strong> ";
  const findings: string[] = [];
  if (addedKeys.has('reciprocal')) findings.push("communication appears quite reciprocal");
  else if (addedKeys.has('delayed_response')) findings.push("episodes of message bursts followed by delayed replies (>2h) were detected");

  const slowResponses = metrics.global.participants.filter(p => metrics.participants[p]?.avgResponseTime?.averageMinutes > METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN).length;
  const fastResponses = metrics.global.participants.filter(p => metrics.participants[p]?.avgResponseTime?.averageMinutes < METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN && metrics.participants[p]?.avgResponseTime?.count > 5).length;

  if (addedKeys.has('resp_fast') && !addedKeys.has('resp_slow') && metrics.global.participants.length > 0 && metrics.global.participants.length === fastResponses) findings.push("response times tend to be fast for all");
  else if (addedKeys.has('resp_slow') && !addedKeys.has('resp_fast') && metrics.global.participants.length > 0 && metrics.global.participants.length === slowResponses) findings.push("median response times tend to be long for all");
  else if (addedKeys.has('resp_slow') || addedKeys.has('resp_fast')) findings.push("response times vary among participants or situations");
  else findings.push("response times are variable");

  if (findings.length === 0) return "";
  text += findings.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join(" and ") + ".";
  return text;
}

/**
 * Generates a textual interpretation summary based on metrics, affection, and flags.
 */
export function generateFinalInterpretation(
  metrics: CalculatedMetrics,
  affectionAnalysis: AffectionAnalysis,
  analysisFlags: AnalysisFlags
): InterpretationDetails {
  const { positivePoints, attentionPoints, addedKeys } = collectAndCleanFlags(analysisFlags);
  
  const summaryElements: string[] = [];
  summaryElements.push("<strong>Detailed Interpretation:</strong>");

  if (metrics.global.participants.length >= 1) { // Allow profiles if at least one participant
    if (metrics.global.participants.length === 1 || metrics.global.participants.length === 2) {
      const balanceProfile = generateBalanceProfile(addedKeys); // Doesn't need metrics
      if (balanceProfile) summaryElements.push(balanceProfile);
      
      const affectionProfile = generateAffectionProfile(affectionAnalysis, metrics.global.participants, addedKeys);
      if (affectionProfile) summaryElements.push(affectionProfile);
    } else { // For groups > 2
       summaryElements.push(
        "<p><strong>Balance & Affection:</strong> Detailed balance and affection comparison primarily applies to 2-person chats. " +
        "For groups, consider individual participation and overall tone.</p>"
      );
    }
  } else { // No participants found
      summaryElements.push(
        "<p><strong>Balance & Affection:</strong> No participant data found for detailed comparison.</p>"
      );
  }


  const toneProfile = generateToneProfile(addedKeys);
  if (toneProfile) summaryElements.push(toneProfile);

  const flowProfile = generateCommunicationFlowProfile(metrics, addedKeys);
  if (flowProfile) summaryElements.push(flowProfile);

  let summaryText: string;
  if (summaryElements.length <= 1 && positivePoints.length === 0 && attentionPoints.length === 0) {
    summaryText = "<p>Not enough specific patterns were detected to generate a detailed interpretation summary. Please review the general metrics.</p>";
  } else if (summaryElements.length <= 1) { // Only title is present
      summaryText = "<p>Review the observed positive patterns and points for reflection for insights.</p>";
  }
  else {
    const title = summaryElements.shift() || "";
    summaryText = title + "<br>" + summaryElements.map(el => el.startsWith("<p>") ? el : `<p>${el}</p>`).join("");
  }

  return {
    positivePoints,
    attentionPoints,
    summary: summaryText,
  };
}