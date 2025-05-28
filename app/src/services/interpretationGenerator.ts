import type {
  CalculatedMetrics,
  AffectionAnalysis,
  AnalysisFlags,
  InterpretationDetails,
} from '../types';

// --- Constants for Metric Flags ---
const METRIC_FLAGS_PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT = 25;
const METRIC_FLAGS_LENGTH_IMBALANCE_RATIO = 1.8;
const METRIC_FLAGS_STARTER_IMBALANCE_THRESHOLD_PERCENT = 20; // Slightly adjusted for more significance
const METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN = 90;
const METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN = 10;
const METRIC_FLAGS_UNILATERAL_THRESHOLD_MESSAGES = 3;
const METRIC_FLAGS_UNILATERAL_RESPONSE_DELAY_HOURS = 2;

/**
 * Generates flags based on quantitative metrics, with more descriptive, human-like phrasing.
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

    if (totalMsgs > 20) {
      const percentP1 = (countP1 / totalMsgs) * 100;
      const percentP2 = (countP2 / totalMsgs) * 100;
      const participationDiff = Math.abs(percentP1 - 50);

      if (participationDiff > METRIC_FLAGS_PARTICIPATION_IMBALANCE_THRESHOLD_PERCENT) {
        const moreActive = percentP1 > percentP2 ? p1 : p2;
        const lessActive = percentP1 > percentP2 ? p2 : p1;
        flagsRef.attention.push(
          `Participación Desigual: Se observa que ${moreActive} (${Math.round(Math.max(percentP1, percentP2))}%) tiende a enviar una cantidad considerablemente mayor de mensajes que ${lessActive}, lo que podría sugerir un desbalance en la participación activa.`
        );
      } else if (participationDiff > 10) {
        const moreActive = percentP1 > percentP2 ? p1 : p2;
        flagsRef.attention.push(
          `Participación Ligeramente Desigual: Hay una tendencia a que ${moreActive} (${Math.round(Math.max(percentP1, percentP2))}%) participe un poco más en términos de volumen de mensajes. Sería bueno reflexionar si esta dinámica es cómoda para ambos.`
        );
      } else {
        flagsRef.positive.push(
          `Participación Equilibrada: La cantidad de mensajes enviados por ${p1} (${Math.round(percentP1)}%) y ${p2} (${Math.round(percentP2)}%) es bastante similar, sugiriendo un buen balance en la contribución a la conversación.`
        );
      }
    }

    const avgWp1 = metrics.participants[p1]?.avgWordsPerMessage || 0;
    const avgWp2 = metrics.participants[p2]?.avgWordsPerMessage || 0;
    if (avgWp1 > 0 && avgWp2 > 0 && (countP1 > 10 && countP2 > 10)) {
      const ratio = Math.max(avgWp1 / avgWp2, avgWp2 / avgWp1);
      if (ratio > METRIC_FLAGS_LENGTH_IMBALANCE_RATIO) {
        const longerAuthor = avgWp1 > avgWp2 ? p1 : p2;
        const shorterAuthor = avgWp1 > avgWp2 ? p2 : p1;
        flagsRef.attention.push(
          `Extensión de Mensajes Desigual: ${longerAuthor} suele escribir mensajes más extensos (promedio ${avgWp1 > avgWp2 ? avgWp1.toFixed(0) : avgWp2.toFixed(0)} pal.) en comparación con ${shorterAuthor} (promedio ${avgWp1 < avgWp2 ? avgWp1.toFixed(0) : avgWp2.toFixed(0)} pal.). Esto podría influir en la percepción del detalle o la elaboración en sus comunicaciones.`
        );
      } else {
        flagsRef.positive.push(
          `Extensión de Mensajes Similar: Ambos participantes tienden a escribir mensajes de una longitud promedio parecida, lo que puede indicar un estilo de comunicación verbalmente equilibrado.`
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
        flagsRef.attention.push(
          `Iniciativa Desigual: ${initiator} parece ser quien más frecuentemente da el primer paso para iniciar las conversaciones (alrededor del ${Math.round(Math.max(startPercentP1, 100 - startPercentP1))}% de las veces). Considerar cómo se sienten ambos con esta dinámica.`
        );
      } else {
        flagsRef.positive.push(`Iniciativa Compartida: La tendencia a iniciar conversaciones parece ser bastante compartida y equilibrada entre ambos.`);
      }
    }
  }

  participants.forEach(author => {
    const respTimeData = metrics.participants[author]?.avgResponseTime;
    if (respTimeData && respTimeData.count > 10) {
      if (respTimeData.averageMinutes > METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN) {
        flagsRef.attention.push(
          `Respuesta Lenta de ${author}: El tiempo mediano que ${author} toma para responder tiende a ser extenso (aprox. ${Math.round(respTimeData.averageMinutes)} min). Si es un patrón constante, podría ser un punto a conversar sobre la fluidez esperada.`
        );
      } else if (respTimeData.averageMinutes < METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN && respTimeData.averageMinutes > 0) {
        flagsRef.positive.push(
          `Respuesta Rápida de ${author}: ${author} usualmente responde con agilidad (tiempo mediano aprox. ${Math.round(respTimeData.averageMinutes)} min), lo que puede contribuir a una comunicación fluida y dinámica.`
        );
      }
    }

    const unilateralCount = metrics.participants[author]?.unilateralSegments || 0;
    if (unilateralCount > 0) {
      const freqText = unilateralCount >= 5 ? "reiterados" : (unilateralCount >= 2 ? "algunos" : "ocasionales");
      flagsRef.attention.push(
        `Monólogos o Retrasos Notables (${author}): Se observaron ${freqText} episodios (${unilateralCount}) donde ${author} envió ${METRIC_FLAGS_UNILATERAL_THRESHOLD_MESSAGES}+ mensajes consecutivos que fueron seguidos por un silencio de más de ${METRIC_FLAGS_UNILATERAL_RESPONSE_DELAY_HOURS}h por parte del otro. Vale la pena reflexionar sobre estos momentos.`
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

  // Keywords updated to match fragments of the new Spanish, more descriptive flags
  const flagMappings = {
    positive: [
      { keywords: ["participación equilibrada"], key: "bal_msg" },
      { keywords: ["extensión de mensajes similar", "verbalmente equilibrado"], key: "bal_len" },
      { keywords: ["iniciativa compartida"], key: "bal_start" },
      { keywords: ["respuesta rápida", "responde con agilidad"], key: "resp_fast" },
      // { keywords: ["recíproca"], key: "reciprocal" }, // Example, if you add such a flag
      { keywords: ["tono", "predominantemente positivo"], key: "tone_v_pos" },
      { keywords: ["tono", "mayormente positivo"], key: "tone_m_pos" },
      { keywords: ["tono", "mayormente neutral"], key: "tone_neu" },
      // { keywords: ["tiende a más positividad (ia)"], key: "tone_p_more" }, // Already covered by tone flags generally
      { keywords: ["cortesía", "ambiente positivo general"], key: "kw_pos" },
      { keywords: ["afecto explícito"], key: "kw_aff" },
    ],
    attention: [
      { keywords: ["participación desigual"], key: "imbal_msg" },
      { keywords: ["extensión de mensajes desigual"], key: "imbal_len" },
      { keywords: ["iniciativa desigual"], key: "imbal_start" },
      { keywords: ["respuesta lenta", "respuesta extenso"], key: "resp_slow" },
      { keywords: ["monólogos o retrasos notables", "silencio prolongado"], key: "delayed_response" },
      { keywords: ["tono", "notable presencia negativa"], key: "tone_v_neg" },
      { keywords: ["tono", "significativa de negatividad"], key: "tone_m_neg" },
      // { keywords: ["tiende a más negatividad (ia)"], key: "tone_n_more" }, // Covered by tone flags
      { keywords: ["negatividad o conflicto"], key: "kw_neg" },
      { keywords: ["ia no pudo realizarse", "ia se omitió"], key: "ai_error_skip" }
    ],
  };

  const processFlagList = (
    list: string[],
    mappings: Array<{ keywords: string[]; key: string }>,
    targetPointList: string[],
    type: 'pos' | 'att'
  ) => {
    list.forEach(flagText => {
      // CleanText logic remains the same: Capitalize, ensure period.
      let cleanText = flagText.replace(/^(Patrón:|Observación:|Métrica:)\s*/i, '').trim();
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
      cleanText = cleanText.endsWith('.') ? cleanText : cleanText + '.';
      
      let mappedKey: string | null = null;
      for (const mapping of mappings) {
        if (mapping.keywords.some(kw => cleanText.toLowerCase().includes(kw.toLowerCase()))) {
          mappedKey = mapping.key;
          break;
        }
      }
      // Add to point list if conceptually new for that list type, or if no key mapped (generic flag)
      if (mappedKey && !addedKeys.has(mappedKey + "_" + type)) {
        targetPointList.push(cleanText);
        addedKeys.add(mappedKey); 
        addedKeys.add(mappedKey + "_" + type);
      } else if (!mappedKey && !targetPointList.some(p => p.startsWith(cleanText.substring(0, 30)))) { // Avoid very similar generic flags
        targetPointList.push(cleanText);
      }
    });
  };

  processFlagList(analysisFlags.positive, flagMappings.positive, positivePoints, 'pos');
  processFlagList(analysisFlags.attention, flagMappings.attention, attentionPoints, 'att');
  
  return { positivePoints, attentionPoints, addedKeys };
}

