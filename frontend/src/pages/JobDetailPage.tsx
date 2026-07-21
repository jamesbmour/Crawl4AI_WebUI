import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, RotateCw } from "lucide-react";
import { api, streamJob, type SlimResult } from "../lib/api";
import { ResultTabs, JsonBlock } from "../components/ResultTabs";
import { ErrorBanner, ResultsTable, StatusBadge } from "../components/shared";

const RERUN_ENDPOINTS: Record<string, string> = {
  scrape: "/crawl",
  batch: "/crawl/batch",
  deep: "/crawl/deep",
  adaptive: "/adaptive",
};

export default function JobDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [results, setResults] = useState<SlimResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const refresh = async () => {
    const j = await api.get(`/jobs/${jobId}`);
    setJob(j);
    setResults(await api.get(`/jobs/${jobId}/results`));
    return j;
  };

  useEffect(() => {
    let unsub: (() => void) | null = null;
    refresh().then((j) => {
      if (j.running) {
        unsub = streamJob(jobId, (event) => {
          if (event.type === "result" && event.result) {
            setResults((prev) => {
              const exists = prev.some((r) => r.index === event.result!.index);
              return exists ? prev : [...prev, event.result!];
            });
          }
          if (event.type === "status") refresh();
        });
      }
    });
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (selected !== null) {
      setDetail(null);
      api.get(`/jobs/${jobId}/results/${selected}`).then(setDetail).catch(() => {});
    }
  }, [selected, jobId]);

  useEffect(() => {
    // Auto-open single-result jobs
    if (results.length === 1 && selected === null) setSelected(results[0].index);
  }, [results, selected]);

  if (!job) return <p className="text-sm text-zinc-500">Loading…</p>;

  const showDepth = job.type === "deep" || job.type === "adaptive";

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/jobs" className="btn-ghost !p-2">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-zinc-100 font-mono">{job.id}</h2>
          <p className="text-sm text-zinc-500 capitalize">
            {job.type} · {new Date(job.created_at * 1000).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={job.status} />
        {RERUN_ENDPOINTS[job.type] && !job.running && (
          <button
            className="btn-secondary !py-1.5 text-xs"
            onClick={async () => {
              const { job_id } = await api.post(RERUN_ENDPOINTS[job.type], job.payload);
              navigate(`/jobs/${job_id}`);
            }}
          >
            <RotateCw size={14} /> Re-run
          </button>
        )}
        <a className="btn-secondary !py-1.5 text-xs" href={`/api/jobs/${job.id}/export.zip`}>
          <Download size={14} /> Export
        </a>
      </header>

      {job.error && <ErrorBanner message={job.error} />}

      {job.extra?.confidence !== undefined && (
        <div className="card p-4 text-sm text-zinc-300">
          Adaptive stats — confidence:{" "}
          {typeof job.extra.confidence === "number" ? `${(job.extra.confidence * 100).toFixed(0)}%` : "n/a"} · pages
          crawled: {job.extra.pages_crawled}
        </div>
      )}

      {results.length > 1 && (
        <ResultsTable results={results} onSelect={(r) => setSelected(r.index)} selected={selected} showDepth={showDepth} />
      )}

      {detail && <ResultTabs result={detail} jobId={job.id} />}

      <details className="card p-4">
        <summary className="text-sm font-semibold text-zinc-300 cursor-pointer">Request payload</summary>
        <JsonBlock data={job.payload} />
      </details>
    </div>
  );
}
