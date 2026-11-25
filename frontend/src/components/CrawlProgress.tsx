import { useId, type ReactNode } from "react";
import { Loader2, Square } from "lucide-react";
import type { SlimResult } from "../lib/api";
import { ErrorBanner, StatusBadge } from "./shared";

interface Props {
  kind: "batch" | "deep";
  jobId: string | null;
  status: string;
  results: SlimResult[];
  total?: number | null;
  stopping: boolean;
  cancelError: string | null;
  onCancel?: () => Promise<void>;
  showJobLink?: boolean;
}

function BarSegments({ success, failed, scale }: { success: number; failed: number; scale: number }) {
  return (
    <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-surface-overlay ring-1 ring-inset ring-surface-border">
      <span className="bg-emerald-400 motion-safe:transition-[width]" style={{ width: `${100 * success / scale}%` }} />
      <span className="bg-rose-400 motion-safe:transition-[width]" style={{ width: `${100 * failed / scale}%` }} />
    </div>
  );
}

function Count({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-sm ${color}`} />
      {children}
    </span>
  );
}

function DepthChart({ results }: { results: SlimResult[] }) {
  const byDepth = new Map<number, { success: number; failed: number }>();
  for (const result of results) {
    const depth = result.depth ?? Number.POSITIVE_INFINITY;
    const count = byDepth.get(depth) ?? { success: 0, failed: 0 };
    if (result.success) count.success++;
    else count.failed++;
    byDepth.set(depth, count);
  }
  const levels = [...byDepth].sort(([a], [b]) => a - b);
  const scale = levels.reduce((max, [, counts]) => Math.max(max, counts.success + counts.failed), 1);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-300">Results by link depth</h3>
      <ul className="space-y-2 text-sm">
        {levels.map(([depth, { success, failed }]) => (
          <li key={depth} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
            <span className="text-zinc-400">
              {depth === 0 ? "Starting page" : depth === 1 ? "1 link away" : Number.isFinite(depth) ? `${depth} links away` : "Unknown depth"}
            </span>
            <BarSegments success={success} failed={failed} scale={scale} />
            <span className="text-right tabular-nums text-zinc-300">
              <span className="sr-only">{success} succeeded and {failed} failed, </span>{success + failed}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CrawlProgress({
  kind, jobId, status, results, total, stopping, cancelError, onCancel, showJobLink = true,
}: Props) {
  const titleId = useId();
  const active = status === "queued" || status === "running";
  const checked = results.length;
  const success = results.reduce((count, result) => count + Number(result.success), 0);
  const failed = checked - success;
  const batchTotal = kind === "batch" && total && total > 0 ? Math.max(total, checked) : null;
  const statusText = stopping ? "Stopping crawl…" : status === "queued" ? "Starting crawl…" : null;

  if (status === "idle") return null;

  return (
    <section aria-labelledby={titleId} className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="text-base font-semibold text-zinc-100">Crawl progress</h2>
        <div className="flex flex-wrap items-center gap-2">
          {jobId && showJobLink && <a className="btn-ghost !px-2 text-xs" href={`#/jobs/${jobId}`}>View job</a>}
          {jobId && active && onCancel && (
            <button
              type="button"
              className="btn-secondary !px-3 text-sm text-red-300 border-red-900/70 hover:border-red-700 hover:bg-red-950/40"
              disabled={stopping}
              onClick={onCancel}
            >
              {stopping ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}
              {stopping ? "Stopping…" : "Stop crawl"}
            </button>
          )}
        </div>
      </div>

      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xl font-semibold tabular-nums text-zinc-100">
          {batchTotal ? `${checked} of ${batchTotal} URLs checked` : `${checked} ${checked === 1 ? "result" : "results"} collected`}
        </span>
        <StatusBadge status={status} />
        {statusText && <span className="text-sm text-zinc-400">{statusText}</span>}
      </div>

      {batchTotal && (
        <div role="progressbar" aria-label="Batch URLs checked" aria-valuemin={0} aria-valuemax={batchTotal}
          aria-valuenow={checked} aria-valuetext={`${checked} of ${batchTotal} URLs checked`}>
          <BarSegments success={success} failed={failed} scale={batchTotal} />
        </div>
      )}
      {kind === "deep" && (checked > 0
        ? <DepthChart results={results} />
        : active && <p className="text-sm text-zinc-400">Results appear here as the crawler follows links.</p>)}

      {(checked > 0 || batchTotal) && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums text-zinc-300">
          <Count color="bg-emerald-400">{success} succeeded</Count>
          <Count color="bg-rose-400">{failed} failed</Count>
          {batchTotal && <Count color="bg-surface-overlay ring-1 ring-inset ring-surface-border">{batchTotal - checked} unprocessed</Count>}
        </div>
      )}
      {status === "cancelled" && (
        <p className="text-sm text-zinc-400">{checked > 0 ? "Saved results are still available below." : "The crawl stopped before saving any results."}</p>
      )}
      <ErrorBanner message={cancelError} />
    </section>
  );
}
