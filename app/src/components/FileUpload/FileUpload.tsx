import React, { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { readTextFile } from '../../services/fileReaderService';

interface FileUploadProps {
  onFileSuccessfullyProcessed: (chatText: string, fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSuccessfullyProcessed }) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Esperando archivo...');
  const [isReading, setIsReading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFileName(file.name);
      setStatusMessage('Leyendo archivo...');
      setErrorMessage(null);
      setIsReading(true);

      try {
        const fileContent = await readTextFile(file);
        setStatusMessage(`Archivo "${file.name}" cargado. Listo para analizar.`);
        onFileSuccessfullyProcessed(fileContent, file.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ocurrió un error desconocido al leer el archivo.';
        console.error('[FileUpload] Error reading file:', error);
        setErrorMessage(`Error: ${message}`);
        setStatusMessage('Error al leer el archivo. Intenta de nuevo.');
        setSelectedFileName(null);
      } finally {
        setIsReading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } else {
      setSelectedFileName(null);
      setStatusMessage('No se seleccionó ningún archivo.');
    }
  };

  return (
    <section id="upload-section">
      <h2>1. Sube tu archivo de chat (.txt)</h2>
      <p>Tu archivo se procesa <strong>localmente</strong> en tu navegador. No se sube a ningún servidor.</p>
      
      <input 
        type="file" 
        id="chatfile-input"
        accept=".txt" 
        onChange={handleFileChange}
        style={{ display: 'none' }}
        ref={fileInputRef}
        disabled={isReading}
      />
      <label 
        htmlFor="chatfile-input" 
        className="file-upload-label" 
        style={{ 
          opacity: isReading ? 0.7 : 1, 
          cursor: isReading ? 'not-allowed' : 'pointer' 
        }}
      >
        {isReading ? 'Procesando...' : 'Seleccionar Archivo'}
      </label>

      {selectedFileName && !errorMessage && (
        <p id="file-chosen" className="file-chosen-text">
          Archivo: {selectedFileName}
        </p>
      )}

      <p 
        id="loading-status" 
        className="loading-status" 
        style={{ 
          color: errorMessage 
            ? 'var(--error-text)' 
            : (statusMessage.includes('Listo para analizar') ? 'var(--success-text)' : 'var(--text-medium)') 
        }}
      >
        {errorMessage ? errorMessage : statusMessage}
      </p>
    </section>
  );
};

export default FileUpload;