import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, // For the X-axis (dates)
  LinearScale,   // For the Y-axis (message count)
  PointElement,  // For the points on the line
  LineElement,   // For the line itself
  Title,
  Tooltip,
  Legend,
  Filler,        // To fill area under the line
} from 'chart.js';
import type { CalculatedMetrics } from '../../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimelineChartProps {
  metrics: CalculatedMetrics;
}

const TimelineChart: React.FC<TimelineChartProps> = ({ metrics }) => {
  if (!metrics || !metrics.global.timeSeries?.labels?.length) {
    return <p>No hay datos de actividad diaria disponibles.</p>;
  }

  const { labels, data: messageCounts } = metrics.global.timeSeries;

  // Chart.js data object
  const chartData = {
    labels: labels, // Dates "YYYY-MM-DD"
    datasets: [
      {
        label: 'Mensajes por Día',
        data: messageCounts,
        fill: true,
        borderColor: 'var(--brand-secondary)',
        backgroundColor: 'rgba(118, 199, 192, 0.2)',
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
    ],
  };

  // Chart.js options object
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Important for fitting into a container
    plugins: {
      legend: {
        display: false, // Hide legend if only one dataset
      },
      title: {
        display: false, // Chart title (handled by the section header)
      },
      tooltip: {
        callbacks: {
          title: function (tooltipItems: any[]) { // Use 'any' or TooltipItem<'line'>[]
            const dateLabel = tooltipItems[0]?.label;
            if (dateLabel) {
              try {
                const date = new Date(dateLabel + 'T00:00:00Z'); 
                return date.toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC', // Displaying the UTC date in es-PE locale format
                });
              } catch (e) {
                return dateLabel; // Fallback to original label if parsing fails
              }
            }
            return '';
          },
          label: function (context: any) { // Use 'any' or TooltipItem<'line'>
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: false,
        },
        ticks: {
          autoSkip: true, // Automatically skip labels if too many
          maxTicksLimit: 10, // Max number of ticks on X-axis
          font: { size: 9 },
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        title: {
          display: false,
        },
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="results-block">
      <h4>Actividad del Chat por Día</h4> {/* Spanish */}
      <div className="chart-container timeline-chart">
        <Line options={chartOptions as any} data={chartData} /> 
        {/* Using 'as any' for options temporarily if specific ChartOptions type causes issues,
            otherwise it should infer correctly.
            Ideally: options={chartOptions}
        */}
      </div>
    </div>
  );
};

export default TimelineChart;