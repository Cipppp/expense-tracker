"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  FileText,
  Upload,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]">
      <CommandPalette />
      <DesktopSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileHeader />
        <div className="px-4 md:px-10 py-6 md:py-8 max-w-[1400px] animate-fade-in flex-1 pb-24 md:pb-8">
          {children}
        </div>
        <MobileTabBar />
      </main>
    </div>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/50">
      <div className="px-5 py-6">
        <Link href="/" className="block">
          <div className="font-display text-xl tracking-tight leading-none">
            expense tracker
          </div>
          <div className="mt-1 text-xs text-muted-foreground uppercase tracking-[0.15em]">
            Project CIP SRL
          </div>
        </Link>
      </div>
      <Separator />
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200 ease-expo",
                active
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="flex items-center justify-between px-3 py-3">
        <form action="/api/auth/logout" method="post" className="flex-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MobileHeader() {
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
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur safe-bottom"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5 pb-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={cn(
                "flex flex-col items-center gap-0.5 flex-1 min-w-0 py-2 rounded-md transition-all duration-200 ease-expo",
                active ? "text-accent" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-200 ease-expo",
                  active && "scale-110",
                )}
              />
              <span className="text-[10px] font-medium leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
