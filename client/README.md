# Groweasy CSV Importer — Frontend

This is the **Next.js 15** frontend for the Groweasy CSV Importer. It handles file upload, CSV preview, real-time import progress via SSE, and results display.

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Pure CSS Modules (no Tailwind)
- **Virtualization**: `@tanstack/react-virtual` — renders 5,000+ row tables without lag
- **CSV Parsing**: `papaparse` — client-side preview only (first 100 rows)
- **Icons/UX**: Dark mode via CSS custom properties, drag-and-drop via `react-dropzone`

## Development

From the **monorepo root**:
```bash
npm run dev
```

Or from this directory:
```bash
npm run dev
```

The dev server runs on **http://localhost:3000** and requires the backend running on port **3001**.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL of the Express backend API |

## Key Files

```
src/
├── app/
│   ├── page.tsx          # Main 4-step import flow (upload → preview → progress → results)
│   ├── layout.tsx        # Root layout, font, theme provider
│   └── globals.css       # Design tokens (colors, spacing, dark mode)
├── components/
│   ├── upload/DropZone   # Drag-and-drop file upload
│   ├── preview/DataTable # Virtualized scrollable table
│   ├── results/          # ResultsSummary component
│   └── ui/               # Button, Card, ProgressBar, ThemeProvider
└── lib/
    └── api.ts            # SSE streaming client for /api/import
```

## Build

```bash
npm run build
```

## Deployment

Deployed on **Vercel**. Point Vercel to this `client/` directory and set the `NEXT_PUBLIC_API_URL` environment variable to your backend URL.

Live: https://groweasy-csv-importer-client.vercel.app/
