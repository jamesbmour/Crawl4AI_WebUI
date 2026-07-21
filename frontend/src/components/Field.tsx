import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json as jsonLang } from "@codemirror/lang-json";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import type { FieldDef } from "../lib/config";

interface Props {
  def: FieldDef;
  value: any;
  onChange: (value: any) => void;
}

export function Field({ def, value, onChange }: Props) {
  switch (def.type) {
    case "boolean":
      return (
        <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group">
          <span className="text-sm text-zinc-300 group-hover:text-zinc-100" title={def.help}>
            {def.label}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => onChange(value ? undefined : true)}
            className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${
              value ? "bg-accent" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                value ? "translate-x-4" : ""
              }`}
            />
          </button>
        </label>
      );
    case "number":
      return (
        <Wrap def={def}>
          <input
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
        <Wrap def={def}>
          <input
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
        <Wrap def={def}>
          <textarea
            className="input min-h-[70px] font-mono text-xs"
            placeholder={def.placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </Wrap>
      );
    case "select":
      return (
        <Wrap def={def}>
          <select
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
      return (
        <Wrap def={def}>
          <input
            type="text"
            className="input"
            placeholder={def.placeholder ?? "comma, separated, values"}
            value={Array.isArray(value) ? value.join(", ") : (value ?? "")}
            onChange={(e) => {
              const parts = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onChange(parts.length ? parts : undefined);
            }}
          />
        </Wrap>
      );
    case "json":
      return <JsonField def={def} value={value} onChange={onChange} />;
    case "code":
      return (
        <Wrap def={def}>
          <div className="rounded-lg overflow-hidden border border-surface-border">
            <CodeMirror
              value={typeof value === "string" ? value : ""}
              onChange={(v) => onChange(v || undefined)}
              extensions={[javascript()]}
              theme={tokyoNight}
              height="120px"
              basicSetup={{ lineNumbers: true, foldGutter: false }}
            />
          </div>
        </Wrap>
      );
  }
}

function Wrap({ def, children }: { def: FieldDef; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <label className="label" title={def.help}>
        {def.label}
        {def.help && <span className="ml-1 text-zinc-600" title={def.help}>ⓘ</span>}
      </label>
      {children}
    </div>
  );
}

function JsonField({ def, value, onChange }: Props) {
  const [text, setText] = useState<string>(value ? JSON.stringify(value, null, 2) : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <Wrap def={def}>
      <div className={`rounded-lg overflow-hidden border ${error ? "border-red-600" : "border-surface-border"}`}>
        <CodeMirror
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
          extensions={[jsonLang()]}
          theme={tokyoNight}
          height="100px"
          placeholder={def.placeholder}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </Wrap>
  );
}
