import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, RotateCw } from "lucide-react";
import { api, isTerminalJobStatus, streamJob, type SlimResult } from "../lib/api";
import { CrawlProgress } from "../components/CrawlProgress";
import { JsonBlock } from "../components/JsonBlock";
import { ResultPreview } from "../components/ResultPreview";
import { ErrorBanner, ResultsTable, StatusBadge } from "../components/shared";
import { useJobCancellation } from "../components/useJob";

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
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const cancellation = useJobCancellation(jobId, !!job?.running && !isTerminalJobStatus(job.status));

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let unsubscribe: (() => void) | undefined;
    const refresh = async () => {
      const jobPath = `/jobs/${jobId}`;
      const [snapshot, pages] = await Promise.all([
        api.get(jobPath, signal),
        api.get(`${jobPath}/results`, signal),
      ]);
      // A job can finish between the parallel reads.
      const currentPages = !snapshot.running && pages.length < snapshot.completed_urls
        ? await api.get(`${jobPath}/results`, signal)
        : pages;
      if (!signal.aborted) {
        setJob(snapshot);
        setResults(currentPages);
      }
      return snapshot;
    };
    const reportError = (error: Error) => {
      if (!signal.aborted) setError(error.message);
    };
    refresh().then((snapshot) => {
      if (!signal.aborted && snapshot.running) {
        unsubscribe = streamJob(jobId, ({ type, status, result, message }) => {
          if (type === "result" && result) {
            setResults((prev) => {
              const exists = prev.some((r) => r.index === result.index);
              return exists ? prev : [...prev, result];
            });
          }
          if (type === "status" && isTerminalJobStatus(status)) refresh().catch(reportError);
          if (type === "error" && message) setError(message);
        });
      }
    }).catch(reportError);
    return () => {
      controller.abort();
      unsubscribe?.();
    };
  }, [jobId]);

  useEffect(() => {
    // Auto-open single-result jobs
    if (results.length === 1 && selected === null) setSelected(results[0].index);
  }, [results, selected]);

  if (!job) return error ? <ErrorBanner message={error} /> : <p className="text-sm text-zinc-400" role="status">Loading job…</p>;

  const showDepth = job.type === "deep" || job.type === "adaptive";
  const showProgress = job.type === "batch" || job.type === "deep";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link to="/jobs" className="btn-ghost !p-2" aria-label="Back to jobs">
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="page-title font-mono">{job.id}</h1>
          <p className="text-sm text-zinc-500 capitalize">
            {job.type} · {new Date(job.created_at * 1000).toLocaleString()}
          </p>
        </div>
        {!showProgress && <StatusBadge status={job.status} />}
        {RERUN_ENDPOINTS[job.type] && !job.running && (
          <button
            className="btn-secondary !py-1.5 text-xs"
            disabled={rerunning}
            onClick={async () => {
              setRerunning(true);
              setError(null);
              try {
                const { job_id } = await api.post(RERUN_ENDPOINTS[job.type], job.payload);
                navigate(`/jobs/${job_id}`);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setRerunning(false);
              }
            }}
          >
            <RotateCw size={14} /> Re-run
          </button>
        )}
        <a className="btn-secondary !py-1.5 text-xs" href={`/api/jobs/${job.id}/export.zip`}>
          <Download size={14} /> Export
        </a>
      </header>

      <ErrorBanner message={error ?? job.error} />

      {showProgress && (
        <CrawlProgress
          kind={job.type}
          jobId={jobId}
          status={job.status}
          results={results}
          total={job.total_urls}
          stopping={cancellation.stopping}
          cancelError={cancellation.cancelError}
          onCancel={job.running ? cancellation.cancel : undefined}
          showJobLink={false}
        />
      )}

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

      {selected !== null && <ResultPreview jobId={jobId} index={selected} />}

      <details className="card p-4">
        <summary className="text-sm font-semibold text-zinc-300 cursor-pointer">Request payload</summary>
        <JsonBlock data={job.payload} />
      </details>
    </div>
  );
}
