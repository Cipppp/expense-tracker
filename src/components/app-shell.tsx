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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]">
      <CommandPalette />
      <DesktopSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileHeader />
        <div className="px-4 md:px-10 py-6 md:py-8 max-w-[1400px] animate-fade-in flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/50 sticky top-0 h-[100dvh] self-start">
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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
      <div className="px-3 py-3 space-y-2">
        <ThemeToggle variant="labeled" />
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
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
