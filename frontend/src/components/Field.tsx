import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import type { FieldDef } from "../lib/config";

const CodeEditor = lazy(() => import("./CodeEditor"));
const editorLoading = <p className="px-3 py-2 text-sm text-zinc-400" role="status">Loading editor…</p>;

interface Props {
  def: FieldDef;
  value: any;
  onChange: (value: any) => void;
}

interface ControlProps extends Props {
  id: string;
  describedBy?: string;
}

/** Edits one flat options object, rendering the fields whose `showIf` passes. */
export function FieldList({
  fields,
  values,
  onChange,
  className,
}: {
  fields: FieldDef[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  className?: string;
}) {
  return (
    <div className={clsx("config-fields", className)}>
      {fields
        .filter((f) => !f.showIf || f.showIf(values))
        .map((f) => (
          <Field key={f.key} def={f} value={values[f.key]} onChange={(v) => onChange({ ...values, [f.key]: v })} />
        ))}
    </div>
  );
}

/** A setting with its description. `undefined` means "use the default"; a set
 *  value gets an accent edge and a reset button. */
export function Field({ def, value, onChange }: Props) {
  const id = useId();
  const helpId = def.help ? `${id}-help` : undefined;
  const isSet = value !== undefined;
  // CodeMirror editors aren't labelable elements.
  const labelable = def.type !== "code" && def.type !== "json";
  return (
    <div className={clsx("min-w-0 border-l-2 py-2 pl-3", isSet ? "border-accent" : "border-transparent")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {labelable ? (
            <label htmlFor={id} className="text-sm font-medium text-zinc-200">{def.label}</label>
          ) : (
            <span className="text-sm font-medium text-zinc-200">{def.label}</span>
          )}
          {def.help && <p id={helpId} className="mt-0.5 text-xs leading-relaxed text-zinc-400">{def.help}</p>}
        </div>
        {def.type === "boolean" ? (
          <Switch id={id} describedBy={helpId} def={def} value={value} onChange={onChange} />
        ) : (
          isSet && (
            <button
              type="button"
              className="btn-ghost !min-h-8 shrink-0 !p-1.5"
              title="Reset to default"
              aria-label={`Reset ${def.label} to default`}
              onClick={() => onChange(undefined)}
            >
              <RotateCcw size={13} aria-hidden="true" />
            </button>
          )
        )}
      </div>
      {def.type !== "boolean" && (
        <div className="mt-1.5">
          <Control id={id} describedBy={helpId} def={def} value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function Switch({ id, describedBy, def, value, onChange }: ControlProps) {
  const fallback = def.default ?? false;
  const on = !!(value ?? fallback);
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-describedby={describedBy}
      // Switching back to the default clears the value instead of storing it.
      onClick={() => onChange(!on === fallback ? undefined : !on)}
      className={clsx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-zinc-700")}
    >
      <span
        className={clsx("absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform", on ? "translate-x-4 bg-surface" : "bg-white")}
      />
    </button>
  );
}

function Control({ id, describedBy, def, value, onChange }: ControlProps) {
  switch (def.type) {
    case "number":
      return (
        <input
          id={id}
          aria-describedby={describedBy}
          type="number"
          className="input"
          step={def.step ?? 1}
          min={def.min}
          placeholder={def.placeholder ?? (def.default === undefined ? undefined : String(def.default))}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "text":
      return (
        <input
          id={id}
          aria-describedby={describedBy}
          type={def.secret ? "password" : "text"}
          autoComplete={def.secret ? "new-password" : "off"}
          spellCheck={false}
          className="input"
          placeholder={def.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    case "textarea":
      return (
        <textarea
          id={id}
          aria-describedby={describedBy}
          className="input min-h-[70px] font-mono text-xs"
          placeholder={def.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    case "select": {
      const defaultOption = def.options?.find((o) => o.value === def.default);
      return (
        <select
          id={id}
          aria-describedby={describedBy}
          className="input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" || e.target.value === def.default ? undefined : e.target.value)}
        >
          <option value="">{defaultOption ? `${defaultOption.label} (default)` : "Default"}</option>
          {def.options
            ?.filter((o) => o !== defaultOption || o.value === value)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      );
    }
    case "list":
      return <ListField id={id} describedBy={describedBy} def={def} value={value} onChange={onChange} />;
    case "json":
      return <JsonField id={id} describedBy={describedBy} def={def} value={value} onChange={onChange} />;
    case "code":
      return (
        <div className="overflow-hidden rounded-lg border border-surface-border">
          <Suspense fallback={editorLoading}>
            <CodeEditor
              language="javascript"
              value={typeof value === "string" ? value : ""}
              onChange={(v) => onChange(v || undefined)}
              height="120px"
            />
          </Suspense>
        </div>
      );
    default:
      return null;
  }
}

/** Comma-separated list editor. Keeps raw keystrokes in local state so typing
 *  a trailing "," or " " isn't immediately erased by re-deriving the display
 *  string from the parsed/trimmed array on every render (the array can't
 *  represent "nav, " while the second item is still empty). Only commits
 *  `onChange` with the parsed array, and only re-syncs from `value` when it
 *  changes for reasons other than our own commit (reset, loaded preset). */
function ListField({ id, describedBy, def, value, onChange }: ControlProps) {
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
    <input
      id={id}
      aria-describedby={describedBy}
      type="text"
      autoComplete="off"
      spellCheck={false}
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
  );
}

/** JSON editor; like ListField it keeps invalid drafts locally and re-syncs on outside changes. */
function JsonField({ def, value, onChange }: ControlProps) {
  const toText = (v: any) => (v === undefined ? "" : JSON.stringify(v, null, 2));
  const [text, setText] = useState<string>(toText(value));
  const [error, setError] = useState<string | null>(null);
  const lastCommitted = useRef<any>(value);

  useEffect(() => {
    if (value !== lastCommitted.current) {
      setText(toText(value));
      setError(null);
      lastCommitted.current = value;
    }
  }, [value]);

  const commit = (next: any) => {
    lastCommitted.current = next;
    setError(null);
    onChange(next);
  };

  return (
    <>
      <div className={clsx("overflow-hidden rounded-lg border", error ? "border-red-600" : "border-surface-border")}>
        <Suspense fallback={editorLoading}>
          <CodeEditor
            language="json"
            value={text}
            onChange={(v) => {
              setText(v);
              if (!v.trim()) return commit(undefined);
              try {
                commit(JSON.parse(v));
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
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </>
  );
}
