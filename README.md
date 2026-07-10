# Groweasy CSV Importer 🚀

An intelligent, AI-powered CSV importer built for Groweasy CRM. It ingests messy, unstructured lead data, standardizes it into a unified schema, and filters invalid records.

## 🌟 Key Features
- **Extreme Performance**: Processes 5,000+ rows in **under 6 seconds** using a highly optimized Hybrid AI pipeline.
- **Hybrid AI & Local Extraction**: Calls Gemini 2.5 Flash exactly **once** on a 5-row sample to map arbitrary columns to CRM fields, preventing rate-limit blocks and timeout failures.
- **Robust Data Recovery**: Uses advanced multi-stage regex and `libphonenumber-js` to extract and split merged emails/phones perfectly, even if the AI fails.
- **Memory Safe & Cancellable**: Fully streams data internally with a strict 10MB limit. Users can instantly cancel an active import from the UI, which gracefully drops the TCP connection and destroys server streams to prevent CPU leaks.
- **Real-Time UI**: Next.js 15 frontend with Server-Sent Events (SSE) providing a live progress bar.
- **Virtualized Tables**: Uses `@tanstack/react-virtual` to efficiently render thousands of rows in the preview and results views without lag.

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

---

### Step 1 — Prerequisites

Before you begin, make sure you have the following installed on your machine:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18 or higher | https://nodejs.org |
| **npm** | v9 or higher (bundled with Node.js) | — |
| **Git** | Any recent version | https://git-scm.com |
| **Docker & Docker Compose** *(optional)* | Any recent version | https://www.docker.com/products/docker-desktop |

You can verify your Node.js and npm versions by running:
```bash
node --version   # should output v18.x.x or higher
npm --version    # should output 9.x.x or higher
```

---

### Step 2 — Get a Gemini API Key

The backend requires a **Google Gemini API key** to power the AI column mapping.

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account.
3. Click **"Create API key"**.
4. Copy the generated key — you'll need it in the next step.

> **Note:** The free tier of the Gemini API is sufficient to run this application. The Hybrid AI design ensures Gemini is only called **once per import** (not once per row), so you will not hit rate limits under normal usage.

---

### Step 3 — Clone the Repository

```bash
git clone https://github.com/shoubhiksaha/groweasy-csv-importer.git
cd groweasy-csv-importer
```

---

### Step 4 — Configure Environment Variables

The project uses a single `.env` file at the **root** of the monorepo that is shared by both the client and server.

Copy the provided example file:
```bash
cp .env.example .env
```

Now open `.env` in your editor and fill in your values:

```env
# ──────────────────────────────────────
# Server (Express backend on port 3001)
# ──────────────────────────────────────
PORT=3001
GEMINI_API_KEY="your_api_key_here"   # ← Paste your Gemini API key here

# ──────────────────────────────────────
# Client (Next.js frontend on port 3000)
# ──────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> **Important:** Never commit your `.env` file to Git. It is already listed in `.gitignore` for your protection.

---

### Step 5 — Run the Application

Choose **one** of the two methods below:

---

#### ▶ Option A: Docker Compose (Recommended — No Node.js setup needed)

This is the simplest method. Docker will build and run both the frontend and backend in isolated containers automatically.

```bash
docker-compose up --build
```

Wait for both services to start (you'll see logs from both `client` and `server`).

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |

To stop the application:
```bash
docker-compose down
```

---

#### ▶ Option B: npm Workspaces (Manual Setup)

**1. Install all dependencies** (this installs both client and server packages from the root):
```bash
npm install
```

**2. Start both development servers concurrently:**
```bash
npm run dev
```

This single command starts:
- **Next.js** dev server on `http://localhost:3000`
- **Express** dev server on `http://localhost:3001` (with hot-reload via `tsx watch`)

You should see output similar to:
```
[0] ▲ Next.js 15.x.x
[0] ✓ Starting...
[0] ✓ Ready in 1234ms
[1] ◇ injected env (3) from .env
[1] Server is running on port 3001
```

---

