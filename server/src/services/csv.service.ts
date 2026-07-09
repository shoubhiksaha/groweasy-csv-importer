import Papa from 'papaparse';
import { Readable } from 'stream';
import { Response } from 'express';
import { logger } from '../utils/logger';
import { processBatchLocal } from './batch.service';
import { inferColumnMappingWithAI } from './ai.service';
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
    const batchSize = 1000; // Increase to 1000 since processing is local now

    // Accumulators for the final result
    const allCrmRecords: import('../types/crm.types').CRMRecord[] = [];
    const allSkippedDetails: SkippedRecord[] = [];
    const startTime = Date.now();
    
    let columnMapping: Record<string, string | null> | null = null;

    // To prevent processing subsequent batches if an unrecoverable error occurs
    let hasError = false;

    // Detect if client drops connection
    res.on('close', () => {
      if (!hasError && !res.writableEnded) {
        logger.warn('Client disconnected prematurely. Aborting import.');
        hasError = true;
        papaStream.destroy(); // stop parsing
        reject(new Error('Client disconnected'));
      }
    });

    // Send Initial Progress Event so UI doesn't wait for the first batch
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      batchIndex: 0,
      totalBatches: Math.ceil(totalRecordsCount / batchSize),
      processedRecords: 0,
      totalRecords: totalRecordsCount,
      message: 'Initializing AI mapping...',
    })}\n\n`);

    // PapaParse stream parsing
    const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
      header: true,
      skipEmptyLines: true,
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
        console.log("PAUSING"); papaStream.pause(); // Pause streaming to process batch
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
          if (!columnMapping) {
            console.log("GETTING AI MAPPING"); const sampleRows = currentBatch.slice(0, 5);
            columnMapping = await inferColumnMappingWithAI(headers, sampleRows);
          }

          console.log("PROCESSING BATCH"); const { crmRecords, skippedRecords } = processBatchLocal(columnMapping, currentBatch, batchIndex, totalRecords);
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
          console.error("MY_ERROR", `Error processing batch ${batchIndex}`, error);
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
      console.error("MY_ERROR", 'PapaParse stream error', err);
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
          if (!columnMapping) {
            console.log("GETTING AI MAPPING"); const sampleRows = currentBatch.slice(0, 5);
            columnMapping = await inferColumnMappingWithAI(headers, sampleRows);
          }

          console.log("PROCESSING BATCH"); const { crmRecords, skippedRecords } = processBatchLocal(columnMapping, currentBatch, batchIndex, totalRecords);
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
          console.error("MY_ERROR", `Error processing final batch ${batchIndex}`, error);
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