// --- Profile Generation Helpers (Rephrased for more human-like tone in Spanish) ---

function generateBalanceProfile(addedKeys: Set<string>): string {
  const findings: string[] = [];
  if (addedKeys.has('bal_msg')) findings.push("la cantidad de mensajes intercambiados sugiere una participación bastante equitativa");
  else if (addedKeys.has('imbal_msg')) findings.push("se percibe una diferencia en el volumen de mensajes, con uno de los participantes contribuyendo notablemente más que el otro");
  
  if (addedKeys.has('bal_len')) findings.push("la extensión de los mensajes tiende a ser similar por parte de ambos");
  else if (addedKeys.has('imbal_len')) findings.push("hay una tendencia a que un participante elabore mensajes más largos mientras el otro es más conciso");
  
  if (addedKeys.has('bal_start')) findings.push("la iniciativa para comenzar nuevas conversaciones parece ser compartida");
  else if (addedKeys.has('imbal_start')) findings.push("uno de los dos suele ser quien da el primer paso para iniciar los intercambios con más frecuencia");

  if (findings.length === 0) return "";
  return `<p><strong>Balance y Participación:</strong> ${findings.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join("; y ")}.</p>`;
}

function generateAffectionProfile(
  affectionAnalysis: AffectionAnalysis, participants: string[], addedKeys: Set<string>
): string {
  const findings: string[] = [];
  if (participants.length === 2) {
    const [p1, p2] = participants;
    const affP1 = affectionAnalysis[p1]?.normalized || 0;
    const affP2 = affectionAnalysis[p2]?.normalized || 0;
    const totalAff = affP1 + affP2;
    const diff = Math.abs(affP1 - affP2);

    if (addedKeys.has('kw_aff')) { // Prioritize if explicit affection is high
        findings.push("se observa un uso frecuente de lenguaje que expresa afecto de manera explícita");
        if (diff > 1.0 && totalAff > 1.5) { // If there's also a difference in this explicit affection
            findings.push(affP1 > affP2 ? `${p1} parece expresar este afecto con un índice (${affP1.toFixed(1)}) mayor que ${p2} (${affP2.toFixed(1)})` : `${p2} parece expresar este afecto con un índice (${affP2.toFixed(1)}) mayor que ${p1} (${affP1.toFixed(1)})`);
        }
    } else if (totalAff > 1.5 && diff > (totalAff * 0.4)) { // Some notable affection and difference
        findings.push( `el índice de afecto estimado sugiere una diferencia entre ${p1} (${affP1.toFixed(1)}) y ${p2} (${affP2.toFixed(1)})`);
    } else if (totalAff < 0.8 && !addedKeys.has('kw_aff')) { // Low overall affection
        findings.push("la expresión de afecto explícito a través de palabras clave parece ser poco frecuente en general");
    }
  } else if (addedKeys.has('kw_aff')) { // For single or group chats if explicit affection found
      findings.push("se observa un uso frecuente de lenguaje que expresa afecto de manera explícita");
  }


  if (findings.length === 0) return "";
  return `<p><strong>Afecto Estimado:</strong> ${findings.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join(". ")}.</p>`;
}

