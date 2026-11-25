import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2, Square, XCircle } from "lucide-react";
import type { SlimResult } from "../lib/api";
import type { JobState } from "./useJob";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: "bg-zinc-800 text-zinc-400",
    queued: "bg-zinc-800 text-zinc-300",
    running: "bg-blue-500/15 text-blue-400",
    completed: "bg-green-500/15 text-green-400",
    failed: "bg-red-500/15 text-red-400",
    cancelled: "bg-yellow-500/15 text-yellow-400",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", styles[status] ?? styles.idle)}>
      {status === "running" && <Loader2 size={11} className="animate-spin" />}
      {status}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      <XCircle size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 whitespace-pre-wrap break-words">{message}</span>
    </div>
  );
}

export function JobBar({ job, onCancel }: { job: JobState & { stopping: boolean }; onCancel?: () => void | Promise<void> }) {
  if (job.status === "idle") return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-surface-border pt-3 text-sm">
      <div role="status" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={job.status} />
          {job.stopping ? <span>Stopping crawl…</span> : (
            job.progress && job.status === "running" && <span className="min-w-0 break-words text-zinc-400">{job.progress}</span>
          )}
        {job.total != null && <span className="text-zinc-400">{job.results.length}/{job.total} pages</span>}
      </div>
      {job.jobId && (job.status === "queued" || job.status === "running") && onCancel && (
        <button
          className="btn-secondary !py-1 !px-2.5 text-xs text-red-300 border-red-900/70 hover:border-red-700 hover:bg-red-950/40"
          onClick={onCancel}
          disabled={job.stopping}
          aria-label={job.stopping ? "Stopping crawl" : "Stop crawl"}
        >
          {job.stopping ? <Loader2 size={12} className="animate-spin" /> : <Square size={11} fill="currentColor" />}
          {job.stopping ? "Stopping…" : "Stop crawl"}
        </button>
      )}
      {job.jobId && (
        <a href={`#/jobs/${job.jobId}`} className="ml-auto inline-flex min-h-10 items-center px-2 text-xs text-zinc-300 hover:text-accent">
          View job
        </a>
      )}
    </div>
  );
}

export function ResultsTable({
  results,
  onSelect,
  selected,
  showDepth = false,
}: {
  results: SlimResult[];
  onSelect?: (r: SlimResult) => void;
  selected?: number | null;
  showDepth?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const lastPage = Math.max(0, Math.ceil(results.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  if (!results.length) return null;
  return (
    <div className="card">
      <div className="table-scroll rounded-t-xl" role="region" aria-label="Crawled pages" tabIndex={0}>
        <table className={clsx("w-full text-sm", showDepth ? "min-w-[540px]" : "min-w-[400px]")}>
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-surface-border">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">URL</th>
              {showDepth && <th className="px-3 py-2 w-16">Depth</th>}
              {showDepth && <th className="px-3 py-2 w-16">Score</th>}
              <th className="px-3 py-2 w-20">Status</th>
              <th className="px-3 py-2 w-24">Markdown</th>
            </tr>
          </thead>
          <tbody>
            {results.slice(start, start + pageSize).map((r) => (
              <tr
                key={r.index}
                onClick={() => onSelect?.(r)}
                className={clsx(
                  "border-b border-surface-border/50 transition-colors",
                  onSelect && "cursor-pointer hover:bg-surface-overlay/50",
                  selected === r.index && "bg-surface-overlay"
                )}
              >
                <td className="px-3 py-2 text-zinc-500">{r.index}</td>
                <td className="px-3 py-2 max-w-[200px] sm:max-w-[380px]" title={r.url}>
                  {onSelect ? (
                    <button
                      className="block min-h-10 w-full truncate rounded text-left text-zinc-200 hover:text-accent"
                      aria-pressed={selected === r.index}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(r);
                      }}
                    >
                      {r.url || `Result ${r.index + 1}`}
                    </button>
                  ) : <span className="block truncate">{r.url}</span>}
                </td>
                {showDepth && <td className="px-3 py-2 text-zinc-400">{r.depth ?? "—"}</td>}
                {showDepth && (
                  <td className="px-3 py-2 text-zinc-400">{typeof r.score === "number" ? r.score.toFixed(2) : "—"}</td>
                )}
                <td className="px-3 py-2">
                  {r.success ? (
                    <span className="text-green-400 text-xs">{r.status_code ?? "OK"}</span>
                  ) : (
                    <span className="text-red-400 text-xs" title={r.error_message ?? undefined}>
                      failed
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-500 text-xs">
                  {r.markdown_length ? `${(r.markdown_length / 1000).toFixed(1)}k chars` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lastPage > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-400">
          <span>{start + 1}–{Math.min(start + pageSize, results.length)} of {results.length} pages</span>
          <div className="flex gap-2">
            <button className="btn-secondary !px-2" aria-label="Previous results page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn-secondary !px-2" aria-label="Next results page" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
