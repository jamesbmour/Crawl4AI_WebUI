export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle(res: Response) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export const api = {
  get: (path: string) => fetch(`/api${path}`).then(handle),
  post: (path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(handle),
  put: (path: string, body: unknown) =>
    fetch(`/api${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),
  delete: (path: string) => fetch(`/api${path}`, { method: "DELETE" }).then(handle),
};

export interface JobEvent {
  type: "status" | "progress" | "result" | "adaptive_stats" | "error";
  status?: string;
  message?: string;
  error?: string;
  result?: SlimResult;
  completed?: number;
  total?: number;
  stats?: Record<string, unknown>;
}

export interface SlimResult {
  index: number;
  url: string;
  success: boolean;
  status_code?: number | null;
  error_message?: string | null;
  depth?: number | null;
  score?: number | null;
  markdown_length?: number;
  artifacts?: string[];
}

/** Subscribe to a job's SSE stream. Returns an unsubscribe function. */
export function streamJob(jobId: string, onEvent: (e: JobEvent) => void): () => void {
  const es = new EventSource(`/api/jobs/${jobId}/stream`);
  es.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as JobEvent;
      onEvent(event);
      if (event.type === "status" && ["completed", "failed", "cancelled"].includes(event.status ?? "")) {
        es.close();
      }
    } catch {
      /* keepalive / malformed */
    }
  };
  es.onerror = () => {
    // EventSource retries automatically; close after terminal handled above.
  };
  return () => es.close();
}

export function artifactUrl(jobId: string, index: number, name: string, download = false) {
  return `/api/jobs/${jobId}/artifacts/${index}/${name}${download ? "?download=1" : ""}`;
}

/** Recursively drop null / undefined / '' / empty arrays & objects from a payload. */
export function prune<T>(value: T): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return (value.trim() === "" ? undefined : value) as T | undefined;
  if (Array.isArray(value)) {
    const arr = value.map((v) => prune(v)).filter((v) => v !== undefined);
    return (arr.length ? arr : undefined) as T | undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = prune(v);
      if (p !== undefined) out[k] = p;
    }
    return (Object.keys(out).length ? out : undefined) as T | undefined;
  }
  return value;
}
