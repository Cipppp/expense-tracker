"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Upload, WarningCircle } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { isFiled, locksResend, stateLabel } from "@/lib/anaf/scope";
import type { EfacturaStatus } from "@/lib/anaf/status";

/*
 * Panoul e-Factura de pe pagina facturii. Ce ar arata Oblio in coloana
 * "e-Factura", dar cu motivele la vedere: scopul legal, termenul, blocajele
 * locale inainte de trimitere, mesajele ANAF verbatim dupa.
 *
 * Mediul conteaza: o trimitere reusita pe TEST nu e o depunere. Blocarea
 * butonului si stingerea termenului se judeca pe acelasi mediu ca serverul
 * (`locksResend`), iar "depus" inseamna doar `ok` pe prod.
 */

const TONE: Record<ReturnType<typeof stateLabel>["tone"], "secondary" | "warning" | "success" | "destructive" | "accent"> = {
  muted: "secondary",
  warn: "warning",
  ok: "success",
  bad: "destructive",
  busy: "accent",
};

export function EfacturaPanel({
  invoiceId,
  label,
  initial,
}: {
  invoiceId: string;
  label: string;
  initial: EfacturaStatus;
}) {
  const router = useRouter();
  const [st, setSt] = useState<EfacturaStatus>(initial);
  const [busy, setBusy] = useState<"send" | "refresh" | null>(null);

  /*
   * Ceasul ca stare, nu citit în timpul randării.
   *
   * `stuck` de mai jos înseamnă „a trecut un minut de la upload și n-a venit
   * indexul”. Citit cu `Date.now()` direct în randare, ieșeau două probleme:
   * serverul și clientul ajungeau la valori diferite la hidratare, iar apoi
   * cifra rămânea înghețată — se actualiza doar când se întâmpla să se
   * re-randeze componenta din altă cauză. Mergea din noroc, pentru că
   * interogarea de stare de mai jos re-randa oricum la 15 secunde.
   *
   * Pornește de la 0, deci `stuck` e fals la prima randare, la fel pe server
   * și pe client. Prima bătaie vine după cinci secunde.
   */
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const sub = st.submission;
  const state = sub?.state ?? null;
  const sameEnv = Boolean(sub && sub.env === st.env);
  const locked = locksResend(sub ? { state: sub.state, env: sub.env } : null, st.env);
  // "uploading" fara index, mai vechi de un minut: upload-ul a plecat dar
  // raspunsul nu a ajuns (functie omorata). Se impaca cu ANAF, nu se retrimite.
  const stuck =
    sameEnv &&
    state === "uploading" &&
    !sub?.indexIncarcare &&
    (sub ? now - new Date(sub.createdAt).getTime() > 60_000 : false);
  const inFlight = sameEnv && (state === "in_prelucrare" || (state === "uploading" && !stuck));
  const legallyFiled = Boolean(sub && sub.env === "prod" && isFiled(sub.state)) || Boolean(st.viaOblio);
  const lbl = stateLabel(state, { hasErrors: stuck || (sub?.errors.length ?? 0) > 0 });
  const overdue = st.workingDaysLeft != null && st.workingDaysLeft < 0 && !legallyFiled;
  const canCall = st.configured && st.connected && !st.needsReauth;

  const refresh = useCallback(
    async (quiet = false) => {
      setBusy("refresh");
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/efactura/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as EfacturaStatus;
        setSt(next);
        if (!quiet) {
          const l = stateLabel(next.submission?.state, { hasErrors: (next.submission?.errors.length ?? 0) > 0 });
          toast.message(`${label} · ${l.text}`);
        }
        return next;
      } catch (err) {
        if (!quiet) toast.error(`${label} — could not refresh`, { description: err instanceof Error ? err.message : undefined });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [invoiceId, label],
  );

  // Pe drum? Mai intrebam de cateva ori, rar, cat e pagina deschisa.
  useEffect(() => {
    if (!inFlight || !canCall) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const next = await refresh(true);
      const s = next?.submission?.state;
      if (tries >= 6 || (s && s !== "in_prelucrare" && s !== "uploading")) clearInterval(t);
    }, 15_000);
    return () => clearInterval(t);
  }, [inFlight, canCall, refresh]);

  async function send(force: boolean) {
    if (force && !confirm(`${label} is outside the mandatory e-Factura scope. Send it anyway with extern=DA?`)) return;
    setBusy("send");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/efactura/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Un 504 de la Vercel sau "upload_unknown" nu e un verdict ANAF: nu
        // afirmam o respingere; refresh-ul de dupa arata starea reala.
        const unknown = res.status >= 500 || typeof data?.code !== "string" || data.code === "upload_unknown";
        if (unknown) {
          toast.message(`${label} — server did not answer in time; checking with ANAF`, {
            description: typeof data?.error === "string" ? data.error : undefined,
          });
        } else {
          toast.error(`${label} — ANAF did not take it`, {
            description: Array.isArray(data?.details) && data.details.length ? data.details[0] : data?.error,
          });
        }
      } else if (data.already) {
        toast.message(`${label} · already ${stateLabel(data.submission?.state).text.toLowerCase()}`);
      } else {
        const l = stateLabel(data.submission?.state);
        const fn = l.tone === "bad" ? toast.error : l.tone === "ok" ? toast.success : toast.message;
        fn(`${label} · ${l.text}`, {
          description: data.submission?.indexIncarcare ? `index_incarcare ${data.submission.indexIncarcare}` : undefined,
        });
      }
    } catch (err) {
      // Functia poate fi mers mai departe pe server: resincronizam oricum.
      toast.error(`${label} — could not reach the server`, { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
      await refresh(true);
      router.refresh();
    }
  }

  const sendButton = (() => {
    if (!st.configured) {
      return (
        <Button variant="outline" asChild>
          <a href="/settings">Connect ANAF in Settings</a>
        </Button>
      );
    }
    if (!st.connected || st.needsReauth) {
      return (
        <Button variant="outline" asChild>
          <a href="/settings">{st.needsReauth ? "Reconnect ANAF (certificate)" : "Connect ANAF (certificate)"}</a>
        </Button>
      );
    }
    if (locked) return null;
    const disabled = busy !== null || st.blockers.length > 0;
    const title = st.blockers.length ? "Fix the issues above first" : undefined;
    if (st.scope === "required" || st.policy === "send") {
      return (
        <Button variant="accent" disabled={disabled} onClick={() => send(false)} title={title}>
          <Upload className={cn("h-3.5 w-3.5", busy === "send" && "animate-pulse")} />
          {busy === "send" ? "Sending…" : sameEnv && state ? "Send again" : "Send to ANAF"}
        </Button>
      );
    }
    return (
      <Button variant="outline" disabled={disabled} onClick={() => send(true)} title={title}>
        <Upload className={cn("h-3.5 w-3.5", busy === "send" && "animate-pulse")} />
        {busy === "send" ? "Sending…" : "Send anyway (extern=DA)"}
      </Button>
    );
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.07em] text-muted-foreground">e-Factura</span>
        <Badge variant={TONE[lbl.tone]} className="text-[10px]">
          {lbl.text}
          {sub && !sameEnv ? ` · ${sub.env}` : ""}
        </Badge>
        {st.env !== "prod" && (
          <Badge variant="warning" className="text-[10px]">
            TEST · api.anaf.ro/test
          </Badge>
        )}
        {st.viaOblio && (
          <Badge variant="outline" className="text-[10px]">
            via Oblio · {st.viaOblio}
          </Badge>
        )}
        {sub?.extern && (
          <Badge variant="outline" className="text-[10px]">
            extern=DA
          </Badge>
        )}
        {sub?.indexIncarcare && (
          <span className="font-mono text-[11px] text-muted-foreground">#{sub.indexIncarcare}</span>
        )}
      </div>

      <p className="text-[12.5px] text-muted-foreground">
        {st.scope === "required" ? (
          <>
            Mandatory — {st.reason}.{" "}
            {st.deadline && !legallyFiled && (
              <span className={cn(overdue && "text-destructive font-medium")}>
                {overdue
                  ? `Deadline passed ${-st.workingDaysLeft!} working day${-st.workingDaysLeft! === 1 ? "" : "s"} ago.`
                  : `Due in ${st.workingDaysLeft} working day${st.workingDaysLeft === 1 ? "" : "s"}.`}
              </span>
            )}
          </>
        ) : (
          <>Optional — {st.reason}.</>
        )}
      </p>

      {st.blockers.length > 0 && !locked && (
        <ul className="rounded-md border border-warning/40 bg-warning/10 p-3 text-[12.5px] space-y-1">
          {st.blockers.map((b) => (
            <li key={b} className="flex gap-2">
              <WarningCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {sub && sub.errors.length > 0 && (
        <ul
          className={cn(
            "rounded-md border p-3 text-[12.5px] space-y-1 font-mono break-words",
            stuck ? "border-warning/40 bg-warning/10" : "border-destructive/40 bg-destructive/10",
          )}
        >
          {sub.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {sendButton}

        {canCall && sub && (
          <Button variant="ghost" disabled={busy !== null} onClick={() => refresh(false)}>
            <RefreshCw className={cn("h-3.5 w-3.5", busy === "refresh" && "animate-spin")} />
            {stuck ? "Check with ANAF" : "Refresh"}
          </Button>
        )}

        {sub?.archived && (
          <>
            <Button variant="outline" asChild>
              <a href={`/api/invoices/${invoiceId}/efactura/archive?file=zip`}>
                <Download className="h-3.5 w-3.5" />
                ANAF zip
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <a href={`/api/invoices/${invoiceId}/efactura/archive?file=xml`}>
                {state === "nok" || state === "xml_nepreluat" ? "Error report" : "Original XML"}
              </a>
            </Button>
            {state === "ok" && (
              <Button variant="ghost" asChild>
                <a href={`/api/invoices/${invoiceId}/efactura/archive?file=sig`}>MF signature</a>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
