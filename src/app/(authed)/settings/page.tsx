import { getSettings } from "@/lib/queries";
import { db } from "@/lib/db";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { ronFromBani } from "@/lib/format";
import { SettingsForm } from "@/components/settings/settings-form";
import { ClientsManager } from "@/components/settings/clients-manager";
import { PasskeysManager } from "@/components/settings/passkeys-manager";
import { SubscriptionsManager } from "@/components/settings/subscriptions-manager";
import { ApiAccessManager } from "@/components/settings/api-access-manager";
import { AnafConnectionCard } from "@/components/settings/anaf-connection-card";
import { anafConfigured, anafEnv, anafMissing } from "@/lib/anaf";
import { tokenStatus } from "@/lib/anaf/oauth";

export const dynamic = "force-dynamic";

export default async function SettingsPage(props: {
  searchParams: Promise<{ anaf?: string; reason?: string }>;
}) {
  const [settings, clients, params, anaf] = await Promise.all([
    getSettings(),
    db.job.findMany({ orderBy: { name: "asc" } }),
    props.searchParams,
    tokenStatus(anafConfigured()),
  ]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="pb-2">
        <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground">
          Settings
        </div>
        <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">
          Tax, FX & clients
        </h1>
      </header>

      <CollapsibleCard
        title="Clients"
        description="Set up the clients you bill. Their hourly rate and color show up in the time tracker."
        defaultOpen={true}
      >
        <ClientsManager
          /*
            Fara filtru pe `active`: un client arhivat trebuie sa ramana vizibil
            exact aici, altfel dispare din singurul loc din care l-ai putea
            aduce inapoi. Ascuns e doar in time tracker si in selectorul de pe
            factura.
          */
          initial={clients
            .map((c) => ({
              id: c.id,
              name: c.name,
              rateUsd: c.rateUsd,
              color: c.color,
              active: c.active,
              companyName: c.companyName ?? "",
              companyCui: c.companyCui ?? "",
              companyReg: c.companyReg ?? "",
              companyAddress: c.companyAddress ?? "",
              companyCountry: c.companyCountry ?? "",
              companyCounty: c.companyCounty ?? "",
              defaultCurrency: c.defaultCurrency,
              email: c.email ?? "",
              invoiceDescription: c.invoiceDescription ?? "",
            }))}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="ANAF e-Factura"
        description="Direct connection to SPV with your qualified certificate — no Oblio in between. One login a year, then the app sends, tracks and archives on its own."
        defaultOpen={!anaf.connected || anaf.level !== "ok" || Boolean(params.anaf)}
      >
        <AnafConnectionCard
          notice={{ result: params.anaf ?? null, reason: params.reason ?? null }}
          status={{
            configured: anaf.configured,
            missing: anaf.configured ? [] : anafMissing(),
            env: anafEnv(),
            redirectUri: process.env.ANAF_REDIRECT_URI ?? "",
            connected: anaf.connected,
            level: anaf.level,
            needsReauth: anaf.needsReauth,
            certSerial: anaf.certSerial,
            obtainedAt: iso(anaf.obtainedAt),
            refreshedAt: iso(anaf.refreshedAt),
            accessExpiresAt: iso(anaf.accessExpiresAt),
            refreshExpiresAt: iso(anaf.refreshExpiresAt),
            accessDaysLeft: anaf.accessDaysLeft,
            refreshDaysLeft: anaf.refreshDaysLeft,
            lastHealthOk: iso(anaf.lastHealthOk),
            lastError: anaf.lastError,
          }}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Recurring expenses"
        description="Subscriptions you pay monthly or yearly. Overlaid as 'expected' on the dashboard for future months."
        defaultOpen={false}
      >
        <SubscriptionsManager />
      </CollapsibleCard>

      <CollapsibleCard
        title="Sign-in & security"
        description="Add passkeys for Face ID / Touch ID logins from your devices."
        defaultOpen={false}
      >
        <PasskeysManager />
      </CollapsibleCard>

      <CollapsibleCard
        title="API access"
        description="Generate a token so tools like Conductor can log hours into the time tracker automatically."
        defaultOpen={false}
      >
        <ApiAccessManager
          token={settings.timelogToken}
          clientNames={clients.filter((c) => c.active).map((c) => c.name)}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Romanian micro-enterprise"
        description="BS+BAS, CAM, impozit micro, dividende. Changes take effect immediately."
        defaultOpen={false}
      >
        <SettingsForm
          initial={{
            fxRonToUsd: settings.fxRonToUsd,
            fxEurToUsd: settings.fxEurToUsd,
            bsBasRon: ronFromBani(settings.bsBasRon),
            camRon: ronFromBani(settings.camRon),
            microPct: settings.microPct,
            dividendePct: settings.dividendePct,
            redThresholdRon: ronFromBani(settings.redThresholdRon),
            senderEmail: settings.senderEmail,
            senderName: settings.senderName,
            invoiceStartNumber: settings.invoiceStartNumber,
            issuerIban: settings.issuerIban,
            issuerIbanEur: settings.issuerIbanEur,
            issuerIbanUsd: settings.issuerIbanUsd,
            issuerSwift: settings.issuerSwift,
            issuerName: settings.issuerName,
            issuerCif: settings.issuerCif,
            issuerReg: settings.issuerReg,
            issuerAddress: settings.issuerAddress,
            issuerBank: settings.issuerBank,
            issuerCapital: settings.issuerCapital,
            issuerSigner: settings.issuerSigner,
            invoiceSeries: settings.invoiceSeries,
          }}
        />
      </CollapsibleCard>
    </div>
  );
}
