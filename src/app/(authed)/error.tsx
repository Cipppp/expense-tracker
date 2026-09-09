"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Ce vezi cand o pagina crapa.
 *
 * Fara asta, orice eroare de pe server ajunge pe ecran ca pagina implicita a
 * framework-ului: fundal alb, font de sistem, „Application error: a server-side
 * exception has occurred". Arata a site stricat, nu a aplicatie care a avut o
 * problema — si nu-ti da nimic de facut.
 */
export default function AuthedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg">
        <CardContent className="p-8 space-y-4">
          <div className="eyebrow">Eroare</div>
          <h1 className="font-display text-2xl">Pagina asta n-a putut fi încărcată</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Datele tale sunt în siguranță — a picat doar afișarea. Încearcă din
            nou; dacă se repetă, cel mai probabil e o problemă de conexiune la
            baza de date.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-muted-foreground/70">
              cod: {error.digest}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={reset}>Încearcă din nou</Button>
            <Button variant="outline" asChild>
              <a href="/">Înapoi la dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
