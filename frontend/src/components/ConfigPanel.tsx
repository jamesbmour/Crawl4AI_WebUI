import { lazy, Suspense, useId, useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import { AlertCircle, Bookmark, Check, ChevronDown, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";
import { CONFIG_GROUPS, defaultConfig, normalizeConfig, type CrawlConfig, type CrawlMode, type FieldDef, type GroupDef } from "../lib/config";
import { api } from "../lib/api";
import { FieldList } from "./Field";
import { ErrorBanner } from "./shared";
import { updateSettings, useCrawlSettings } from "./useCrawlSettings";

const ExtractionEditor = lazy(() => import("./ExtractionEditor").then((module) => ({ default: module.ExtractionEditor })));
const loading = <p className="px-4 pb-4 text-sm text-zinc-400" role="status">Loading options…</p>;
const EXTRACTION = {
  title: "Extraction",
  description: "Pull structured JSON with CSS, XPath, regex or an LLM",
  terms: "extraction structured data json css xpath regex llm schema",
};

/** The shared crawl settings. `mode` hides fields that don't apply to that crawl type. */
export function ConfigPanel({ mode }: { mode: CrawlMode }) {
  const idPrefix = useId();
  const { settings, ready, save, saveError } = useCrawlSettings();
  const config = settings.config;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo: CrawlConfig } | null>(null);

  if (!ready) return <div className="card p-4 text-sm text-zinc-400" role="status">Loading settings…</div>;

  const setConfig = (next: CrawlConfig) => {
    setNotice(null);
    updateSettings({ config: next });
  };
  const replaceConfig = (next: CrawlConfig, text: string) => {
    setNotice({ text, undo: config });
    updateSettings({ config: next });
  };

  const applies = (f: FieldDef) => !f.modes || f.modes.includes(mode);
  const needle = query.trim().toLowerCase();
  const filtering = !!needle || changedOnly;
  const extractionSet = (config.extraction?.type ?? "none") !== "none";
  const changedCount = (group: GroupDef) =>
    group.fields.filter((f) => applies(f) && config[group.id]?.[f.key] !== undefined).length;
  const totalChanged = CONFIG_GROUPS.reduce((sum, g) => sum + changedCount(g), 0) + Number(extractionSet);

  const sections: ReactNode[] = [];
  for (const group of CONFIG_GROUPS) {
    const values = config[group.id] ?? {};
    const fields = group.fields.filter(
      (f) =>
        applies(f) &&
        (!changedOnly || values[f.key] !== undefined) &&
        (!needle || `${f.label} ${f.help ?? ""} ${f.key} ${group.title}`.toLowerCase().includes(needle))
    );
    if (filtering && !fields.some((f) => !f.showIf || f.showIf(values))) continue;
    const isOpen = filtering || !!open[group.id];
    const changed = changedCount(group);
    sections.push(
      <section key={group.id}>
        <GroupHeader
          id={`${idPrefix}-${group.id}`}
          title={group.title}
          description={group.description}
          badge={changed ? `${changed} changed` : null}
          open={isOpen}
          filtering={filtering}
          onToggle={() => setOpen({ ...open, [group.id]: !isOpen })}
        />
        {isOpen && (
          <div id={`${idPrefix}-${group.id}`}>
            <FieldList
              className="px-4 pb-4"
              fields={fields}
              values={values}
              onChange={(next) => setConfig({ ...config, [group.id]: next })}
            />
          </div>
        )}
      </section>
    );
  }
  if (!filtering || ((!needle || EXTRACTION.terms.includes(needle)) && (!changedOnly || extractionSet))) {
    const isOpen = filtering || !!open.extraction;
    sections.push(
      <section key="extraction">
        <GroupHeader
          id={`${idPrefix}-extraction`}
          title={EXTRACTION.title}
          description={EXTRACTION.description}
          badge={extractionSet ? config.extraction.type.toUpperCase() : null}
          open={isOpen}
          filtering={filtering}
          onToggle={() => setOpen({ ...open, extraction: !isOpen })}
        />
        {isOpen && (
          <div id={`${idPrefix}-extraction`} className="px-4 pb-4">
            <Suspense fallback={loading}>
              <ExtractionEditor
                value={config.extraction ?? { type: "none" }}
                onChange={(extraction) => setConfig({ ...config, extraction })}
              />
            </Suspense>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="card config-panel">
      <div className="space-y-3 border-b border-surface-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-100">Crawl settings</h2>
            <p className="text-xs text-zinc-400">Shared by Scrape, Batch crawl and Deep crawl. Changes save automatically.</p>
          </div>
          <SaveStatus save={save} />
        </div>
        {save === "error" && <ErrorBanner message={`Settings weren't saved: ${saveError}`} />}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            className="input pl-9"
            aria-label="Search settings"
            placeholder="Search settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={clsx("btn-ghost !px-2 text-xs", changedOnly && "tab-active")}
            aria-pressed={changedOnly}
            disabled={!totalChanged && !changedOnly}
            onClick={() => setChangedOnly(!changedOnly)}
          >
            Changed ({totalChanged})
          </button>
          <button
            type="button"
            className="btn-ghost !px-2 text-xs"
            disabled={!totalChanged}
            onClick={() => replaceConfig(defaultConfig(), "All settings are back to their defaults.")}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset all
          </button>
          <PresetMenu config={config} onApply={(next, name) => replaceConfig(next, `Applied preset “${name}”.`)} />
        </div>
        {notice && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-overlay px-3 py-1.5 text-xs text-zinc-300">
            <span>{notice.text}</span>
            <button
              type="button"
              className="btn-ghost !min-h-8 !px-2 text-xs"
              onClick={() => {
                updateSettings({ config: notice.undo });
                setNotice(null);
              }}
            >
              Undo
            </button>
          </div>
        )}
      </div>
      <div className="divide-y divide-surface-border">
        {sections}
        {sections.length === 0 && (
          <p className="p-4 text-sm text-zinc-400" role="status">
            {changedOnly && !needle ? "Every setting is at its default." : "No settings match."}
          </p>
        )}
      </div>
    </div>
  );
}

function GroupHeader({
  id,
  title,
  description,
  badge,
  open,
  filtering,
  onToggle,
}: {
  id: string;
  title: string;
  description: string;
  badge: string | null;
  open: boolean;
  filtering: boolean;
  onToggle: () => void;
}) {
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-zinc-200">{title}</span>
      <span className="block text-xs text-zinc-400">{description}</span>
    </span>
  );
  const pill = badge && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">{badge}</span>;
  // While searching or showing changed settings every matching group is open.
  if (filtering) {
    return (
      <h3 className="flex items-center gap-3 px-4 pb-1 pt-3">
        {text}
        {pill}
      </h3>
    );
  }
  return (
    <h3>
      <button
        type="button"
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-overlay/50"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={onToggle}
      >
        {text}
        {pill}
        {open ? <ChevronDown size={16} className="shrink-0 text-zinc-400" aria-hidden="true" /> : <ChevronRight size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />}
      </button>
    </h3>
  );
}

function SaveStatus({ save }: { save: "idle" | "saving" | "saved" | "error" }) {
  return (
    <span role="status" className="inline-flex min-h-6 items-center gap-1 text-xs">
      {save === "saving" && (
        <span className="inline-flex items-center gap-1 text-zinc-400">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Saving…
        </span>
      )}
      {save === "saved" && (
        <span className="inline-flex items-center gap-1 text-green-400">
          <Check size={12} aria-hidden="true" /> Saved
        </span>
      )}
      {save === "error" && (
        <span className="inline-flex items-center gap-1 text-red-300">
          <AlertCircle size={12} aria-hidden="true" /> Not saved
        </span>
      )}
    </span>
  );
}

interface Preset {
  id: number;
  name: string;
}

function PresetMenu({ config, onApply }: { config: CrawlConfig; onApply: (config: CrawlConfig, name: string) => void }) {
  const nameId = useId();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.get("/profiles").then(setPresets).catch((e: Error) => setError(e.message));

  const apply = async (preset: Preset, menu: HTMLDetailsElement | null) => {
    setError(null);
    try {
      const full = await api.get(`/profiles/${preset.id}`);
      onApply(normalizeConfig(full.config), preset.name);
      menu?.removeAttribute("open");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const savePreset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const existing = presets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) await api.put(`/profiles/${existing.id}`, { name: existing.name, config });
      else await api.post("/profiles", { name: trimmed, config });
      setMessage(existing ? `Updated “${existing.name}”.` : `Saved “${trimmed}”.`);
      setName("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details
      className="relative ml-auto"
      onToggle={(e) => {
        if (e.currentTarget.open) {
          setMessage(null);
          setError(null);
          refresh();
        }
      }}
    >
      <summary className="btn-ghost cursor-pointer list-none !px-2 text-xs [&::-webkit-details-marker]:hidden">
        <Bookmark size={14} aria-hidden="true" /> Presets <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="card absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2.5rem)] space-y-2 p-2 shadow-xl shadow-black/40">
        <p className="px-2 pt-1 text-xs text-zinc-400">Applying a preset replaces the current settings.</p>
        {presets.length > 0 ? (
          <ul aria-label="Saved presets" className="max-h-56 overflow-y-auto">
            {presets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center rounded-md px-2 text-left text-sm text-zinc-200 hover:bg-surface-overlay hover:text-accent"
                  onClick={(e) => apply(p, e.currentTarget.closest("details"))}
                >
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 text-sm text-zinc-400">No presets yet.</p>
        )}
        <form onSubmit={savePreset} className="border-t border-surface-border px-2 pt-2">
          <label className="label !text-xs" htmlFor={nameId}>Save current settings as</label>
          <div className="flex gap-1">
            <input
              id={nameId}
              className="input"
              list={`${nameId}-names`}
              autoComplete="off"
              placeholder="Preset name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn-secondary shrink-0 !px-3 text-xs" disabled={busy || !name.trim()}>
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : "Save"}
            </button>
          </div>
          <datalist id={`${nameId}-names`}>
            {presets.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-zinc-400">An existing name updates that preset.</p>
        </form>
        {message && <p role="status" className="px-2 text-xs text-green-400">{message}</p>}
        <ErrorBanner message={error} />
      </div>
    </details>
  );
}
