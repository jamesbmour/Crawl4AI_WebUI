import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { defaultConfig, normalizeConfig, type CrawlConfig } from "../lib/config";

export function useCrawlConfig() {
  const [config, setConfig] = useState<CrawlConfig>(defaultConfig());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get("/settings")
      .then((settings) => {
        if (active && settings.default_crawl_config) {
          setConfig(normalizeConfig(settings.default_crawl_config));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return [config, setConfig, ready] as const;
}
