import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, Trash2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/shared";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const refresh = async () => {
    setLoading(true);
    try {
      setJobs(await api.get("/jobs"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  const fmtDuration = (j: any) => {
    if (!j.started_at) return "—";
    const end = j.finished_at ?? Date.now() / 1000;
    const s = Math.max(0, end - j.started_at);
    return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
  };

  const label = (j: any) => {
    const p = j.payload ?? {};
    return p.url ?? p.start_url ?? (Array.isArray(p.urls) ? `${p.urls.length} URLs` : "");
  };

  const needle = query.trim().toLowerCase();
  const shown = jobs.filter((j) => {
    const p = j.payload ?? {};
    const text = [j.id, p.url, p.start_url, p.query, ...(Array.isArray(p.urls) ? p.urls : [])].join(" ").toLowerCase();
    return (!status || j.status === status) && (!type || j.type === type) && text.includes(needle);
  });
  // Only jobs still visible count as selected, so a filter never hides what gets deleted.
  const selected = shown.filter((j) => checked.has(j.id));

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(checked);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setChecked(next);
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selected.length} ${selected.length === 1 ? "job" : "jobs"} and their artifacts?`)) return;
    await Promise.allSettled(selected.map((j) => api.delete(`/jobs/${j.id}`)));
    setChecked(new Set());
    refresh();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="text-sm text-zinc-500">Every crawl run, with stored results and artifacts.</p>
        </div>
        <button className="btn-secondary !py-1.5 text-xs" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="input max-w-xs"
          aria-label="Filter jobs by URL or ID"
          placeholder="Filter by URL or job ID…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="input !w-auto" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {["queued", "running", "completed", "failed", "cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input !w-auto" aria-label="Filter by type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          {[...new Set(jobs.map((j) => j.type))].map((t) => <option key={t}>{t}</option>)}
        </select>
        {shown.length !== jobs.length && (
          <span role="status" className="text-xs text-zinc-400">{shown.length} of {jobs.length} jobs</span>
        )}
        {selected.length > 0 && (
          <button className="btn-secondary ml-auto text-xs text-red-300 border-red-900/70 hover:border-red-700 hover:bg-red-950/40" onClick={deleteSelected}>
            <Trash2 size={14} aria-hidden="true" /> Delete {selected.length} selected
          </button>
        )}
      </div>

      <div className="card table-scroll" role="region" aria-label="Job history" tabIndex={0}>
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-surface-border">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  className="accent-orange-500"
                  aria-label="Select all listed jobs"
                  checked={shown.length > 0 && selected.length === shown.length}
                  onChange={(event) => toggle(shown.map((j) => j.id), event.target.checked)}
                />
              </th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Pages</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => (
              <tr key={j.id} className="border-b border-surface-border/50 hover:bg-surface-overlay/40">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    aria-label={`Select job ${j.id}`}
                    checked={checked.has(j.id)}
                    onChange={(event) => toggle([j.id], event.target.checked)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link to={`/jobs/${j.id}`} className="font-mono text-xs text-accent hover:underline">
                    {j.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-300 capitalize">{j.type}</td>
                <td className="px-3 py-2 text-zinc-400 truncate max-w-[280px]" title={label(j)}>
                  {label(j)}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {j.completed_urls}
                  {j.total_urls ? `/${j.total_urls}` : ""}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={j.status} />
                </td>
                <td className="px-3 py-2 text-zinc-500 text-xs">{fmtDuration(j)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {j.running && (
                      <button
                        className="btn-ghost !p-1.5 text-yellow-400"
                        title="Cancel"
                        onClick={async () => {
                          await api.post(`/jobs/${j.id}/cancel`).catch(() => {});
                          refresh();
                        }}
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                    <a className="btn-ghost !p-1.5" title="Export zip" href={`/api/jobs/${j.id}/export.zip`}>
                      <Download size={14} />
                    </a>
                    <button
                      className="btn-ghost !p-1.5 text-red-400"
                      title="Delete"
                      onClick={async () => {
                        if (window.confirm(`Delete job ${j.id} and its artifacts?`)) {
                          await api.delete(`/jobs/${j.id}`);
                          refresh();
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-zinc-500">
                  {jobs.length ? "No jobs match these filters." : "No jobs yet — run a crawl from any page."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
