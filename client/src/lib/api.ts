import { ImportResponse, ProgressEvent } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const importCSV = (
  file: File,
  onProgress: (event: ProgressEvent) => void
): Promise<ImportResponse['data']> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_URL}/api/import`, {
      method: 'POST',
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
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
        return reject(new Error('Response body is empty.'));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';

      const readChunk = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (part.startsWith('data: ')) {
              const dataStr = part.slice(6);
              try {
                const event: ProgressEvent = JSON.parse(dataStr);
                onProgress(event);
                if (event.type === 'complete') {
                  resolve(event.data as ImportResponse['data']);
                  return;
                } else if (event.type === 'error') {
                  reject(new Error(event.message));
                  return;
                }
              } catch (e) {
                console.error('Failed to parse SSE event', e);
              }
            }
          }
          readChunk();
        } catch (error) {
          reject(error);
        }
      };

      readChunk();
    }).catch(reject);
  });
};
