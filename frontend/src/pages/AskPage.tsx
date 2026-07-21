import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, SendHorizonal } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner } from "../components/shared";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function AskPage() {
  const [sourceType, setSourceType] = useState<"url" | "job">("url");
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/settings").then((s) => setLlmReady(!!s.llm_configured)).catch(() => {});
    api
      .get("/jobs")
      .then((rows) => setJobs(rows.filter((j: any) => j.status === "completed" && j.completed_urls > 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setQuestion("");
    const newHistory: Turn[] = [...history, { role: "user", content: q }];
    setHistory(newHistory);
    setLoading(true);
    try {
      const res = await api.post("/ask", {
        url: sourceType === "url" ? url.trim() || undefined : undefined,
        job_id: sourceType === "job" ? jobId || undefined : undefined,
        question: q,
        history,
      });
      setHistory([...newHistory, { role: "assistant", content: res.answer }]);
    } catch (e: any) {
      setError(e.message);
      setHistory(history);
      setQuestion(q);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Ask</h2>
        <p className="text-sm text-zinc-500">Chat with crawled content — a page URL or a finished job's results.</p>
      </header>

      {llmReady === false && (
        <div className="rounded-lg border border-yellow-900 bg-yellow-950/40 px-3 py-2 text-sm text-yellow-300">
          No LLM provider configured — set one up in <a href="#/settings" className="underline">Settings</a> to use Ask.
        </div>
      )}

      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div className="flex gap-1">
          <button className={`tab ${sourceType === "url" ? "tab-active" : ""}`} onClick={() => setSourceType("url")}>
            URL
          </button>
          <button className={`tab ${sourceType === "job" ? "tab-active" : ""}`} onClick={() => setSourceType("job")}>
            Crawl job
          </button>
        </div>
        {sourceType === "url" ? (
          <div className="flex-1 min-w-[280px]">
            <label className="label">Page URL</label>
            <input className="input" placeholder="https://example.com/article" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        ) : (
          <div className="flex-1 min-w-[280px]">
            <label className="label">Completed job</label>
            <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Select a job…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id} — {j.type} ({j.completed_urls} pages)
                </option>
              ))}
            </select>
          </div>
        )}
        {history.length > 0 && (
          <button className="btn-ghost text-xs" onClick={() => setHistory([])}>
            Clear chat
          </button>
        )}
      </div>

      <div className="card p-4 min-h-[300px] max-h-[520px] overflow-auto space-y-4">
        {history.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ask anything about the selected content — summaries, specific facts, comparisons.
          </p>
        )}
        {history.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                t.role === "user" ? "bg-accent/20 text-zinc-100" : "bg-surface-overlay text-zinc-200"
              }`}
            >
              {t.role === "assistant" ? (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                </div>
              ) : (
                t.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 size={14} className="animate-spin" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ErrorBanner message={error} />

      <div className="flex gap-2">
        <input
          className="input"
          placeholder="What is this page about?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={llmReady === false}
        />
        <button
          className="btn-primary shrink-0"
          onClick={send}
          disabled={loading || !question.trim() || llmReady === false || (sourceType === "url" ? !url.trim() : !jobId)}
        >
          <SendHorizonal size={16} />
        </button>
      </div>
    </div>
  );
}
