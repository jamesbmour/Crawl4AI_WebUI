import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, FolderOpen, Save, Star } from "lucide-react";
import { CONFIG_GROUPS, type CrawlConfig, type GroupId } from "../lib/config";
import { Field } from "./Field";
import { ExtractionEditor } from "./ExtractionEditor";
import { api } from "../lib/api";

interface Props {
  config: CrawlConfig;
  onChange: (config: CrawlConfig) => void;
  showExtraction?: boolean;
}

export function ConfigPanel({ config, onChange, showExtraction = true }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    api.get("/profiles").then(setProfiles).catch(() => {});
  }, []);

  const setGroup = (id: GroupId, group: Record<string, any>) =>
    onChange({ ...config, [id]: group });

  const countActive = (id: GroupId) =>
    Object.entries(config[id] ?? {}).filter(
      ([k, v]) => v !== undefined && v !== null && v !== "" && !(id === "extraction" && k === "type" && v === "none")
    ).length;

  const saveProfile = async () => {
    const name = window.prompt("Profile name:");
    if (!name) return;
    setSaving(true);
    try {
      await api.post("/profiles", { name, config });
      setProfiles(await api.get("/profiles"));
    } finally {
      setSaving(false);
    }
  };

  const applyProfile = async (id: string) => {
    if (!id) return;
    const profile = await api.get(`/profiles/${id}`);
    const base: CrawlConfig = { browser: {}, page: {}, content: {}, markdown: {}, capture: {}, extraction: { type: "none" } };
    onChange({ ...base, ...profile.config });
  };

  const saveAsDefault = async () => {
    setSavingDefault(true);
    setDefaultStatus("idle");
    try {
      await api.put("/settings", { default_crawl_config: config });
      setDefaultStatus("saved");
      window.setTimeout(() => setDefaultStatus("idle"), 1800);
    } catch {
      setDefaultStatus("error");
    } finally {
      setSavingDefault(false);
    }
  };

  return (
    <div className="card divide-y divide-surface-border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-zinc-200">Configuration</h3>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {profiles.length > 0 && (
            <div className="flex items-center gap-1">
              <FolderOpen size={14} className="text-zinc-500" />
              <select
                className="bg-surface-overlay border border-surface-border rounded-md text-xs px-2 py-1 text-zinc-300"
                defaultValue=""
                onChange={(e) => {
                  applyProfile(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Apply profile…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={saveProfile} disabled={saving}>
            <Save size={14} /> Save profile
          </button>
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={saveAsDefault} disabled={savingDefault}>
            {defaultStatus === "saved" ? <Check size={14} className="text-green-400" /> : <Star size={14} />}
            {defaultStatus === "saved" ? "Default saved" : defaultStatus === "error" ? "Save failed" : "Save as default"}
          </button>
        </div>
      </div>

      {CONFIG_GROUPS.map((group) => {
        const isOpen = open[group.id] ?? false;
        const active = countActive(group.id);
        return (
          <div key={group.id}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay/50 transition-colors"
              onClick={() => setOpen({ ...open, [group.id]: !isOpen })}
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
                <span className="text-sm font-medium text-zinc-200">{group.title}</span>
                {active > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
                    {active}
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-500">{group.description}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {group.fields
                  .filter((f) => !f.showIf || f.showIf(config[group.id] ?? {}))
                  .map((f) => (
                    <Field
                      key={f.key}
                      def={f}
                      value={config[group.id]?.[f.key]}
                      onChange={(v) => setGroup(group.id, { ...config[group.id], [f.key]: v })}
                    />
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {showExtraction && (
        <div>
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay/50 transition-colors"
            onClick={() => setOpen({ ...open, extraction: !(open.extraction ?? false) })}
          >
            <div className="flex items-center gap-2">
              {open.extraction ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
              <span className="text-sm font-medium text-zinc-200">Extraction</span>
              {config.extraction?.type && config.extraction.type !== "none" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold uppercase">
                  {config.extraction.type}
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-500">Structured data (CSS / XPath / Regex / LLM)</span>
          </button>
          {open.extraction && (
            <div className="px-4 pb-4">
              <ExtractionEditor
                value={config.extraction ?? { type: "none" }}
                onChange={(extraction) => onChange({ ...config, extraction })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
