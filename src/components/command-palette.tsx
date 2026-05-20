"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/icons";
import { useTheme } from "next-themes";
import { fmtRate } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { value: "/", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { value: "/expenses", label: "Expenses", icon: Receipt, keywords: "spending" },
  { value: "/income", label: "Income", icon: TrendingUp, keywords: "hours timer earnings" },
  { value: "/invoices", label: "Invoices", icon: FileText, keywords: "factura billing" },
  { value: "/invoices/new", label: "New invoice", icon: Plus, keywords: "create factura" },
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

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Recent[]>([]);
  const [loaded, setLoaded] = useState(false);

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
        if (jobRes && jobRes.ok) {
          const { jobs } = await jobRes.json();
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
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Command.Input
                  placeholder="Search expenses, clients, pages…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  esc
                </kbd>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-1">
                <Command.Empty className="px-3 py-6 text-sm text-muted-foreground text-center">
                  No matches.
                </Command.Empty>

                <Command.Group heading="Navigate" className="px-1 py-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-0.5">
                    Pages
                  </div>
                  {NAV_ITEMS.map(({ value, label, icon: Icon, keywords }) => (
                    <Command.Item
                      key={value}
                      value={`${label} ${keywords}`}
                      onSelect={() => go(value)}
                      className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {items.filter((i) => i.type === "client").length > 0 && (
                  <Command.Group heading="Clients">
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
                          className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
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
                  <Command.Group heading="Recent expenses">
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
                          className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
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

                <Command.Group heading="Theme">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-0.5">
                    Theme
                  </div>
                  <Command.Item
                    value="theme light"
                    onSelect={() => {
                      setTheme("light");
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
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
                    className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-secondary"
                  >
                    <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                    Switch to dark
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground flex justify-between">
                <span>↑↓ to navigate, ↵ to open</span>
                <span>
                  <kbd className="font-mono">⌘K</kbd> to toggle
                </span>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
