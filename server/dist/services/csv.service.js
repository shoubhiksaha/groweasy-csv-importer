"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSVStream = void 0;
const papaparse_1 = __importDefault(require("papaparse"));
const stream_1 = require("stream");
const logger_1 = require("../utils/logger");
const batch_service_1 = require("./batch.service");
const parseCSVStream = (fileBuffer, res) => {
    return new Promise((resolve, reject) => {
        const stream = stream_1.Readable.from(fileBuffer);
        let headers = [];
        let currentBatch = [];
        let batchIndex = 0;
        let totalRecords = 0;
        let processedRecords = 0;
        const batchSize = 25; // 25 records per batch to balance latency and context
        // Accumulators for the final result
        const allCrmRecords = [];
        const allSkippedDetails = [];
        const startTime = Date.now();
        // To prevent processing subsequent batches if an unrecoverable error occurs
        let hasError = false;
        // PapaParse stream parsing
        const papaStream = papaparse_1.default.parse(papaparse_1.default.NODE_STREAM_INPUT, {
            header: true,
            skipEmptyLines: true,
            // We don't know if the file is UTF-8 or something else, but Papa handles Node streams mostly as UTF-8 unless configured otherwise
        });
        stream.pipe(papaStream);
        papaStream.on('data', async (row) => {
            if (hasError)
                return;
            if (headers.length === 0) {
                headers = Object.keys(row);
            }
            currentBatch.push(row);
            totalRecords++;
            if (currentBatch.length >= batchSize) {
                papaStream.pause(); // Pause streaming to process batch
                batchIndex++;
                try {
                    const { crmRecords, skippedRecords } = await (0, batch_service_1.processBatch)(headers, currentBatch, batchIndex, totalRecords);
                    allCrmRecords.push(...crmRecords);
                    allSkippedDetails.push(...skippedRecords);
                    processedRecords += currentBatch.length;
                    // Send SSE Progress Event
                    res.write(`data: ${JSON.stringify({
                        type: 'progress',
                        batchIndex,
                        totalBatches: '?', // Unknown until end
                        processedRecords,
                        totalRecords: '?',
                        message: `Processed batch ${batchIndex}`,
                    })}\n\n`);
                    currentBatch = [];
                    papaStream.resume();
                }
                catch (error) {
                    logger_1.logger.error(`Error processing batch ${batchIndex}`, error);
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
        papaStream.on('error', (err) => {
            logger_1.logger.error('PapaParse stream error', err);
            hasError = true;
            res.write(`data: ${JSON.stringify({
                type: 'error',
                message: 'Failed to parse CSV file.'
            })}\n\n`);
            res.end();
            reject(err);
        });
        papaStream.on('end', async () => {
            if (hasError)
                return;
            // Process remaining records in the last batch
            if (currentBatch.length > 0) {
                batchIndex++;
                try {
                    const { crmRecords, skippedRecords } = await (0, batch_service_1.processBatch)(headers, currentBatch, batchIndex, totalRecords);
                    allCrmRecords.push(...crmRecords);
                    allSkippedDetails.push(...skippedRecords);
                    processedRecords += currentBatch.length;
                    res.write(`data: ${JSON.stringify({
                        type: 'progress',
                        batchIndex,
                        totalBatches: batchIndex,
                        processedRecords,
                        totalRecords: processedRecords,
                        message: `Processed final batch ${batchIndex}`,
                    })}\n\n`);
                }
                catch (error) {
                    logger_1.logger.error(`Error processing final batch ${batchIndex}`, error);
                    hasError = true;
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        message: `Failed to process batch ${batchIndex}. ${error.message}`
                    })}\n\n`);
                    res.end();
                    return reject(error);
                }
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
exports.parseCSVStream = parseCSVStream;
