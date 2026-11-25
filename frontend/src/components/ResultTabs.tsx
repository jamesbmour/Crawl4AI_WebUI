import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";
import { CopyButton, JsonBlock } from "./JsonBlock";
import { api, artifactUrl } from "../lib/api";
import { ErrorBanner } from "./shared";

interface Props {
  result: any; // full result summary from /api/jobs/{id}/results/{index}
  jobId: string;
}

type TabId =
  | "markdown"
  | "html"
  | "extracted"
  | "links"
  | "media"
  | "tables"
  | "metadata"
  | "screenshot"
  | "pdf"
  | "network"
  | "ssl"
  | "changes";

export function ResultTabs({ result, jobId }: Props) {
  const tabs = useMemo(() => {
    const t: { id: TabId; label: string }[] = [];
    if (result.markdown) t.push({ id: "markdown", label: "Markdown" });
    if (result.html || result.cleaned_html || result.html_truncated) t.push({ id: "html", label: "HTML" });
    if (result.extracted_content) t.push({ id: "extracted", label: "Extracted" });
    if (result.links && (result.links.internal?.length || result.links.external?.length))
      t.push({ id: "links", label: `Links` });
    if (result.media && Object.values(result.media).some((v: any) => Array.isArray(v) && v.length))
      t.push({ id: "media", label: "Media" });
    if (result.tables?.length) t.push({ id: "tables", label: `Tables (${result.tables.length})` });
    if (result.screenshot) t.push({ id: "screenshot", label: "Screenshot" });
    if (result.pdf) t.push({ id: "pdf", label: "PDF" });
    if (result.network_requests?.length || result.console_messages?.length)
      t.push({ id: "network", label: "Network / Console" });
    if (result.ssl_certificate) t.push({ id: "ssl", label: "SSL" });
    if (result.markdown) t.push({ id: "changes", label: "Changes" });
    t.push({ id: "metadata", label: "Metadata" });
    return t;
  }, [result]);

  const [tab, setTab] = useState<TabId>(tabs[0]?.id ?? "metadata");
  const active = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id ?? "metadata";

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1" role="group" aria-label="Result format">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab whitespace-nowrap ${active === t.id ? "tab-active" : ""}`}
              aria-pressed={active === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <a className="btn-ghost shrink-0 !px-2 text-xs" href={`/api/jobs/${jobId}/export.zip`}>
          <Download size={14} aria-hidden="true" /> Export ZIP
        </a>
      </div>
      <div className="result-content max-h-[640px] min-w-0 overflow-auto p-3 sm:p-4">
        {active === "markdown" && <MarkdownTab result={result} jobId={jobId} />}
        {active === "html" && <HtmlTab result={result} jobId={jobId} />}
        {active === "extracted" && <JsonBlock data={result.extracted_content} />}
        {active === "links" && <LinksTab links={result.links} />}
        {active === "media" && <MediaTab media={result.media} />}
        {active === "tables" && <TablesTab tables={result.tables} />}
        {active === "screenshot" && (
          <img
            src={artifactUrl(jobId, result.index, "screenshot.png")}
            alt="Page screenshot"
            className="max-w-full rounded-lg border border-surface-border"
          />
        )}
        {active === "pdf" && (
          <iframe
            src={artifactUrl(jobId, result.index, "page.pdf")}
            className="w-full h-[600px] rounded-lg border border-surface-border bg-white"
            title="PDF"
          />
        )}
        {active === "network" && <NetworkTab result={result} />}
        {active === "ssl" && <JsonBlock data={result.ssl_certificate} />}
        {active === "changes" && <ChangesTab result={result} jobId={jobId} />}
        {active === "metadata" && <MetadataTab result={result} />}
      </div>
    </div>
  );
}

