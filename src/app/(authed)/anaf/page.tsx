import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { describeSpv, groupDue, isCnp, maskCnp, shortCompany, type SpvTone } from "@/lib/spv";
import { cn } from "@/lib/utils";
import { AlertCircle, FilePdf } from "@/lib/icons";
import { MarkAllRead, MessageRow, SyncButton } from "@/components/anaf/spv-actions";

export const dynamic = "force-dynamic";

/*
 * Tot ce a pus ANAF in SPV, fara sa intri in SPV: recipise, notificari,
 * decizii, raspunsuri la cereri. SPV vorbeste doar cu certificatul de pe
 * token, deci butonul Sync porneste `tools/anaf-spv-sync` pe Mac; aici doar
 * citesti. Un rand e un mesaj, pe o linie, iar tot randul deschide PDF-ul.
 */

const TONE: Record<SpvTone, string> = {
  ok: "text-foreground",
  info: "text-foreground/80",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action", label: "Needs attention" },
] as const;

const TZ = "Europe/Bucharest";
const dayMonth = (d: Date) =>
  d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(/\.$/, "");
const monthYear = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "due today" / "in 3 days", numarat pe zile calendaristice in Bucuresti. */
function dueIn(deadline: Date, today: Date) {
  const days = Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
  return days <= 0 ? "due today" : days === 1 ? "due tomorrow" : `in ${days} days`;
}

export default async function AnafPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "all" } = await searchParams;
  const [rows, withPdfRows, settings] = await Promise.all([
    db.spvMessage.findMany({
      orderBy: [{ anafCreatedAt: "desc" }, { anafId: "desc" }],
      select: { id: true, anafId: true, cif: true, kind: true, details: true, anafCreatedAt: true, readAt: true },
    }),
    db.spvMessage.findMany({ where: { NOT: { pdf: null } }, select: { id: true } }),
    getSettings(),
  ]);
  const withPdf = new Set(withPdfRows.map((r) => r.id));

  /* Firma ta are doua coduri: CIF-ul si codul de TVA pe art. 317, fara "RO". */
  const own = new Map<string, string>();
  const ownName = shortCompany(settings.issuerName || "Your company");
  for (const code of [settings.issuerCif, settings.issuerVatIntra]) {
    const digits = code?.replace(/\D/g, "");
    if (digits) own.set(digits, ownName);
  }
  const entity = (cif: string) => (isCnp(cif) ? `Personal ${maskCnp(cif)}` : own.get(cif) ?? `CIF ${cif}`);

  // Ziua de azi in Bucuresti, la pranz UTC, ca termenele (tot la pranz UTC).
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const today = new Date(`${ymd}T12:00:00Z`);

  const items = rows.map((r) => ({ ...r, info: describeSpv(r.kind, r.details, r.anafCreatedAt) }));
  const due = groupDue(items, today);
  const needsAttention = (m: (typeof items)[number]) => m.info.tone === "danger" || m.info.tone === "warn";
  const counts = {
    all: items.length,
    unread: items.filter((m) => !m.readAt).length,
    action: items.filter(needsAttention).length,
  };
  const shown = items.filter((m) => (f === "unread" ? !m.readAt : f === "action" ? needsAttention(m) : true));

  const months: { label: string; items: typeof shown }[] = [];
  for (const m of shown) {
    const label = monthYear(m.anafCreatedAt);
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1)!.items.push(m);
  }

  const synced = settings.spvSyncedAt
    ? settings.spvSyncedAt.toLocaleString("ro-RO", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ,
      })
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-[30px] sm:text-[40px] leading-[1.05]">ANAF messages</h1>
          <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
            {synced ? `Synced ${synced}` : "Never synced"}
            {counts.unread > 0 && (
              <>
                {" · "}
                <span className="text-foreground">{counts.unread} unread</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {counts.unread > 0 && <MarkAllRead />}
          <SyncButton lastSyncedAt={settings.spvSyncedAt?.toISOString() ?? null} />
        </div>
      </header>

      {due.length > 0 && (
        <ul className="divide-y divide-destructive/15 rounded-lg border border-destructive/30 bg-destructive/[0.06] text-sm">
          {due.map(({ first, count }) => (
            <li key={first.id} className="flex items-center gap-3 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{first.info.title.replace(/^Notificare:\s*/, "")}</span>
                <span className="text-muted-foreground"> · {entity(first.cif)}</span>
                {count > 1 && <span className="text-muted-foreground"> · {count} notices</span>}
              </span>
              <span className="shrink-0 tabular-nums text-destructive">
                {dueIn(first.info.deadline!, today)}
                <span className="hidden sm:inline text-muted-foreground"> · {dayMonth(first.info.deadline!)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Filter" className="inline-flex rounded-lg border border-border p-0.5 text-sm">
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            href={x.id === "all" ? "/anaf" : `/anaf?f=${x.id}`}
            aria-current={f === x.id ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 transition-colors duration-200 ease-expo",
              f === x.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{counts[x.id]}</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No messages yet.</p>
          <p className="mt-1 max-w-prose">
            SPV only answers to your qualified certificate, so the sync runs on your Mac. Plug in the token, install the
            helper once with <code className="font-mono text-xs">tools/anaf-spv-sync/install.sh</code>, then press Sync.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="space-y-5">
          {months.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{g.label}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {g.items.map((m) => {
                  const overdue = m.info.deadline && m.info.deadline.getTime() < today.getTime();
                  return (
                    <li key={m.id}>
                      <MessageRow
                        id={m.id}
                        unread={!m.readAt}
                        hasPdf={withPdf.has(m.id)}
                        className="grid grid-cols-[8px_44px_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-sm md:grid-cols-[8px_44px_120px_minmax(0,1fr)_auto]"
                      >
                        <span
                          aria-label={m.readAt ? undefined : "Unread"}
                          className={cn("h-1.5 w-1.5 rounded-full", !m.readAt && "bg-destructive")}
                        />
                        <span className="tabular-nums text-xs text-muted-foreground">{dayMonth(m.anafCreatedAt)}</span>
                        <span className="hidden truncate text-xs text-muted-foreground md:block">{entity(m.cif)}</span>
                        <span className="min-w-0 truncate" title={m.details}>
                          <span className={cn(TONE[m.info.tone], !m.readAt && "font-semibold")}>{m.info.title}</span>
                          <span className="text-xs text-muted-foreground md:hidden"> · {entity(m.cif)}</span>
                        </span>
                        <span className="flex items-center gap-2.5 text-xs">
                          {m.info.deadline && (
                            <span className={cn("tabular-nums", overdue ? "text-muted-foreground line-through" : "text-destructive")}>
                              {dayMonth(m.info.deadline)}
                            </span>
                          )}
                          {withPdf.has(m.id) ? (
                            <FilePdf aria-label="Open PDF" className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <span className="text-muted-foreground">no PDF yet</span>
                          )}
                        </span>
                      </MessageRow>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
