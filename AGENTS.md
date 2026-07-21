You are an experienced, pragmatic software engineering AI agent. Do not over-engineer a solution when a simple one is possible. Keep edits minimal. If you want an exception to ANY rule, you MUST stop and get permission first.

## Project Overview

**Status: Scaffolding stage.** This repository (`crawl4ai_webui`) was initialized with a `.gitignore`, `README.md` placeholder, and `LICENSE` (MIT, 2026 James), but contains **no source code, no framework config, no package manager, and no CI**. Before any implementation work, the sections marked `TODO` below must be resolved.

**Working name / inferred goal:** A web UI for the [Crawl4AI](https://github.com/unclecode/crawl4ai) library — a browser to issue, monitor, and review web crawl jobs produced by Crawl4AI. Before implementation, the following scope items must be explicitly confirmed: single-page demo vs. multi-user dashboard, local-only vs. hosted deployment, and all core features to support.

**TODO — to be filled in by the user:**

- **Project description and goals:** what users should be able to do with the UI (e.g. submit a URL, configure crawl parameters, view results/JSON, schedule jobs, manage crawl history, RAG ingestion, etc.).
- **User roles and permissions:** define user roles (e.g., admin, user, guest) and their permissions for each action (e.g., who can submit crawls, view results, manage jobs, configure settings).
- **Primary language(s):** the `.gitignore` is the standard Node template, hinting at a JS/TS project, but this is not confirmed. Python is also a reasonable choice given Crawl4AI's Python-first API.
- **Frontend framework:** React, Vue, Svelte, SvelteKit, Next.js, Nuxt, plain HTML/HTMX, etc.
- **Backend / runtime:** Node + FastAPI proxy, Next.js API routes, FastAPI + separate SPA, serverless, etc.
- **Integration with Crawl4AI:** local Python subprocess, HTTP to a separately-run Crawl4AI server, embedded `crawl4ai` Python package, or something else.
- **Persistence:** none, SQLite, Postgres, file-based jobs, etc.
- **Styling / component library:** Tailwind + shadcn/ui, plain CSS, etc.
- **Tooling:** package manager (`pnpm` / `npm` / `yarn` / `uv` / `poetry`), formatter, linter, test runner.
- **License intent:** LICENSE says MIT (2026, James). Confirm this is the intended license.

## Reference

There is no source code yet. Once the stack is chosen, the expected layout will follow the chosen framework's conventions. A reasonable target structure for a TS frontend + Python backend split:

```
crawl4ai_webui/
├── frontend/          # Web UI (framework TBD)
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # API server that talks to crawl4ai (TBD)
│   ├── app/
│   ├── tests/
│   └── pyproject.toml  # or requirements.txt
├── AGENTS.md
├── README.md
└── LICENSE
```

TODO: update this section once a framework is picked and the directory layout exists.

## Essential Commands

There is no build, test, or lint command configured yet. The commands below are **placeholders to fill in once tooling is chosen** — do not run them blindly.

- `install` — TODO (e.g. `pnpm install` in `frontend/`, `uv sync` in `backend/`)
- `dev` — TODO (e.g. start frontend dev server + backend)
- `build` — TODO
- `lint` — TODO
- `format` — TODO
- `test` — TODO
- `clean` — TODO (typical: remove `node_modules/`, `.next/`, `dist/`, `__pycache__/`, `.venv/`, `*.pyc`)

No `.sh` scripts exist in the repo yet (`find -type f -name '*.sh'` returns nothing).

## Patterns

TODO — no patterns established yet. Add once the first module is in place (e.g. how the UI submits a crawl job, how the backend invokes Crawl4AI, how results are streamed back).

## Anti-patterns

TODO — none known yet. Add as they are discovered in code review or git history.

## Code style

TODO — to be defined with the chosen stack (e.g. ESLint + Prettier config, `ruff` + `black`, etc.).

## Commit and Pull Request Guidelines

- **Validation before commit:** the repo currently has no automated checks. Until CI is added, run any configured `lint`, `format`, `test`, and `build` commands locally and confirm they pass.
- **Commit message format:** no convention is established. Default to `type: short summary` (e.g. `feat: add URL submission form`, `fix: handle crawl timeout`, `chore: scaffold project`).
- **Branching:** the default branch is `dev` (per `git status`). TODO: confirm whether `main`/`master` should be the protected default and `dev` a feature branch, or the other way around.
- **Pull request description:** TODO — no PR template exists. At minimum, include: what changed, why, how it was tested, and any screenshots for UI changes.

## Open questions for the project owner

Before writing any code, please confirm or decide:

1. **Scope** — what should the UI actually do? (Just submit a URL and show markdown/JSON output? Or full job history, auth, scheduling, RAG?)
2. **Stack** — frontend framework, backend, package manager.
3. **How it talks to Crawl4AI** — local Python process, sidecar container, or hosted endpoint?
4. **Persistence** — needed at all for v1?
5. **Deployment target** — local-only dev tool, single-user app, or multi-user hosted?
6. **License** — confirm MIT is the intended license.

Once these are answered, replace the `TODO` placeholders above with the real values and start scaffolding.