### Step 6 — Using the Application

Once both servers are running, open **http://localhost:3000** in your browser.

1. **Upload** — Drag & drop or click to upload any `.csv` file.
2. **Preview** — The first 100 rows are parsed and displayed instantly (no AI yet).
3. **Confirm Import** — Click "Confirm Import" to trigger the AI mapping + full processing.
4. **Results** — Watch the live progress bar, then review imported and skipped records.
5. **Export** — Download the final standardized CRM CSV.

#### Sample Test Files

7 ready-to-use test CSVs are available in the `test/` directory:

| File | Description |
|------|-------------|
| `sample_leads.csv` | Clean GrowEasy-format leads |
| `messy_leads.csv` | Mixed emails/phones in one column |
| `facebook_ads_leads.csv` | Facebook Lead Ads export format |
| `google_ads_leads.csv` | Google Ads export format |
| `real_estate_leads.csv` | Real estate CRM export format |
| `missing_contact_leads.csv` | Rows missing both email and phone (should be skipped) |
| `huge_5000_leads.csv` | 5,000-row stress test (~380KB) |

---

## 🧪 Running Tests

Run the full backend test suite (23 tests) with:
```bash
npm test
```

To run tests with verbose output:
```bash
npm run test --workspace=server -- --reporter=verbose
```

To run a full CI check (tests + build):
```bash
npm run check
```

> **What's tested:** AI fallback behaviour, phone number parsing (Indian/US formats), CRM status normalization (`not interested` → `BAD_LEAD`, etc.), source field cleaning, owner email leakage prevention, and the SSE streaming API endpoint.

---

## 📁 Project Structure

```
groweasy-csv-importer/
├── client/                  # Next.js 15 frontend
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # UI components (DataTable, UploadZone, etc.)
│       └── lib/             # API client, types
├── server/                  # Express backend
│   └── src/
│       ├── controllers/     # Route handlers
│       ├── services/
│       │   ├── ai.service.ts      # Gemini API call for schema mapping
│       │   ├── batch.service.ts   # Deterministic row extraction logic
│       │   └── csv.service.ts     # CSV streaming + SSE orchestration
│       ├── validators/      # Zod schemas
│       └── utils/           # Logger, helpers
├── test/                    # Sample CSV files for testing
├── .env.example             # Environment variable template
├── docker-compose.yml       # Docker Compose config
└── package.json             # Root workspace config
```

---

## 📦 Deployment

| Service | URL |
|---------|-----|
| **Live Frontend** | https://groweasy-csv-importer-client.vercel.app/ |
| **Live Backend API** | https://groweasy-api-wa99.onrender.com/ |

**Deploy your own:**
- **Frontend → Vercel**: Point Vercel to the `client/` directory. Set environment variable `NEXT_PUBLIC_API_URL` to your backend URL.
- **Backend → Render / Railway**: Point to the `server/` directory. Build command: `npm run build`. Start command: `npm start`. Set `GEMINI_API_KEY` and optionally `CLIENT_URL` for CORS.

---

## ⚠️ Known Limitations

- **Rate Limits**: By using the Hybrid AI architecture (one AI call per import, not per row), rate limit issues are greatly minimised. If the single AI mapping call fails, the system falls back to deterministic keyword-based header matching automatically so the import never crashes.
- **File Size**: CSV files are capped at **10MB** via Multer to protect server memory. This comfortably covers files with 100,000+ rows depending on column count.
- **Phone Parsing Bias**: The fallback phone number parser (`libphonenumber-js`) defaults to India (`IN`) to handle GrowEasy's primary market. International numbers without an explicit country code prefix may parse imperfectly.
- **NPM Audit Warning**: `npm audit` reports a moderate advisory for `postcss` inside the Next.js dependency tree. This is an upstream Next.js issue and has been deliberately left untouched to avoid breaking the build with forced downgrades.
- **Progress Tracking Accuracy**: The progress bar updates per-batch (batches of 1,000 rows). The percentage reflects batch completion rather than individual row granularity, but remains highly accurate in practice.

