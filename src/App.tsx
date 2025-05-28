import { useState } from 'react';
import html2canvas from 'html2canvas';

// Layout and UI Components
import AppLayout from './components/Layout/AppLayout';
import FileUpload from './components/FileUpload/FileUpload';
import SummaryCardsSection from './components/Report/SummaryCards/SummaryCardsSection';
import ParticipationChart from './components/Report/Charts/ParticipationChart';
import TimelineChart from './components/Report/Charts/TimelineChart';
import AffectionIndexDisplay from './components/Report/Affection/AffectionIndexDisplay';
import PatternsDisplay from './components/Report/Patterns/PatternsDisplay';
import InterpretationSummary from './components/Report/Interpretation/InterpretationSummary';

// Services for chat analysis
import { parseChatExport } from './services/chatParser';
import { calculateChatMetrics } from './services/metricsCalculator';
import {
  analyzeChatSentimentAndAffection,
  type ModelLoadProgress,
} from './services/sentimentAnalyzer';
import {
  generateMetricBasedFlags,
  generateFinalInterpretation,
} from './services/interpretationGenerator';

// Types for our data structures
import type {
  FullAnalysisResult,
  AnalysisFlags,
  ParsedChatData,
  CalculatedMetrics,
  AffectionAnalysis,
  InterpretationDetails,
} from './types';

