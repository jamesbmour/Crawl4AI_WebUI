import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  Bug,
  Compass,
  Braces,
  Globe,
  Layers,
  ListTodo,
  MessageCircleQuestion,
  Settings,
  Sparkles,
} from "lucide-react";
import ScrapePage from "./pages/ScrapePage";
import BatchPage from "./pages/BatchPage";
import DeepCrawlPage from "./pages/DeepCrawlPage";
import DiscoveryPage from "./pages/DiscoveryPage";
import ExtractionPage from "./pages/ExtractionPage";
import AdaptivePage from "./pages/AdaptivePage";
import AskPage from "./pages/AskPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import SettingsPage from "./pages/SettingsPage";

const NAV = [
  { to: "/", label: "Scrape", icon: Globe, end: true },
  { to: "/batch", label: "Batch crawl", icon: Layers },
  { to: "/deep", label: "Deep crawl", icon: Bug },
  { to: "/discovery", label: "Discovery", icon: Compass },
  { to: "/extraction", label: "Extraction", icon: Braces },
  { to: "/adaptive", label: "Adaptive", icon: Sparkles },
  { to: "/ask", label: "Ask", icon: MessageCircleQuestion },
  { to: "/jobs", label: "Jobs", icon: ListTodo },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <aside className="w-52 shrink-0 border-r border-surface-border bg-surface-raised/50 flex flex-col">
          <div className="px-4 py-4 flex items-center gap-2">
            <span className="text-xl">🕷️</span>
            <div>
              <h1 className="text-sm font-bold text-zinc-100 leading-tight">Crawl4AI</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Studio</p>
            </div>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <footer className="px-4 py-3 text-[10px] text-zinc-600">
            Local Crawl4AI playground
          </footer>
        </aside>
        <main className="flex-1 min-w-0 px-6 py-6 max-w-[1200px]">
          <Routes>
            <Route path="/" element={<ScrapePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/deep" element={<DeepCrawlPage />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/extraction" element={<ExtractionPage />} />
            <Route path="/adaptive" element={<AdaptivePage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
