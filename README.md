# Groweasy CSV Importer 🚀

An intelligent, AI-powered CSV importer built for Groweasy CRM. It ingests messy, unstructured lead data, standardizes it into a unified schema, and filters invalid records.

## 🌟 Key Features
- **Efficient Parsing**: Uses `Papa.NODE_STREAM_INPUT` to process CSV buffers in chunks before passing them to the AI.
- **AI-Powered Extraction**: Uses Gemini 2.5 Flash to automatically map arbitrary columns to CRM fields.
- **Deterministic Pre-mapping**: Employs Regex heuristics to identify obvious fields (like email/phone) *before* hitting AI. This acts as a hint, dramatically reducing hallucinations and API costs.
- **Batch Processing with Backoff**: Chunks processing into batches of 25 to respect Gemini rate limits, with exponential backoff for resilience.
- **Real-Time UI**: Next.js 15 frontend with Server-Sent Events (SSE) providing a live progress bar.
- **Virtualized Tables**: Uses `@tanstack/react-virtual` to efficiently render thousands of rows in the preview and results views without lag.
- **Rules Processing**: Handles multiple emails/phones (routing extras to notes), cleans up phone formats, and filters skipped rows seamlessly.

## Scripts

At the root directory, you can use these commands:
- `npm run dev` - Starts both the Next.js client and Express server concurrently.
- `npm run build` - Builds both client and server workspaces.
- `npm run test` - Runs the Vitest test suite for the backend.
- `npm run check` - Runs both `npm run test` and `npm run build` sequentially for CI/CD checks.

## Implementation Details

- **Frontend (Next.js)**: Drag & Drop upload with PapaParse stream processing. The initial preview displays only the first 100 rows to ensure UI responsiveness. The "Confirm Import" pushes the entire file to the backend API.
- **Backend (Express)**: Receives the file via Multer (max 10MB CSV), parses it chunk by chunk, and dispatches batches to Gemini.
- **AI Processing**: Gemini 2.5 Flash maps fields into standard headers. It employs an exponential backoff retry mechanism (up to 3 tries per batch).
- **Validation**: Strict row-by-row Zod schema parsing guarantees valid output shapes, dropping invalid rows into a skipped records list instead of failing entire batches.
- **Progress Tracking**: Uses SSE (Server-Sent Events) to provide real-time batch completion percentages to the frontend.
- **Export**: Generates a downloadable CSV mapping from the successfully processed entries.

## 🛠 Tech Stack
- **Frontend**: Next.js 15 (React 19), pure CSS Modules, `@tanstack/react-virtual`
- **Backend**: Node.js, Express, TypeScript, Zod, Multer
- **AI Engine**: Google Generative AI (`gemini-2.5-flash`)

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+) OR Docker
- A Google Gemini API Key

### Using Docker Compose (Recommended)
You can easily spin up the entire application stack using Docker Compose:
1. Copy `.env.example` to `.env` and add your `GEMINI_API_KEY`.
2. Run the following command:
   ```bash
   docker-compose up --build
   ```
3. The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:3001`.

### Using npm Workspaces (Manual)
1. Clone the repository.
2. Run `npm install` at the root.
3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
4. Add your `GEMINI_API_KEY` to the `.env` file.
5. Start both development servers concurrently:
   ```bash
   npm run dev
   ```

## 🧪 Testing
Run the backend unit tests:
```bash
npm test
```

You can find 6 diverse test CSVs (including a 5000-row stress test and messy formats like Facebook/Google Ads exports) in the `test/` directory.

## 📦 Deployment
The application is structured as a monorepo and can be deployed easily:
- **Live Demo**: [https://groweasy-csv-importer-client.vercel.app/](https://groweasy-csv-importer-client.vercel.app/)
- **Frontend (Vercel)**: Point Vercel to the `client/` directory and set `NEXT_PUBLIC_API_URL` to your backend URL.
- **Backend (Render/Railway)**: Point to the `server/` directory. Run `npm run build` and start with `npm start`. Ensure you set `GEMINI_API_KEY` and `CLIENT_URL` (for CORS).

## ⚠️ Known Limitations
- The AI batch processing size is currently set to 25 to balance rate limits and speed. For extremely large files (e.g. 100k+ rows) on a free Gemini tier, this may take time or hit API limits. We use exponential backoff to handle 429 Too Many Requests seamlessly.
