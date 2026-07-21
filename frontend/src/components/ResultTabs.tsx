import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, Check } from "lucide-react";
import { artifactUrl } from "../lib/api";

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
  | "ssl";

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
    t.push({ id: "metadata", label: "Metadata" });
    return t;
  }, [result]);

  const [tab, setTab] = useState<TabId>(tabs[0]?.id ?? "metadata");
  const active = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id ?? "metadata";

  return (
    <div className="card">
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-surface-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} className={`tab whitespace-nowrap ${active === t.id ? "tab-active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <a className="btn-ghost !px-2 !py-1 text-xs" href={`/api/jobs/${jobId}/export.zip`}>
            <Download size={13} /> Export
          </a>
        </div>
      </div>
      <div className="p-4 max-h-[640px] overflow-auto">
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
        {active === "metadata" && <MetadataTab result={result} />}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost !px-2 !py-1 text-xs"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MarkdownTab({ result, jobId }: Props) {
  const hasFit = !!result.fit_markdown;
  const [view, setView] = useState<"raw" | "fit" | "rendered">("rendered");
  const text = view === "fit" && hasFit ? result.fit_markdown : result.markdown;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          <button className={`tab ${view === "rendered" ? "tab-active" : ""}`} onClick={() => setView("rendered")}>
            Rendered
          </button>
          <button className={`tab ${view === "raw" ? "tab-active" : ""}`} onClick={() => setView("raw")}>
            Raw
          </button>
          {hasFit && (
            <button className={`tab ${view === "fit" ? "tab-active" : ""}`} onClick={() => setView("fit")}>
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text ?? ""}</ReactMarkdown>
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
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {result.cleaned_html && (
            <button className={`tab ${view === "cleaned" ? "tab-active" : ""}`} onClick={() => setView("cleaned")}>
              Cleaned
            </button>
          )}
          <button className={`tab ${view === "raw" ? "tab-active" : ""}`} onClick={() => setView("raw")}>
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

export function JsonBlock({ data }: { data: any }) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={text} />
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap text-zinc-300">{text}</pre>
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
          <button className={`tab ${view === "network" ? "tab-active" : ""}`} onClick={() => setView("network")}>
            Network ({result.network_requests_count})
          </button>
        )}
        {result.console_messages?.length > 0 && (
          <button className={`tab ${view === "console" ? "tab-active" : ""}`} onClick={() => setView("console")}>
            Console ({result.console_messages.length})
          </button>
        )}
      </div>
      <JsonBlock data={view === "network" ? result.network_requests : result.console_messages} />
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
