/** Declarative definitions for every crawl option exposed in the UI.
 *  Group/field keys mirror the backend pydantic models 1:1. `default` is what
 *  crawl4ai (0.7.8) or the backend uses when a field is left unset. */

export const CRAWL4AI_DOCS_URL = "https://docs.crawl4ai.com/";

export const DEFAULT_BATCH_URLS = [
  CRAWL4AI_DOCS_URL,
  `${CRAWL4AI_DOCS_URL}core/quickstart/`,
  `${CRAWL4AI_DOCS_URL}core/simple-crawling/`,
];

export type GroupId = "browser" | "page" | "content" | "markdown" | "capture" | "extraction";

export type CrawlConfig = Record<GroupId, Record<string, any>>;

export type CrawlMode = "scrape" | "batch" | "deep";

export function defaultConfig(): CrawlConfig {
  return { browser: {}, page: {}, content: {}, markdown: {}, capture: {}, extraction: { type: "none" } };
}

export function normalizeConfig(config?: Partial<CrawlConfig> | null): CrawlConfig {
  const base = defaultConfig();
  if (!config) return base;
  // Configs saved before the backend dumped by alias stored the inline schema as `schema_json`.
  const { schema_json, ...extraction } = config.extraction ?? {};
  return {
    ...base,
    ...config,
    extraction: { ...base.extraction, schema: schema_json, ...extraction },
  };
}

