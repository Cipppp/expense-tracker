"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Single-button theme toggle. One click flips light ↔ dark. Long-press or
 * shift-click resets to system (rare power-user shortcut, no UI).
 */
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "labeled";
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const next = isDark ? "light" : "dark";

  function onClick(e: React.MouseEvent) {
    if (e.shiftKey) {
      setTheme("system");
      return;
    }
    setTheme(next);
  }

  if (variant === "labeled") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        className={cn("w-full justify-start gap-3 h-11", className)}
        aria-label={`Switch to ${next} mode`}
        title={`Switch to ${next} mode (shift-click for system)`}
      >
        <span className="relative inline-flex items-center justify-center w-5 h-5">
          <Sun
            className={cn(
              "h-4 w-4 absolute transition-all duration-300 ease-expo",
              isDark
                ? "scale-0 rotate-90 opacity-0"
                : "scale-100 rotate-0 opacity-100",
            )}
          />
          <Moon
            className={cn(
              "h-4 w-4 absolute transition-all duration-300 ease-expo",
              isDark
                ? "scale-100 rotate-0 opacity-100"
                : "scale-0 -rotate-90 opacity-0",
            )}
          />
        </span>
        <span className="text-sm">{isDark ? "Dark mode" : "Light mode"}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode (shift-click for system)`}
      className={cn(
        "text-muted-foreground hover:text-foreground relative",
        className,
      )}
    >
      <span className="relative inline-flex items-center justify-center w-4 h-4">
        <Sun
          className={cn(
            "h-4 w-4 absolute transition-all duration-300 ease-expo",
            isDark
              ? "scale-0 rotate-90 opacity-0"
              : "scale-100 rotate-0 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "h-4 w-4 absolute transition-all duration-300 ease-expo",
            isDark
              ? "scale-100 rotate-0 opacity-100"
              : "scale-0 -rotate-90 opacity-0",
          )}
        />
      </span>
    </Button>
  );
}
