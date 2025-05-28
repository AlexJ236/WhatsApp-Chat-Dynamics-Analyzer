import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string | number | string[];
  className?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, className }) => {
  let displayValue = value;
  if (Array.isArray(value)) {
    displayValue = value.join(', ');
    if (displayValue.length > 50) { // Truncate if too long (as in original)
      displayValue = displayValue.substring(0, 47) + '...';
    }
  } else if (typeof value === 'number' && value > 100000) { //toLocaleString for large numbers
    displayValue = value.toLocaleString('es-PE');
  } else if (value === null || typeof value === 'undefined') {
    displayValue = 'N/A';
  }

  return (
    <div className={`stat-card ${className || ''}`}>
      <span className="stat-card-title">{title}</span>
      <span className="stat-card-value">{String(displayValue)}</span>
    </div>
  );
};

export default SummaryCard;