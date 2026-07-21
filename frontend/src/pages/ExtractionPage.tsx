import { useEffect, useState } from "react";
import { Loader2, Play, Save, Sparkles, Trash2 } from "lucide-react";
import { api, prune } from "../lib/api";
import { ExtractionEditor, SchemaJsonEditor } from "../components/ExtractionEditor";
import { useCrawlConfig } from "../components/useCrawlConfig";
import { ErrorBanner, JobBar } from "../components/shared";
import { JsonBlock } from "../components/ResultTabs";
import { useJob } from "../components/useJob";

export default function ExtractionPage() {
  const [testUrl, setTestUrl] = useState("");
  const [extraction, setExtraction] = useState<Record<string, any>>({ type: "css" });
  const [extracted, setExtracted] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [crawlConfig, , configReady] = useCrawlConfig();
  const job = useJob();

  // Schema generation
  const [genQuery, setGenQuery] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Library
  const [schemas, setSchemas] = useState<any[]>([]);
  const refreshSchemas = () => api.get("/schemas").then(setSchemas).catch(() => {});
  useEffect(() => {
    refreshSchemas();
  }, []);

  useEffect(() => {
    if (job.jobId && job.results.length > 0 && job.status !== "running") {
      api
        .get(`/jobs/${job.jobId}/results/0`)
        .then((r) => setExtracted(r.extracted_content ?? { note: "No extracted content — check your selectors." }))
        .catch(() => {});
    }
  }, [job.status, job.results, job.jobId]);

  const test = async () => {
    if (!configReady || !testUrl.trim()) return;
    setError(null);
    setExtracted(null);
    const config = { ...crawlConfig, extraction };
    try {
      await job.start("/crawl", { url: testUrl.trim(), config: prune(config) ?? {} });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const generate = async () => {
    if (!testUrl.trim()) return;
    setGenLoading(true);
    setGenError(null);
    try {
      const res = await api.post("/schema/generate", {
        url: testUrl.trim(),
        query: genQuery || undefined,
        schema_type: extraction.type === "xpath" ? "XPATH" : "CSS",
      });
      setExtraction({ ...extraction, schema: res.schema, schema_id: undefined });
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenLoading(false);
    }
  };

  const saveToLibrary = async () => {
    const name = window.prompt("Schema name:");
    if (!name) return;
    const kind = extraction.type === "none" ? "css" : extraction.type;
    const payload =
      kind === "regex"
        ? { regex_builtin: extraction.regex_builtin, regex_custom: extraction.regex_custom }
        : kind === "llm"
          ? extraction.llm_schema ?? {}
          : extraction.schema ?? {};
    await api.post("/schemas", { name, kind, payload });
    refreshSchemas();
  };

  const running = job.status === "running" || job.status === "queued";

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Extraction studio</h2>
        <p className="text-sm text-zinc-500">
          Build and test extraction strategies — CSS/XPath schemas (LLM-generated once, reused forever), regex and LLM extraction.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          className="input text-base"
          placeholder="https://news.ycombinator.com"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && test()}
        />
        <button className="btn-primary shrink-0" onClick={test} disabled={!configReady || running || !testUrl.trim()}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Test
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-200">Strategy</h3>
              <button className="btn-ghost !px-2 !py-1 text-xs" onClick={saveToLibrary}>
                <Save size={14} /> Save to library
              </button>
            </div>
            <ExtractionEditor value={extraction} onChange={setExtraction} />
          </div>

          {(extraction.type === "css" || extraction.type === "xpath") && (
            <div className="card p-4 space-y-2">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Sparkles size={15} className="text-accent" /> Generate schema with LLM
              </h3>
              <p className="text-xs text-zinc-500">
                One-time LLM call analyzes the page above and produces a reusable schema — extraction itself stays LLM-free.
              </p>
              <input
                className="input"
                placeholder="What to extract, e.g. 'posts with title, points, comment count'"
                value={genQuery}
                onChange={(e) => setGenQuery(e.target.value)}
              />
              <button className="btn-secondary" onClick={generate} disabled={genLoading || !testUrl.trim()}>
                {genLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Generate from {testUrl.trim() ? new URL(testUrl.trim().startsWith("http") ? testUrl.trim() : `https://${testUrl.trim()}`).hostname : "URL"}
              </button>
              <ErrorBanner message={genError} />
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-2">Schema library</h3>
            {schemas.length === 0 && <p className="text-xs text-zinc-500">Saved schemas appear here for reuse across pages.</p>}
            <div className="space-y-1.5">
              {schemas.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm rounded-lg border border-surface-border px-3 py-2">
                  <span className="text-[10px] uppercase font-semibold text-accent bg-accent/10 rounded px-1.5 py-0.5">{s.kind}</span>
                  <span className="text-zinc-200">{s.name}</span>
                  <div className="ml-auto flex gap-1">
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() =>
                        setExtraction(
                          s.kind === "regex"
                            ? { type: "regex", ...s.payload }
                            : { type: s.kind, schema: s.payload, schema_id: undefined }
                        )
                      }
                    >
                      Load
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs text-red-400"
                      onClick={async () => {
                        await api.delete(`/schemas/${s.id}`);
                        refreshSchemas();
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <ErrorBanner message={error ?? job.error} />
          <JobBar job={job} onCancel={job.cancel} />
          <div className="card p-4 min-h-[300px]">
            <h3 className="text-sm font-semibold text-zinc-200 mb-2">Extracted data</h3>
            {extracted ? (
              <JsonBlock data={extracted} />
            ) : (
              <p className="text-sm text-zinc-500">Run a test to see extracted JSON here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
