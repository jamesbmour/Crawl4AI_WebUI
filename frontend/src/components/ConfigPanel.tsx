import { lazy, Suspense, useEffect, useId, useState } from "react";
import { Check, ChevronDown, ChevronRight, FolderOpen, Save, Star } from "lucide-react";
import { CONFIG_GROUPS, type CrawlConfig, type GroupId } from "../lib/config";
import { api } from "../lib/api";
import { ErrorBanner } from "./shared";

const Field = lazy(() => import("./Field").then((module) => ({ default: module.Field })));
const ExtractionEditor = lazy(() => import("./ExtractionEditor").then((module) => ({ default: module.ExtractionEditor })));
const loading = <p className="px-4 pb-4 text-sm text-zinc-400" role="status">Loading options…</p>;

interface Props {
  config: CrawlConfig;
  onChange: (config: CrawlConfig) => void;
  showExtraction?: boolean;
}

export function ConfigPanel({ config, onChange, showExtraction = true }: Props) {
  const idPrefix = useId();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    const controller = new AbortController();
    api.get("/profiles", controller.signal).then(setProfiles).catch(() => {});
    return () => controller.abort();
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
    setProfileError(null);
    try {
      await api.post("/profiles", { name, config });
      setProfiles(await api.get("/profiles"));
    } catch (error) {
      setProfileError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const applyProfile = async (id: string) => {
    if (!id) return;
    setProfileError(null);
    setApplying(true);
    try {
      const profile = await api.get(`/profiles/${id}`);
      const base: CrawlConfig = { browser: {}, page: {}, content: {}, markdown: {}, capture: {}, extraction: { type: "none" } };
      onChange({ ...base, ...profile.config });
    } catch (error) {
      setProfileError((error as Error).message);
    } finally {
      setApplying(false);
    }
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
    <div className="card config-panel divide-y divide-surface-border">
      <div className="flex flex-wrap items-center justify-between gap-x-3 px-4 py-3">
        <h2 className="pr-2 text-base font-semibold text-zinc-100">Configuration</h2>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {profiles.length > 0 && (
            <div className="flex min-w-0 items-center gap-1">
              <FolderOpen size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />
              <select
                aria-label="Apply profile"
                className="min-h-10 min-w-0 rounded-md border border-surface-border bg-surface-overlay px-2 text-sm text-zinc-300"
                defaultValue=""
                disabled={applying}
                onChange={(e) => {
                  applyProfile(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">{applying ? "Applying profile…" : "Apply profile…"}</option>
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
        {profileError && <div className="mt-2 w-full"><ErrorBanner message={profileError} /></div>}
      </div>

      {CONFIG_GROUPS.map((group) => {
        const isOpen = open[group.id] ?? false;
        const active = countActive(group.id);
        return (
          <div key={group.id}>
            <button
              type="button"
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-overlay/50"
              aria-expanded={isOpen}
              aria-controls={isOpen ? `${idPrefix}-${group.id}` : undefined}
              onClick={() => setOpen({ ...open, [group.id]: !isOpen })}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-200">{group.title}</span>
                <span className="block text-xs text-zinc-400">{group.description}</span>
              </span>
              {active > 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent" aria-label={`${active} options set`}>{active}</span>}
              {isOpen ? <ChevronDown size={16} className="shrink-0 text-zinc-400" /> : <ChevronRight size={16} className="shrink-0 text-zinc-400" />}
            </button>
            {isOpen && (
              <div id={`${idPrefix}-${group.id}`}>
                <Suspense fallback={loading}>
                  <div className="config-fields">
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
                </Suspense>
              </div>
            )}
          </div>
        );
      })}

      {showExtraction && (
        <div>
          <button
            type="button"
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-overlay/50"
            aria-expanded={!!open.extraction}
            aria-controls={open.extraction ? `${idPrefix}-extraction` : undefined}
            onClick={() => setOpen({ ...open, extraction: !(open.extraction ?? false) })}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-200">Extraction</span>
              <span className="block text-xs text-zinc-400">Structured data (CSS / XPath / Regex / LLM)</span>
            </span>
            {config.extraction?.type && config.extraction.type !== "none" && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs uppercase text-accent">{config.extraction.type}</span>
            )}
            {open.extraction ? <ChevronDown size={16} className="shrink-0 text-zinc-400" /> : <ChevronRight size={16} className="shrink-0 text-zinc-400" />}
          </button>
          {open.extraction && (
            <div id={`${idPrefix}-extraction`} className="px-4 pb-4">
              <Suspense fallback={loading}>
                <ExtractionEditor
                  value={config.extraction ?? { type: "none" }}
                  onChange={(extraction) => onChange({ ...config, extraction })}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
