"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  FileText,
  Upload,
  Settings as SettingsIcon,
  Plus,
  Search,
  Building2,
  Sun,
  Moon,
  Clock,
  Broom,
  Sparkle,
} from "@/lib/icons";
import { useTheme } from "next-themes";
import { fmtDuration, fmtRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseQuickLog } from "@/lib/quick-log";

const NAV_ITEMS = [
  { value: "/", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { value: "/expenses", label: "Expenses", icon: Receipt, keywords: "spending" },
  { value: "/income", label: "Income", icon: TrendingUp, keywords: "hours timer earnings" },
  { value: "/invoices", label: "Invoices", icon: FileText, keywords: "factura billing" },
  { value: "/invoices/new", label: "New invoice", icon: Plus, keywords: "create factura" },
  { value: "/chores", label: "Chores", icon: Broom, keywords: "treburi randul casa curatenie axy" },
  { value: "/gratitude", label: "Gratitude", icon: Sparkle, keywords: "recunostinta lista merita sa traim multumesc" },
  { value: "/import", label: "Import CSV", icon: Upload, keywords: "revolut upload" },
  { value: "/settings", label: "Settings", icon: SettingsIcon, keywords: "tax fx clients passkey subscriptions" },
];

type Recent = {
  type: "expense" | "client";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

type JobLite = { id: string; name: string };

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Recent[]>([]);
  const [jobsLite, setJobsLite] = useState<JobLite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const [expRes, jobRes] = await Promise.all([
          fetch("/api/expenses-search").catch(() => null),
          fetch("/api/jobs"),
        ]);
        const items: Recent[] = [];
        const allJobs: JobLite[] = [];
        if (jobRes && jobRes.ok) {
          const { jobs } = await jobRes.json();
          for (const j of jobs) {
            if (j.active === false) continue;
            allJobs.push({ id: j.id, name: j.name });
          }
          for (const j of jobs.slice(0, 12)) {
            items.push({
              type: "client",
              id: j.id,
              title: j.name,
              subtitle: j.companyName || fmtRate(j.rateUsd, j.defaultCurrency || "USD"),
              href: `/invoices/new?jobId=${j.id}`,
            });
          }
        }
        setJobsLite(allJobs);
        if (expRes && expRes.ok) {
          const { expenses } = await expRes.json();
          for (const e of expenses.slice(0, 15)) {
            items.push({
              type: "expense",
              id: e.id,
              title: e.description,
              subtitle: `${e.category} · ${(e.amountRon / 100).toFixed(2)} RON`,
              href: `/expenses?q=${encodeURIComponent(e.description)}`,
            });
          }
        }
        setItems(items);
      } finally {
        setLoaded(true);
      }
    })();
  }, [open, loaded]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  // Parse the current input as a time-log entry. Returns null when the
  // query clearly isn't a log (no time/hours and no client matched).
  const parsed = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    if (jobsLite.length === 0) return null;
    const p = parseQuickLog(q, jobsLite);
    // Only show the preview if we recognized SOMETHING actionable:
    // either a time range/hours, OR a client name.
    if (p.startMinutes !== null || p.jobId) return p;
    return null;
  }, [query, jobsLite]);

  async function commitQuickLog() {
    if (!parsed || parsed.missing.length > 0 || logging) return;
    setLogging(true);
    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "time",
          date: parsed.date,
          jobId: parsed.jobId,
          startMinutes: parsed.startMinutes,
          endMinutes: parsed.endMinutes,
          description: parsed.description,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Could not log time", {
          description: String(err?.error ?? ""),
        });
        return;
      }
      toast.success(
        `Logged ${fmtDuration(parsed.hours ?? 0)} on ${parsed.jobName}`,
      );
      setQuery("");
      setOpen(false);
      router.refresh();
    } finally {
      setLogging(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px] animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-1/2 top-[15%] -translate-x-1/2 w-full max-w-xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              label="Command palette"
              className={cn(
                "rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden",
              )}
              shouldFilter
              // When a quick-log preview is showing, Enter commits the log
              // instead of selecting whichever list item happens to have
              // focus. Otherwise let cmdk handle navigation normally.
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  parsed &&
                  parsed.missing.length === 0 &&
                  !e.metaKey &&
                  !e.ctrlKey
                ) {
                  // Only intercept if the focused item is the quick-log preview.
                  const active = document.querySelector('[cmdk-item][data-selected="true"]');
                  if (!active || active.getAttribute("data-quicklog") === "true") {
                    e.preventDefault();
                    commitQuickLog();
                  }
                }
              }}
            >
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder='Search or log time — "8h netop today fix bug"'
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70"
                  autoFocus
                />
                <span className="font-mono text-[10px] tracking-tight text-muted-foreground/70 shrink-0">
                  esc
                </span>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-sm text-muted-foreground text-center">
                  No matches.
                </Command.Empty>

                {parsed && (
                  <Command.Group className="px-1 py-1">
                    <div className="text-[10px] uppercase tracking-wider text-accent px-2 pt-1 pb-0.5">
                      Quick-log time
                    </div>
                    <Command.Item
                      value={`__quicklog__ ${query}`}
                      data-quicklog="true"
                      forceMount
                      onSelect={commitQuickLog}
                      className={cn(
                        "flex items-start gap-2 px-2 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-accent/10 border border-transparent",
                        parsed.missing.length === 0
                          ? "data-[selected=true]:border-accent/40"
                          : "opacity-80",
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {parsed.missing.length === 0 ? (
                            <>
                              Log{" "}
                              <span className="text-accent tabular-nums">
                                {fmtDuration(parsed.hours ?? 0)}
                              </span>{" "}
                              on{" "}
                              <span className="text-accent">{parsed.jobName}</span>
                            </>
                          ) : (
                            <>
                              Quick-log <span className="text-muted-foreground">— missing {parsed.missing.join(", ")}</span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {parsed.date}
                          {parsed.startMinutes !== null && parsed.endMinutes !== null && (
                            <>
                              {" · "}
                              {formatTimeRange(parsed.startMinutes, parsed.endMinutes)}
                            </>
                          )}
                          {parsed.description && (
                            <span className="ml-1 italic text-muted-foreground/80">
                              · {parsed.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <kbd className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                        ↵
                      </kbd>
                    </Command.Item>
                  </Command.Group>
                )}

                <Command.Group className="px-1 py-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-0.5">
                    Pages
                  </div>
                  {NAV_ITEMS.map(({ value, label, icon: Icon, keywords }) => (
                    <Command.Item
                      key={value}
                      value={`${label} ${keywords}`}
                      onSelect={() => go(value)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {items.filter((i) => i.type === "client").length > 0 && (
                  <Command.Group>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5">
                      Clients · jump to new invoice
                    </div>
                    {items
                      .filter((i) => i.type === "client")
                      .map((c) => (
                        <Command.Item
                          key={c.id}
                          value={`${c.title} ${c.subtitle ?? ""}`}
                          onSelect={() => go(c.href)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{c.title}</span>
                          {c.subtitle && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                              {c.subtitle}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                  </Command.Group>
                )}

                {items.filter((i) => i.type === "expense").length > 0 && (
                  <Command.Group>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5">
                      Recent expenses · jump to filter
                    </div>
                    {items
                      .filter((i) => i.type === "expense")
                      .map((c) => (
                        <Command.Item
                          key={c.id}
                          value={`${c.title} ${c.subtitle ?? ""}`}
                          onSelect={() => go(c.href)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                        >
                          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{c.title}</span>
                          {c.subtitle && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {c.subtitle}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                  </Command.Group>
                )}

                <Command.Group>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5">
                    Theme
                  </div>
                  <Command.Item
                    value="theme light"
                    onSelect={() => {
                      setTheme("light");
                      setOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                  >
                    <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                    Switch to light
                  </Command.Item>
                  <Command.Item
                    value="theme dark"
                    onSelect={() => {
                      setTheme("dark");
                      setOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                  >
                    <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                    Switch to dark
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground/70 flex justify-between font-mono tracking-tight">
                <span>↑↓ navigate · ↵ open</span>
                <span>⌘K toggle</span>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}

function formatTimeRange(start: number, end: number): string {
  const s = `${String(Math.floor(start / 60) % 24).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const e = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return end > 1440 ? `${s}–${e} (+next day)` : `${s}–${e}`;
}
