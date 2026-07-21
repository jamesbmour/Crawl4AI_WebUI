import { useEffect, useState } from "react";
import { Check, Loader2, Save, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner } from "../components/shared";
import { JsonBlock } from "../components/ResultTabs";

const PROVIDER_EXAMPLES = [
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-5",
  "gemini/gemini-2.0-flash",
  "groq/llama-3.3-70b-versatile",
  "ollama/llama3.3",
  "deepseek/deepseek-chat",
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    api.get("/settings").then((s) => {
      setSettings(s);
      setForm({
        llm_provider: s.llm_provider,
        llm_api_token: s.llm_api_token,
        llm_base_url: s.llm_base_url,
        llm_temperature: s.llm_temperature,
        llm_max_tokens: s.llm_max_tokens,
      });
    });
    api.get("/meta").then(setMeta).catch(() => {});
    api.get("/profiles").then(setProfiles).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const s = await api.put("/settings", form);
      setSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
        <p className="text-sm text-zinc-500">
          LLM provider for extraction, filtering, schema generation and Q&A
          {meta?.crawl4ai_version && <> · crawl4ai v{meta.crawl4ai_version}</>}
        </p>
      </header>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">LLM provider</h3>
          {settings.llm_configured ? (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check size={13} /> configured
            </span>
          ) : (
            <span className="text-xs text-yellow-400">not configured — LLM features disabled</span>
          )}
        </div>
        <div>
          <label className="label">Provider (LiteLLM format)</label>
          <input
            className="input"
            list="providers"
            placeholder="openai/gpt-4o-mini"
            value={form.llm_provider ?? ""}
            onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
          />
          <datalist id="providers">
            {PROVIDER_EXAMPLES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">API key (stored locally in data/settings.json)</label>
          <input
            className="input font-mono"
            type="password"
            placeholder="sk-…  (empty for Ollama / env vars)"
            value={form.llm_api_token ?? ""}
            onChange={(e) => setForm({ ...form, llm_api_token: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Base URL (optional)</label>
            <input
              className="input"
              placeholder="http://localhost:11434"
              value={form.llm_base_url ?? ""}
              onChange={(e) => setForm({ ...form, llm_base_url: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Temperature</label>
              <input
                type="number"
                step={0.1}
                className="input"
                value={form.llm_temperature ?? ""}
                onChange={(e) =>
                  setForm({ ...form, llm_temperature: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label">Max tokens</label>
              <input
                type="number"
                className="input"
                value={form.llm_max_tokens ?? ""}
                onChange={(e) =>
                  setForm({ ...form, llm_max_tokens: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>
        <ErrorBanner message={error} />
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? "Saved" : "Save settings"}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">Config profiles</h3>
        <p className="text-xs text-zinc-500">
          Saved from the Configuration panel on any crawl page; apply them via the “Apply profile” dropdown.
        </p>
        {profiles.length === 0 && <p className="text-sm text-zinc-500">No profiles saved yet.</p>}
        {profiles.map((p) => (
          <div key={p.id} className="rounded-lg border border-surface-border">
            <div className="flex items-center gap-2 px-3 py-2">
              <button className="text-sm text-zinc-200 hover:text-accent" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                {p.name}
              </button>
              <span className="text-xs text-zinc-600">{new Date(p.updated_at * 1000).toLocaleDateString()}</span>
              <button
                className="btn-ghost !p-1.5 text-red-400 ml-auto"
                onClick={async () => {
                  await api.delete(`/profiles/${p.id}`);
                  setProfiles(await api.get("/profiles"));
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            {expanded === p.id && (
              <div className="px-3 pb-3">
                <JsonBlock data={p.config} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Security note</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          This server executes arbitrary JavaScript in a browser and can read local files via file:// URLs. It binds to
          127.0.0.1 by default — do not expose it to untrusted networks.
        </p>
      </div>
    </div>
  );
}
