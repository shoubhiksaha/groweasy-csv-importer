# Groweasy CSV Importer 🚀

An intelligent, AI-powered CSV importer built for Groweasy CRM. It ingests messy, unstructured lead data, standardizes it into a unified schema, and filters invalid records.

## 🌟 Key Features
- **Efficient Parsing**: Uses `Papa.NODE_STREAM_INPUT` to process CSV buffers chunk by chunk.
- **Hybrid AI & Local Extraction**: Uses Gemini 2.5 Flash to intelligently map arbitrary columns to CRM fields just once using a sample of 5 rows.
- **Deterministic High-Speed Processing**: Once the schema is mapped, thousands of rows are processed deterministically using robust regex extractors in massive local batches (5000 rows in ~6 seconds).
- **Batch Processing**: Chunks processing into local batches of 1000 to keep memory footprint low and provide real-time updates.
- **Real-Time UI**: Next.js 15 frontend with Server-Sent Events (SSE) providing a live progress bar and a graceful **Cancel Import** flow.
- **Virtualized Tables**: Uses `@tanstack/react-virtual` to efficiently render thousands of rows in the preview and results views without lag.
- **Robust Rules Engine**: Handles multiple emails/phones (splitting glued numbers and routing extras to notes), cleans up complex Indian and International phone formats, and relies on an aggressive keyword safety net for unmapped columns.

## Scripts

At the root directory, you can use these commands:
- `npm run dev` - Starts both the Next.js client and Express server concurrently.
- `npm run build` - Builds both client and server workspaces.
- `npm run test` - Runs the Vitest test suite for the backend.
- `npm run check` - Runs both `npm run test` and `npm run build` sequentially for CI/CD checks.

## Implementation Details

- **Frontend (Next.js)**: Drag & Drop upload with a lightweight PapaParse chunked preview. The initial preview parses and displays only the first 100 rows to ensure UI responsiveness. The "Confirm Import" pushes the entire file buffer to the backend API.
- **Backend (Express)**: Receives the file via Multer (max 10MB CSV), parses it chunk by chunk using `Papa.NODE_STREAM_INPUT`, and processes them in batches of 1000.
- **AI Processing**: Gemini 2.5 Flash maps arbitrary fields into standard headers by inferring context from the first 5 rows of data. It is called exactly once per import.
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
*Note: The API tests bind a local listener via Supertest. Ensure your environment allows local listening if running in a restricted sandbox.*

You can find 6 diverse test CSVs (including a 5000-row stress test and messy formats like Facebook/Google Ads exports) in the `test/` directory.

## 📦 Deployment
The application is structured as a monorepo and can be deployed easily:
- **Live Frontend**: [https://groweasy-csv-importer-client.vercel.app/](https://groweasy-csv-importer-client.vercel.app/)
- **Live Backend API**: [https://groweasy-api-wa99.onrender.com/](https://groweasy-api-wa99.onrender.com/)
- **Frontend (Vercel)**: Point Vercel to the `client/` directory and set `NEXT_PUBLIC_API_URL` to your backend URL.
- **Backend (Render/Railway)**: Point to the `server/` directory. Run `npm run build` and start with `npm start`. Ensure you set `GEMINI_API_KEY` and `CLIENT_URL` (for CORS, though we allow `*` by default for ease of testing).

## ⚠️ Known Limitations
- **Rate Limits**: By using the hybrid architecture (AI mapping once, local extraction for all rows), rate limit issues are greatly reduced. If the single AI mapping call fails, the system falls back to deterministic keyword-based header matching automatically.
- **NPM Audit Warning**: Running `npm audit` will report a moderate advisory related to `postcss` inside the Next.js dependency tree. This is an upstream advisory in Next.js and has been deliberately left untouched to avoid breaking the build with force-downgrades.
- **Phone Parsing Bias**: The fallback phone number parsing (`libphonenumber-js`) defaults to India (`IN`) to handle GrowEasy sample data effectively. International numbers might parse imperfectly without an explicit country code.
- **Progress Tracking Accuracy**: The progress bar updates per-batch using a pre-calculated total record count. While highly accurate, the exact percentage reflects batch completion rather than per-row granularity.
