import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, Trash2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/shared";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Jobs</h2>
          <p className="text-sm text-zinc-500">Every crawl run, with stored results and artifacts.</p>
        </div>
        <button className="btn-secondary !py-1.5 text-xs" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-surface-border">
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
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-surface-border/50 hover:bg-surface-overlay/40">
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
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No jobs yet — run a crawl from any page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
