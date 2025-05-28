import React from 'react';
import type { CalculatedMetrics } from '../../../types';
import SummaryCard from './SummaryCard';

interface SummaryCardsSectionProps {
  metrics: CalculatedMetrics;
}

const SummaryCardsSection: React.FC<SummaryCardsSectionProps> = ({ metrics }) => {
  if (!metrics || !metrics.global || !metrics.participants) {
    return <p>No hay datos de resumen disponibles.</p>;
  }

  const { global: globalMetrics, participants: participantMetrics } = metrics;

  let dateRangeString = 'N/D';
  if (globalMetrics.dateRange.start && globalMetrics.dateRange.end) {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC', // Dates were parsed as UTC
    };
    try {
      const startDate = globalMetrics.dateRange.start.toLocaleDateString('es-PE', options);
      const endDate = globalMetrics.dateRange.end.toLocaleDateString('es-PE', options);
      dateRangeString = `${startDate} - ${endDate}`;
    } catch (e) {
      console.warn("Error formateando fechas para el resumen:", e);
      // Fallback simple
      dateRangeString = `${globalMetrics.dateRange.start.toISOString().split('T')[0]} - ${globalMetrics.dateRange.end.toISOString().split('T')[0]}`;
    }
  }

  return (
    <div className="results-block" id="summary">
      <h4>Resumen General</h4>
      <div id="summary-cards-container">
        <SummaryCard title="Participantes" value={globalMetrics.participants} />
        <SummaryCard title="Msjs Totales" value={globalMetrics.totalMessageCount || 0} />
        <SummaryCard title="Periodo" value={dateRangeString} />

        {globalMetrics.participants.map(participantName => (
          <SummaryCard 
            key={`${participantName}-msgs`}
            title={`Msjs ${participantName}`} 
            value={participantMetrics[participantName]?.messageCount || 0} 
          />
        ))}

        {globalMetrics.participants.map(participantName => (
          <SummaryCard 
            key={`${participantName}-avgwords`}
            title={`Pal/Msj ${participantName}`} 
            value={participantMetrics[participantName]?.avgWordsPerMessage || 0} 
          />
        ))}

        {globalMetrics.participants.map(participantName => {
          const respTime = participantMetrics[participantName]?.avgResponseTime;
          return (
            <SummaryCard 
              key={`${participantName}-resptime`}
              title={`Tpo Resp (med) ${participantName}`} 
              value={(respTime && respTime.count > 0) ? `${respTime.averageMinutes} min` : 'N/A'} 
            />
          );
        })}

        {globalMetrics.participants.map(participantName => (
          <SummaryCard 
            key={`${participantName}-starts`}
            title={`Inicios ${participantName}`} 
            value={participantMetrics[participantName]?.conversationStarters || 0} 
          />
        ))}

        {globalMetrics.participants.map(participantName => (
          <SummaryCard 
            key={`${participantName}-unilateral`}
            title={`Episodios unilaterales ${participantName}`} 
            value={participantMetrics[participantName]?.unilateralSegments || 0} 
          />
        ))}
      </div>
    </div>
  );
};

export default SummaryCardsSection;