export interface FieldDef {
  key: string;
  label: string;
  type: "boolean" | "number" | "text" | "select" | "textarea" | "list" | "json" | "code";
  /** Value used when the field is unset; drives toggles, select labels and placeholders. */
  default?: unknown;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  step?: number;
  min?: number;
  secret?: boolean;
  /** Crawl types the field applies to (all when omitted). Other types hide it and drop its value. */
  modes?: CrawlMode[];
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
    description: "Engine, window size, identity, proxy and login state",
    fields: [
      { key: "browser_type", label: "Browser engine", type: "select", default: "chromium", options: sel("chromium", "firefox", "webkit"), help: "Playwright browser that loads pages. Firefox and WebKit work only if their Playwright browsers are installed." },
      { key: "headless", label: "Headless", type: "boolean", default: true, help: "Run without a visible browser window. Turn off to watch pages load (local runs only)." },
      { key: "enable_stealth", label: "Stealth mode", type: "boolean", default: false, help: "Hide common automation fingerprints (playwright-stealth) to get past basic bot detection." },
      { key: "viewport_width", label: "Viewport width (px)", type: "number", default: 1080, min: 1, help: "Browser window width. Changes responsive layouts and screenshot size." },
      { key: "viewport_height", label: "Viewport height (px)", type: "number", default: 600, min: 1, help: "Browser window height." },
      { key: "user_agent", label: "User agent", type: "text", placeholder: "Mozilla/5.0 …", help: "Send this User-Agent instead of crawl4ai's built-in Chrome one." },
      { key: "user_agent_mode", label: "User agent mode", type: "select", default: "", options: [{ value: "", label: "Fixed" }, { value: "random", label: "Random" }], help: "Random generates a realistic User-Agent for each browser instead of a fixed one." },
      { key: "java_script_enabled", label: "JavaScript", type: "boolean", default: true, help: "Run page scripts. Turning this off is faster but breaks most modern sites." },
      { key: "text_mode", label: "Text mode", type: "boolean", default: false, help: "Don't load images and other heavy media; faster when you only need text." },
      { key: "light_mode", label: "Light mode", type: "boolean", default: false, help: "Turn off background browser features to save CPU and memory." },
      { key: "ignore_https_errors", label: "Ignore HTTPS errors", type: "boolean", default: true, help: "Load pages even when their TLS certificate is invalid or self-signed." },
      { key: "proxy_server", label: "Proxy server", type: "text", placeholder: "http://host:port", help: "Send all browser traffic through this proxy." },
      { key: "proxy_username", label: "Proxy username", type: "text", showIf: (g) => !!g.proxy_server, help: "Username for the proxy, if it needs one." },
      { key: "proxy_password", label: "Proxy password", type: "text", secret: true, showIf: (g) => !!g.proxy_server, help: "Password for the proxy. Stored with your settings on this server." },
      { key: "headers", label: "Extra headers", type: "json", placeholder: '{"X-Header": "value"}', help: "HTTP headers added to every request, as a JSON object." },
      { key: "cookies", label: "Cookies", type: "json", placeholder: '[{"name":"session","value":"…","url":"https://site.com"}]', help: "Cookies set before the first request, as a JSON array of {name, value, url}." },
      { key: "storage_state", label: "Storage state", type: "json", help: "Cookies and localStorage exported from a logged-in Playwright browser, for crawling pages behind a login." },
      { key: "extra_args", label: "Extra browser flags", type: "list", placeholder: "--disable-gpu, --no-sandbox", help: "Command-line flags passed to the browser at launch." },
    ],
  },
  {
    id: "page",
    title: "Page interaction",
    description: "Waiting, scripts, scrolling and anti-bot behavior",
    fields: [
      {
        key: "wait_until",
        label: "Wait until",
        type: "select",
        default: "domcontentloaded",
        options: [
          { value: "domcontentloaded", label: "domcontentloaded — HTML parsed" },
          { value: "load", label: "load — all resources loaded" },
          { value: "networkidle", label: "networkidle — network quiet for 500 ms" },
          { value: "commit", label: "commit — first response received" },
        ],
        help: "Navigation event to wait for before continuing. networkidle suits apps that fetch data after load but is slow on busy pages.",
      },
      { key: "wait_for", label: "Wait for", type: "text", placeholder: "css:.loaded  or  js:() => window.ready", help: "Before capturing, wait for a CSS selector to appear (css:…) or a JavaScript check to return true (js:…)." },
      { key: "page_timeout", label: "Page timeout (ms)", type: "number", default: 60000, min: 0, help: "Give up on a page after this long, covering navigation and waits." },
      { key: "wait_for_timeout", label: "Wait-for timeout (ms)", type: "number", min: 0, placeholder: "Same as page timeout", help: "Time limit for the Wait for condition." },
      { key: "wait_for_images", label: "Wait for images", type: "boolean", default: false, help: "Wait until images finish loading before capturing." },
      { key: "delay_before_return_html", label: "Delay before capture (s)", type: "number", default: 0.1, step: 0.1, min: 0, help: "Extra pause before the final HTML is read, for content that renders late." },
      { key: "js_code", label: "JavaScript to run", type: "code", help: "Runs after the page loads and before content is captured, e.g. to click “Load more” or close a dialog." },
      { key: "scan_full_page", label: "Scroll full page", type: "boolean", default: false, help: "Scroll to the bottom before capturing so lazy-loaded content appears." },
      { key: "scroll_delay", label: "Scroll delay (s)", type: "number", default: 0.2, step: 0.1, min: 0, showIf: (g) => !!g.scan_full_page, help: "Pause between scroll steps." },
      { key: "max_scroll_steps", label: "Max scroll steps", type: "number", min: 1, placeholder: "Until the end", showIf: (g) => !!g.scan_full_page, help: "Stop after this many scroll steps. Empty scrolls until the page ends." },
      { key: "virtual_scroll", label: "Virtual scroll", type: "json", placeholder: '{"container_selector":"#feed","scroll_count":10,"scroll_by":"container_height","wait_after_scroll":0.5}', help: "For feeds that swap content out while you scroll (X/Twitter-style): scrolls a container and keeps everything it saw." },
      { key: "remove_overlay_elements", label: "Remove overlays", type: "boolean", default: false, help: "Remove popups, modals and cookie banners before capturing." },
      { key: "magic", label: "Magic mode", type: "boolean", default: false, help: "Experimental: automatically handle popups and consent banners and mask automation signals." },
      { key: "simulate_user", label: "Simulate user", type: "boolean", default: false, help: "Make random mouse movements and clicks so the visit looks human (anti-bot)." },
      { key: "override_navigator", label: "Override navigator", type: "boolean", default: false, help: "Hide navigator properties that reveal an automated browser (anti-bot)." },
      { key: "process_iframes", label: "Include iframes", type: "boolean", default: false, help: "Merge iframe content into the page before markdown and extraction run." },
      { key: "adjust_viewport_to_content", label: "Fit viewport to content", type: "boolean", default: false, help: "Resize the viewport to the whole page before capturing; useful for full-page screenshots." },
      { key: "session_id", label: "Session ID", type: "text", modes: ["scrape"], placeholder: "login-flow", help: "Scrape only. Keeps the browser tab open under this name so the next scrape continues on the same page (logins, multi-step flows)." },
      { key: "js_only", label: "Reuse page without reloading", type: "boolean", default: false, modes: ["scrape"], showIf: (g) => !!g.session_id, help: "Run the JavaScript on the open session tab instead of navigating again." },
      { key: "locale", label: "Locale", type: "text", placeholder: "en-US", help: "Browser language and region. Sites may localize content from it." },
      { key: "timezone_id", label: "Timezone", type: "text", placeholder: "America/New_York", help: "Timezone the page sees, as an IANA name." },
      { key: "geolocation_latitude", label: "Latitude", type: "number", step: 0.0001, help: "Location the page gets from the geolocation API. Set together with longitude." },
      { key: "geolocation_longitude", label: "Longitude", type: "number", step: 0.0001, help: "Set together with latitude." },
    ],
  },
  {
    id: "content",
    title: "Content selection",
    description: "Which parts of the page, links and images are kept",
    fields: [
      { key: "css_selector", label: "CSS selector", type: "text", placeholder: "main.article", help: "Keep only this part of the page. In deep crawls, links outside it aren't followed; use Target elements to keep them." },
      { key: "target_elements", label: "Target elements", type: "list", placeholder: "article, .content", help: "Build markdown and extraction from only these elements; links and media still come from the whole page." },
      { key: "excluded_tags", label: "Excluded tags", type: "list", placeholder: "nav, footer, aside", help: "Remove these HTML tags before processing." },
      { key: "excluded_selector", label: "Excluded selector", type: "text", placeholder: "#ads, .cookie-banner", help: "Remove elements matching this CSS selector before processing." },
      { key: "word_count_threshold", label: "Min words per block", type: "number", default: 1, min: 0, help: "Drop text blocks shorter than this many words. Around 10 cuts most menus and captions." },
      { key: "only_text", label: "Text only", type: "boolean", default: false, help: "Flatten inline formatting (bold, italics, underline…) into plain text." },
      { key: "keep_data_attributes", label: "Keep data-* attributes", type: "boolean", default: false, help: "Keep data-* attributes in the cleaned HTML, e.g. for selectors that rely on them." },
      { key: "remove_forms", label: "Remove forms", type: "boolean", default: false, help: "Remove <form> elements before processing." },
      { key: "exclude_external_links", label: "Drop external links", type: "boolean", default: false, help: "Remove links to other domains from the results." },
      { key: "exclude_internal_links", label: "Drop internal links", type: "boolean", default: false, modes: ["scrape", "batch"], help: "Remove links within the same site from the results. Not used by deep crawls, which need them." },
      { key: "exclude_social_media_links", label: "Drop social media links", type: "boolean", default: false, help: "Remove links to social networks such as Facebook, X and LinkedIn." },
      { key: "exclude_domains", label: "Excluded link domains", type: "list", placeholder: "ads.com, tracker.io", help: "Remove links to these domains. Deep crawls won't follow them either." },
      { key: "exclude_external_images", label: "Drop external images", type: "boolean", default: false, help: "Remove images hosted on other domains." },
      { key: "exclude_all_images", label: "Drop all images", type: "boolean", default: false, help: "Remove every image from the results." },
      { key: "image_score_threshold", label: "Image score threshold", type: "number", default: 2, help: "Images scoring below this (from size, alt text and position) are dropped." },
      { key: "table_score_threshold", label: "Table score threshold", type: "number", default: 7, help: "Tables scoring below this are treated as page layout and left out of the extracted tables." },
      { key: "check_robots_txt", label: "Respect robots.txt", type: "boolean", default: false, help: "Skip URLs the site's robots.txt disallows." },
    ],
  },
  {
    id: "markdown",
    title: "Markdown",
    description: "How markdown is generated and filtered",
    fields: [
      {
        key: "content_filter",
        label: "Content filter",
        type: "select",
        default: "none",
        options: [
          { value: "none", label: "None — full markdown only" },
          { value: "pruning", label: "Pruning — drop boilerplate" },
          { value: "bm25", label: "BM25 — keep text relevant to a query" },
          { value: "llm", label: "LLM — follow an instruction" },
        ],
        help: "Adds fit_markdown, a filtered copy with only the main or most relevant content. The full markdown is always kept.",
      },
      { key: "pruning_threshold", label: "Pruning threshold", type: "number", default: 0.48, step: 0.01, showIf: (g) => g.content_filter === "pruning", help: "Blocks scoring below this are removed. Higher keeps less." },
      { key: "pruning_threshold_type", label: "Threshold type", type: "select", default: "fixed", options: sel("fixed", "dynamic"), showIf: (g) => g.content_filter === "pruning", help: "Fixed applies the threshold as-is; dynamic adjusts it per block from tag type and text density." },
      { key: "pruning_min_word_threshold", label: "Min words per block", type: "number", min: 0, showIf: (g) => g.content_filter === "pruning", help: "Always remove blocks with fewer words than this." },
      { key: "bm25_query", label: "BM25 query", type: "text", placeholder: "machine learning tutorials", showIf: (g) => g.content_filter === "bm25", help: "Required. Blocks relevant to this query are kept." },
      { key: "bm25_threshold", label: "BM25 threshold", type: "number", default: 1, step: 0.1, showIf: (g) => g.content_filter === "bm25", help: "Minimum relevance score to keep a block. Higher keeps less." },
      { key: "llm_filter_instruction", label: "Filter instruction", type: "textarea", placeholder: "Keep only technical content and code examples…", showIf: (g) => g.content_filter === "llm", help: "What the LLM should keep. Uses the provider from Settings and spends tokens on every page." },
      { key: "content_source", label: "Markdown source", type: "select", default: "cleaned_html", options: [{ value: "cleaned_html", label: "Cleaned HTML" }, { value: "raw_html", label: "Raw HTML" }, { value: "fit_html", label: "Fit HTML" }], help: "HTML the markdown is built from: cleaned (scripts and clutter removed), the raw page, or fit HTML (trimmed for extraction)." },
      { key: "ignore_links", label: "Ignore links", type: "boolean", default: false, help: "Write link text without the URLs." },
      { key: "ignore_images", label: "Ignore images", type: "boolean", default: false, help: "Leave images out of the markdown." },
      { key: "skip_internal_links", label: "Skip anchor links", type: "boolean", default: false, help: "Leave out same-page #anchor links." },
      { key: "body_width", label: "Wrap column", type: "number", default: 0, min: 0, help: "Wrap lines at this many characters. 0 never wraps." },
    ],
  },
  {
    id: "capture",
    title: "Capture & cache",
    description: "Screenshots, PDF, archives, debug data and caching",
    fields: [
      {
        key: "cache_mode",
        label: "Cache",
        type: "select",
        default: "bypass",
        options: [
          { value: "bypass", label: "Bypass — always fetch fresh" },
          { value: "enabled", label: "Enabled — reuse and store pages" },
          { value: "read_only", label: "Read only — reuse, never store" },
          { value: "write_only", label: "Write only — fetch fresh, store for later" },
          { value: "disabled", label: "Disabled — no cache at all" },
        ],
        help: "Whether crawl4ai reuses pages from its local cache. Cached pages return much faster but show the page as it was when stored.",
      },
      { key: "screenshot", label: "Screenshot", type: "boolean", default: false, help: "Save a full-page PNG screenshot." },
      { key: "screenshot_wait_for", label: "Screenshot delay (s)", type: "number", step: 0.1, min: 0, showIf: (g) => !!g.screenshot, help: "Extra wait before the screenshot is taken." },
      { key: "pdf", label: "PDF", type: "boolean", default: false, help: "Save the page as a PDF." },
      { key: "capture_mhtml", label: "MHTML archive", type: "boolean", default: false, help: "Save the page and its resources as one .mhtml file you can open offline." },
      { key: "capture_network_requests", label: "Network requests", type: "boolean", default: false, help: "Record every request and response the page makes, for debugging APIs and failed loads." },
      { key: "capture_console_messages", label: "Console messages", type: "boolean", default: false, help: "Record browser console logs, warnings and errors." },
      { key: "fetch_ssl_certificate", label: "SSL certificate", type: "boolean", default: false, help: "Save the site's TLS certificate details, such as issuer and validity dates." },
    ],
  },
];

