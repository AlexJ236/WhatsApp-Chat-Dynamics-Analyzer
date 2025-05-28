import React, { useState, useEffect } from 'react';

const Footer: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTimeLocation = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Lima',
        hour12: true,
      };
      try {
        setCurrentTime(now.toLocaleString('es-PE', options));
      } catch (e) {
        // Fallback simple
        setCurrentTime(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
        console.warn("Error al formatear la hora con zona horaria 'America/Lima', usando fallback.");
      }
    };

    updateTimeLocation();
    const intervalId = setInterval(updateTimeLocation, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <footer>
      <p>Herramienta de análisis local y privada para ti</p>
      <p>
        <small id="current-location-time">
          Perú - <span>{currentTime}</span>
        </small>
      </p>
    </footer>
  );
};

export default Footer;