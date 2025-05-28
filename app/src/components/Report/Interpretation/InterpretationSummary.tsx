import React from 'react';
import type { InterpretationDetails } from '../../../types';

interface InterpretationSummaryProps {
  interpretationDetails: InterpretationDetails;
}

const InterpretationSummary: React.FC<InterpretationSummaryProps> = ({ interpretationDetails }) => {
  const { summary } = interpretationDetails;

  // Default disclaimer text, adapt as needed.
  const disclaimerText = `
    <strong>Importante:</strong> Este análisis se basa únicamente en patrones textuales y 
    métricas cuantitativas del chat exportado. No puede capturar el contexto completo, 
    el tono de voz, las expresiones faciales, la intención real detrás de los mensajes, 
    ni la complejidad de las relaciones humanas. Las interpretaciones y "patrones" son 
    sugerencias generadas algorítmicamente y deben tomarse con precaución. 
    Úsalo como una herramienta para la auto-reflexión y la comunicación, no como un juicio 
    definitivo. La comunicación saludable siempre implica comprensión mutua y diálogo abierto.
  `; // Consider breaking this into <p> tags if more structure is needed within the disclaimer.

  return (
    <div className="results-block interpretation-summary">
      <h4>Interpretación General</h4>
      <div 
        id="compatibility-summary" /* ID for potential specific styling */
        dangerouslySetInnerHTML={{ __html: summary || "<p>No se pudo generar un resumen de la interpretación.</p>" }} 
      />
      <p className="disclaimer" dangerouslySetInnerHTML={{ __html: disclaimerText }} />
    </div>
  );
};

export default InterpretationSummary;