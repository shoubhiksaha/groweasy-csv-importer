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
    
    // Ping the backend every 3 minutes to prevent Render's free tier from spinning down due to "inactivity"
    const keepAwakeInterval = setInterval(() => {
      fetch(`${API_URL}/`).catch(() => {}); // silent ping
    }, 180000);

    fetch(`${API_URL}/api/import`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    }).then(async (response) => {
      if (!response.ok) {
        clearInterval(keepAwakeInterval);
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
        clearInterval(keepAwakeInterval);
        return reject(new Error('Response body is empty.'));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const readChunk = async () => {
        try {
          const { done, value } = await reader.read();

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const parts = buffer.split('\n\n');
            buffer = parts.pop() || ''; // Keep the incomplete part in the buffer

            for (const part of parts) {
              if (part.startsWith('data: ')) {
                const dataStr = part.slice(6);
                try {
                  const event = JSON.parse(dataStr);
                  onProgress(event);
                  if (event.type === 'complete') {
                    clearInterval(keepAwakeInterval);
                    resolve(event.data as ImportResponse['data']);
                    return;
                  } else if (event.type === 'error') {
                    clearInterval(keepAwakeInterval);
                    reject(new Error(event.message));
                    return;
                  }
                } catch (e) {
                  console.error('Failed to parse SSE JSON', e);
                }
              }
            }
          }

          if (done) {
            clearInterval(keepAwakeInterval);
            // If we reached here without a complete/error event, it's an abnormal stream end
            return reject(new Error('Stream ended without completion event.'));
          }

          readChunk();
        } catch (error) {
          clearInterval(keepAwakeInterval);
          reject(error);
        }
      };

      readChunk();
    }).catch((err) => {
      clearInterval(keepAwakeInterval);
      reject(err);
    });
  });
};
