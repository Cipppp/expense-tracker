import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ronFromBani } from "@/lib/format";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Settings
        </div>
        <h1 className="mt-1 font-display text-4xl tracking-tight">
          Tax & FX
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Romanian micro-enterprise</CardTitle>
          <p className="text-sm text-muted-foreground">
            Mirrors Dashboard L3:N7 in the spreadsheet. Changes take effect
            immediately across all calculations.
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
