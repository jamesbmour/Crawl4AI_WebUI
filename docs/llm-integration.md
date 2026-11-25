# LLM Integration

Several features are powered by an LLM, accessed through crawl4ai's `LLMConfig` and (for Ask)
`litellm` directly. The LLM is **optional** — the crawling core works without it; only the
features below need a provider.

## Configuring a provider

Set it in **Settings** (`PUT /api/settings`) or by editing `data/settings.json` directly. The
relevant fields:

| Setting | Example | Notes |
|---------|---------|-------|
| `llm_provider` | `openai/gpt-4o-mini` | A litellm-style `provider/model` string |
| `llm_api_token` | `sk-…` | Stored masked; omit for local providers or env-based keys |
| `llm_base_url` | `http://localhost:11434` | For self-hosted/proxied endpoints (e.g. Ollama) |
| `llm_temperature` | `0.2` | Optional |
| `llm_max_tokens` | `2048` | Optional |

### Token handling

- `GET /api/settings` returns the token **masked** (`********` + last 4 chars) plus a computed
  `llm_configured` boolean.
- On `PUT`, a token that begins with `********` is treated as "keep the existing value"; an empty
  string **clears** it; `null`/omitted leaves it unchanged.
- The file is written with permission mode `0600`.

### When is the LLM considered "configured"?

`llm_is_configured()` returns true when `llm_provider` is set **and** one of:

- the provider starts with `ollama` (local — no token needed), **or**
- `llm_api_token` is set, **or**
- a matching provider env var is present:

  | Provider prefix | Env var |
  |-----------------|---------|
  | `openai` | `OPENAI_API_KEY` |
  | `anthropic` | `ANTHROPIC_API_KEY` |
  | `gemini` | `GEMINI_API_KEY` |
  | `groq` | `GROQ_API_KEY` |
  | `deepseek` | `DEEPSEEK_API_KEY` |

So you can run against, say, OpenAI by exporting `OPENAI_API_KEY` and setting only
`llm_provider`, without ever storing the key in `settings.json`.

## Supported providers

Anything litellm/crawl4ai supports, addressed as `provider/model`, e.g.:

- `openai/gpt-4o-mini`, `openai/gpt-4o`
- `anthropic/claude-3-5-sonnet-latest`
- `gemini/gemini-1.5-pro`
- `groq/llama-3.1-70b-versatile`
- `deepseek/deepseek-chat`
- `ollama/llama3` (set `llm_base_url` to your Ollama endpoint)
- any OpenAI-compatible endpoint via a custom `llm_base_url`

## The four LLM-powered features

| Feature | Endpoint / config | What the LLM does |
|---------|-------------------|-------------------|
| **Schema generation** | `POST /api/schema/generate` | Reads a page's HTML + your description and emits a CSS/XPath extraction schema (`JsonElementExtractionStrategy.generate_schema`, run in a worker thread) |
| **LLM extraction** | `config.extraction.type = "llm"` | Extracts structured data per your instruction/schema (`LLMExtractionStrategy`) |
| **LLM markdown filter** | `config.markdown.content_filter = "llm"` | Filters page content down to the substantive parts (`LLMContentFilter`) |
| **Ask (RAG Q&A)** | `POST /api/ask` | Answers questions grounded in a job's or URL's markdown, via `litellm.acompletion` |

Any of these returns **HTTP 422** with a clear message if no provider is configured. Upstream
LLM errors surface as **502**.

### How `get_llm_config()` builds the config

`core/settings.py::get_llm_config()` lazily imports `crawl4ai.LLMConfig` (it's heavy) and passes
through only the fields that are set: `provider` (always), and optionally `api_token`,
`base_url`, `temperature`, `max_tokens`. It returns `None` when not configured, which is how the
feature endpoints detect the unconfigured case.

### Ask context limits

`POST /api/ask` builds its prompt from the job's stored markdown (`fit_markdown` preferred, else
`markdown`) or a freshly crawled URL, capped at **120 000 characters**, and includes the last
**10** conversation turns. The system prompt instructs the model to answer **only** from the
provided content and to say so when the answer isn't present.
