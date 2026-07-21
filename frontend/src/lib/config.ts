/** Declarative definitions for every crawl4ai option exposed in the UI.
 *  Group/field keys mirror the backend pydantic models 1:1. */

export type GroupId = "browser" | "page" | "content" | "markdown" | "capture" | "extraction";

export type CrawlConfig = Record<GroupId, Record<string, any>>;

export function defaultConfig(): CrawlConfig {
  return { browser: {}, page: {}, content: {}, markdown: {}, capture: {}, extraction: { type: "none" } };
}

export function normalizeConfig(config?: Partial<CrawlConfig> | null): CrawlConfig {
  const base = defaultConfig();
  if (!config) return base;
  return {
    ...base,
    ...config,
    extraction: { ...base.extraction, ...(config.extraction ?? {}) },
  };
}

export interface FieldDef {
  key: string;
  label: string;
  type: "boolean" | "number" | "text" | "select" | "textarea" | "list" | "json" | "code";
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  step?: number;
  showIf?: (group: Record<string, any>) => boolean;
}

export interface GroupDef {
  id: GroupId;
  title: string;
  description: string;
  fields: FieldDef[];
}

const sel = (...values: string[]) => values.map((v) => ({ value: v, label: v }));

export const CONFIG_GROUPS: GroupDef[] = [
  {
    id: "browser",
    title: "Browser",
    description: "Engine, identity, proxy and context",
    fields: [
      { key: "browser_type", label: "Browser engine", type: "select", options: sel("chromium", "firefox", "webkit") },
      { key: "headless", label: "Headless", type: "boolean", help: "Run without a visible window (default on)" },
      { key: "enable_stealth", label: "Stealth mode", type: "boolean", help: "playwright-stealth patches to reduce bot detection" },
      { key: "viewport_width", label: "Viewport width", type: "number", placeholder: "1080" },
      { key: "viewport_height", label: "Viewport height", type: "number", placeholder: "600" },
      { key: "user_agent", label: "User agent", type: "text", placeholder: "Custom UA string" },
      { key: "user_agent_mode", label: "UA mode", type: "select", options: [{ value: "random", label: "random" }], help: "Generate a random valid user agent" },
      { key: "java_script_enabled", label: "JavaScript enabled", type: "boolean" },
      { key: "text_mode", label: "Text mode", type: "boolean", help: "Disable images/rich content for speed" },
      { key: "light_mode", label: "Light mode", type: "boolean", help: "Disable background browser features" },
      { key: "ignore_https_errors", label: "Ignore HTTPS errors", type: "boolean" },
      { key: "proxy_server", label: "Proxy server", type: "text", placeholder: "http://host:port" },
      { key: "proxy_username", label: "Proxy username", type: "text", showIf: (g) => !!g.proxy_server },
      { key: "proxy_password", label: "Proxy password", type: "text", showIf: (g) => !!g.proxy_server },
      { key: "headers", label: "Extra headers (JSON)", type: "json", placeholder: '{"X-Header": "value"}' },
      { key: "cookies", label: "Cookies (JSON array)", type: "json", placeholder: '[{"name":"session","value":"…","url":"https://site.com"}]' },
      { key: "storage_state", label: "Storage state (JSON)", type: "json", help: "Playwright storage_state export (cookies + localStorage) for authenticated sessions" },
      { key: "extra_args", label: "Extra browser args", type: "list", placeholder: "--disable-gpu, --no-sandbox" },
    ],
  },
  {
    id: "page",
    title: "Page interaction",
    description: "Waiting, JavaScript, scrolling, sessions",
    fields: [
      { key: "wait_until", label: "Wait until", type: "select", options: sel("domcontentloaded", "networkidle", "load", "commit"), help: "Browser lifecycle event that must fire before crawling continues; networkidle can be slow on pages with ongoing requests" },
      { key: "wait_for", label: "Wait for", type: "text", placeholder: "css:.loaded  or  js:() => window.ready", help: "CSS selector or JS predicate to wait for before extraction" },
      { key: "page_timeout", label: "Page timeout (ms)", type: "number", placeholder: "60000" },
      { key: "wait_for_timeout", label: "Wait-for timeout (ms)", type: "number" },
      { key: "wait_for_images", label: "Wait for images", type: "boolean" },
      { key: "delay_before_return_html", label: "Delay before capture (s)", type: "number", step: 0.1 },
      { key: "js_code", label: "JavaScript to execute", type: "code", help: "Runs after page load, before extraction" },
      { key: "js_only", label: "JS-only (reuse page)", type: "boolean", help: "Continue in an existing session without a new navigation", showIf: (g) => !!g.session_id },
      { key: "session_id", label: "Session ID", type: "text", help: "Reuse the same browser tab across crawls (login flows)" },
      { key: "scan_full_page", label: "Scan full page", type: "boolean", help: "Auto-scroll to trigger lazy loading" },
      { key: "scroll_delay", label: "Scroll delay (s)", type: "number", step: 0.1, showIf: (g) => !!g.scan_full_page },
      { key: "max_scroll_steps", label: "Max scroll steps", type: "number", showIf: (g) => !!g.scan_full_page },
      { key: "virtual_scroll", label: "Virtual scroll (JSON)", type: "json", placeholder: '{"container_selector":"#feed","scroll_count":10,"scroll_by":"container_height","wait_after_scroll":0.5}', help: "For virtualized feeds (Twitter-style) where DOM is recycled" },
      { key: "magic", label: "Magic mode", type: "boolean", help: "Auto-handle overlays and popups" },
      { key: "remove_overlay_elements", label: "Remove overlays", type: "boolean" },
      { key: "process_iframes", label: "Inline iframes", type: "boolean", help: "Merge iframe content into the processed page before markdown and extraction run" },
      { key: "simulate_user", label: "Simulate user", type: "boolean", help: "Mouse movement simulation (anti-bot)" },
      { key: "override_navigator", label: "Override navigator", type: "boolean", help: "Patch navigator properties (anti-bot)" },
      { key: "adjust_viewport_to_content", label: "Fit viewport to content", type: "boolean", help: "Resize the browser viewport to the page content before capture; useful for full-page screenshots" },
      { key: "locale", label: "Locale", type: "text", placeholder: "en-US" },
      { key: "timezone_id", label: "Timezone", type: "text", placeholder: "America/New_York" },
      { key: "geolocation_latitude", label: "Geo latitude", type: "number", step: 0.0001 },
      { key: "geolocation_longitude", label: "Geo longitude", type: "number", step: 0.0001 },
    ],
  },
  {
    id: "content",
    title: "Content selection",
    description: "Scoping, exclusions, links and media",
    fields: [
      { key: "css_selector", label: "CSS selector", type: "text", placeholder: "main.article", help: "Restrict the crawl output to this element" },
      { key: "target_elements", label: "Target elements", type: "list", placeholder: "article, .content", help: "Only these elements feed markdown/extraction (page context kept)" },
      { key: "excluded_tags", label: "Excluded tags", type: "list", placeholder: "nav, footer, aside" },
      { key: "excluded_selector", label: "Excluded selector", type: "text", placeholder: "#ads, .cookie-banner" },
      { key: "word_count_threshold", label: "Min words per block", type: "number", placeholder: "200" },
      { key: "only_text", label: "Text only", type: "boolean" },
      { key: "keep_data_attributes", label: "Keep data-* attributes", type: "boolean", help: "Preserve HTML data-* attributes in cleaned output for selectors or downstream processing" },
      { key: "remove_forms", label: "Remove forms", type: "boolean" },
      { key: "exclude_external_links", label: "Drop external links", type: "boolean" },
      { key: "exclude_internal_links", label: "Drop internal links", type: "boolean" },
      { key: "exclude_social_media_links", label: "Drop social media links", type: "boolean" },
      { key: "exclude_domains", label: "Excluded domains", type: "list", placeholder: "ads.com, tracker.io" },
      { key: "exclude_external_images", label: "Drop external images", type: "boolean" },
      { key: "exclude_all_images", label: "Drop all images", type: "boolean" },
      { key: "image_score_threshold", label: "Image score threshold", type: "number", help: "Minimum Crawl4AI relevance score required to keep an image in the result" },
      { key: "table_score_threshold", label: "Table score threshold", type: "number", placeholder: "7", help: "Minimum table quality score required before a table is included in processed content" },
      { key: "check_robots_txt", label: "Respect robots.txt", type: "boolean" },
    ],
  },
  {
    id: "markdown",
    title: "Markdown",
    description: "Generator options and content filters",
    fields: [
      { key: "content_source", label: "Content source", type: "select", options: sel("cleaned_html", "raw_html", "fit_html") },
      {
        key: "content_filter",
        label: "Content filter",
        type: "select",
        options: [
          { value: "none", label: "None (raw markdown)" },
          { value: "pruning", label: "Pruning — heuristic quality filter" },
          { value: "bm25", label: "BM25 — relevance to a query" },
          { value: "llm", label: "LLM — instruction-driven filter" },
        ],
        help: "Produces fit_markdown alongside raw markdown",
      },
      { key: "pruning_threshold", label: "Pruning threshold", type: "number", step: 0.01, placeholder: "0.48", showIf: (g) => g.content_filter === "pruning" },
      { key: "pruning_threshold_type", label: "Threshold type", type: "select", options: sel("fixed", "dynamic"), showIf: (g) => g.content_filter === "pruning" },
      { key: "pruning_min_word_threshold", label: "Min words per block", type: "number", showIf: (g) => g.content_filter === "pruning" },
      { key: "bm25_query", label: "BM25 query", type: "text", placeholder: "machine learning tutorials", showIf: (g) => g.content_filter === "bm25" },
      { key: "bm25_threshold", label: "BM25 threshold", type: "number", step: 0.1, placeholder: "1.0", showIf: (g) => g.content_filter === "bm25" },
      { key: "llm_filter_instruction", label: "Filter instruction", type: "textarea", placeholder: "Keep only technical content, code examples…", showIf: (g) => g.content_filter === "llm" },
      { key: "ignore_links", label: "Ignore links", type: "boolean" },
      { key: "ignore_images", label: "Ignore images", type: "boolean" },
      { key: "escape_html", label: "Escape HTML entities", type: "boolean" },
      { key: "skip_internal_links", label: "Skip internal links", type: "boolean" },
      { key: "body_width", label: "Wrap column (0 = none)", type: "number" },
    ],
  },
  {
    id: "capture",
    title: "Capture & cache",
    description: "Screenshot, PDF, MHTML, network, SSL, caching",
    fields: [
      { key: "cache_mode", label: "Cache mode", type: "select", options: sel("bypass", "enabled", "disabled", "read_only", "write_only"), help: "Controls whether Crawl4AI reads cached pages, writes new cache entries, does both, or bypasses the cache" },
      { key: "screenshot", label: "Screenshot", type: "boolean" },
      { key: "screenshot_wait_for", label: "Screenshot delay (s)", type: "number", step: 0.1, showIf: (g) => !!g.screenshot },
      { key: "pdf", label: "PDF export", type: "boolean" },
      { key: "capture_mhtml", label: "MHTML snapshot", type: "boolean", help: "Save the page and its resources as a single browser archive (.mhtml)" },
      { key: "capture_network_requests", label: "Capture network requests", type: "boolean", help: "Record requests made by the page for debugging APIs, assets, and failed loads" },
      { key: "capture_console_messages", label: "Capture console messages", type: "boolean", help: "Include browser console logs, warnings, and errors in the crawl artifacts" },
      { key: "fetch_ssl_certificate", label: "Fetch SSL certificate", type: "boolean", help: "Collect TLS certificate metadata for HTTPS pages" },
    ],
  },
];

export const REGEX_LABELS: Record<string, string> = {
  email: "Emails",
  phone_intl: "Phones (intl)",
  phone_us: "Phones (US)",
  url: "URLs",
  ipv4: "IPv4",
  ipv6: "IPv6",
  uuid: "UUIDs",
  currency: "Currency",
  percentage: "Percentages",
  number: "Numbers",
  date_iso: "Dates (ISO)",
  date_us: "Dates (US)",
  time_24h: "Times (24h)",
  postal_us: "US ZIP codes",
  postal_uk: "UK postcodes",
  html_color_hex: "Hex colors",
  twitter_handle: "Twitter handles",
  hashtag: "Hashtags",
  mac_addr: "MAC addresses",
  iban: "IBANs",
  credit_card: "Credit cards",
};
