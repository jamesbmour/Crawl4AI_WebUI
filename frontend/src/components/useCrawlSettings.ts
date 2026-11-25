import { useEffect, useSyncExternalStore } from "react";
import { api } from "../lib/api";
import { defaultConfig, normalizeConfig, type CrawlConfig } from "../lib/config";

/** Crawl settings shared by Scrape, Batch crawl and Deep crawl. One copy lives
 *  in memory for the whole app, so an edit on one page shows on the others,
 *  and every change is saved to the backend shortly after it is made. */
export interface CrawlSettings {
  config: CrawlConfig;
  batch: Record<string, any>;
  deep: Record<string, any>;
}

interface State {
  settings: CrawlSettings;
  ready: boolean;
  save: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
}

let state: State = {
  settings: { config: defaultConfig(), batch: {}, deep: {} },
  ready: false,
  save: "idle",
  saveError: null,
};
const listeners = new Set<() => void>();
let loadStarted = false;
let saveTimer: number | undefined;
let saveQueue = Promise.resolve();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function load() {
  if (loadStarted) return;
  loadStarted = true;
  api
    .get("/settings")
    .then((s) =>
      setState({
        settings: {
          config: normalizeConfig(s.default_crawl_config),
          batch: s.batch_options ?? {},
          deep: s.deep_options ?? {},
        },
      })
    )
    .catch(() => {}) // backend unreachable: keep the built-in defaults
    .finally(() => setState({ ready: true }));
}

const saveBody = () => ({
  default_crawl_config: state.settings.config,
  batch_options: state.settings.batch,
  deep_options: state.settings.deep,
});

function save() {
  saveTimer = undefined;
  const body = saveBody();
  // Chained so an older save can never land after a newer one.
  saveQueue = saveQueue
    .then(() => api.put("/settings", body))
    .then(
      () => {
        if (saveTimer === undefined) setState({ save: "saved", saveError: null });
      },
      (error: Error) => setState({ save: "error", saveError: error.message })
    );
}

export function updateSettings(patch: Partial<CrawlSettings>) {
  setState({ settings: { ...state.settings, ...patch }, save: "saving" });
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 500);
}

// A change made just before the tab closes would otherwise wait for a timer that never fires.
window.addEventListener("pagehide", () => {
  if (saveTimer === undefined) return;
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  fetch("/api/settings", {
    method: "PUT",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(saveBody()),
  }).catch(() => {});
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useCrawlSettings() {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, () => state);
}
