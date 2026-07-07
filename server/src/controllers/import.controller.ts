import { Request, Response, NextFunction } from 'express';
import Papa from 'papaparse';
import { logger } from '../utils/logger';
import { parseCSVStream } from '../services/csv.service';

export const handleImport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    logger.info(`Starting import for file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Quick parse to get accurate total records for progress bar
    const fileString = req.file.buffer.toString('utf-8');
    
    const parsed = Papa.parse(fileString, {
      header: true,
      skipEmptyLines: true,
    });
    const totalRecordsCount = parsed.data.length;

    // The parseCSVStream service will handle batching, calling AI, and writing SSE events
    await parseCSVStream(req.file.buffer, res, totalRecordsCount);

    // No need to call res.end() here, the stream service should handle it after completing
  } catch (error) {
    logger.error('Import controller error', error);
    // If headers haven't been sent, we can use standard JSON error
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'An unexpected error occurred during processing.' })}\n\n`);
      res.end();
    }
  }
};