function generateToneProfile(addedKeys: Set<string>): string {
  const findings_tone: string[] = [];
  if (addedKeys.has('tone_v_pos')) findings_tone.push("el análisis de IA sugiere un ambiente predominantemente positivo en la conversación");
  else if (addedKeys.has('tone_m_pos')) findings_tone.push("la IA percibe un tono generalmente positivo en los mensajes");
  else if (addedKeys.has('tone_v_neg')) findings_tone.push("según la IA, hay una presencia notable de tono negativo, lo que podría indicar momentos de tensión o desacuerdo");
  else if (addedKeys.has('tone_m_neg')) findings_tone.push("la IA identifica una corriente de negatividad en una porción significativa de los mensajes");
  else if (addedKeys.has('tone_neu')) findings_tone.push("el tono general, según la IA, tiende a ser neutral o informativo");
  else findings_tone.push("la IA no identificó un tono emocional claramente dominante en la conversación");
  
  let combinedText = findings_tone.length > 0 ? findings_tone[0].charAt(0).toUpperCase() + findings_tone[0].slice(1) : "La evaluación del tono por IA no fue concluyente";

  if (addedKeys.has('kw_pos') && !addedKeys.has('kw_neg')) combinedText += "; además, el uso de palabras amables o de cortesía parece ser frecuente";
  else if (addedKeys.has('kw_neg') && !addedKeys.has('kw_pos')) combinedText += "; adicionalmente, se nota el uso de expresiones que podrían asociarse con conflicto o malestar";
  else if (addedKeys.has('kw_pos') && addedKeys.has('kw_neg')) combinedText += "; curiosamente, se observa tanto el uso de lenguaje cortés como de expresiones potencialmente conflictivas";
  
  combinedText += ".";

  if ((addedKeys.has('tone_v_pos') || addedKeys.has('tone_m_pos')) && addedKeys.has('kw_neg')) {
    combinedText += " (Es interesante notar que, aunque el tono general por IA es positivo, también se detectaron palabras que usualmente connotan conflicto).";
  } else if ((addedKeys.has('tone_v_neg') || addedKeys.has('tone_m_neg')) && addedKeys.has('kw_pos')) {
    combinedText += " (A pesar de un tono general negativo según la IA, se observan también expresiones de cortesía o positividad).";
  }
  return `<p><strong>Tono General:</strong> ${combinedText}</p>`;
}

