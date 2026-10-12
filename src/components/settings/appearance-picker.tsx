"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Check } from "@/lib/icons";
import { useHydrated } from "@/lib/use-hydrated";
import { setThemePreview } from "@/components/theme-style";
import {
  ACCENT_SWATCHES,
  THEME_IDS,
  THEMES,
  themeCss,
  themePreview,
  type ThemeChoice,
  type ThemeId,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark";

/*
 * Alegerea temei se vede imediat si se salveaza singura: aici nu completezi
 * un formular, te uiti la culori. Un buton „Save" ar insemna sa aplici o tema
 * ca s-o vezi si apoi sa-ti amintesti s-o si pastrezi.
 *
 * Clicurile rapide pe teme se strang intr-o singura salvare, iar raspunsurile
 * venite in alta ordine decat cererile sunt ignorate, ca tema salvata sa fie
 * mereu ultima aleasa.
 */
export function AppearancePicker({ initial }: { initial: ThemeChoice }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const mode: Mode = useHydrated() && resolvedTheme === "dark" ? "dark" : "light";

  const [choice, setChoice] = useState<ThemeChoice>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef<ThemeChoice>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 2400);
    return () => clearTimeout(t);
  }, [status]);

  function apply(next: ThemeChoice, delay: number) {
    setChoice(next);
    setThemePreview(themeCss(next));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), delay);
  }

  async function save(next: ThemeChoice) {
    const mine = ++seq.current;
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => null);
    if (mine !== seq.current) return;

    if (!res?.ok) {
      setChoice(saved.current);
      setThemePreview(themeCss(saved.current));
      setStatus("idle");
      toast.error("Couldn't save the theme", {
        description: "Your previous colors are back. Check your connection and try again.",
      });
      return;
    }
    saved.current = next;
    setStatus("saved");
    router.refresh();
  }

  const customIsPreset = ACCENT_SWATCHES.some((s) => s.hex === choice.accent);
  const custom = choice.accent && !customIsPreset ? choice.accent : "";

  return (
    <div className="space-y-7">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Theme</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_IDS.map((id) => (
            <ThemeOption
              key={id}
              id={id}
              mode={mode}
              checked={choice.preset === id}
              onSelect={() => apply({ ...choice, preset: id }, 150)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Accent</legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          Marks what&rsquo;s active and selected. Buttons keep the theme&rsquo;s color.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <label
            className={cn(
              "flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm",
              "transition-colors duration-200 ease-expo hover:bg-secondary",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
              !choice.accent ? "border-foreground/60 font-medium" : "border-border text-muted-foreground",
            )}
          >
            <input
              type="radio"
              name="accent"
              className="sr-only"
              checked={!choice.accent}
              onChange={() => apply({ ...choice, accent: "" }, 150)}
            />
            <span
              aria-hidden
              className="h-3 w-3 rounded-full"
              style={{ background: themePreview(choice.preset, mode).accent }}
            />
            Theme&rsquo;s own
          </label>

          {ACCENT_SWATCHES.map((s) => (
            <Swatch
              key={s.hex}
              color={s.hex}
              name={s.name}
              checked={choice.accent === s.hex}
              onSelect={() => apply({ ...choice, accent: s.hex }, 150)}
            />
          ))}

          <label
            title="Pick any color"
            className={cn(
              "relative grid h-8 w-8 cursor-pointer place-items-center rounded-full",
              "ring-offset-2 ring-offset-card transition-shadow duration-200 ease-expo",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              custom && "ring-2 ring-foreground/70",
            )}
            style={{
              background:
                custom ||
                "conic-gradient(from 90deg, #f24b1a, #d97706, #16a34a, #0d9488, #0284c7, #7c3aed, #e11d74, #f24b1a)",
            }}
          >
            <input
              type="color"
              aria-label="Custom accent color"
              value={custom || "#f24b1a"}
              onChange={(e) => apply({ ...choice, accent: e.target.value.toLowerCase() }, 400)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>

          {custom && (
            <span className="font-mono text-xs uppercase tabular-nums text-muted-foreground">
              {custom}
            </span>
          )}
        </div>
      </fieldset>

      <p aria-live="polite" className="h-4 text-xs text-muted-foreground">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved to your account" : ""}
      </p>
    </div>
  );
}

function ThemeOption({
  id,
  mode,
  checked,
  onSelect,
}: {
  id: ThemeId;
  mode: Mode;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-2",
        "transition-[border-color,box-shadow] duration-200 ease-expo",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
        checked
          ? "border-action shadow-[0_0_0_1px_hsl(var(--action))]"
          : "border-border hover:border-foreground/25",
      )}
    >
      <input type="radio" name="theme" value={id} checked={checked} onChange={onSelect} className="sr-only" />
      <ThemeThumb id={id} mode={mode} />
      <span className="mt-2 flex items-center justify-between px-1 pb-0.5">
        <span className="text-sm font-medium">{THEMES[id].name}</span>
        <span
          aria-hidden
          className={cn(
            "grid h-4 w-4 place-items-center rounded-full bg-action text-action-foreground",
            "transition-[opacity,transform] duration-300 ease-expo",
            checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        >
          <Check className="h-2.5 w-2.5" />
        </span>
      </span>
    </label>
  );
}

/**
 * Miniatura unei teme, desenata cu culorile ei, nu cu ale paginii: meniul cu
 * elementul activ in accent, un card cu grafic in scara categoriilor si un
 * buton. E ce vei vedea, nu o paleta abstracta de cercuri.
 */
function ThemeThumb({ id, mode }: { id: ThemeId; mode: Mode }) {
  const p = themePreview(id, mode);
  const bars = [0.5, 0.78, 0.42, 0.95, 0.66];
  return (
    <div
      aria-hidden
      className="relative aspect-[16/10] overflow-hidden rounded-lg"
      style={{ background: p.background }}
    >
      <div className="absolute inset-y-2.5 left-2.5 w-[27%] space-y-1.5">
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: p.border }} />
        <div className="flex items-center gap-1 rounded px-1 py-[3px]" style={{ background: p.accentSoft }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.accent }} />
          <span className="h-1 flex-1 rounded-full" style={{ background: p.accent }} />
        </div>
        <div className="h-1.5 w-2/3 rounded-full" style={{ background: p.border }} />
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: p.border }} />
      </div>
      <div
        className="absolute inset-y-2.5 right-2.5 flex flex-col rounded-md border p-1.5"
        style={{ left: "calc(27% + 1.1rem)", background: p.card, borderColor: p.border }}
      >
        <div className="flex flex-1 items-end gap-[3px]">
          {p.ramp.map((c, i) => (
            <div key={i} className="flex-1 rounded-[2px]" style={{ background: c, height: `${bars[i] * 100}%` }} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-end">
          <span className="h-2 w-6 rounded-full" style={{ background: p.action }} />
        </div>
      </div>
    </div>
  );
}

function Swatch({
  color,
  name,
  checked,
  onSelect,
}: {
  color: string;
  name: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      title={name}
      className={cn(
        "h-8 w-8 cursor-pointer rounded-full ring-offset-2 ring-offset-card",
        "transition-[box-shadow,transform] duration-200 ease-expo hover:scale-105",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked && "ring-2 ring-foreground/70",
      )}
      style={{ background: color }}
    >
      <input
        type="radio"
        name="accent"
        aria-label={name}
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
    </label>
  );
}
