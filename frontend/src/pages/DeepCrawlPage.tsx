import { useEffect, useState } from "react";
import { Loader2, Play, Plus, Trash2 } from "lucide-react";
import { api, prune, type SlimResult } from "../lib/api";
import { ConfigPanel } from "../components/ConfigPanel";
import { useCrawlConfig } from "../components/useCrawlConfig";
import { ResultTabs } from "../components/ResultTabs";
import { ErrorBanner, JobBar, ResultsTable } from "../components/shared";
import { useJob } from "../components/useJob";

interface FilterRow {
  type: string;
  patterns?: string;
  allowed_domains?: string;
  blocked_domains?: string;
  allowed_types?: string;
  query?: string;
  threshold?: number;
  keywords?: string;
  reverse?: boolean;
}

const FILTER_TYPES = [
  { value: "url_pattern", label: "URL pattern" },
  { value: "domain", label: "Domain allow/block" },
  { value: "content_type", label: "Content type" },
  { value: "content_relevance", label: "Content relevance (BM25 on <head>)" },
  { value: "seo", label: "SEO quality" },
];

export default function DeepCrawlPage() {
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState("bfs");
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(25);
  const [includeExternal, setIncludeExternal] = useState(false);
  const [scoreThreshold, setScoreThreshold] = useState<string>("");
  const [keywords, setKeywords] = useState("");
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [config, setConfig, configReady] = useCrawlConfig();
  const [selected, setSelected] = useState<SlimResult | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const job = useJob();

  useEffect(() => {
    if (selected && job.jobId) {
      setDetail(null);
      api.get(`/jobs/${job.jobId}/results/${selected.index}`).then(setDetail).catch(() => {});
    }
  }, [selected, job.jobId]);

  const toList = (s?: string) =>
    s
      ?.split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const run = async () => {
    if (!configReady || !url.trim()) return;
    setStartError(null);
    setSelected(null);
    setDetail(null);
    const payload = {
      url: url.trim(),
      strategy,
      max_depth: maxDepth,
      max_pages: maxPages || undefined,
      include_external: includeExternal,
      score_threshold: scoreThreshold === "" ? undefined : Number(scoreThreshold),
      keywords: toList(keywords),
      filters: filters.map((f) => ({
        type: f.type,
        patterns: toList(f.patterns),
        allowed_domains: toList(f.allowed_domains),
        blocked_domains: toList(f.blocked_domains),
        allowed_types: toList(f.allowed_types),
        query: f.query || undefined,
        threshold: f.threshold,
        keywords: toList(f.keywords),
        reverse: f.reverse,
      })),
      config: prune(config) ?? {},
    };
    try {
      await job.start("/crawl/deep", payload);
    } catch (e: any) {
      setStartError(e.message);
    }
  };

  const running = job.status === "running" || job.status === "queued";

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Deep crawl</h2>
        <p className="text-sm text-zinc-500">
          Recursively follow links with BFS, DFS or Best-First strategies, URL filters and keyword scoring.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          className="input text-base"
          placeholder="https://docs.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && run()}
        />
        <button className="btn-primary shrink-0" onClick={run} disabled={!configReady || running || !url.trim()}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Crawl
        </button>
      </div>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <label className="label">Strategy</label>
          <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="bfs">BFS — breadth first</option>
            <option value="dfs">DFS — depth first</option>
            <option value="best_first">Best-first (scored)</option>
          </select>
        </div>
        <div>
          <label className="label">Max depth</label>
          <input type="number" className="input" value={maxDepth} min={0} onChange={(e) => setMaxDepth(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Max pages</label>
          <input type="number" className="input" value={maxPages} min={1} onChange={(e) => setMaxPages(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Score threshold</label>
          <input
            type="number"
            step={0.05}
            className="input"
            placeholder="(none)"
            value={scoreThreshold}
            onChange={(e) => setScoreThreshold(e.target.value)}
            disabled={strategy === "best_first"}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              className="accent-orange-500"
              checked={includeExternal}
              onChange={(e) => setIncludeExternal(e.target.checked)}
            />
            Follow external links
          </label>
        </div>
        <div className="col-span-2 md:col-span-5">
          <label className="label">Relevance keywords (scores links; drives Best-First ordering)</label>
          <input
            className="input"
            placeholder="python, async, tutorial"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">URL filters</h3>
          <button
            className="btn-ghost !px-2 !py-1 text-xs"
            onClick={() => setFilters([...filters, { type: "url_pattern" }])}
          >
            <Plus size={14} /> Add filter
          </button>
        </div>
        {filters.length === 0 && <p className="text-xs text-zinc-500">No filters — all discovered URLs are eligible.</p>}
        {filters.map((f, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-surface-border p-3">
            <div className="w-48">
              <label className="label">Type</label>
              <select
                className="input"
                value={f.type}
                onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { type: e.target.value } : x)))}
              >
                {FILTER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {f.type === "url_pattern" && (
              <>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Glob patterns (comma separated)</label>
                  <input
                    className="input"
                    placeholder="*/docs/*, *.html"
                    value={f.patterns ?? ""}
                    onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, patterns: e.target.value } : x)))}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-400 pb-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={!!f.reverse}
                    onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, reverse: e.target.checked } : x)))}
                  />
                  Exclude matches
                </label>
              </>
            )}
            {f.type === "domain" && (
              <>
                <div className="flex-1 min-w-[180px]">
                  <label className="label">Allowed domains</label>
                  <input
                    className="input"
                    placeholder="docs.example.com"
                    value={f.allowed_domains ?? ""}
                    onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, allowed_domains: e.target.value } : x)))}
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="label">Blocked domains</label>
                  <input
                    className="input"
                    placeholder="ads.example.com"
                    value={f.blocked_domains ?? ""}
                    onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, blocked_domains: e.target.value } : x)))}
                  />
                </div>
              </>
            )}
            {f.type === "content_type" && (
              <div className="flex-1 min-w-[220px]">
                <label className="label">Allowed MIME types</label>
                <input
                  className="input"
                  placeholder="text/html, application/pdf"
                  value={f.allowed_types ?? ""}
                  onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, allowed_types: e.target.value } : x)))}
                />
              </div>
            )}
            {f.type === "content_relevance" && (
              <>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Query</label>
                  <input
                    className="input"
                    placeholder="machine learning tutorials"
                    value={f.query ?? ""}
                    onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, query: e.target.value } : x)))}
                  />
                </div>
                <div className="w-28">
                  <label className="label">Threshold</label>
                  <input
                    type="number"
                    step={0.05}
                    className="input"
                    placeholder="0.7"
                    value={f.threshold ?? ""}
                    onChange={(e) =>
                      setFilters(
                        filters.map((x, j) =>
                          j === i ? { ...x, threshold: e.target.value === "" ? undefined : Number(e.target.value) } : x
                        )
                      )
                    }
                  />
                </div>
              </>
            )}
            {f.type === "seo" && (
              <>
                <div className="flex-1 min-w-[180px]">
                  <label className="label">Keywords</label>
                  <input
                    className="input"
                    placeholder="crawler, scraping"
                    value={f.keywords ?? ""}
                    onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))}
                  />
                </div>
                <div className="w-28">
                  <label className="label">Threshold</label>
                  <input
                    type="number"
                    step={0.05}
                    className="input"
                    placeholder="0.5"
                    value={f.threshold ?? ""}
                    onChange={(e) =>
                      setFilters(
                        filters.map((x, j) =>
                          j === i ? { ...x, threshold: e.target.value === "" ? undefined : Number(e.target.value) } : x
                        )
                      )
                    }
                  />
                </div>
              </>
            )}
            <button className="btn-ghost !p-2 text-red-400 ml-auto" onClick={() => setFilters(filters.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <ErrorBanner message={startError ?? job.error} />
      <JobBar job={job} onCancel={job.cancel} />

      <ConfigPanel config={config} onChange={setConfig} />

      <ResultsTable results={job.results} onSelect={setSelected} selected={selected?.index ?? null} showDepth />
      {detail && job.jobId && <ResultTabs result={detail} jobId={job.jobId} />}
    </div>
  );
}