function generateCommunicationFlowProfile(metrics: CalculatedMetrics, addedKeys: Set<string>): string {
  const findings: string[] = [];
  if (addedKeys.has('reciprocal')) findings.push("la dinámica general sugiere una comunicación bastante recíproca");
  else if (addedKeys.has('delayed_response')) findings.push("se identificaron situaciones donde ráfagas de mensajes de un participante fueron seguidas por silencios prolongados (más de 2 horas) del otro, lo que podría indicar interrupciones en el flujo conversacional");

  const slowResponderAuthors = metrics.global.participants.filter(p => metrics.participants[p]?.avgResponseTime?.averageMinutes > METRIC_FLAGS_RESP_TIME_SLOW_THRESHOLD_MIN && metrics.participants[p]?.avgResponseTime?.count > 5);
  const fastResponderAuthors = metrics.global.participants.filter(p => metrics.participants[p]?.avgResponseTime?.averageMinutes < METRIC_FLAGS_RESP_TIME_FAST_THRESHOLD_MIN && metrics.participants[p]?.avgResponseTime?.count > 5);

  if (fastResponderAuthors.length === metrics.global.participants.length && metrics.global.participants.length > 0) {
    findings.push("generalmente, todos los participantes tienden a responder con agilidad");
  } else if (slowResponderAuthors.length === metrics.global.participants.length && metrics.global.participants.length > 0) {
     findings.push("parece haber una tendencia generalizada a tiempos de respuesta extensos por parte de todos");
  } else {
    if (fastResponderAuthors.length > 0) findings.push(`algunos participantes, como ${fastResponderAuthors.join(", ")}, tienden a responder rápidamente`);
    if (slowResponderAuthors.length > 0) findings.push(`${slowResponderAuthors.length > 0 && fastResponderAuthors.length > 0 ? "mientras que otros" : "algunos participantes,"} como ${slowResponderAuthors.join(", ")}, pueden tomarse más tiempo para responder`);
  }
  
  if (findings.length === 0) return "";
  return `<p><strong>Fluidez y Respuesta:</strong> ${findings.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join("; ")}.</p>`;
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
  // Title added by the calling component or as static text in UI
  // summaryElements.push("<strong>Interpretación Detallada:</strong>"); 

  if (metrics.global.participants.length > 0) {
      const balanceProfile = generateBalanceProfile(addedKeys);
      if (balanceProfile.length > "<p><strong>Balance y Participación:</strong> ".length + 3) summaryElements.push(balanceProfile);
      
      const affectionProfile = generateAffectionProfile(affectionAnalysis, metrics.global.participants, addedKeys);
      if (affectionProfile.length > "<p><strong>Afecto Estimado:</strong> ".length + 3) summaryElements.push(affectionProfile);
  } else {
      summaryElements.push("<p>No se encontraron datos de participantes para generar perfiles detallados de balance o afecto.</p>");
  }

  const toneProfile = generateToneProfile(addedKeys);
  if (toneProfile.length > "<p><strong>Tono General:</strong> ".length + 3) summaryElements.push(toneProfile);

  const flowProfile = generateCommunicationFlowProfile(metrics, addedKeys);
  if (flowProfile.length > "<p><strong>Fluidez y Respuesta:</strong> ".length + 3) summaryElements.push(flowProfile);

  let summaryText: string;
  if (summaryElements.length === 0 && positivePoints.length === 0 && attentionPoints.length === 0) {
    summaryText = "<p>No se detectaron patrones específicos o métricas destacadas para generar un resumen detallado. Revisa las métricas y patrones individuales si se identificaron.</p>";
  } else if (summaryElements.length === 0) {
      summaryText = "<p>Revisa los patrones positivos observados y los puntos de reflexión para obtener más detalles sobre la dinámica de la conversación.</p>";
  } else {
    summaryText = summaryElements.join(""); // Elements already include <p> tags
  }

  return {
    positivePoints,
    attentionPoints,
    summary: summaryText,
  };
}