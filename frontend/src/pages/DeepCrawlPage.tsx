import { useRef, useState, type FormEvent } from "react";
import { Bug, Loader2, Play, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { prune, type SlimResult } from "../lib/api";
import { CRAWL4AI_DOCS_URL, DEEP_FIELDS, FILTER_FIELDS, FILTER_TYPES, configForMode, withDefaults } from "../lib/config";
import { ConfigPanel } from "../components/ConfigPanel";
import { CrawlProgress } from "../components/CrawlProgress";
import { FieldList } from "../components/Field";
import { ResultPreview } from "../components/ResultPreview";
import { ErrorBanner, ResultsTable } from "../components/shared";
import { updateSettings, useCrawlSettings } from "../components/useCrawlSettings";
import { useJob } from "../components/useJob";

type Filter = Record<string, any>;

export default function DeepCrawlPage() {
  const [url, setUrl] = useState(CRAWL4AI_DOCS_URL);
  const { settings, ready } = useCrawlSettings();
  const [selected, setSelected] = useState<SlimResult | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const job = useJob();
  const deep = settings.deep;
  const filters: Filter[] = deep.filters ?? [];
  const running = job.status === "running" || job.status === "queued";
  const canRun = ready && !running && !!url.trim();

  const setFilters = (next: Filter[]) => updateSettings({ deep: { ...deep, filters: next.length ? next : undefined } });
  const setFilter = (index: number, next: Filter) => setFilters(filters.map((f, i) => (i === index ? next : f)));

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRun) return;
    setStartError(null);
    setSelected(null);
    try {
      await job.start(
        "/crawl/deep",
        prune({ url: url.trim(), ...withDefaults(DEEP_FIELDS, deep), filters, config: configForMode(settings.config, "deep") })
      );
    } catch (e) {
      setStartError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-7">
      <header>
        <h1 className="page-title">Deep crawl</h1>
        <p className="text-sm">Follow links from a starting page and see how far the crawl reaches.</p>
      </header>

      <div className="crawl-workspace">
        <section className="crawl-request card min-w-0 space-y-5 p-4 sm:p-5" aria-label="Deep crawl request">
          <form onSubmit={run}>
            <label className="label" htmlFor="deep-url">Start URL</label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                id="deep-url"
                className="input h-11 font-mono text-base"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://docs.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button type="submit" className="btn-primary h-11 whitespace-nowrap" disabled={!canRun}>
                {running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                {running ? "Crawling…" : "Run deep crawl"}
              </button>
            </div>
            <div className="mt-2 flex justify-end xl:hidden">
              <button type="button" className="btn-ghost !px-2 text-xs" onClick={() => settingsRef.current?.focus()}>
                <SlidersHorizontal size={14} aria-hidden="true" /> Crawl settings
              </button>
            </div>
          </form>

          <section className="config-panel border-t border-surface-border pt-4" aria-labelledby="deep-options-title">
            <h2 id="deep-options-title" className="text-sm font-semibold text-zinc-100">Deep crawl options</h2>
            <p className="text-xs text-zinc-400">How far the crawl goes and which links it visits first. Only used by deep crawls; saved automatically.</p>
            <FieldList fields={DEEP_FIELDS} values={deep} onChange={(next) => updateSettings({ deep: next })} />
          </section>

          <section className="space-y-3 border-t border-surface-border pt-4" aria-labelledby="deep-filters-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="deep-filters-title" className="text-sm font-semibold text-zinc-100">URL filters</h2>
                <p className="text-xs text-zinc-400">A discovered link is crawled only if it passes every filter.</p>
              </div>
              <button type="button" className="btn-ghost !px-2 text-xs" onClick={() => setFilters([...filters, { type: "url_pattern" }])}>
                <Plus size={14} aria-hidden="true" /> Add filter
              </button>
            </div>
            {filters.length === 0 && <p className="text-xs text-zinc-400">No filters: every discovered link is eligible.</p>}
            {filters.map((filter, i) => (
              <div key={i} className="config-panel rounded-lg border border-surface-border p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="label" htmlFor={`deep-filter-${i}`}>Filter {i + 1}</label>
                    <select
                      id={`deep-filter-${i}`}
                      aria-describedby={`deep-filter-${i}-help`}
                      className="input"
                      value={filter.type}
                      // A different filter type takes different fields, so start it fresh.
                      onChange={(e) => setFilter(i, { type: e.target.value })}
                    >
                      {FILTER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost !p-2 text-red-400"
                    aria-label={`Remove filter ${i + 1}`}
                    onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <p id={`deep-filter-${i}-help`} className="mt-1.5 text-xs text-zinc-400">
                  {FILTER_TYPES.find((t) => t.value === filter.type)?.help}
                </p>
                <FieldList fields={FILTER_FIELDS} values={filter} onChange={(next) => setFilter(i, next)} />
              </div>
            ))}
          </section>

          <ErrorBanner message={startError ?? job.error} />
        </section>

        <section className="crawl-output min-w-0 space-y-4" aria-label="Results">
          <CrawlProgress kind="deep" {...job} onCancel={job.cancel} />
          {job.status === "idle" && (
            <div className="card flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-overlay text-accent">
                <Bug size={20} aria-hidden="true" />
              </span>
              <p className="text-sm text-zinc-400">Run a deep crawl to see every page it reaches here.</p>
            </div>
          )}
          <ResultsTable key={job.jobId} results={job.results} onSelect={setSelected} selected={selected?.index ?? null} showDepth />
          {selected && job.jobId && <ResultPreview jobId={job.jobId} index={selected.index} />}
        </section>

        <section ref={settingsRef} tabIndex={-1} className="crawl-options min-w-0 scroll-mt-4" aria-label="Crawl settings">
          <ConfigPanel mode="deep" />
        </section>
      </div>
    </div>
  );
}