/** Values that apply to `mode`: fields marked for other crawl types are dropped. */
export function configForMode(config: CrawlConfig, mode: CrawlMode): CrawlConfig {
  const out = { ...config };
  for (const group of CONFIG_GROUPS) {
    const skip = new Set(group.fields.filter((f) => f.modes && !f.modes.includes(mode)).map((f) => f.key));
    if (skip.size) out[group.id] = Object.fromEntries(Object.entries(config[group.id] ?? {}).filter(([key]) => !skip.has(key)));
  }
  return out;
}

/** The fields' defaults overlaid with the values that are set. */
export function withDefaults(fields: FieldDef[], values: Record<string, any> = {}) {
  const out: Record<string, any> = {};
  for (const f of fields) if (f.default !== undefined) out[f.key] = f.default;
  for (const [key, value] of Object.entries(values)) if (value !== undefined) out[key] = value;
  return out;
}

// ---------------------------------------------------------------------------
// Options that belong to one crawl type (backend DispatcherOptions / DeepCrawlOptions)
// ---------------------------------------------------------------------------

export const BATCH_FIELDS: FieldDef[] = [
  {
    key: "type",
    label: "Concurrency",
    type: "select",
    default: "memory_adaptive",
    options: [
      { value: "memory_adaptive", label: "Adaptive — pause when memory runs low" },
      { value: "semaphore", label: "Fixed — always the same number" },
    ],
    help: "How many pages load in parallel. Adaptive starts new pages only while system memory stays under the limit.",
  },
  { key: "max_session_permit", label: "Max pages at once", type: "number", default: 10, min: 1, showIf: (g) => g.type !== "semaphore", help: "Upper limit on pages crawling in parallel." },
  { key: "memory_threshold_percent", label: "Memory limit (%)", type: "number", default: 90, min: 1, showIf: (g) => g.type !== "semaphore", help: "New pages wait while system memory use is above this." },
  { key: "semaphore_count", label: "Pages at once", type: "number", default: 5, min: 1, showIf: (g) => g.type === "semaphore", help: "Number of pages crawling in parallel." },
];

