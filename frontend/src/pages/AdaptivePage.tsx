import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner, JobBar, ResultsTable } from "../components/shared";
import { JsonBlock } from "../components/ResultTabs";
import { useJob } from "../components/useJob";

export default function AdaptivePage() {
  const [startUrl, setStartUrl] = useState("");
  const [query, setQuery] = useState("");
  const [strategy, setStrategy] = useState("statistical");
  const [confidence, setConfidence] = useState(0.7);
  const [maxPages, setMaxPages] = useState(20);
  const [topK, setTopK] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const job = useJob();

  useEffect(() => {
    setDetail(null);
  }, [job.jobId]);

  const run = async () => {
    if (!startUrl.trim() || !query.trim()) return;
    setError(null);
    try {
      await job.start("/adaptive", {
        start_url: startUrl.trim(),
        query: query.trim(),
        strategy,
        confidence_threshold: confidence,
        max_pages: maxPages,
        top_k_links: topK,
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const running = job.status === "running" || job.status === "queued";
  const stats = job.stats as any;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Adaptive crawl</h2>
        <p className="text-sm text-zinc-500">
          Information-foraging crawl that stops when it has gathered enough content to answer a query.
        </p>
      </header>

      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Start URL</label>
            <input
              className="input"
              placeholder="https://docs.example.com"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Query</label>
            <input
              className="input"
              placeholder="how to configure authentication hooks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Strategy</label>
            <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option value="statistical">Statistical (no LLM)</option>
              <option value="embedding">Embedding (semantic)</option>
            </select>
          </div>
          <div>
            <label className="label">Confidence threshold</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className="input"
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Max pages</label>
            <input type="number" className="input" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Links per step</label>
            <input type="number" className="input" value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
          </div>
        </div>
        <button className="btn-primary" onClick={run} disabled={running || !startUrl.trim() || !query.trim()}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Start adaptive crawl
        </button>
      </div>

      <ErrorBanner message={error ?? job.error} />
      <JobBar job={job} onCancel={job.cancel} />

      {stats && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Confidence" value={typeof stats.confidence === "number" ? `${(stats.confidence * 100).toFixed(0)}%` : "—"} />
          <Stat label="Pages crawled" value={String(stats.pages_crawled ?? "—")} />
          <Stat label="Relevant pages" value={String(job.results.length)} />
          <Stat label="Strategy" value={strategy} />
        </div>
      )}

      <ResultsTable
        results={job.results}
        showDepth
        onSelect={async (r) => {
          if (job.jobId) setDetail(await api.get(`/jobs/${job.jobId}/results/${r.index}`));
        }}
      />
      {detail && (
        <div className="card p-4 max-h-[500px] overflow-auto">
          <h3 className="text-sm font-semibold text-zinc-200 mb-2">{detail.url}</h3>
          <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-300">{detail.markdown}</pre>
        </div>
      )}
      {stats?.metrics && Object.keys(stats.metrics).length > 0 && (
        <details className="card p-4">
          <summary className="text-sm font-semibold text-zinc-300 cursor-pointer">Raw metrics</summary>
          <JsonBlock data={stats.metrics} />
        </details>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
