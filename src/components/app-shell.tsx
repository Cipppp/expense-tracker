"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Clock,
  FileText,
  Upload,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronDown,
  Search,
  Broom,
  Sparkle,
  Pill,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { MascotBadge } from "@/components/mascot";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

/*
 * Nine flat links was too many unrelated things in one column — the ledger
 * pages and the household pages have nothing to do with each other, and
 * reading past Invoices to reach Chores made that obvious every single time.
 * They're grouped now, and each group collapses so you can shut the half of
 * the app you're not using today.
 */
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = { id: string; label: string; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/income", label: "Income", icon: Clock },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/investments", label: "Investments", icon: TrendingUp },
      { href: "/import", label: "Import", icon: Upload },
    ],
  },
  {
    id: "household",
    label: "Household",
    items: [
      { href: "/chores", label: "Chores", icon: Broom },
      { href: "/gratitude", label: "Gratitude", icon: Sparkle },
      { href: "/supplements", label: "Supplements", icon: Pill },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: SettingsIcon }],
  },
] as const;

const STORAGE_KEY = "et:sidebar-collapsed";
const GROUPS_KEY = "et:nav-groups-closed";
/* Only Finance is open on a fresh browser — the household pages are a glance,
   not a daily destination, and an open Finance group is what you want when the
   app loads on the Dashboard. */
const DEFAULT_CLOSED = ["household", "system"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Which group owns the current route — that one is never left collapsed. */
function groupOf(pathname: string): string | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => isActive(pathname, i.href))) return g.id;
  }
  return null;
}

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

/** Shared open/closed state for the grouped nav, persisted per group id. */
function useGroupState(pathname: string) {
  const [closed, setClosed] = useState<Set<string>>(
    () => new Set(DEFAULT_CLOSED),
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      // Only an explicit saved choice overrides the default — an absent key
      // means "never touched it", which keeps Finance-only.
      if (raw) setClosed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, []);

  function toggle(id: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const active = groupOf(pathname);
  // The group you're standing in stays open no matter what storage says —
  // otherwise a collapsed group hides the page you're currently on.
  const isOpen = (id: string) => id === active || !closed.has(id);
  return { isOpen, toggle };
}

function NavLink({
  item,
  collapsed,
  pathname,
  size = "sm",
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  size?: "sm" | "lg";
}) {
  const { href, label, icon: Icon } = item;
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md transition-colors duration-200 ease-expo",
        size === "lg" ? "px-3 py-3 text-base" : "text-sm",
        collapsed
          ? "justify-center px-0 py-2"
          : size === "lg"
            ? ""
            : "px-3 py-2",
        active
          ? "bg-accent/10 text-accent-text font-semibold dark:text-accent"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {/* Active rail — a 2px accent tick on the left edge. Reads at a glance
          even when the tinted background is washed out on a bright screen. */}
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-accent"
        />
      )}
      <Icon
        className={cn(
          "shrink-0",
          size === "lg" ? "h-5 w-5" : "h-4 w-4",
          active ? "text-accent" : "text-muted-foreground",
        )}
      />
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
    </Link>
  );
}

function GroupedNav({
  collapsed,
  pathname,
  size = "sm",
}: {
  collapsed: boolean;
  pathname: string;
  size?: "sm" | "lg";
}) {
  const { isOpen, toggle } = useGroupState(pathname);

  // Icon rail: headers would be unreadable at 56px, so groups become clusters
  // separated by a hairline instead.
  if (collapsed) {
    return (
      <>
        {NAV_GROUPS.map((g, i) => (
          <div key={g.id}>
            {i > 0 && <div className="my-2 mx-2 h-px bg-border" />}
            <div className="space-y-1">
              {g.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed
                  pathname={pathname}
                />
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {NAV_GROUPS.map((g) => {
        const open = isOpen(g.id);
        const hasActive = g.items.some((i) => isActive(pathname, i.href));
        return (
          <div key={g.id} className="pb-1">
            <button
              type="button"
              onClick={() => toggle(g.id)}
              aria-expanded={open}
              className={cn(
                "w-full flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                "text-muted-foreground/80 hover:text-foreground transition-colors",
              )}
            >
              <span className="truncate">{g.label}</span>
              {hasActive && !open && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-accent shrink-0"
                />
              )}
              <ChevronDown
                className={cn(
                  "ml-auto h-3 w-3 shrink-0 transition-transform duration-300 ease-expo",
                  open ? "rotate-0" : "-rotate-90",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-expo",
                open
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="space-y-0.5 pt-0.5">
                  {g.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      collapsed={false}
                      pathname={pathname}
                      size={size}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "font-display font-extrabold tracking-[-0.03em] leading-none truncate",
          size === "lg" ? "text-lg" : "text-base",
        )}
        style={{ fontVariationSettings: '"wdth" 92' }}
      >
        house cefani
        <span
          aria-hidden="true"
          className="ml-[0.08em] inline-block h-[0.22em] w-[0.22em] rounded-full bg-accent align-baseline"
        />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground uppercase tracking-[0.07em] truncate">
        Project CIP SRL
      </div>
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
    /*
     * Two elements, not one: the outer div stretches to the full flex height
     * so the card surface runs the whole page, while the inner aside sticks
     * at 100dvh. Collapsing them into one sticky aside leaves the page
     * background showing below the fold on any page taller than the viewport.
     */
    <div
      className={cn(
        "hidden md:block shrink-0 border-r border-border bg-card",
        "transition-[width] duration-300 ease-expo",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <aside className="sticky top-0 h-[100dvh] flex flex-col">
        {/* Brand row — Cefi, the wordmark, and the collapse chevron inline so
          the toggle stays in the user's line of sight. Collapsed, the mark
          itself becomes the expand button. */}
        <div
          className={cn(
            "py-5 transition-[padding] duration-300 ease-expo flex items-center",
            collapsed ? "px-2 justify-center" : "px-4 justify-between gap-2",
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
            >
              <MascotBadge className="h-7 w-7" />
            </button>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2.5 min-w-0">
                <MascotBadge className="h-9 w-9 shrink-0" />
                <Wordmark />
              </Link>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="shrink-0 -mr-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <Separator />
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          <SearchTrigger collapsed={collapsed} />
          <div className={cn(collapsed ? "pt-1" : "pt-2", "space-y-1")}>
            <GroupedNav collapsed={collapsed} pathname={pathname} />
          </div>
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
    </div>
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
        collapsed
          ? "justify-center px-0 py-2"
          : "px-3 py-2 border border-border bg-background/60",
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
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <MascotBadge className="h-8 w-8 shrink-0" />
          <Wordmark size="sm" />
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
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <MascotBadge className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <SheetTitle
            className="font-display font-extrabold tracking-[-0.03em] text-lg leading-none"
            style={{ fontVariationSettings: '"wdth" 92' }}
          >
            house cefani
            <span
              aria-hidden="true"
              className="ml-[0.08em] inline-block h-[0.22em] w-[0.22em] rounded-full bg-accent"
            />
          </SheetTitle>
          <SheetDescription className="uppercase tracking-[0.07em] text-[10px] mt-1">
            Project CIP SRL
          </SheetDescription>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <GroupedNav collapsed={false} pathname={pathname} size="lg" />
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
