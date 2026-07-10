import Papa from 'papaparse';
import { Readable } from 'stream';
import { Response } from 'express';
import { logger } from '../utils/logger';
import { processBatchLocal } from './batch.service';
import { inferColumnMappingWithAI } from './ai.service';
import { SkippedRecord } from '../types/api.types';
import { CRMRecord } from '../types/crm.types';

/**
 * Deterministic header-to-CRM field mapping used as a fallback when AI is unavailable.
 * Matches CSV headers to CRM fields using keyword heuristics.
 */
const deterministicFallbackMapping = (headers: string[]): Record<string, string | null> => {
  const crmFields: Record<string, string[]> = {
    name: ['name', 'full name', 'fullname', 'contact name', 'lead name', 'customer'],
    email: ['email', 'e-mail', 'mail', 'email address', 'emailid', 'contact info', 'contact'],
    country_code: ['country code', 'countrycode', 'dial code', 'phone code'],
    mobile_without_country_code: ['phone', 'mobile', 'cell', 'telephone', 'contact number', 'phone number', 'mobile number', 'contact info'],
    company: ['company', 'organization', 'org', 'firm', 'business'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    country: ['country', 'nation'],
    lead_owner: ['owner', 'lead owner', 'assigned to', 'agent', 'sales rep'],
    crm_status: ['status', 'lead status', 'stage', 'disposition'],
    crm_note: ['note', 'notes', 'comment', 'comments', 'remark', 'remarks'],
    data_source: ['source', 'lead source', 'data source', 'campaign', 'origin'],
    created_at: ['date', 'created', 'created at', 'created_at', 'timestamp', 'created date'],
    possession_time: ['possession', 'possession time', 'move in'],
    description: ['description', 'desc', 'details', 'about'],
  };

  const mapping: Record<string, string | null> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const [field, keywords] of Object.entries(crmFields)) {
    let matched: string | null = null;
    for (const keyword of keywords) {
      const idx = lowerHeaders.findIndex(h => h === keyword || h.includes(keyword));
      if (idx !== -1) {
        matched = headers[idx]; // Use original casing
        break;
      }
    }
    mapping[field] = matched;
  }

  return mapping;
};

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

    res.on('close', () => {
      if (!hasError && !res.writableEnded) {
        logger.warn('Client disconnected prematurely. Aborting import.');
        hasError = true;
        stream.destroy(); // Destroying the source stream stops all data flowing into PapaParse
      }
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
          if (!columnMapping) {
            const sampleRows = currentBatch.slice(0, 5);
            try {
              columnMapping = await inferColumnMappingWithAI(headers, sampleRows);
            } catch (aiError: any) {
              logger.error('AI mapping failed, using deterministic fallback', aiError);
              columnMapping = deterministicFallbackMapping(headers);
            }
          }

          const { crmRecords, skippedRecords } = processBatchLocal(columnMapping, currentBatch, batchIndex, totalRecords);
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
          if (!res.destroyed && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: `Failed to process batch ${batchIndex}. ${error.message}`
            })}\n\n`);
            res.end();
          }
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
          if (!columnMapping) {
            const sampleRows = currentBatch.slice(0, 5);
            try {
              columnMapping = await inferColumnMappingWithAI(headers, sampleRows);
            } catch (aiError: any) {
              logger.error('AI mapping failed, using deterministic fallback', aiError);
              columnMapping = deterministicFallbackMapping(headers);
            }
          }

          const { crmRecords, skippedRecords } = processBatchLocal(columnMapping, currentBatch, batchIndex, totalRecords);
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
          if (!res.destroyed && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: `Failed to process batch ${batchIndex}. ${error.message}`
            })}\n\n`);
            res.end();
          }
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