export const RATE_LIMIT_FIELDS: FieldDef[] = [
  { key: "enabled", label: "Rate limiting", type: "boolean", default: false, help: "Space out requests to the same site and back off when it answers 429 or 503." },
  { key: "base_delay_min", label: "Min delay (s)", type: "number", default: 1, step: 0.5, min: 0, showIf: (g) => !!g.enabled, help: "Shortest wait between requests to one site." },
  { key: "base_delay_max", label: "Max delay (s)", type: "number", default: 3, step: 0.5, min: 0, showIf: (g) => !!g.enabled, help: "Longest wait. Each delay is picked at random between min and max." },
  { key: "max_delay", label: "Max backoff (s)", type: "number", default: 60, min: 0, showIf: (g) => !!g.enabled, help: "Cap on the wait after repeated 429/503 answers." },
  { key: "max_retries", label: "Retries", type: "number", default: 3, min: 0, showIf: (g) => !!g.enabled, help: "Retries for a URL that keeps answering 429/503 before it counts as failed." },
];

export const DEEP_FIELDS: FieldDef[] = [
  {
    key: "strategy",
    label: "Crawl order",
    type: "select",
    default: "bfs",
    options: [
      { value: "bfs", label: "Breadth-first — level by level" },
      { value: "dfs", label: "Depth-first — one branch at a time" },
      { value: "best_first", label: "Best-first — highest-scoring links first" },
    ],
    help: "Which discovered link is visited next. Best-first ranks links with the relevance keywords.",
  },
  { key: "max_depth", label: "Max depth", type: "number", default: 2, min: 0, help: "How many clicks away from the start page to go. 0 crawls only the start page." },
  { key: "max_pages", label: "Max pages", type: "number", default: 25, min: 1, help: "Stop after crawling this many pages in total." },
  { key: "include_external", label: "Follow external links", type: "boolean", default: false, help: "Also follow links to other domains. Off keeps the crawl on the start site." },
  { key: "keywords", label: "Relevance keywords", type: "list", placeholder: "python, async, tutorial", help: "Score each discovered link by how many of these words appear in its URL." },
  { key: "score_threshold", label: "Min link score", type: "number", step: 0.05, min: 0, showIf: (g) => g.strategy !== "best_first", help: "Skip links scoring below this. Scores run 0–0.7 (share of keywords in the URL × 0.7); without keywords every link scores 0." },
];

