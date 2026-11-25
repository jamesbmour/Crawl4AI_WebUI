import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner } from "../components/shared";

interface Hit {
  job_id: string;
  index: number;
  url: string | null;
  created_at: number;
  in_content: number;
  snippet: string;
}

const MAX_HITS = 50;

function Highlight({ text, query }: { text: string; query: string }) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    <>
      {text.split(new RegExp(`(${escaped})`, "ig")).map((part, i) =>
        i % 2 ? <mark key={i} className="rounded bg-accent/25 px-0.5 text-zinc-100">{part}</mark> : part
      )}
    </>
  );
}

export default function SearchPage() {
  // The query lives in the URL so going back from a job restores the results.
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const [draft, setDraft] = useState(query);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    if (query.length < 2) {
      setHits(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(query)}&limit=${MAX_HITS}`, controller.signal)
      .then(setHits)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParams(draft.trim() ? { q: draft.trim() } : {});
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="page-title">Search</h1>
        <p className="text-sm text-zinc-500">Find text in every page you have crawled, across all jobs.</p>
      </header>

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            className="input h-11 pl-10 text-base"
            aria-label="Search crawled pages"
            placeholder="Words from a page or part of a URL"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary h-11" disabled={loading || draft.trim().length < 2}>
          {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          Search
        </button>
      </form>

      <ErrorBanner message={error} />

      {hits && (
        <p className="text-sm text-zinc-400" role="status">
          {hits.length === 0
            ? `No stored pages contain “${query}”.`
            : hits.length === MAX_HITS
              ? `Showing the ${MAX_HITS} most recent matches.`
              : `${hits.length} ${hits.length === 1 ? "page matches" : "pages match"}.`}
        </p>
      )}

      <ul className="space-y-2">
        {hits?.map((hit) => (
          <li key={`${hit.job_id}/${hit.index}`} className="card p-4">
            <Link
              to={`/jobs/${hit.job_id}?result=${hit.index}`}
              className="block break-all font-mono text-sm text-accent hover:underline"
            >
              <Highlight text={hit.url || `Result ${hit.index + 1}`} query={query} />
            </Link>
            {hit.snippet && (
              <p className="mt-1.5 break-words text-sm text-zinc-300">
                …<Highlight text={hit.snippet.replace(/\s+/g, " ")} query={query} />…
              </p>
            )}
            <p className="mt-1.5 text-xs text-zinc-500">
              {new Date(hit.created_at * 1000).toLocaleString()} · job {hit.job_id}
              {!hit.in_content && " · matched the URL only"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
