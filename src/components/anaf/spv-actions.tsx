"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "@/lib/icons";
import { cn } from "@/lib/utils";

/*
 * Un rand din lista: tot randul deschide PDF-ul intr-un tab nou. Serverul il
 * marcheaza citit la deschidere; reimprospatam dupa, ca punctul rosu si
 * insigna din meniu sa dispara.
 */
export function MessageRow({
  id,
  unread,
  hasPdf,
  className,
  children,
}: {
  id: string;
  unread: boolean;
  hasPdf: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  if (!hasPdf) return <div className={className}>{children}</div>;
  return (
    <a
      href={`/api/anaf/spv/${id}/pdf`}
      target="_blank"
      rel="noopener"
      onClick={() => unread && setTimeout(() => router.refresh(), 800)}
      className={cn(
        className,
        "transition-colors duration-200 ease-expo hover:bg-secondary/60",
        "focus-visible:outline-none focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      {children}
    </a>
  );
}

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/anaf/spv/read", { method: "POST", body: "{}" }).catch(() => null);
        setBusy(false);
        if (!res?.ok) return toast.error("Couldn't mark them read", { description: "Check your connection and try again." });
        router.refresh();
      }}
    >
      Mark all read
    </Button>
  );
}

/*
 * Sync porneste ajutorul de pe Mac printr-o schema proprie de URL
 * (house-anaf-sync://), inregistrata de tools/anaf-spv-sync/install.sh.
 * Browserul intreaba prima data daca are voie sa-l deschida. Ajutorul nu
 * raspunde paginii direct; pagina asteapta pana cand serverul vede o
 * sincronizare mai noua decat apasarea, cu marja pentru PIN-ul tokenului.
 */
const SCHEME_URL = "house-anaf-sync://run";
const POLL_MS = 2000;
const GIVE_UP_MS = 120_000;

export function SyncButton({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  function start() {
    const pressedAt = Date.now();
    const before = lastSyncedAt ? Date.parse(lastSyncedAt) : 0;
    setSyncing(true);
    window.location.href = SCHEME_URL;

    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const res = await fetch("/api/anaf/spv/status", { cache: "no-store" }).catch(() => null);
      const body = res?.ok ? ((await res.json()) as { syncedAt: string | null; unread: number }) : null;
      const at = body?.syncedAt ? Date.parse(body.syncedAt) : 0;
      if (at > before && at >= pressedAt - 5_000) {
        clearInterval(timer.current);
        setSyncing(false);
        toast.success("Synced with SPV", {
          description: body!.unread > 0 ? `${body!.unread} unread` : "Nothing new to read",
        });
        router.refresh();
      } else if (Date.now() - pressedAt > GIVE_UP_MS) {
        clearInterval(timer.current);
        setSyncing(false);
        toast.error("No answer from your Mac", {
          description: "Plug in the token, enter its PIN if asked, then try again. On a new Mac, run install.sh once.",
        });
      }
    }, POLL_MS);
  }

  return (
    <Button variant="accent" size="sm" onClick={start} disabled={syncing} className="min-w-[96px]">
      <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
      {syncing ? "Syncing…" : "Sync"}
    </Button>
  );
}
