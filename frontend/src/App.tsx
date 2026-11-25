import { lazy, Suspense, useState } from "react";
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Braces, Bug, Compass, Globe, Layers, ListTodo, Menu,
  MessageCircleQuestion, ScanSearch, Settings, Sparkles, X,
} from "lucide-react";

const ScrapePage = lazy(() => import("./pages/ScrapePage"));
const BatchPage = lazy(() => import("./pages/BatchPage"));
const DeepCrawlPage = lazy(() => import("./pages/DeepCrawlPage"));
const DiscoveryPage = lazy(() => import("./pages/DiscoveryPage"));
const ExtractionPage = lazy(() => import("./pages/ExtractionPage"));
const AdaptivePage = lazy(() => import("./pages/AdaptivePage"));
const AskPage = lazy(() => import("./pages/AskPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const NAV = [
  {
    label: "Crawl",
    items: [
      { to: "/", label: "Scrape", icon: Globe, end: true },
      { to: "/batch", label: "Batch crawl", icon: Layers },
      { to: "/deep", label: "Deep crawl", icon: Bug },
      { to: "/discovery", label: "URL discovery", icon: Compass },
    ],
  },
  {
    label: "Analyze",
    items: [
      { to: "/extraction", label: "Extraction", icon: Braces },
      { to: "/adaptive", label: "Adaptive crawl", icon: Sparkles },
      { to: "/ask", label: "Ask", icon: MessageCircleQuestion },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/jobs", label: "Jobs", icon: ListTodo },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <aside className="studio-sidebar" onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        document.getElementById("studio-menu")?.focus();
      }
    }}>
      <div className="studio-brand-row">
        <Link to="/" className="studio-brand" onClick={() => setMenuOpen(false)}>
          <span className="studio-mark"><ScanSearch size={21} aria-hidden="true" /></span>
          <span>Crawl4AI <span className="studio-brand-subtitle">Studio</span></span>
        </Link>
        <button
          id="studio-menu"
          type="button"
          className="btn-secondary studio-menu"
          aria-expanded={menuOpen}
          aria-controls="studio-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          Menu
        </button>
      </div>
      <nav id="studio-navigation" aria-label="Workspace" className="studio-nav" data-open={menuOpen}>
        {NAV.map(({ label, items }) => (
          <div key={label} className="studio-nav-group">
            <div className="studio-nav-label">{label}</div>
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="studio-nav-link" onClick={() => setMenuOpen(false)}>
                <Icon size={17} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function Studio() {
  const { pathname } = useLocation();

  return (
    <div className="studio">
      <button type="button" className="studio-skip" onClick={() => document.getElementById("main-content")?.focus()}>
        Skip to content
      </button>
      <Navigation key={pathname} />
      <main id="main-content" className="studio-main" tabIndex={-1}>
        <Suspense fallback={<p className="text-sm text-zinc-400" role="status">Loading workspace…</p>}>
          <Routes>
            <Route path="/" element={<ScrapePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/deep" element={<DeepCrawlPage />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/extraction" element={<ExtractionPage />} />
            <Route path="/adaptive" element={<AdaptivePage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage key={pathname} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return <HashRouter><Studio /></HashRouter>;
}
