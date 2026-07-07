"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./utils/logger");
const import_routes_1 = __importDefault(require("./routes/import.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express_1.default.json({ limit: '50mb' }));
// Routes
app.use('/api/import', import_routes_1.default);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    logger_1.logger.info(`Server is running on port ${PORT}`);
});
