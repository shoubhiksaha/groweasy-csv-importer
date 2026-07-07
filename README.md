# Groweasy CSV Importer 🚀

An intelligent, AI-powered CSV importer built for Groweasy CRM. It ingests messy, unstructured lead data, standardizes it into a unified schema, and filters invalid records.

## 🌟 Key Features
- **Streaming Pipeline**: Handles giant CSV files using `Papa.NODE_STREAM_INPUT` to stream rows rather than blowing up memory.
- **AI-Powered Extraction**: Uses Gemini 2.5 Flash to automatically map arbitrary columns to CRM fields.
- **Deterministic Pre-mapping**: Employs Regex heuristics to identify obvious fields (like email/phone) *before* hitting AI. This acts as a hint, dramatically reducing hallucinations and API costs.
- **Batch Processing with Backoff**: Chunks processing into batches of 25 to respect Gemini rate limits, with exponential backoff for resilience.
- **Real-Time UI**: Next.js 15 frontend with Server-Sent Events (SSE) providing a live progress bar.
- **Virtualized Tables**: Uses `@tanstack/react-virtual` to efficiently render thousands of rows in the preview and results views without lag.
- **Rules Processing**: Handles multiple emails/phones (routing extras to notes), cleans up phone formats, and filters skipped rows seamlessly.

## 🛠 Tech Stack
- **Frontend**: Next.js 15 (React 19), pure CSS Modules, `@tanstack/react-virtual`
- **Backend**: Node.js, Express, TypeScript, Zod, Multer
- **AI Engine**: Google Generative AI (`gemini-2.5-flash`)

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+)
- A Google Gemini API Key

### Setup
1. Clone the repository.
2. Run `npm install` at the root (this uses npm workspaces to install both client and server dependencies).
3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
4. Add your `GEMINI_API_KEY` to the `.env` file.
5. Start both development servers concurrently:
   ```bash
   npm run dev
   ```
   
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## 🧪 Testing
Run the backend unit tests:
```bash
npm test
```

You can find 6 diverse test CSVs (including a 5000-row stress test and messy formats like Facebook/Google Ads exports) in the `test/` directory.

## 📦 Deployment
The application is structured as a monorepo and can be deployed easily:
- **Frontend (Vercel)**: Point Vercel to the `client/` directory and set `NEXT_PUBLIC_API_URL` to your backend URL.
- **Backend (Render/Railway)**: Point to the `server/` directory. Run `npm run build` and start with `npm start`. Ensure you set `GEMINI_API_KEY` and `CLIENT_URL` (for CORS).

## ⚠️ Known Limitations
- The AI batch processing size is currently set to 25 to balance rate limits and speed. For extremely large files (e.g. 100k+ rows) on a free Gemini tier, this may take time or hit API limits. We use exponential backoff to handle 429 Too Many Requests seamlessly.
