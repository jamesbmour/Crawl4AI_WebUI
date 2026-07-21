import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Loader2, Send } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner } from "../components/shared";

interface SeedEntry {
  url: string;
  status?: string | null;
  relevance_score?: number | null;
  title?: string | null;
}

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState("");
  const [source, setSource] = useState("sitemap");
  const [pattern, setPattern] = useState("*");
  const [query, setQuery] = useState("");
  const [scoreThreshold, setScoreThreshold] = useState<string>("");
  const [liveCheck, setLiveCheck] = useState(false);
  const [maxUrls, setMaxUrls] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SeedEntry[]> | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const run = async () => {
    const list = domains
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (!list.length) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await api.post("/seed", {
        domains: list,
        source,
        pattern: pattern || "*",
        query: query || undefined,
        score_threshold: scoreThreshold === "" ? undefined : Number(scoreThreshold),
        live_check: liveCheck,
        max_urls: maxUrls,
      });
      setResults(res.results);
      setChecked(new Set(Object.values(res.results as Record<string, SeedEntry[]>).flat().map((e) => e.url)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const allEntries = results ? Object.values(results).flat() : [];

  const sendToBatch = () => {
    const urls = allEntries.filter((e) => checked.has(e.url)).map((e) => e.url);
    localStorage.setItem("c4ai:batch_urls", urls.join("\n"));
    navigate("/batch");
  };

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">URL discovery</h2>
        <p className="text-sm text-zinc-500">
          Discover URLs from sitemaps and Common Crawl before crawling — with optional BM25 relevance scoring.
        </p>
      </header>

      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Domains (comma or newline separated)</label>
          <textarea
            className="input min-h-[60px] font-mono text-xs"
            placeholder="docs.crawl4ai.com"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Source</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="sitemap">Sitemap</option>
              <option value="cc">Common Crawl</option>
              <option value="sitemap+cc">Sitemap + Common Crawl</option>
            </select>
          </div>
          <div>
            <label className="label">URL pattern</label>
            <input className="input" placeholder="*/blog/*" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </div>
          <div>
            <label className="label">Max URLs</label>
            <input type="number" className="input" value={maxUrls} onChange={(e) => setMaxUrls(Number(e.target.value))} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" className="accent-orange-500" checked={liveCheck} onChange={(e) => setLiveCheck(e.target.checked)} />
              Live check (HEAD)
            </label>
          </div>
          <div className="col-span-2">
            <label className="label">Relevance query (BM25 scoring over page heads)</label>
            <input
              className="input"
              placeholder="async crawling examples"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Score threshold</label>
            <input
              type="number"
              step={0.05}
              className="input"
              placeholder="0.3"
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(e.target.value)}
              disabled={!query}
            />
          </div>
        </div>
        <button className="btn-primary" onClick={run} disabled={loading || !domains.trim()}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Compass size={16} />}
          Discover
        </button>
      </div>

      <ErrorBanner message={error} />

      {results && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-zinc-400">
              {allEntries.length} URLs found · {checked.size} selected
            </p>
            <button className="btn-secondary !py-1.5 text-xs" onClick={sendToBatch} disabled={!checked.size}>
              <Send size={14} /> Send to batch crawl
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-surface-border">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      className="accent-orange-500"
                      checked={checked.size === allEntries.length && allEntries.length > 0}
                      onChange={(e) =>
                        setChecked(e.target.checked ? new Set(allEntries.map((x) => x.url)) : new Set())
                      }
                    />
                  </th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2 w-40">Title</th>
                  <th className="px-3 py-2 w-20">Score</th>
                  <th className="px-3 py-2 w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {allEntries.slice(0, 1000).map((e) => (
                  <tr key={e.url} className="border-b border-surface-border/50 hover:bg-surface-overlay/40">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={checked.has(e.url)}
                        onChange={(ev) => {
                          const next = new Set(checked);
                          ev.target.checked ? next.add(e.url) : next.delete(e.url);
                          setChecked(next);
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5 truncate max-w-[420px]">
                      <a href={e.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                        {e.url}
                      </a>
                    </td>
                    <td className="px-3 py-1.5 text-zinc-500 truncate max-w-[160px]">{e.title ?? "—"}</td>
                    <td className="px-3 py-1.5 text-zinc-400">
                      {typeof e.relevance_score === "number" ? e.relevance_score.toFixed(3) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-500 text-xs">{e.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