function MarkdownTab({ result, jobId }: Props) {
  const hasFit = !!result.fit_markdown;
  const [view, setView] = useState<"raw" | "fit" | "rendered">("rendered");
  const text = view === "fit" && hasFit ? result.fit_markdown : result.markdown;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <button className={`tab ${view === "rendered" ? "tab-active" : ""}`} aria-pressed={view === "rendered"} onClick={() => setView("rendered")}>
            Rendered
          </button>
          <button className={`tab ${view === "raw" ? "tab-active" : ""}`} aria-pressed={view === "raw"} onClick={() => setView("raw")}>
            Raw
          </button>
          {hasFit && (
            <button className={`tab ${view === "fit" ? "tab-active" : ""}`} aria-pressed={view === "fit"} onClick={() => setView("fit")}>
              Fit (filtered)
            </button>
          )}
        </div>
        <span className="text-xs text-zinc-500">{(text?.length ?? 0).toLocaleString()} chars</span>
        <div className="ml-auto flex items-center gap-1">
          <CopyButton text={text ?? ""} />
          <a
            className="btn-ghost !px-2 !py-1 text-xs"
            href={artifactUrl(jobId, result.index, view === "fit" ? "result.fit.md" : "result.md", true)}
          >
            <Download size={13} /> .md
          </a>
        </div>
      </div>
      {view === "rendered" ? (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ img: ({ node: _node, ...props }) => <img {...props} loading="lazy" decoding="async" /> }}
          >
            {text ?? ""}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-300">{text}</pre>
      )}
    </div>
  );
}

function HtmlTab({ result, jobId }: Props) {
  const [view, setView] = useState<"cleaned" | "raw">(result.cleaned_html ? "cleaned" : "raw");
  const text = view === "cleaned" ? result.cleaned_html : result.html;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {result.cleaned_html && (
            <button className={`tab ${view === "cleaned" ? "tab-active" : ""}`} aria-pressed={view === "cleaned"} onClick={() => setView("cleaned")}>
              Cleaned
            </button>
          )}
          <button className={`tab ${view === "raw" ? "tab-active" : ""}`} aria-pressed={view === "raw"} onClick={() => setView("raw")}>
            Raw
          </button>
        </div>
        <div className="ml-auto flex gap-1">
          {text && <CopyButton text={text} />}
          <a
            className="btn-ghost !px-2 !py-1 text-xs"
            href={artifactUrl(jobId, result.index, view === "cleaned" ? "cleaned.html" : "page.html", true)}
          >
            <Download size={13} /> .html
          </a>
        </div>
      </div>
      {text ? (
        <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-300 max-h-[500px] overflow-auto">
          {text.slice(0, 200_000)}
        </pre>
      ) : (
        <p className="text-sm text-zinc-500">HTML too large for inline view — use the download button.</p>
      )}
    </div>
  );
}

