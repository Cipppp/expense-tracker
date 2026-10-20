import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { describeSpv, isCnp, maskCnp, type SpvTone } from "@/lib/spv";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FilePdf, WarningCircle } from "@/lib/icons";
import { MarkAllRead, MessageLink } from "@/components/anaf/spv-actions";

export const dynamic = "force-dynamic";

/*
 * Tot ce a pus ANAF in SPV, fara sa intri in SPV: recipise, notificari,
 * decizii, raspunsuri la cereri. Mesajele le aduce `tools/anaf-spv-sync` de
 * pe Mac-ul cu tokenul (SPV cere certificatul, iar cheia nu iese de pe token);
 * aici doar le citesti. Termenele vin din textul notificarilor.
 */

const TONE: Record<SpvTone, string> = {
  ok: "text-foreground",
  info: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action", label: "Needs attention" },
] as const;

export default async function AnafPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "all" } = await searchParams;
  const [rows, settings] = await Promise.all([
    db.spvMessage.findMany({
      orderBy: [{ anafCreatedAt: "desc" }, { anafId: "desc" }],
      select: {
        id: true, anafId: true, cif: true, kind: true, details: true,
        anafCreatedAt: true, readAt: true, createdAt: true, pdf: false,
      },
    }),
    getSettings(),
  ]);
  const withPdf = new Set(
    (await db.spvMessage.findMany({ where: { NOT: { pdf: null } }, select: { id: true } })).map((r) => r.id),
  );

  /* Firma ta are doua coduri: CIF-ul si codul de TVA pe art. 317, fara "RO". */
  const own = new Map<string, string>();
  if (settings.issuerCif) own.set(settings.issuerCif.replace(/\D/g, ""), settings.issuerName || "Your company");
  if (settings.issuerVatIntra) own.set(settings.issuerVatIntra.replace(/\D/g, ""), settings.issuerName || "Your company");
  const entity = (cif: string) => (isCnp(cif) ? `Personal · ${maskCnp(cif)}` : own.get(cif) ?? `CIF ${cif}`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const items = rows.map((r) => ({ ...r, info: describeSpv(r.kind, r.details, r.anafCreatedAt) }));
  const due = items.filter(
    (m) => m.info.deadline && m.info.deadline.getTime() >= today.getTime() && (m.info.tone === "danger" || m.info.tone === "warn"),
  );
  const unread = items.filter((m) => !m.readAt).length;
  const shown = items.filter((m) =>
    f === "unread" ? !m.readAt : f === "action" ? m.info.tone === "danger" || m.info.tone === "warn" : true,
  );
  const lastSync = rows.reduce<Date | null>((a, r) => (!a || r.createdAt > a ? r.createdAt : a), null);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground">ANAF</div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">SPV messages</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lastSync ? <>Last synced {fmtDate(lastSync)} from your Mac.</> : <>Nothing synced yet.</>}{" "}
            {unread > 0 && <span className="text-foreground">{unread} unread.</span>}
          </p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </header>

      {due.length > 0 && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {due.map((m) => (
            <div key={m.id} className="flex items-start gap-3">
              <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <span className="font-medium">{m.info.title}</span>
                <span className="text-muted-foreground">
                  {" "}· {entity(m.cif)} · reply by <span className="text-foreground tabular-nums">{fmtDate(m.info.deadline!)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <nav className="flex gap-1.5 text-sm" aria-label="Filter">
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            href={x.id === "all" ? "/anaf" : `/anaf?f=${x.id}`}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors duration-200 ease-expo",
              f === x.id ? "border-foreground/60 font-medium" : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No SPV messages yet.</p>
          <p className="mt-1">
            SPV only talks to your qualified certificate, so the messages come from your Mac: plug in the token and run{" "}
            <code className="font-mono text-xs">tools/anaf-spv-sync/install.sh</code> once. After that it checks every 15 minutes.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {shown.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-label={m.readAt ? undefined : "Unread"}
                className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", m.readAt ? "bg-transparent" : "bg-destructive")}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={cn("text-sm", !m.readAt && "font-semibold", TONE[m.info.tone])}>{m.info.title}</span>
                  <span className="text-xs text-muted-foreground">{entity(m.cif)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={m.details}>{m.details}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <span className="tabular-nums text-muted-foreground">{fmtDate(m.anafCreatedAt)}</span>
                {m.info.deadline && (
                  <span className={cn("tabular-nums", m.info.deadline < today ? "text-muted-foreground line-through" : "text-destructive")}>
                    by {fmtDate(m.info.deadline)}
                  </span>
                )}
                {withPdf.has(m.id) ? (
                  <MessageLink id={m.id} unread={!m.readAt}>
                    <FilePdf className="h-3.5 w-3.5" /> PDF
                  </MessageLink>
                ) : (
                  <span className="text-muted-foreground">PDF pending</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
