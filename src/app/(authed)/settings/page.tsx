import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ronFromBani } from "@/lib/format";
import { SettingsForm } from "@/components/settings/settings-form";
import { ClientsManager } from "@/components/settings/clients-manager";

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
    <div className="space-y-8 max-w-3xl">
      <header>
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Settings
        </div>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Tax, FX & clients</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clients</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set up the clients you bill. Their hourly rate and color show up in
            the time tracker.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <ClientsManager
            initial={clients
              .filter((c) => c.active)
              .map((c) => ({
                id: c.id,
                name: c.name,
                rateUsd: c.rateUsd,
                color: c.color,
                active: c.active,
              }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Romanian micro-enterprise</CardTitle>
          <p className="text-sm text-muted-foreground">
            BS+BAS, CAM, impozit micro, dividende. Changes take effect immediately.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
