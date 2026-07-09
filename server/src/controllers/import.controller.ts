import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { parseCSVStream } from '../services/csv.service';

export const handleImport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file || req.file.size === 0 || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: 'No file uploaded or file is empty' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // CRITICAL: Prevent Nginx from buffering SSE
    res.flushHeaders();

    logger.info(`Starting import for file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Fast newline split for estimated record count (subtract 1 for header)
    const fileString = req.file.buffer.toString('utf-8');
    const totalRecordsCount = Math.max(0, fileString.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0).length - 1);

    // The parseCSVStream service will handle batching, calling AI, and writing SSE events
    await parseCSVStream(req.file.buffer, res, totalRecordsCount);

    // No need to call res.end() here, the stream service should handle it after completing
  } catch (error) {
    console.error("MY_ERROR", 'Import controller error', error);
    // If headers haven't been sent, we can use standard JSON error
    if (!res.headersSent) {
      next(error);
    } else {
      try { res.write(`data: ${JSON.stringify({ type: 'error', message: 'An unexpected error occurred during processing. ' + (error?.message || error) + '' })}\n\n`); } catch(e) { console.error("WRITE FAILED", e); }
      res.end();
    }
  }
};
