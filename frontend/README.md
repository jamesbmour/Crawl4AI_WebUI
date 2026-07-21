# Frontend

React + Vite + TypeScript + Tailwind CSS frontend for Crawl4AI Studio.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **Code Editor**: CodeMirror (via @uiw/react-codemirror)
- **Markdown Rendering**: react-markdown with remark-gfm

## Project Structure

```
src/
├── components/     # Reusable UI components
├── lib/           # Utility functions and config definitions
├── pages/         # Route pages (Scrape, Batch, Deep, Discovery, Extraction, Adaptive, Ask, Jobs, Settings)
├── styles/        # Global styles
└── main.tsx       # Application entry point
```

## Available Scripts

```bash
npm run dev       # Start development server (http://localhost:5173)
npm run build     # Build for production
npm run preview   # Preview production build locally
```

## Development

The frontend communicates with the backend API running on `http://127.0.0.1:8742`.

Key features:
- **Config Accordion**: Generated from declarative field definitions in `src/lib/config.ts`, mirroring backend models 1:1
- **Live Streaming**: Real-time job progress via Server-Sent Events (SSE)
- **Code Preview**: Syntax-highlighted display for JSON, HTML, and JavaScript outputs

## Environment Variables

No additional environment variables required for local development. The API base URL is configured to proxy to the backend server.
