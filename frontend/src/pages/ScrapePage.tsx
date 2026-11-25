import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, FileText, Globe, Loader2, Play, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { prune } from "../lib/api";
import { CRAWL4AI_DOCS_URL } from "../lib/config";
import { ConfigPanel } from "../components/ConfigPanel";
import { ResultPreview } from "../components/ResultPreview";
import { ErrorBanner, JobBar } from "../components/shared";
import { useCrawlConfig } from "../components/useCrawlConfig";
import { useJob } from "../components/useJob";

export default function ScrapePage() {
  const [url, setUrl] = useState(CRAWL4AI_DOCS_URL);
  const [config, setConfig, configReady] = useCrawlConfig();
  const [startError, setStartError] = useState<string | null>(null);
  const settings = useRef<HTMLElement>(null);
  const job = useJob();
  const running = job.status === "running" || job.status === "queued";
  const canRun = configReady && !running && !!url.trim();

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRun) return;
    setStartError(null);
    try {
      await job.start("/crawl", { url: url.trim(), config: prune(config) ?? {} });
    } catch (error) {
      setStartError((error as Error).message);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Scrape</h1>
          <p className="text-sm">Turn a single page into markdown, structured data, or a screenshot.</p>
        </div>
        <Link className="btn-secondary" to="/jobs">
          Job history <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <div className="scrape-workspace">
        <section className="scrape-request card min-w-0 p-4 sm:p-5" aria-label="Crawl request">
          <form onSubmit={run}>
            <label className="label" htmlFor="scrape-url">Page URL</label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative min-w-0">
                <Globe size={17} className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" aria-hidden="true" />
                <input
                  className="input h-11 pl-10 font-mono text-base"
                  id="scrape-url"
                  aria-describedby="scrape-url-help"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="https://example.com"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary h-11 whitespace-nowrap" disabled={!canRun}>
                {running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                {running ? "Crawling…" : "Run scrape"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2">
              <p className="py-2 text-xs text-zinc-400" id="scrape-url-help">
                Supports web URLs, <code>raw:</code> and <code>file://</code>.
              </p>
              <button type="button" className="btn-ghost !px-2 text-xs xl:hidden" onClick={() => settings.current?.focus()}>
                <SlidersHorizontal size={14} aria-hidden="true" /> Crawl settings
              </button>
            </div>
          </form>
          <div className="space-y-2 empty:hidden">
            <ErrorBanner message={startError ?? job.error} />
            <JobBar job={job} onCancel={job.cancel} />
          </div>
        </section>

        <section className="scrape-output min-w-0 space-y-2" aria-labelledby="scrape-output-title">
          <h2 id="scrape-output-title" className="text-base font-semibold text-zinc-100">Output</h2>
          {job.jobId && job.results.length > 0 ? (
            <ResultPreview jobId={job.jobId} index={0} />
          ) : (
            <div className="card flex min-h-48 flex-col items-center justify-center gap-3 p-5 text-center sm:min-h-60">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-overlay text-accent">
                <FileText size={20} aria-hidden="true" />
              </span>
              <p className="text-sm text-zinc-400" role="status">
                {running ? "Waiting for the page result…" : job.status === "idle" ? "Run a scrape to preview the result." : "This crawl returned no preview."}
              </p>
            </div>
          )}
        </section>

        <section ref={settings} tabIndex={-1} className="scrape-options min-w-0 scroll-mt-4" aria-label="Crawl settings">
          <ConfigPanel config={config} onChange={setConfig} />
        </section>
      </div>
    </div>
  );
}
