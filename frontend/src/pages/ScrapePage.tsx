import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { api, prune } from "../lib/api";
import { defaultConfig, type CrawlConfig } from "../lib/config";
import { ConfigPanel } from "../components/ConfigPanel";
import { ResultTabs } from "../components/ResultTabs";
import { ErrorBanner, JobBar } from "../components/shared";
import { useJob } from "../components/useJob";

export default function ScrapePage() {
  const [url, setUrl] = useState("");
  const [config, setConfig] = useState<CrawlConfig>(defaultConfig());
  const [fullResult, setFullResult] = useState<any>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const job = useJob();

  useEffect(() => {
    // When the single result lands, fetch the full payload.
    if (job.jobId && job.results.length > 0 && !fullResult) {
      api.get(`/jobs/${job.jobId}/results/0`).then(setFullResult).catch(() => {});
    }
  }, [job.results, job.jobId, fullResult]);

  const run = async () => {
    if (!url.trim()) return;
    setStartError(null);
    setFullResult(null);
    try {
      await job.start("/crawl", { url: url.trim(), config: prune(config) ?? {} });
    } catch (e: any) {
      setStartError(e.message);
    }
  };

  const running = job.status === "running" || job.status === "queued";

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Scrape</h2>
        <p className="text-sm text-zinc-500">
          Single-URL playground — markdown, extraction, screenshots and more. Accepts https://, raw: and file:// URLs.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          className="input text-base"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !running)) run();
          }}
        />
        <button className="btn-primary shrink-0" onClick={run} disabled={running || !url.trim()}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Run
        </button>
      </div>

      <ErrorBanner message={startError ?? job.error} />
      <JobBar job={job} onCancel={job.cancel} />

      <ConfigPanel config={config} onChange={setConfig} />

      {fullResult && job.jobId && <ResultTabs result={fullResult} jobId={job.jobId} />}
    </div>
  );
}
