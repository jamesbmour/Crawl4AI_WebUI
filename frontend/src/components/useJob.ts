import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamJob, type JobEvent, type SlimResult } from "../lib/api";

export interface JobState {
  jobId: string | null;
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
  error: string | null;
  progress: string | null;
  results: SlimResult[];
  total: number | null;
  stats: Record<string, unknown> | null;
  stopping: boolean;
}

const initial: JobState = {
  jobId: null,
  status: "idle",
  error: null,
  progress: null,
  results: [],
  total: null,
  stats: null,
  stopping: false,
};

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

  const attach = useCallback((jobId: string) => {
    unsubRef.current?.();
    setState({ ...initial, jobId, status: "running" });
    unsubRef.current = streamJob(jobId, (event: JobEvent) => {
      setState((prev) => {
        const next = { ...prev };
        if (event.type === "status" && event.status) {
          next.status = event.status as JobState["status"];
          next.stopping = false;
          if (event.error) next.error = event.error;
          } else if (event.type === "error") {
            next.status = "failed";
            next.stopping = false;
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

  const start = useCallback((path: string, payload: unknown): Promise<string> => {
    if (pending.current) return pending.current;
    setState({ ...initial, status: "queued" });
    const request = api.post(path, payload)
      .then(({ job_id }) => {
        if (mounted.current) attach(job_id);
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

  const cancel = useCallback(async () => {
    if (state.jobId) {
      setState((prev) => ({ ...prev, stopping: true, progress: "Stopping crawl…" }));
      try {
        await api.post(`/jobs/${state.jobId}/cancel`);
      } catch {
        /* already finished */
        setState((prev) => ({ ...prev, stopping: false }));
      }
    }
  }, [state.jobId]);

  const reset = useCallback(() => {
    unsubRef.current?.();
    setState(initial);
  }, []);

  return { ...state, start, attach, cancel, reset };
}
