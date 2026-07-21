import { useEffect, useState } from "react";
import { Download, Loader2, Play } from "lucide-react";
import { api, prune, type SlimResult } from "../lib/api";
import { ConfigPanel } from "../components/ConfigPanel";
import { useCrawlConfig } from "../components/useCrawlConfig";
import { ResultTabs } from "../components/ResultTabs";
import { ErrorBanner, JobBar, ResultsTable } from "../components/shared";
import { useJob } from "../components/useJob";

export default function BatchPage() {
  const [urlText, setUrlText] = useState("");
  const [config, setConfig, configReady] = useCrawlConfig();
  const [dispatcher, setDispatcher] = useState<Record<string, any>>({ type: "memory_adaptive" });
  const [rateLimit, setRateLimit] = useState<Record<string, any>>({ enabled: false });
  const [selected, setSelected] = useState<SlimResult | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const job = useJob();

  useEffect(() => {
    // URLs handed over from the Discovery page
    const handoff = localStorage.getItem("c4ai:batch_urls");
    if (handoff) {
      setUrlText(handoff);
      localStorage.removeItem("c4ai:batch_urls");
    }
  }, []);

  useEffect(() => {
    if (selected && job.jobId) {
      setDetail(null);
      api.get(`/jobs/${job.jobId}/results/${selected.index}`).then(setDetail).catch(() => {});
    }
  }, [selected, job.jobId]);

  const urls = urlText
    .split(/\s+/)
    .map((u) => u.trim())
    .filter(Boolean);

  const run = async () => {
    if (!configReady || !urls.length) return;
    setStartError(null);
    setSelected(null);
    setDetail(null);
    try {
      await job.start("/crawl/batch", {
        urls,
        config: prune(config) ?? {},
        dispatcher: { ...dispatcher, rate_limit: rateLimit },
      });
    } catch (e: any) {
      setStartError(e.message);
    }
  };

  const running = job.status === "running" || job.status === "queued";

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Batch crawl</h2>
        <p className="text-sm text-zinc-500">
          Crawl many URLs concurrently with arun_many — adaptive dispatching, rate limiting, streaming results.
        </p>
      </header>

      <textarea
        className="input min-h-[110px] font-mono text-xs"
        placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://another.site/article"}
        value={urlText}
        onChange={(e) => setUrlText(e.target.value)}
      />

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="label">Dispatcher</label>
          <select
            className="input"
            value={dispatcher.type}
            onChange={(e) => setDispatcher({ ...dispatcher, type: e.target.value })}
          >
            <option value="memory_adaptive">Memory adaptive</option>
            <option value="semaphore">Semaphore (fixed)</option>
          </select>
        </div>
        {dispatcher.type === "memory_adaptive" ? (
          <>
            <div>
              <label className="label">Max sessions</label>
              <input
                type="number"
                className="input"
                value={dispatcher.max_session_permit ?? 10}
                onChange={(e) => setDispatcher({ ...dispatcher, max_session_permit: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Memory threshold %</label>
              <input
                type="number"
                className="input"
                value={dispatcher.memory_threshold_percent ?? 90}
                onChange={(e) => setDispatcher({ ...dispatcher, memory_threshold_percent: Number(e.target.value) })}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="label">Concurrency</label>
            <input
              type="number"
              className="input"
              value={dispatcher.semaphore_count ?? 5}
              onChange={(e) => setDispatcher({ ...dispatcher, semaphore_count: Number(e.target.value) })}
            />
          </div>
        )}
        <div>
          <label className="label">Rate limiting</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-orange-500"
              checked={!!rateLimit.enabled}
              onChange={(e) => setRateLimit({ ...rateLimit, enabled: e.target.checked })}
            />
            {rateLimit.enabled && (
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                delay
                <input
                  type="number"
                  step={0.5}
                  className="input !w-16 !px-1.5 !py-1"
                  value={rateLimit.base_delay_min ?? 1}
                  onChange={(e) => setRateLimit({ ...rateLimit, base_delay_min: Number(e.target.value) })}
                />
                –
                <input
                  type="number"
                  step={0.5}
                  className="input !w-16 !px-1.5 !py-1"
                  value={rateLimit.base_delay_max ?? 3}
                  onChange={(e) => setRateLimit({ ...rateLimit, base_delay_max: Number(e.target.value) })}
                />
                s
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={run} disabled={!configReady || running || !urls.length}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Crawl {urls.length || ""} URL{urls.length === 1 ? "" : "s"}
        </button>
        {job.jobId && job.status === "completed" && (
          <a className="btn-secondary" href={`/api/jobs/${job.jobId}/export.zip`}>
            <Download size={15} /> Export all (.zip)
          </a>
        )}
      </div>

      <ErrorBanner message={startError ?? job.error} />
      <JobBar job={job} onCancel={job.cancel} />

      <ConfigPanel config={config} onChange={setConfig} />

      <ResultsTable
        results={job.results}
        onSelect={setSelected}
        selected={selected?.index ?? null}
      />
      {detail && job.jobId && <ResultTabs result={detail} jobId={job.jobId} />}
    </div>
  );
}
