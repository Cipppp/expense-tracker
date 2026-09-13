"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, RefreshCw, Trash2 } from "@/lib/icons";

/*
 * Legatura cu ANAF: cand a fost facuta, cu ce certificat, cat mai tine.
 *
 * "Connect" trebuie apasat din browserul cu certificatul/tokenul USB:
 * logincert.anaf.ro il cere la TLS. Dupa aia aplicatia se descurca singura
 * un an (refresh token), cu access token reimprospatat automat de cron.
 */

export type AnafStatusView = {
  configured: boolean;
  missing: string[];
  env: "test" | "prod";
  redirectUri: string;
  connected: boolean;
  level: "ok" | "warn" | "error" | "none";
  needsReauth: boolean;
  certSerial: string | null;
  obtainedAt: string | null;
  refreshedAt: string | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  accessDaysLeft: number | null;
  refreshDaysLeft: number | null;
  lastHealthOk: string | null;
  lastError: string | null;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function AnafConnectionCard({
  status,
  notice,
}: {
  status: AnafStatusView;
  /** ?anaf= din URL dupa callback: connected | failed | denied | stale */
  notice: { result: string | null; reason: string | null };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!notice.result) return;
    if (notice.result === "connected") toast.success("Connected to ANAF e-Factura");
    else if (notice.result === "stale") toast.error("ANAF login took too long — start again from this page");
    else toast.error("ANAF connection failed", { description: notice.reason ?? undefined });
    // Curatam URL-ul ca refresh-ul sa nu repete toastul.
    router.replace("/settings");
  }, [notice.result, notice.reason, router]);

  async function disconnect() {
    if (!confirm("Disconnect from ANAF? Sending invoices will need the certificate again.")) return;
    setPending(true);
    try {
      const res = await fetch("/api/anaf/disconnect", { method: "POST" });
      if (res.ok) {
        toast.success("Disconnected from ANAF");
        router.refresh();
      } else toast.error("Could not disconnect");
    } catch {
      toast.error("Could not disconnect");
    } finally {
      setPending(false);
    }
  }

  const badge =
    !status.configured
      ? { v: "secondary" as const, t: "Not configured" }
      : !status.connected
        ? { v: "secondary" as const, t: "Not connected" }
        : status.level === "error"
          ? { v: "destructive" as const, t: "Reconnect needed" }
          : status.level === "warn"
            ? { v: "warning" as const, t: "Connected · attention" }
            : { v: "success" as const, t: "Connected" };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.v} className="text-[10px]">
          {badge.t}
        </Badge>
        <Badge variant={status.env === "prod" ? "outline" : "warning"} className="text-[10px]">
          {status.env === "prod" ? "PROD · api.anaf.ro/prod" : "TEST · api.anaf.ro/test"}
        </Badge>
      </div>

      {!status.configured ? (
        <div className="space-y-2 text-muted-foreground">
          <p>Missing on this deployment: <span className="font-mono text-foreground">{status.missing.join(", ")}</span>.</p>
          <ol className="list-decimal pl-5 space-y-1 text-[13px]">
            <li>
              Create the developer account at{" "}
              <a className="text-accent underline-offset-4 hover:underline" href="https://www.anaf.ro/InregOauth/index.xhtml" target="_blank" rel="noreferrer">
                anaf.ro/InregOauth
              </a>{" "}
              (username + password, email code).
            </li>
            <li>
              „Editare profil Oauth” → „Gestionare aplicații” → new app, service <b>E-Factura</b>, Callback URL{" "}
              <span className="font-mono text-foreground break-all">{status.redirectUri || "ANAF_REDIRECT_URI"}</span>. The callback cannot be edited later.
            </li>
            <li>Copy Client ID / Client Secret into Vercel env, plus <span className="font-mono">ANAF_TOKEN_ENC_KEY</span> (<span className="font-mono">openssl rand -base64 32</span>). Redeploy.</li>
          </ol>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[12.5px]">
            <div>
              <dt className="text-muted-foreground">Certificate serial</dt>
              <dd className="font-mono break-all">{status.certSerial ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Authorized</dt>
              <dd>{fmt(status.obtainedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Access token</dt>
              <dd>
                {fmt(status.accessExpiresAt)}
                {status.accessDaysLeft != null && (
                  <span className="text-muted-foreground"> · {status.accessDaysLeft}d</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Refresh token</dt>
              <dd className={status.refreshDaysLeft != null && status.refreshDaysLeft < 30 ? "text-destructive" : undefined}>
                {fmt(status.refreshExpiresAt)}
                {status.refreshDaysLeft != null && (
                  <span className="text-muted-foreground"> · {status.refreshDaysLeft}d</span>
                )}
              </dd>
            </div>
          </dl>

          {status.lastError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-[12.5px] font-mono break-words">
              {status.lastError}
            </p>
          )}

          <p className="text-[12.5px] text-muted-foreground">
            {status.connected
              ? "The access token is renewed automatically. Once a year the refresh token expires and you connect again with the certificate."
              : "Plug in the certificate token, then connect. ANAF asks the browser for the certificate and the PIN, then sends you back here."}
          </p>

          <div className="flex flex-wrap gap-2">
            {/*
              POST, nu link: /api/anaf/oauth/start refuza GET-ul tocmai ca o
              pagina straina sa nu poata porni fluxul in browserul tau.
              Formularul clasic pastreaza navigarea de nivel superior de care
              are nevoie redirectul 303 spre ANAF.
            */}
            <form method="post" action="/api/anaf/oauth/start">
              <Button type="submit" variant={status.connected && status.level !== "error" ? "outline" : "accent"}>
                <Fingerprint className="h-3.5 w-3.5" />
                {status.connected ? "Reconnect with certificate" : "Connect with certificate"}
              </Button>
            </form>
            {status.connected && (
              <>
                <Button variant="ghost" onClick={() => router.refresh()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={disconnect}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
