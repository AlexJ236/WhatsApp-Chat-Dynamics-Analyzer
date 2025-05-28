import JSZip from 'jszip';

/**
 * Reads the content of a plain text File object.
 * @param file - The .txt File object.
 * @returns A Promise resolving with the file content as a string.
 */
async function readTextFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result);
      } else {
        reject(new Error('No se pudo leer el contenido del archivo como texto.'));
      }
    };
    reader.onerror = (event: ProgressEvent<FileReader>) => {
      console.error('[FileReaderService] Error leyendo archivo de texto:', event.target?.error);
      reject(new Error(`Error al leer el archivo: ${event.target?.error?.message || 'Error desconocido'}`));
    };
    reader.onabort = () => {
      reject(new Error('La lectura del archivo fue abortada.'));
    };
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Reads a chat file, which can be a .txt or a .zip containing a single .txt chat file.
 *
 * @param file - The File object (either .txt or .zip).
 * @returns A Promise that resolves with the chat content as a string.
 */
export async function readChatFile(file: File): Promise<string> {
  const fileNameLower = file.name.toLowerCase();

  if (fileNameLower.endsWith('.txt') || file.type === 'text/plain') {
    return readTextFileContent(file);
  } else if (fileNameLower.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    try {
      const jszip = new JSZip();
      const zip = await jszip.loadAsync(file); 
      
      const txtFiles: JSZip.JSZipObject[] = [];
      // Use '_relativePath' to indicate the parameter is intentionally not used
      zip.forEach((_relativePath, zipEntry) => {
        if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.txt')) {
          txtFiles.push(zipEntry);
        }
      });

      if (txtFiles.length === 0) {
        throw new Error('No se encontró ningún archivo .txt dentro del archivo ZIP.');
      }

      if (txtFiles.length > 1) {
        const specificChatFile = txtFiles.find(f => 
          f.name.toLowerCase().includes('_chat.txt') || 
          f.name.toLowerCase().startsWith('whatsapp chat')
        );
        if (specificChatFile) {
          return await specificChatFile.async('string');
        }
        throw new Error('El archivo ZIP contiene múltiples archivos .txt. Por favor, asegúrate de que haya solo un archivo de chat .txt, o que siga el patrón de nombre de exportación de WhatsApp (ej. _chat.txt).');
      }
      
      return await txtFiles[0].async('string');

    } catch (error) {
      console.error('[FileReaderService] Error procesando el archivo ZIP:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo procesar el archivo ZIP.';
      throw new Error(`Error con el ZIP: ${errorMessage}`);
    }
  } else {
    throw new Error('Tipo de archivo no soportado. Por favor, sube un archivo .txt o .zip.');
  }
}