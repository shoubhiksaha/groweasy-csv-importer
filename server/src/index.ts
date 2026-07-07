import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import importRoutes from './routes/import.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(url => url.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/import', importRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
