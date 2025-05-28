/**
 * Reads the content of a File object as plain text.
 * Primarily intended for reading .txt chat export files.
 *
 * @param file - The File object to read (e.g., from an <input type="file"> element).
 * @returns A Promise that resolves with the file content as a string.
 * @throws If the file is not a text file (based on a simple MIME type check for 'text/plain')
 * or if there's an error during file reading.
 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Basic check for .txt file type based on name, can be enhanced with MIME type if needed
    // WhatsApp exports are typically .txt, and input accept=".txt" should mostly handle this.
    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
      // Allow if type is explicitly text/plain even if extension is missing
      if (file.type !== 'text/plain') {
         console.warn(`[FileReaderService] Attempted to read non-txt file: ${file.name} (type: ${file.type})`);
         return reject(new Error('Invalid file type. Please upload a .txt file.'));
      }
    }

    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result);
      } else {
        // This case should ideally not happen if readAsText is used correctly
        reject(new Error('Failed to read file content as text.'));
      }
    };

    reader.onerror = (event: ProgressEvent<FileReader>) => {
      // event.target.error contains the DOMException
      console.error('[FileReaderService] Error reading file:', event.target?.error);
      reject(new Error(`Error reading file: ${event.target?.error?.message || 'Unknown error'}`));
    };

    reader.onabort = () => {
      console.warn('[FileReaderService] File reading was aborted.');
      reject(new Error('File reading was aborted.'));
    };

    // Read the file as UTF-8 text. WhatsApp exports are typically UTF-8.
    reader.readAsText(file, 'UTF-8');
  });
}

// --- Future Enhancements (Placeholder for ZIP handling) ---

// import JSZip from 'jszip'; // Would need to npm install jszip and @types/jszip

/**
 * Reads a chat file, which can be a .txt or a .zip containing a .txt file.
 *
 * @param file - The File object (either .txt or .zip).
 * @returns A Promise that resolves with the chat content as a string.
 * @throws If the file type is unsupported, the ZIP is invalid, or no chat .txt found in ZIP.
 */
/*
export async function readChatFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain') {
    return readTextFile(file);
  } else if (file.name.toLowerCase().endsWith('.zip')) {
    try {
      const jszip = new JSZip();
      const zip = await jszip.loadAsync(file);
      
      // Look for a .txt file within the ZIP.
      // Common WhatsApp export name is "_chat.txt" or "WhatsApp Chat with ....txt"
      const chatFileEntry = Object.values(zip.files).find(
        (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.txt') &&
                   (entry.name.toLowerCase().includes('chat') || entry.name.toLowerCase().includes('whatsapp'))
      );

      if (chatFileEntry) {
        return await chatFileEntry.async('string');
      } else {
        throw new Error('No .txt chat file found within the ZIP archive.');
      }
    } catch (error) {
      console.error('[FileReaderService] Error processing ZIP file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process ZIP file';
      throw new Error(`ZIP Error: ${errorMessage}`);
    }
  } else {
    throw new Error('Unsupported file type. Please upload a .txt or .zip file.');
  }
}
*/