function App() {
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null);
  const [chatFileName, setChatFileName] = useState<string | null>(null);
  const [appStatusMessage, setAppStatusMessage] = useState<string>('Sube un archivo de chat para comenzar.');
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // For main analysis pipeline
  const [modelLoadProgress, setModelLoadProgress] = useState<ModelLoadProgress | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false); // For image export process

  const handleFileProcessed = (chatText: string, fileName: string) => {
    setChatFileName(fileName);
    setAppStatusMessage(`Archivo "${fileName}" cargado. Iniciando análisis...`);
    setAnalysisResult(null); 
    setModelLoadProgress(null); 
    triggerFullAnalysis(chatText, fileName);
  };

  const handleModelProgress = (progress: ModelLoadProgress) => {
    setModelLoadProgress(progress);
    if (progress.status === 'downloading' && progress.file && progress.loaded && progress.total) {
      const percentNum = ((progress.loaded / progress.total) * 100);
      setAppStatusMessage(`Descargando modelo IA: ${progress.file} (${percentNum.toFixed(1)}%)`);
    } else if (progress.status === 'quantizing' && typeof progress.progress === 'number') {
      setAppStatusMessage(`Optimizando modelo IA: ${progress.progress.toFixed(1)}%`);
    } else if (progress.status === 'loading') {
      setAppStatusMessage('Cargando modelo IA en memoria...');
    } else if (progress.status === 'error' && progress.error) {
      setAppStatusMessage(`Error cargando modelo IA: ${progress.error}`);
    }
  };

  const handleAIAnalysisProgress = (processed: number, total: number) => {
    const percent = total > 0 ? ((processed / total) * 100).toFixed(0) : '0';
    setAppStatusMessage(`Analizando mensajes con IA: ${processed}/${total} (${percent}%)`);
  };

  const triggerFullAnalysis = async (chatText: string, fileName: string) => {
    // ... (Implementation from previous step, no changes here)
    if (!chatText) {
      setAppStatusMessage('No se puede analizar un archivo vacío.');
      return;
    }
    setIsProcessing(true);
    setAnalysisResult(null); 
    setAppStatusMessage(`Iniciando análisis para "${fileName}"...`);
    setModelLoadProgress(null); 
    try {
      setAppStatusMessage('Parseando líneas del chat...');
      await new Promise(resolve => setTimeout(resolve, 50)); 
      const parsedData: ParsedChatData = parseChatExport(chatText);
      if (parsedData.messages.length === 0) {
        throw new Error('No se encontraron mensajes válidos en el archivo. Por favor, revisa el formato del archivo.');
      }
      setAppStatusMessage('Calculando métricas...');
      await new Promise(resolve => setTimeout(resolve, 50));
      const metrics: CalculatedMetrics = calculateChatMetrics(parsedData.messages);
      const analysisFlags: AnalysisFlags = { positive: [], attention: [] };
      setAppStatusMessage('Preparando análisis de sentimiento y afecto...');
      await new Promise(resolve => setTimeout(resolve, 50));
      const affectionAnalysis: AffectionAnalysis = await analyzeChatSentimentAndAffection(
        parsedData.messages, metrics, analysisFlags, handleModelProgress, handleAIAnalysisProgress
      );
      setAppStatusMessage('Generando flags basados en métricas...');
      await new Promise(resolve => setTimeout(resolve, 50));
      generateMetricBasedFlags(metrics, analysisFlags);
      setAppStatusMessage('Generando interpretación final...');
      await new Promise(resolve => setTimeout(resolve, 50));
      const interpretationDetails: InterpretationDetails = generateFinalInterpretation(
        metrics, affectionAnalysis, analysisFlags
      );
      setAnalysisResult({
        parsedChatData: parsedData, calculatedMetrics: metrics,
        affectionAnalysis: affectionAnalysis, analysisFlags: analysisFlags,
        interpretationDetails: interpretationDetails,
      });
      setAppStatusMessage(`¡Análisis de "${fileName}" completado!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ocurrió un error desconocido durante el análisis.';
      console.error("[App] Error during full analysis:", error); 
      setAppStatusMessage(`Error en el análisis: ${message}`);
      setAnalysisResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles the export of the report section as a PNG image.
   */
  const handleImageExport = async () => {
    const reportElement = document.getElementById('report-container');
    if (!reportElement) {
      setAppStatusMessage('Error: No se encontró el contenido del reporte para exportar.');
      console.error('[App] Report container element not found for image export.');
      return;
    }
    if (!analysisResult) {
        setAppStatusMessage('No hay resultados visibles para exportar.');
        return;
    }

    setIsGeneratingImage(true);
    setAppStatusMessage('Generando imagen del reporte...');

    try {
      // Ensure a small delay for any final rendering updates
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(reportElement, {
        scale: window.devicePixelRatio || 2, // Enhances resolution
        useCORS: true, // If you have external images, though unlikely here
        logging: false, // Set to true for debugging html2canvas
        backgroundColor: getComputedStyle(document.body).getPropertyValue('background-color') || '#f8f9fa', // Use body background
      });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      const safeFileName = chatFileName ? chatFileName.replace(/\.[^/.]+$/, "") : "chat"; // Remove extension for cleaner name
      link.download = `analisis_${safeFileName}_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setAppStatusMessage('Imagen generada y descarga iniciada.');
    } catch (err) {
      console.error("[App] Error during html2canvas export:", err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setAppStatusMessage(`Error al generar la imagen: ${message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  // ... (statusColor logic remains the same)
  let statusColor = 'var(--text-medium)';
  if (appStatusMessage.toLowerCase().includes('error')) {
    statusColor = 'var(--error-text)';
  } else if (isProcessing || isGeneratingImage || (modelLoadProgress && modelLoadProgress.status !== 'done' && modelLoadProgress.status !== 'error')) {
    statusColor = 'var(--primary-color)';
  } else if (appStatusMessage.toLowerCase().includes('completado') || appStatusMessage.toLowerCase().includes('iniciada')) { // For "descarga iniciada"
    statusColor = 'var(--success-text)';
  } else if (appStatusMessage.toLowerCase().includes('sube un archivo')) {
    statusColor = 'var(--text-medium)';
  }

  return (
    <AppLayout>
      <FileUpload 
        onFileSuccessfullyProcessed={handleFileProcessed}
      />

      {appStatusMessage && (
        <p id="loading-status" className="loading-status" style={{
            color: statusColor,
            marginTop: '1rem', 
            textAlign: 'center',
            minHeight: '1.5em' 
        }}>
          {appStatusMessage}
        </p>
      )}
      
      {analysisResult && !isProcessing && (
        <>
          <hr className="divider" />
          <div id="report-container"> {/* This is the element we will capture */}
            <section id="results-section">
              <h2>Análisis de: {chatFileName}</h2>
              
              <div className="results-columns-container">
                <div className="results-column" id="column-left">
                  <SummaryCardsSection metrics={analysisResult.calculatedMetrics} />
                </div>
                <div className="results-column" id="column-middle">
                  <ParticipationChart metrics={analysisResult.calculatedMetrics} />
                  <TimelineChart metrics={analysisResult.calculatedMetrics} />
                  <AffectionIndexDisplay 
                    affectionAnalysis={analysisResult.affectionAnalysis}
                    metrics={analysisResult.calculatedMetrics} 
                  />
                </div>
                <div className="results-column" id="column-right">
                   <PatternsDisplay interpretationDetails={analysisResult.interpretationDetails} />
                </div>
              </div>
              
              <InterpretationSummary interpretationDetails={analysisResult.interpretationDetails} />
            </section>

            <section id="download-report" style={{marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)'}}>
              <h3>Exportar Informe</h3>
              <p>Guarda una imagen del análisis completo.</p>
              <button 
                id="image-button" 
                onClick={handleImageExport} 
                disabled={isGeneratingImage || isProcessing || !analysisResult} // Disable if processing, generating or no result
              >
                {isGeneratingImage ? 'Generando...' : 'Descargar como Imagen (PNG)'}
              </button>
            </section>
          </div>
        </>
      )}
    </AppLayout>
  );
}

export default App;