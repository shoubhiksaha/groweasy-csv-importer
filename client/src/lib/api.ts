import { ImportResponse, ProgressEvent } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const importCSV = (
  file: File,
  onProgress: (event: ProgressEvent) => void
): Promise<ImportResponse['data']> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const abortController = new AbortController();
    
    // Inactivity timeout: abort if no data received for 60 seconds
    let timeout: NodeJS.Timeout;
    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        abortController.abort();
        reject(new Error('Import request timed out due to inactivity.'));
      }, 120000); // 120 seconds
    };
    resetTimeout();

    fetch(`${API_URL}/api/import`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    }).then(async (response) => {
      if (!response.ok) {
        clearTimeout(timeout);
        if (response.status === 413) {
           return reject(new Error('File is too large. Maximum 10MB.'));
        }
        try {
          const errData = await response.json();
          return reject(new Error(errData.message || 'Server error'));
        } catch {
          return reject(new Error('An unexpected server error occurred.'));
        }
      }

      if (!response.body) {
        clearTimeout(timeout);
        return reject(new Error('Response body is empty.'));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';

      const readChunk = async () => {
        try {
          const { done, value } = await reader.read();
          resetTimeout();
          
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
          }

          if (buffer) {
            const parts = buffer.split('\n\n');
            // If done is true, process all parts, otherwise keep the last incomplete part in buffer
            if (!done) {
              buffer = parts.pop() || '';
            } else {
              buffer = '';
            }

            for (const part of parts) {
              if (part.trim().startsWith('data: ')) {
                const dataStr = part.trim().slice(6);
                try {
                  const event: ProgressEvent = JSON.parse(dataStr);
                  onProgress(event);
                  if (event.type === 'complete') {
                    clearTimeout(timeout);
                    resolve(event.data as ImportResponse['data']);
                    return;
                  } else if (event.type === 'error') {
                    clearTimeout(timeout);
                    reject(new Error(event.message));
                    return;
                  }
                } catch (e) {
                  console.error('Failed to parse SSE event', e);
                }
              }
            }
          }

          if (done) {
            clearTimeout(timeout);
            // If we reached here without a complete/error event, it's an abnormal stream end
            return reject(new Error('Stream ended without completion event.'));
          }

          readChunk();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      readChunk();
    }).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};
