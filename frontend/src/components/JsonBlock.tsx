import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [status]);
  return (
    <button
      className="btn-ghost !px-2 !py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("copied");
        } catch {
          setStatus("failed");
        }
      }}
    >
      {status === "copied" ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      <span aria-live="polite">{status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}</span>
    </button>
  );
}

export function JsonBlock({ data }: { data: unknown }) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2) ?? "";
  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={text} />
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap break-words text-zinc-300">{text}</pre>
    </div>
  );
}
