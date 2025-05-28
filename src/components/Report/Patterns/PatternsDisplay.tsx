import React from 'react';
import type { InterpretationDetails } from '../../../types';

interface PatternsDisplayProps {
  interpretationDetails: InterpretationDetails;
}

const PatternsDisplay: React.FC<PatternsDisplayProps> = ({ interpretationDetails }) => {
  const { positivePoints, attentionPoints } = interpretationDetails;

  return (
    <div className="patterns-container"> {/* Main container for both pattern blocks */}
      <div className="results-block green patterns-block">
        <h4>
          <span className="icon" aria-hidden="true">✓</span>
          Patrones Positivos Observados
        </h4>
        <ul id="positive-patterns-list"> {/* ID for potential specific styling */}
          {positivePoints && positivePoints.length > 0 ? (
            positivePoints.map((point, index) => (
              <li key={`positive-${index}`}>{point}</li>
            ))
          ) : (
            <li className="default-pattern-item">
              No se destacaron patrones positivos específicos.
            </li>
          )}
        </ul>
      </div>

      <div className="results-block red patterns-block">
        <h4>
          <span className="icon" aria-hidden="true">!</span>
          Patrones para Reflexión
        </h4>
        <ul id="attention-patterns-list"> {/* ID for potential specific styling */}
          {attentionPoints && attentionPoints.length > 0 ? (
            attentionPoints.map((point, index) => (
              <li key={`attention-${index}`}>{point}</li>
            ))
          ) : (
            <li className="default-pattern-item">
              No se identificaron patrones específicos para reflexión.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PatternsDisplay;