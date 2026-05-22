"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  FileText,
  Upload,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Search,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const STORAGE_KEY = "et:sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Start uncollapsed; hydrate from localStorage on mount. Avoids the SSR
  // layout shift that would happen if we tried to read storage during SSR.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      // private mode / SSR boundary — fall through to default
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-[100dvh]">
      <CommandPalette />
      <DesktopSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileHeader />
        <div className="px-4 md:px-10 py-6 md:py-8 max-w-[1400px] animate-fade-in flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

function DesktopSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-border bg-card/50 sticky top-0 h-[100dvh] self-start",
        "transition-[width] duration-300 ease-expo",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Brand row — the chevron toggle sits inline with the wordmark so
          it stays in the user's line of sight. When collapsed, the toggle
          becomes the only thing visible up top (clicking expands again). */}
      <div
        className={cn(
          "py-6 transition-[padding] duration-300 ease-expo flex items-start",
          collapsed ? "px-2 justify-center" : "px-5 justify-between gap-2",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <Link href="/" className="block min-w-0">
              <div className="font-display text-xl tracking-tight leading-none truncate">
                expense tracker
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground uppercase tracking-[0.15em] truncate">
                Project CIP SRL
              </div>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="shrink-0 -mr-1 mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <Separator />
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <SearchTrigger collapsed={collapsed} />
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm transition-colors duration-200 ease-expo",
                collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
                active
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              />
              <span className={cn("truncate", collapsed && "sr-only")}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div
        className={cn(
          "py-3 space-y-2 transition-[padding] duration-300 ease-expo",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <ThemeToggle variant="icon" />
          </div>
        ) : (
          <ThemeToggle variant="labeled" />
        )}
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
              collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "sr-only")}>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

/**
 * Surfaces the Cmd+K palette in the sidebar so newcomers actually find it.
 * Dispatches a synthetic keydown so we don't have to wire a context just
 * for this one consumer.
 */
function SearchTrigger({ collapsed }: { collapsed: boolean }) {
  function open() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      title={collapsed ? "Search or quick-log (⌘K)" : undefined}
      className={cn(
        "w-full flex items-center gap-3 rounded-md text-sm transition-colors duration-200 ease-expo",
        "text-muted-foreground hover:bg-secondary hover:text-foreground",
        collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className={cn("flex-1 text-left truncate", collapsed && "sr-only")}>
        Search
      </span>
      {!collapsed && (
        <span className="font-mono text-[10px] tracking-tight text-muted-foreground/70">
          ⌘K
        </span>
      )}
    </button>
  );
}

function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="md:hidden sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="block">
          <div className="font-display text-lg leading-none tracking-tight">
            expense tracker
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
            Project CIP SRL
          </div>
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="h-11 w-11 inline-flex items-center justify-center rounded-md text-foreground hover:bg-secondary transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent>
            <MobileMenu />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function MobileMenu() {
  const pathname = usePathname();
  return (
    <>
      <div className="px-5 pt-6 pb-2">
        <SheetTitle>expense tracker</SheetTitle>
        <SheetDescription className="uppercase tracking-[0.15em] text-[10px]">
          Project CIP SRL
        </SheetDescription>
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-3 text-base transition-colors duration-200 ease-expo",
                active
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="px-3 py-4 space-y-2 safe-bottom">
        <ThemeToggle variant="labeled" />
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors h-11"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
