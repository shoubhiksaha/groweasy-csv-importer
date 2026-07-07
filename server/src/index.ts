import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger';
import importRoutes from './routes/import.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();
// In a monorepo, often the .env is at the root. Fallback to the root if not in server/
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
