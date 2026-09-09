"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Crearea primului cont.
 *
 * Pagina există pentru instalarea proaspătă: până acum, aplicația presupunea
 * că omul care o pornește e deja înăuntru, pentru că exista o parolă în
 * variabilele de mediu. Cu conturi, cineva trebuie să și le facă — iar dacă
 * există deja unul, serverul refuză, așa că pagina nu e o ușă deschisă.
 */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Nu s-a putut crea contul.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-secondary/50 px-4 py-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="eyebrow">Cont nou</div>
        <h1 className="mt-1.5 font-display text-2xl">Începe</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Contul rămâne pe instanța ta. Datele nu pleacă nicăieri.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nume (opțional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              Minimum 10 caractere.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="accent"
            className="w-full h-11"
            disabled={pending || !email || password.length < 10}
          >
            {pending ? "Se creează…" : "Creează contul"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ai deja cont?{" "}
          <a href="/login" className="underline underline-offset-2">
            Intră
          </a>
        </p>
      </div>
    </div>
  );
}
