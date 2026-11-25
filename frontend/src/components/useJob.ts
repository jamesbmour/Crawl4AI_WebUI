import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, streamJob, type JobEvent, type SlimResult } from "../lib/api";

export interface JobState {
  jobId: string | null;
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
  error: string | null;
  progress: string | null;
  results: SlimResult[];
  total: number | null;
  stats: Record<string, unknown> | null;
}

const initial: JobState = {
  jobId: null,
  status: "idle",
  error: null,
  progress: null,
  results: [],
  total: null,
  stats: null,
};

/** Keep the stop request pending until the crawl reports a terminal status. */
export function useJobCancellation(jobId: string | null, active: boolean) {
  const [request, setRequest] = useState<{ jobId: string; stopping: boolean; error?: string } | null>(null);
  const current = active && request?.jobId === jobId ? request : null;
  const stopping = current?.stopping ?? false;

  const cancel = async () => {
    if (!jobId || !active || stopping) return;
    setRequest({ jobId, stopping: true });
    try {
      await api.post(`/jobs/${jobId}/cancel`);
    } catch (error) {
      // A job that finished during the request will report its final state on the stream.
      const message = error instanceof ApiError && error.status === 409
        ? undefined
        : "Could not stop the crawl. Try again.";
      setRequest((previous) => previous?.jobId === jobId
        ? { jobId, stopping: false, error: message }
        : previous);
    }
  };

  return { cancel, stopping, cancelError: current?.error ?? null };
}

/** Start jobs and stream their events into React state. */
export function useJob() {
  const [state, setState] = useState<JobState>(initial);
  const unsubRef = useRef<(() => void) | null>(null);
  const pending = useRef<Promise<string> | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      unsubRef.current?.();
    };
  }, []);

  const attach = useCallback((jobId: string, total: number | null = null) => {
    unsubRef.current?.();
    setState({ ...initial, jobId, total, status: "running" });
    unsubRef.current = streamJob(jobId, (event: JobEvent) => {
      setState((prev) => {
        const next = { ...prev };
        if (event.type === "status" && event.status) {
          next.status = event.status as JobState["status"];
          if (event.error) next.error = event.error;
        } else if (event.type === "error") {
          next.status = "failed";
          next.error = event.message ?? "Unable to follow this crawl.";
        } else if (event.type === "progress" && event.message) {
          next.progress = event.message;
        } else if (event.type === "result" && event.result) {
          const exists = prev.results.some((r) => r.index === event.result!.index);
          next.results = exists
            ? prev.results.map((r) => (r.index === event.result!.index ? event.result! : r))
            : [...prev.results, event.result];
          if (event.total) next.total = event.total;
        } else if (event.type === "adaptive_stats" && event.stats) {
          next.stats = event.stats;
        }
        return next;
      });
    });
  }, []);

  const start = useCallback((path: string, payload: unknown, total: number | null = null): Promise<string> => {
    if (pending.current) return pending.current;
    setState({ ...initial, total, status: "queued" });
    const request = api.post(path, payload)
      .then(({ job_id }) => {
        if (mounted.current) attach(job_id, total);
        return job_id;
      })
      .catch((error: Error) => {
        if (mounted.current) setState(initial);
        throw error;
      })
      .finally(() => { pending.current = null; });
    pending.current = request;
    return request;
  }, [attach]);

  const reset = useCallback(() => {
    unsubRef.current?.();
    setState(initial);
  }, []);

  const cancellation = useJobCancellation(state.jobId, state.status === "queued" || state.status === "running");
  return { ...state, ...cancellation, start, attach, reset };
}
