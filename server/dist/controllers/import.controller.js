"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleImport = void 0;
const logger_1 = require("../utils/logger");
const csv_service_1 = require("../services/csv.service");
const handleImport = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        logger_1.logger.info(`Starting import for file: ${req.file.originalname} (${req.file.size} bytes)`);
        // The parseCSVStream service will handle batching, calling AI, and writing SSE events
        await (0, csv_service_1.parseCSVStream)(req.file.buffer, res);
        // No need to call res.end() here, the stream service should handle it after completing
    }
    catch (error) {
        logger_1.logger.error('Import controller error', error);
        // If headers haven't been sent, we can use standard JSON error
        if (!res.headersSent) {
            next(error);
        }
        else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'An unexpected error occurred during processing.' })}\n\n`);
            res.end();
        }
    }
};
exports.handleImport = handleImport;
