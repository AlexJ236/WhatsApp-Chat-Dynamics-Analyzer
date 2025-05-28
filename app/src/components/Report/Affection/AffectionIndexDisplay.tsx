import React from 'react';
import type { AffectionAnalysis, CalculatedMetrics } from '../../../types';
import { AFFECTION_INDEX_MAX_FOR_100_PERCENT } from '../../../services/sentimentAnalyzer'; // Import the constant

interface AffectionIndexDisplayProps {
  affectionAnalysis: AffectionAnalysis;
  metrics: CalculatedMetrics; // To get participant names in order
}

const AffectionIndexDisplay: React.FC<AffectionIndexDisplayProps> = ({ affectionAnalysis, metrics }) => {
  const participants = metrics.global.participants;

  if (!participants || participants.length === 0) {
    return <p>No hay datos de afecto para mostrar.</p>;
  }

  return (
    <div className="results-block">
      <h4>Índice de Expresión Afectiva (Estimado)</h4>
      <div id="affection-bars-container">
        {participants.map((participantName) => {
          const indexData = affectionAnalysis[participantName];
          const normalizedScore = indexData?.normalized || 0;

          // Calculate percentage for the bar width
          // Score is capped by AFFECTION_INDEX_MAX_FOR_100_PERCENT for 100% display
          const percentage = Math.max(
            0,
            Math.min(100, (normalizedScore / AFFECTION_INDEX_MAX_FOR_100_PERCENT) * 100)
          );

          return (
            <div key={participantName} className="affection-bar-wrapper">
              <div className="affection-bar-label">
                {participantName}: {percentage.toFixed(0)}%
              </div>
              <div 
                className="affection-bar-container" 
                title={`Índice estimado: ${normalizedScore.toFixed(2)}`}
              >
                <div
                  className="affection-bar-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AffectionIndexDisplay;