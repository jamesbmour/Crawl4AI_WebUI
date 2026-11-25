# User Guide

Crawl4AI Studio is a single-page app with a left sidebar. Each nav item is a self-contained
workflow. This guide walks through every page.

The sidebar (from `App.tsx`):

```
🕷️ Crawl4AI Studio
  Globe     Scrape         /            single-URL playground
  Layers    Batch crawl    /batch       many URLs at once
  Bug       Deep crawl     /deep        recursive site crawl
  Compass   Discovery      /discovery   URL discovery (seeding)
  Braces    Extraction     /extraction  build & test extraction schemas
  Sparkles  Adaptive       /adaptive    information-foraging crawl
  ?         Ask            /ask         Q&A over crawled content
  ListTodo  Jobs           /jobs        history + live progress
  Settings  Settings       /settings    LLM provider + profiles
```

Routing is **hash-based** (`/#/batch`, etc.), so URLs are shareable and reloads work when the
app is served statically.

---

## Scrape (`/`)

The single-URL playground. Enter a URL, expand the **config accordion** (Browser / Page /
Content / Markdown / Capture / Extraction — see [configuration.md](configuration.md)), and run.
Progress streams live; results open in the tabbed viewer.

Typical uses: dialing in a configuration before scaling it up to a batch, one-off extractions,
capturing a screenshot/PDF, or inspecting exactly what crawl4ai returns for a page.

---

## Batch crawl (`/batch`)

Paste a list of URLs (one per line) and run them through `arun_many()`. Beyond the shared
config, this page exposes the **dispatcher**:

- **Memory-adaptive** — scales concurrency with available RAM (`max_session_permit`,
  `memory_threshold_percent`).
- **Semaphore** — fixed concurrency (`semaphore_count`).
- **Rate limiting** — optional per-request delay window with backoff and retries.

Results stream in as each URL finishes, with a live `completed / total` counter. If **every**
URL fails, the job is marked `failed`.

---

## Deep crawl (`/deep`)

Recursively follow links from a start URL. Choose a **strategy**:

- **BFS** — breadth-first; explore level by level.
- **DFS** — depth-first; dive down one path before backtracking.
- **Best-First** — a priority queue ordered by URL score (needs `keywords` to score usefully).

Bound the crawl with `max_depth` and `max_pages`, keep it on-site (`include_external=false`),
and shape it with a **filter chain** (URL pattern, domain allow/block, content type, content
relevance, SEO) and an optional **keyword scorer**. Each result carries its `depth` and `score`.

---

## Discovery (`/discovery`)

URL discovery without crawling page bodies — backed by `AsyncUrlSeeder`. Give one or more
domains and a source (**sitemap**, **Common Crawl**, or both), optionally a glob `pattern`, and
optionally a `query` to rank results by **BM25** relevance. Toggle `live_check` to verify URLs
resolve and `extract_head` to pull page titles.

This runs synchronously (no job) and returns a per-domain list of
`{ url, status, relevance_score, title }`. Use it to seed a Batch or Deep crawl.

---

## Extraction studio (`/extraction`)

Build and test structured-data extraction. Four modes:

- **CSS / XPath** — define a selector schema by hand, **or** click generate to have the LLM
  produce one from the page + a plain-English description (`POST /api/schema/generate`). Save
  useful schemas to the **library** for reuse (they get a `schema_id` you can reference from any
  crawl).
- **Regex** — pick from 21 built-in patterns (email, phone, url, currency, …) and/or add custom
  `label: pattern` regexes.
- **LLM** — describe what to extract in natural language; optionally provide a JSON schema.

The CodeMirror editor (`ExtractionEditor.tsx`) provides JSON/JS syntax highlighting.

---

## Adaptive (`/adaptive`)

An **information-foraging** crawl: give a start URL and a `query`, and the crawler keeps
following the most promising links until its **confidence** crosses `confidence_threshold` (or
it hits `max_depth` / `max_pages`). Choose the **statistical** or **embedding** strategy.

On completion the page shows adaptive stats — confidence, pages crawled, and the crawl order —
and stores the most relevant pages as results (each with a `relevant.md` artifact).

---

## Ask (`/ask`)

A chat interface for Q&A over crawled content (RAG). Point it at either a **finished job**
(reuses its stored markdown as context) or a **URL** (crawled on demand), then ask questions.
Conversation history is kept for follow-ups. Answers are grounded strictly in the page content
— the assistant says so when the answer isn't present.

Requires an LLM provider (Settings). Uses `litellm` under the hood.

---

## Jobs (`/jobs`) and Job detail (`/jobs/:id`)

**Jobs** lists every run newest-first, with type, status, URL counts, and a live `running`
indicator. Row actions: **cancel** a running job, **export** the whole job as a ZIP, or
**delete** it (also removes its artifacts).

**Job detail** shows the full result set in the tabbed viewer (`ResultTabs.tsx`), typically
including:

- **Markdown** — raw, and filtered (`fit_markdown`) when a content filter was used.
- **HTML** — cleaned and raw (raw is a download link when it exceeds 1.5 MB).
- **Links** — internal/external with metadata.
- **Media** — images/videos/audio with dimensions and alt text.
- **Tables** — extracted tabular data.
- **Extracted** — structured output from the extraction strategy.
- **Metadata** — Open Graph, Twitter cards, JSON-LD, response headers, SSL certificate.
- **Artifacts** — screenshot, PDF, MHTML, network/console logs (download links).

A finished job can be re-opened any time; results replay from SQLite even after the server
restarts.

---

## Settings (`/settings`)

- **LLM provider** — set the provider string (e.g. `openai/gpt-4o-mini`,
  `anthropic/claude-3-5-sonnet`, `ollama/llama3`), API token, optional base URL, temperature,
  and max tokens. The token is stored masked and never returned in full. See
  [llm-integration.md](llm-integration.md).
- **Profiles** — save the current crawl config as a named preset and load it later.

---

## Tips

- **Iterate on Scrape, then scale on Batch/Deep** — the config object is identical across all
  three, so a working single-URL config drops straight into a batch.
- **Save schemas once** — build a CSS/XPath schema in Extraction, save it, then reference its
  `schema_id` from any crawl instead of re-pasting.
- **Watch for `422`** — an invalid config (e.g. BM25 filter with no query, LLM feature with no
  provider) is rejected immediately with a clear message, before the job starts.
- **Reloads are safe** — the SSE stream replays buffered/persisted progress, so refreshing
  mid-crawl won't lose anything.
