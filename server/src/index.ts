import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger';
import importRoutes from './routes/import.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config({ override: true });
// In a monorepo, often the .env is at the root. Fallback to the root if not in server/
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = process.env.CLIENT_URL 
  ? { origin: process.env.CLIENT_URL.split(',').map(url => url.trim()) }
  : { origin: '*' }; // Allow all if not specified to make deployment easier
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/import', importRoutes);
app.get('/', (req, res) => res.json({ status: 'ok', service: 'groweasy-csv-importer-api' }));

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
