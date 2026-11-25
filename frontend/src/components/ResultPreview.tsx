import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "../lib/api";
import { ErrorBanner } from "./shared";

const ResultTabs = lazy(() => import("./ResultTabs").then((module) => ({ default: module.ResultTabs })));
const loading = <p className="card p-4 text-sm text-zinc-400" role="status">Loading result…</p>;

export function ResultPreview({ jobId, index }: { jobId: string; index: number }) {
  return <ResultLoader key={`${jobId}/${index}`} jobId={jobId} index={index} />;
}

function ResultLoader({ jobId, index }: { jobId: string; index: number }) {
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/jobs/${jobId}/results/${index}`, controller.signal)
      .then(setResult)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [jobId, index, attempt]);

  if (error) {
    return (
      <div className="space-y-2">
        <ErrorBanner message={error} />
        <button className="btn-secondary" onClick={() => {
          setError(null);
          setAttempt(attempt + 1);
        }}>Retry preview</button>
      </div>
    );
  }
  if (result === undefined) return loading;

  return (
    <Suspense fallback={loading}>
      <ResultTabs result={result} jobId={jobId} />
    </Suspense>
  );
}
