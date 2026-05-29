import { db } from "@/lib/db";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { ronFromBani } from "@/lib/format";
import { SettingsForm } from "@/components/settings/settings-form";
import { ClientsManager } from "@/components/settings/clients-manager";
import { PasskeysManager } from "@/components/settings/passkeys-manager";
import { SubscriptionsManager } from "@/components/settings/subscriptions-manager";
import { ApiAccessManager } from "@/components/settings/api-access-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, clients] = await Promise.all([
    db.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    }),
    db.job.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="pb-2">
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Settings
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-4xl tracking-tight">
          Tax, FX & clients
        </h1>
      </header>

      <CollapsibleCard
        title="Clients"
        description="Set up the clients you bill. Their hourly rate and color show up in the time tracker."
        defaultOpen={true}
      >
        <ClientsManager
          initial={clients
            .filter((c) => c.active)
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
              defaultCurrency: c.defaultCurrency,
            }))}
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
            bsBasRon: ronFromBani(settings.bsBasRon),
            camRon: ronFromBani(settings.camRon),
            microPct: settings.microPct,
            dividendePct: settings.dividendePct,
            redThresholdRon: ronFromBani(settings.redThresholdRon),
          }}
        />
      </CollapsibleCard>
    </div>
  );
}
