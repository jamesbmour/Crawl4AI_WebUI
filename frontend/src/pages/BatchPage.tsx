import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, Layers, Loader2, Play, SlidersHorizontal } from "lucide-react";
import { prune, type SlimResult } from "../lib/api";
import { BATCH_FIELDS, DEFAULT_BATCH_URLS, RATE_LIMIT_FIELDS, configForMode } from "../lib/config";
import { ConfigPanel } from "../components/ConfigPanel";
import { CrawlProgress } from "../components/CrawlProgress";
import { FieldList } from "../components/Field";
import { ResultPreview } from "../components/ResultPreview";
import { ErrorBanner, ResultsTable } from "../components/shared";
import { updateSettings, useCrawlSettings } from "../components/useCrawlSettings";
import { useJob } from "../components/useJob";

export default function BatchPage() {
  const [urlText, setUrlText] = useState(() => DEFAULT_BATCH_URLS.join("\n"));
  const { settings, ready } = useCrawlSettings();
  const [selected, setSelected] = useState<SlimResult | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const job = useJob();
  const batch = settings.batch;

  useEffect(() => {
    // URLs handed over from the Discovery page
    const handoff = localStorage.getItem("c4ai:batch_urls");
    if (handoff) {
      setUrlText(handoff);
      localStorage.removeItem("c4ai:batch_urls");
    }
  }, []);

  const urls = urlText
    .split(/\s+/)
    .map((u) => u.trim())
    .filter(Boolean);
  const running = job.status === "running" || job.status === "queued";
  const canRun = ready && !running && urls.length > 0;

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRun) return;
    setStartError(null);
    setSelected(null);
    try {
      await job.start(
        "/crawl/batch",
        prune({ urls, config: configForMode(settings.config, "batch"), dispatcher: batch }),
        urls.length
      );
    } catch (e) {
      setStartError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-7">
      <header>
        <h1 className="page-title">Batch crawl</h1>
        <p className="text-sm">Crawl a list of URLs and see which pages succeed as results come in.</p>
      </header>

      <div className="crawl-workspace">
        <section className="crawl-request card min-w-0 space-y-5 p-4 sm:p-5" aria-label="Batch request">
          <form onSubmit={run} className="space-y-3">
            <div>
              <label className="label" htmlFor="batch-urls">URLs</label>
              <textarea
                id="batch-urls"
                aria-describedby="batch-urls-help"
                className="input min-h-[110px] font-mono text-xs"
                spellCheck={false}
                placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://another.site/article"}
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
              />
              <p id="batch-urls-help" className="mt-1 text-xs text-zinc-400">One URL per line.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary" disabled={!canRun}>
                {running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                Crawl {urls.length || ""} URL{urls.length === 1 ? "" : "s"}
              </button>
              {job.jobId && (job.status === "completed" || (job.status === "cancelled" && job.results.length > 0)) && (
                <a className="btn-secondary" href={`/api/jobs/${job.jobId}/export.zip`}>
                  <Download size={15} aria-hidden="true" /> Export all (.zip)
                </a>
              )}
              <button type="button" className="btn-ghost ml-auto !px-2 text-xs xl:hidden" onClick={() => settingsRef.current?.focus()}>
                <SlidersHorizontal size={14} aria-hidden="true" /> Crawl settings
              </button>
            </div>
          </form>

          <section className="config-panel border-t border-surface-border pt-4" aria-labelledby="batch-options-title">
            <h2 id="batch-options-title" className="text-sm font-semibold text-zinc-100">Batch options</h2>
            <p className="text-xs text-zinc-400">How many pages run at once and how quickly requests go out. Only used by batch crawls; saved automatically.</p>
            <FieldList fields={BATCH_FIELDS} values={batch} onChange={(next) => updateSettings({ batch: next })} />
            <FieldList
              fields={RATE_LIMIT_FIELDS}
              values={batch.rate_limit ?? {}}
              onChange={(rate_limit) => updateSettings({ batch: { ...batch, rate_limit } })}
            />
          </section>

          <ErrorBanner message={startError ?? job.error} />
        </section>

        <section className="crawl-output min-w-0 space-y-4" aria-label="Results">
          <CrawlProgress kind="batch" {...job} onCancel={job.cancel} />
          {job.status === "idle" && (
            <div className="card flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-overlay text-accent">
                <Layers size={20} aria-hidden="true" />
              </span>
              <p className="text-sm text-zinc-400">Run a batch crawl to see each page's result here.</p>
            </div>
          )}
          <ResultsTable key={job.jobId} results={job.results} onSelect={setSelected} selected={selected?.index ?? null} />
          {selected && job.jobId && <ResultPreview jobId={job.jobId} index={selected.index} />}
        </section>

        <section ref={settingsRef} tabIndex={-1} className="crawl-options min-w-0 scroll-mt-4" aria-label="Crawl settings">
          <ConfigPanel mode="batch" />
        </section>
      </div>
    </div>
  );
}
