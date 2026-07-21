import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { api } from "../lib/api";
import { REGEX_LABELS } from "../lib/config";

interface Props {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
}

const TYPES = [
  { value: "none", label: "None" },
  { value: "css", label: "CSS schema" },
  { value: "xpath", label: "XPath schema" },
  { value: "regex", label: "Regex patterns" },
  { value: "llm", label: "LLM extraction" },
];

export function ExtractionEditor({ value, onChange }: Props) {
  const type = value.type ?? "none";
  const [savedSchemas, setSavedSchemas] = useState<any[]>([]);
  const [builtins, setBuiltins] = useState<string[]>(Object.keys(REGEX_LABELS));

  useEffect(() => {
    api.get("/schemas").then(setSavedSchemas).catch(() => {});
    api
      .get("/meta")
      .then((m) => m.regex_builtin_patterns && setBuiltins(m.regex_builtin_patterns))
      .catch(() => {});
  }, []);

  const set = (patch: Record<string, any>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.value}
            className={`tab ${type === t.value ? "tab-active ring-1 ring-accent/50" : ""}`}
            onClick={() => set({ type: t.value })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(type === "css" || type === "xpath") && (
        <div className="space-y-2">
          {savedSchemas.filter((s) => s.kind === type).length > 0 && (
            <div>
              <label className="label">Load from library</label>
              <select
                className="input"
                value={value.schema_id ?? ""}
                onChange={(e) =>
                  set({
                    schema_id: e.target.value ? Number(e.target.value) : undefined,
                    schema: undefined,
                  })
                }
              >
                <option value="">— inline schema below —</option>
                {savedSchemas
                  .filter((s) => s.kind === type)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          {!value.schema_id && (
            <div>
              <label className="label">Schema (JSON)</label>
              <SchemaJsonEditor
                value={value.schema}
                onChange={(schema) => set({ schema })}
              />
              <p className="text-xs text-zinc-500 mt-1">
                Format: {"{ name, baseSelector, fields: [{ name, selector, type }] }"} — build one in the Extraction studio.
              </p>
            </div>
          )}
        </div>
      )}

      {type === "regex" && (
        <div className="space-y-2">
          <label className="label">Built-in patterns</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {builtins.map((key) => {
              const selected = (value.regex_builtin ?? []).includes(key);
              return (
                <label key={key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={selected}
                    onChange={(e) => {
                      const cur: string[] = value.regex_builtin ?? [];
                      set({
                        regex_builtin: e.target.checked
                          ? [...cur, key]
                          : cur.filter((k) => k !== key),
                      });
                    }}
                  />
                  {REGEX_LABELS[key] ?? key}
                </label>
              );
            })}
          </div>
          <div>
            <label className="label">Custom patterns (JSON: label → regex)</label>
            <SchemaJsonEditor
              value={value.regex_custom}
              onChange={(regex_custom) => set({ regex_custom })}
              placeholder='{"sku": "SKU-\\\\d+"}'
              height="80px"
            />
          </div>
        </div>
      )}

      {type === "llm" && (
        <div className="space-y-2">
          <div>
            <label className="label">Instruction</label>
            <textarea
              className="input min-h-[70px]"
              placeholder="Extract all product names with prices and ratings…"
              value={value.llm_instruction ?? ""}
              onChange={(e) => set({ llm_instruction: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="label">JSON schema (optional — forces structured output)</label>
            <SchemaJsonEditor
              value={value.llm_schema}
              onChange={(llm_schema) =>
                set({ llm_schema, llm_extraction_type: llm_schema ? "schema" : undefined })
              }
              placeholder='{"type":"object","properties":{"name":{"type":"string"}}}'
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Input format</label>
              <select
                className="input"
                value={value.llm_input_format ?? ""}
                onChange={(e) => set({ llm_input_format: e.target.value || undefined })}
              >
                <option value="">markdown (default)</option>
                <option value="html">html</option>
                <option value="fit_markdown">fit_markdown</option>
                <option value="fit_html">fit_html</option>
              </select>
            </div>
            <div>
              <label className="label">Chunk token threshold</label>
              <input
                type="number"
                className="input"
                value={value.llm_chunk_token_threshold ?? ""}
                onChange={(e) =>
                  set({ llm_chunk_token_threshold: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SchemaJsonEditor({
  value,
  onChange,
  placeholder,
  height = "140px",
}: {
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
  height?: string;
}) {
  const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sync external resets (e.g. generated schema applied)
    if (value && JSON.stringify(value) !== safeParse(text)) {
      setText(JSON.stringify(value, null, 2));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
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
          height={height}
          placeholder={placeholder}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function safeParse(text: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return undefined;
  }
}
