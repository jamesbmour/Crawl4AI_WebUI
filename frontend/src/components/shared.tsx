import clsx from "clsx";
import { Loader2, XCircle } from "lucide-react";
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
    <div className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      <XCircle size={16} className="mt-0.5 shrink-0" />
      <span className="whitespace-pre-wrap break-words">{message}</span>
    </div>
  );
}

export function JobBar({ job, onCancel }: { job: JobState; onCancel?: () => void }) {
  if (job.status === "idle") return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <StatusBadge status={job.status} />
      {job.progress && job.status === "running" && <span className="text-zinc-400">{job.progress}</span>}
      {job.total != null && (
        <span className="text-zinc-500">
          {job.results.length}/{job.total}
        </span>
      )}
      {job.status === "running" && onCancel && (
        <button className="btn-ghost !py-0.5 !px-2 text-xs text-red-400" onClick={onCancel}>
          Cancel
        </button>
      )}
      {job.jobId && (
        <a href={`#/jobs/${job.jobId}`} className="ml-auto text-xs text-zinc-500 hover:text-accent">
          job {job.jobId}
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
  if (!results.length) return null;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
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
          {results.map((r) => (
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
              <td className="px-3 py-2 truncate max-w-[380px]" title={r.url}>
                {r.url}
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
  );
}
