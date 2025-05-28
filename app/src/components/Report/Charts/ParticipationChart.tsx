import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { CalculatedMetrics } from '../../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ParticipationChartProps {
  metrics: CalculatedMetrics;
}

const ParticipationChart: React.FC<ParticipationChartProps> = ({ metrics }) => {
  if (!metrics || !metrics.global.participants.length) {
    return <p>No hay datos de participación disponibles.</p>;
  }

  const participantData = metrics.global.participants.map(
    p => metrics.participants[p]?.messageCount || 0
  );
  const totalMessages = participantData.reduce((sum, count) => sum + count, 0);
  
  const participantPercentages = participantData.map(count =>
    totalMessages > 0 ? parseFloat(((count / totalMessages) * 100).toFixed(1)) : 0
  );

  const baseChartColors = ['#ef97be', '#76c7c0', '#f39c12', '#3498db', '#9b59b6', '#e74c3c', '#2ecc71'];
  const chartColors = metrics.global.participants.map(
    (_, index) => baseChartColors[index % baseChartColors.length]
  );

  const data = {
    labels: [''], 
    datasets: metrics.global.participants.map((p, index) => ({
      label: p,
      data: [participantPercentages[index]],
      backgroundColor: chartColors[index] + 'CC',
      borderColor: chartColors[index],
      borderWidth: 1,
    })),
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: { display: false },
        max: 100,
        min: 0,
        ticks: {
          callback: (value: string | number) => `${value}%`,
          font: { size: 9 },
        },
      },
      y: {
        stacked: true,
        display: false,
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        align: 'center' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 10 },
        },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.x !== null) {
              const participantName = context.dataset.label || 'Desconocido';
              const messageCount = metrics.participants[participantName]?.messageCount || 0;
              label += `${context.parsed.x.toFixed(1)}% (${messageCount} mensajes)`;
            }
            return label;
          }
        }
      }
    },
  };

  return (
    <div className="results-block">
      <h4>Distribución de Mensajes (%)</h4>
      <div className="chart-container participation-chart">
        <Bar options={options} data={data} />
      </div>
    </div>
  );
};

export default ParticipationChart;