"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const errorHandler = (err, req, res, next) => {
    logger_1.logger.error(`Error processing request: ${err.message}`, err.stack);
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.issues,
        });
    }
    if (err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    res.status(500).json({
        success: false,
        message: 'Internal server error',
    });
};
exports.errorHandler = errorHandler;
