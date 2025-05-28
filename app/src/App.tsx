import AppLayout from './components/Layout/AppLayout';
import FileUpload from './components/FileUpload/FileUpload';
import { useState } from 'react';

// Importa los servicios de análisis que usaremos después
// import { parseChatExport } from './services/chatParser';
// import { calculateChatMetrics } from './services/metricsCalculator';
// import { analyzeChatSentimentAndAffection, loadSentimentModel } from './services/sentimentAnalyzer';
// import { generateMetricBasedFlags, generateFinalInterpretation } from './services/interpretationGenerator';
// import type { FullAnalysisResult, AnalysisFlags } from './types';


function App() {
  const [rawChatText, setRawChatText] = useState<string | null>(null);
  const [chatFileName, setChatFileName] = useState<string | null>(null);

  // Estado para mensajes de carga/proceso globales
  const [appStatusMessage, setAppStatusMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFileProcessed = (chatText: string, fileName: string) => {
    console.log(`[App] Archivo procesado: ${fileName}, tamaño: ${chatText.length} caracteres.`);
    setRawChatText(chatText);
    setChatFileName(fileName);
    setAppStatusMessage(`Listo para analizar "${fileName}".`);
  };

  return (
    <AppLayout>
      <FileUpload 
        onFileSuccessfullyProcessed={handleFileProcessed} 
        />

      <hr className="divider" /> 

      {rawChatText && chatFileName && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Chat "{chatFileName}" cargado.</h3>
          <p>El análisis se mostrará aquí.</p>
        </div>
      )}

      {appStatusMessage && !isProcessing && (
         <p className="loading-status" style={{textAlign: 'center', marginTop: '1rem'}}>
            {appStatusMessage}
         </p>
      )}
    </AppLayout>
  );
}

export default App;