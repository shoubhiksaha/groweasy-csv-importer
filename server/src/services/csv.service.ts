import Papa from 'papaparse';
import { Readable } from 'stream';
import { Response } from 'express';
import { logger } from '../utils/logger';
import { processBatch } from './batch.service';
import { SkippedRecord } from '../types/api.types';
import { CRMRecord } from '../types/crm.types';

export const parseCSVStream = (fileBuffer: Buffer, res: Response, totalRecordsCount: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stream = Readable.from(fileBuffer);
    
    let headers: string[] = [];
    let currentBatch: any[] = [];
    let batchIndex = 0;
    let totalRecords = 0;
    let processedRecords = 0;
    const batchSize = 25; // 25 records per batch to balance latency and context

    // Accumulators for the final result
    const allCrmRecords: import('../types/crm.types').CRMRecord[] = [];
    const allSkippedDetails: SkippedRecord[] = [];
    const startTime = Date.now();

    // To prevent processing subsequent batches if an unrecoverable error occurs
    let hasError = false;

    // Detect if client drops connection
    if (res.req) {
      res.req.on('close', () => {
        if (!hasError && !res.writableEnded) {
          logger.warn('Client disconnected prematurely. Aborting import.');
          hasError = true;
          papaStream.destroy(); // stop parsing
          reject(new Error('Client disconnected'));
        }
      });
    }

    // Send Initial Progress Event so UI doesn't wait for the first batch
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      batchIndex: 0,
      totalBatches: Math.ceil(totalRecordsCount / batchSize),
      processedRecords: 0,
      totalRecords: totalRecordsCount,
      message: 'Initializing import...',
    })}\n\n`);

    // PapaParse stream parsing
    const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
      header: true,
      skipEmptyLines: true,
      // We don't know if the file is UTF-8 or something else, but Papa handles Node streams mostly as UTF-8 unless configured otherwise
    });

    stream.pipe(papaStream);

    papaStream.on('data', async (row: any) => {
      if (hasError) return;

      if (headers.length === 0) {
        headers = Object.keys(row);
      }

      currentBatch.push(row);
      totalRecords++;

      if (currentBatch.length >= batchSize) {
        papaStream.pause(); // Pause streaming to process batch
        batchIndex++;
        
        const pingInterval = setInterval(() => {
          // Check writableEnded and destroyed to prevent EPIPE crashes if client disconnected
          if (!hasError && !res.writableEnded && !res.destroyed) {
            res.write(`:\n\n`); // SSE comment acts as a ping
          } else {
            clearInterval(pingInterval);
          }
        }, 15000);

        try {
          const { crmRecords, skippedRecords } = await processBatch(headers, currentBatch, batchIndex, totalRecords);
          clearInterval(pingInterval);
          allCrmRecords.push(...crmRecords);
          allSkippedDetails.push(...skippedRecords);
          processedRecords += currentBatch.length;

          // Send SSE Progress Event
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            batchIndex,
            totalBatches: Math.ceil(totalRecordsCount / batchSize), 
            processedRecords,
            totalRecords: totalRecordsCount,
            message: `Processed batch ${batchIndex}`,
          })}\n\n`);

          currentBatch = [];
          papaStream.resume();
        } catch (error: any) {
          clearInterval(pingInterval);
          logger.error(`Error processing batch ${batchIndex}`, error);
          hasError = true;
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: `Failed to process batch ${batchIndex}. ${error.message}`
          })}\n\n`);
          res.end();
          reject(error);
        }
      }
    });

    papaStream.on('error', (err: any) => {
      logger.error('PapaParse stream error', err);
      hasError = true;
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: 'Failed to parse CSV file.'
      })}\n\n`);
      res.end();
      reject(err);
    });

    papaStream.on('end', async () => {
      if (hasError) return;

      // Process remaining records in the last batch
      if (currentBatch.length > 0) {
        batchIndex++;
        const pingInterval = setInterval(() => {
          if (!hasError && !res.writableEnded && !res.destroyed) {
            res.write(`:\n\n`);
          } else {
            clearInterval(pingInterval);
          }
        }, 15000);

        try {
          const { crmRecords, skippedRecords } = await processBatch(headers, currentBatch, batchIndex, totalRecords);
          clearInterval(pingInterval);

          allCrmRecords.push(...crmRecords);
          allSkippedDetails.push(...skippedRecords);
          processedRecords += currentBatch.length;
          
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            batchIndex,
            totalBatches: Math.ceil(totalRecordsCount / batchSize),
            processedRecords,
            totalRecords: totalRecordsCount,
            message: `Processed final batch ${batchIndex}`,
          })}\n\n`);
        } catch (error: any) {
          clearInterval(pingInterval);
          logger.error(`Error processing final batch ${batchIndex}`, error);
          hasError = true;
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: `Failed to process batch ${batchIndex}. ${error.message}`
          })}\n\n`);
          res.end();
          return reject(error);
        }
      }

      if (processedRecords === 0) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'CSV file is empty or contains no headers'
        })}\n\n`);
        res.end();
        return reject(new Error('Empty file'));
      }

      // Send Completion Event
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        data: {
          totalRecords: processedRecords,
          importedRecords: allCrmRecords.length,
          skippedRecords: allSkippedDetails.length,
          crmRecords: allCrmRecords,
          skippedDetails: allSkippedDetails,
          processingTime: Date.now() - startTime
        },
        message: 'Import completed successfully'
      })}\n\n`);
      res.end();
      resolve();
    });
  });
};
