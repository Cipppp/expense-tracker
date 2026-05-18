"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Upload,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
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
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
                  className={cn("h-4 w-4", active ? "text-accent" : "text-muted-foreground")}
                />
                {label}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <form action="/api/auth/logout" method="post" className="px-3 py-4">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </aside>

      <main className="flex-1 min-w-0">
        <MobileNav />
        <div className="px-6 md:px-10 py-8 max-w-[1400px] animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <div className="md:hidden sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-display text-lg leading-none">
          expense tracker
        </Link>
      </div>
      <nav className="flex overflow-x-auto px-2 pb-2 gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs whitespace-nowrap",
                active
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