export const FILTER_TYPES = [
  { value: "url_pattern", label: "URL pattern", help: "Keep only links whose URL matches a pattern, or skip the matches instead." },
  { value: "domain", label: "Domain allow / block", help: "Only follow links on allowed domains, or never follow blocked ones. Subdomains count." },
  { value: "content_type", label: "Content type", help: "Keep links whose file extension maps to an allowed type. Links without an extension pass." },
  { value: "content_relevance", label: "Content relevance", help: "Fetches each link's <head> and keeps pages whose title and description match a query (BM25)." },
  { value: "seo", label: "SEO quality", help: "Fetches each link's <head> and keeps pages with strong SEO signals such as title, description and canonical URL." },
];

export const FILTER_FIELDS: FieldDef[] = [
  { key: "patterns", label: "Patterns", type: "list", placeholder: "*/docs/*, *.html", showIf: (f) => f.type === "url_pattern", help: "Glob patterns matched against the URL; * matches anything." },
  { key: "reverse", label: "Skip matches instead", type: "boolean", default: false, showIf: (f) => f.type === "url_pattern", help: "Crawl everything except URLs that match." },
  { key: "allowed_domains", label: "Allowed domains", type: "list", placeholder: "docs.example.com", showIf: (f) => f.type === "domain", help: "Only follow links on these domains." },
  { key: "blocked_domains", label: "Blocked domains", type: "list", placeholder: "ads.example.com", showIf: (f) => f.type === "domain", help: "Never follow links on these domains." },
  { key: "allowed_types", label: "Allowed types", type: "list", placeholder: "text/html, application/pdf", showIf: (f) => f.type === "content_type", help: "MIME types to keep." },
  { key: "query", label: "Query", type: "text", placeholder: "machine learning tutorials", showIf: (f) => f.type === "content_relevance", help: "Topic the page's title and description should match." },
  { key: "threshold", label: "Min relevance", type: "number", default: 0.7, step: 0.05, min: 0, showIf: (f) => f.type === "content_relevance", help: "Relevance score a page needs to pass." },
  { key: "keywords", label: "Keywords", type: "list", placeholder: "crawler, scraping", showIf: (f) => f.type === "seo", help: "Words the title and description should contain." },
  { key: "threshold", label: "Min SEO score", type: "number", default: 0.5, step: 0.05, min: 0, showIf: (f) => f.type === "seo", help: "Score from 0 to 1 a page needs to pass." },
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
