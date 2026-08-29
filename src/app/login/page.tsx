"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { Lock, Fingerprint } from "@/lib/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mascot } from "@/components/mascot";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, remember }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Incorrect password.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function signInWithPasskey() {
    setError(null);
    setPasskeyPending(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
      });
      if (!optionsRes.ok) throw new Error("Failed to start passkey login");
      const options = await optionsRes.json();

      const response = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, remember }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Passkey login failed");
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      const msg =
        e instanceof Error
          ? e.message
          : "Passkey unavailable — try the password.";
      // Dismissals & timeouts: WebAuthn raises NotAllowedError with a spec-y
      // message ("The operation either timed out or was not allowed…").
      // Passkeys are also per-domain — one saved on the old vercel.app URL
      // doesn't exist for house.cefani.com. Show a friendly hint, not the spec.
      if (
        name === "NotAllowedError" ||
        msg.includes("NotAllowed") ||
        msg.includes("cancel") ||
        msg.includes("timed out or was not allowed")
      ) {
        setError(
          "Passkey sign-in was cancelled or no passkey exists on this device for this site. Sign in with the password, then add a passkey from Settings.",
        );
        setPasskeyPending(false);
        return;
      }
      toast.error(msg);
      setError(msg);
    } finally {
      setPasskeyPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full h-11"
        onClick={signInWithPasskey}
        disabled={passkeyPending || pending}
      >
        <Fingerprint className="h-4 w-4" />
        {passkeyPending ? "Waiting for biometric…" : "Sign in with passkey"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
          <span className="bg-card px-2 text-muted-foreground">
            or password
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          name="username"
          autoComplete="username"
          defaultValue="owner"
          className="hidden"
          aria-hidden
        />
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={remember}
            onCheckedChange={(c) => setRemember(c === true)}
          />
          <span className="text-sm">Remember me for 90 days</span>
        </label>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="accent"
          className="w-full h-11"
          disabled={pending || !password || passkeyPending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-secondary/50 px-4 py-8 safe-bottom">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <Mascot pose="waving" className="h-24 w-24 -mb-1" />
          <div
            className="font-display font-extrabold text-3xl tracking-[-0.03em]"
            style={{ fontVariationSettings: '"wdth" 92' }}
          >
            house cefani
            <span
              aria-hidden="true"
              className="ml-[0.08em] inline-block h-[0.2em] w-[0.2em] rounded-full bg-accent"
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground uppercase tracking-[0.07em]">
            Project CIP SRL
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-accent" />
              <CardTitle className="text-lg">Sign in</CardTitle>
            </div>
            <CardDescription>
              Use your passkey for a fast biometric login, or enter the access
              password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