function LinksTab({ links }: { links: any }) {
  const internal = links?.internal ?? [];
  const external = links?.external ?? [];
  return (
    <div className="space-y-4">
      {[
        ["Internal", internal],
        ["External", external],
      ].map(([label, items]: any) => (
        <div key={label}>
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">
            {label} ({items.length})
          </h4>
          <div className="space-y-1 max-h-64 overflow-auto">
            {items.slice(0, 500).map((l: any, i: number) => (
              <div key={i} className="text-xs flex gap-2 items-baseline">
                <a href={l.href} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate max-w-[50%]">
                  {l.href}
                </a>
                <span className="text-zinc-500 truncate">{l.text}</span>
                {typeof l.total_score === "number" && (
                  <span className="text-zinc-600 ml-auto shrink-0">score {l.total_score.toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaTab({ media }: { media: any }) {
  return (
    <div className="space-y-4">
      {Object.entries(media ?? {}).map(([kind, items]: [string, any]) =>
        Array.isArray(items) && items.length ? (
          <div key={kind}>
            <h4 className="text-sm font-semibold text-zinc-300 mb-2 capitalize">
              {kind} ({items.length})
            </h4>
            <div className="space-y-1 max-h-64 overflow-auto">
              {items.slice(0, 200).map((m: any, i: number) => (
                <div key={i} className="text-xs flex gap-2 items-baseline">
                  <a href={m.src} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate max-w-[60%]">
                    {m.src}
                  </a>
                  <span className="text-zinc-500 truncate">{m.alt ?? m.desc}</span>
                  {typeof m.score === "number" && <span className="text-zinc-600 ml-auto shrink-0">score {m.score}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function TablesTab({ tables }: { tables: any[] }) {
  return (
    <div className="space-y-6">
      {(tables ?? []).map((t, i) => (
        <div key={i}>
          {t.caption && <p className="text-sm text-zinc-400 mb-1">{t.caption}</p>}
          <div className="overflow-auto max-h-80">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  {(t.headers ?? []).map((h: string, j: number) => (
                    <th key={j} className="border border-surface-border px-2 py-1 text-left bg-surface-overlay sticky top-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(t.rows ?? []).slice(0, 200).map((row: any[], j: number) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k} className="border border-surface-border px-2 py-1">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function NetworkTab({ result }: { result: any }) {
  const [view, setView] = useState<"network" | "console">(
    result.network_requests?.length ? "network" : "console"
  );
  return (
    <div>
      <div className="flex gap-1 mb-3">
        {result.network_requests?.length > 0 && (
          <button className={`tab ${view === "network" ? "tab-active" : ""}`} aria-pressed={view === "network"} onClick={() => setView("network")}>
            Network ({result.network_requests_count})
          </button>
        )}
        {result.console_messages?.length > 0 && (
          <button className={`tab ${view === "console" ? "tab-active" : ""}`} aria-pressed={view === "console"} onClick={() => setView("console")}>
            Console ({result.console_messages.length})
          </button>
        )}
      </div>
      <JsonBlock data={view === "network" ? result.network_requests : result.console_messages} />
    </div>
  );
}

/** Line diff of this page's markdown against the previous crawl of the same URL. */
function ChangesTab({ result, jobId }: Props) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/jobs/${jobId}/results/${result.index}/diff`, controller.signal)
      .then(setData)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [jobId, result.index]);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <p className="text-sm text-zinc-400" role="status">Comparing with the previous crawl…</p>;
  if (!data.previous) {
    return (
      <p className="text-sm text-zinc-400">
        This is the first stored crawl of this URL. Crawl it again later to see what changed.
      </p>
    );
  }

  const previous = (
    <a className="text-accent hover:underline" href={`#/jobs/${data.previous.job_id}?result=${data.previous.index}`}>
      {new Date(data.previous.created_at * 1000).toLocaleString()}
    </a>
  );
  if (!data.diff.length) return <p className="text-sm text-zinc-300">No changes since the crawl on {previous}.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">
        <span className="text-green-400">+{data.added} added</span>{" · "}
        <span className="text-red-400">−{data.removed} removed</span> since the crawl on {previous}
        {data.truncated && " (showing the first part of a long diff)"}
      </p>
      <div className="text-xs font-mono whitespace-pre-wrap break-words">
        {data.diff.map((line: string, i: number) => (
          <div
            key={i}
            className={
              line.startsWith("+") ? "bg-green-500/10 text-green-300"
                : line.startsWith("-") ? "bg-red-500/10 text-red-300"
                : line.startsWith("@@") ? "mt-2 text-zinc-500"
                : "text-zinc-400"
            }
          >
            {line || " "}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetadataTab({ result }: { result: any }) {
  const meta = {
    url: result.url,
    redirected_url: result.redirected_url,
    status_code: result.status_code,
    success: result.success,
    error_message: result.error_message,
    session_id: result.session_id,
    depth: result.depth,
    score: result.score,
    metadata: result.metadata,
    response_headers: result.response_headers,
  };
  return <JsonBlock data={meta} />;
}
