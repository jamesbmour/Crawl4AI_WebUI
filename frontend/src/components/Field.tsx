import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { FieldDef } from "../lib/config";

const CodeEditor = lazy(() => import("./CodeEditor"));
const editorLoading = <p className="px-3 py-2 text-sm text-zinc-400" role="status">Loading editor…</p>;

interface Props {
  def: FieldDef;
  value: any;
  onChange: (value: any) => void;
}

export function Field({ def, value, onChange }: Props) {
  const id = useId();
  switch (def.type) {
    case "boolean":
      return (
        <div className="group relative flex items-center justify-between gap-3 py-1.5">
          <span className="inline-flex items-center text-sm text-zinc-300 group-hover:text-zinc-100">
            {def.label}
            {def.help && <HelpTooltip label={def.label} text={def.help} />}
          </span>
          <button
            type="button"
            role="switch"
            aria-label={def.label}
            aria-checked={!!value}
            onClick={() => onChange(value ? undefined : true)}
            className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${
              value ? "bg-accent" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform ${
                value ? "translate-x-4 bg-surface" : "bg-white"
              }`}
            />
          </button>
        </div>
      );
    case "number":
      return (
        <Wrap def={def} id={id}>
          <input
            id={id}
            type="number"
            className="input"
            step={def.step ?? 1}
            placeholder={def.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Wrap>
      );
    case "text":
      return (
        <Wrap def={def} id={id}>
          <input
            id={id}
            type="text"
            className="input"
            placeholder={def.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </Wrap>
      );
    case "textarea":
      return (
        <Wrap def={def} id={id}>
          <textarea
            id={id}
            className="input min-h-[70px] font-mono text-xs"
            placeholder={def.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </Wrap>
      );
    case "select":
      return (
        <Wrap def={def} id={id}>
          <select
            id={id}
            className="input"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">(default)</option>
            {def.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Wrap>
      );
    case "list":
      return <ListField def={def} value={value} onChange={onChange} />;
    case "json":
      return <JsonField def={def} value={value} onChange={onChange} />;
    case "code":
      return (
        <Wrap def={def}>
          <div className="rounded-lg overflow-hidden border border-surface-border">
            <Suspense fallback={editorLoading}>
              <CodeEditor
                language="javascript"
                value={typeof value === "string" ? value : ""}
                onChange={(v) => onChange(v || undefined)}
                height="120px"
              />
            </Suspense>
          </div>
        </Wrap>
      );
  }
}

function Wrap({ def, id, children }: { def: FieldDef; id?: string; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 py-1.5">
      <div className="label flex items-center">
        {id ? <label htmlFor={id}>{def.label}</label> : def.label}
        {def.help && <HelpTooltip label={def.label} text={def.help} />}
      </div>
      {children}
    </div>
  );
}

function HelpTooltip({ label, text }: { label: string; text: string }) {
  const tooltipId = useId();
  return (
    <span className="ml-1 inline-flex group/tooltip">
      <button
        type="button"
        className="rounded-sm text-zinc-500 hover:text-zinc-200 focus:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label={`Help for ${label}`}
        aria-describedby={tooltipId}
      >
        <CircleHelp size={13} aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="invisible pointer-events-none absolute bottom-full left-0 z-30 w-64 max-w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-zinc-200 shadow-xl group-hover/tooltip:visible group-focus-within/tooltip:visible"
      >
        {text}
      </span>
    </span>
  );
}

/** Comma-separated list editor. Keeps raw keystrokes in local state so typing
 *  a trailing "," or " " isn't immediately erased by re-deriving the display
 *  string from the parsed/trimmed array on every render (the array can't
 *  represent "nav, " while the second item is still empty). Only commits
 *  `onChange` with the parsed array, and only re-syncs from `value` when it
 *  changes for reasons other than our own commit (reset, loaded profile). */
function ListField({ def, value, onChange }: Props) {
  const id = useId();
  const toText = (v: any) => (Array.isArray(v) ? v.join(", ") : "");
  const [text, setText] = useState<string>(toText(value));
  const lastCommitted = useRef<any>(value);

  useEffect(() => {
    if (value !== lastCommitted.current) {
      setText(toText(value));
      lastCommitted.current = value;
    }
  }, [value]);

  return (
    <Wrap def={def} id={id}>
      <input
        id={id}
        type="text"
        className="input"
        placeholder={def.placeholder ?? "comma, separated, values"}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const parts = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const next = parts.length ? parts : undefined;
          lastCommitted.current = next;
          onChange(next);
        }}
      />
    </Wrap>
  );
}

function JsonField({ def, value, onChange }: Props) {
  const [text, setText] = useState<string>(value ? JSON.stringify(value, null, 2) : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <Wrap def={def}>
      <div className={`rounded-lg overflow-hidden border ${error ? "border-red-600" : "border-surface-border"}`}>
        <Suspense fallback={editorLoading}>
          <CodeEditor
            language="json"
            value={text}
            onChange={(v) => {
              setText(v);
              if (!v.trim()) {
                setError(null);
                onChange(undefined);
                return;
              }
              try {
                onChange(JSON.parse(v));
                setError(null);
              } catch {
                setError("Invalid JSON");
              }
            }}
            height="100px"
            placeholder={def.placeholder}
            lineNumbers={false}
          />
        </Suspense>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </Wrap>
  );
}
