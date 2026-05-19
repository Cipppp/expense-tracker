"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { toast } from "sonner";
import {
  Fingerprint,
  Smartphone,
  Laptop,
  Trash2,
  Plus,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDate } from "@/lib/format";

type Passkey = {
  id: string;
  label: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string;
  transports: string;
};

export function PasskeysManager() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingDelete, startDelete] = useTransition();

  async function load() {
    const res = await fetch("/api/auth/passkey");
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPasskeys(data.passkeys);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addPasskey() {
    if (!label.trim()) {
      toast.error("Pick a label first (e.g. 'iPhone' or 'MacBook')");
      return;
    }
    setPending(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to start registration");
      }
      const options = await optionsRes.json();

      const response = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), response }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to verify passkey");
      }
      toast.success(`${label} added`);
      setLabel("");
      load();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add passkey";
      if (msg.includes("NotAllowed") || msg.includes("cancel")) {
        setPending(false);
        return;
      }
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  function removePasskey(id: string, name: string) {
    if (!confirm(`Remove passkey "${name}"? You'll need to add it again on that device.`))
      return;
    startDelete(async () => {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to remove");
        return;
      }
      toast.success("Removed");
      load();
    });
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No passkeys yet. Add one to sign in with Face ID, Touch ID, or your
          device's biometric.
        </p>
      ) : (
        <ul className="space-y-2">
          {passkeys.map((p) => {
            const isPlatform =
              p.transports.includes("internal") || p.transports === "";
            const Icon = isPlatform ? Smartphone : Laptop;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md bg-accent/10 p-2 text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {p.label}
                      </span>
                      {p.backedUp && (
                        <span
                          className="text-muted-foreground"
                          title="Synced via iCloud / Google Password Manager"
                        >
                          <Cloud className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Added {fmtDate(p.createdAt)} · last used {fmtDate(p.lastUsedAt)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePasskey(p.id, p.label)}
                  disabled={pendingDelete}
                  aria-label="Remove passkey"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-md border border-dashed border-border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Add a new passkey</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="passkey-label"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Device label
            </Label>
            <Input
              id="passkey-label"
              placeholder="iPhone, MacBook, …"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
            />
          </div>
          <Button
            variant="accent"
            onClick={addPasskey}
            disabled={pending || !label.trim()}
            className="sm:self-end h-10"
          >
            <Plus className="h-3.5 w-3.5" />
            {pending ? "Waiting for biometric…" : "Add passkey"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Your device will prompt for Face ID / Touch ID / Windows Hello. The
          passkey is bound to this domain — it can't be used anywhere else.
        </p>
      </div>
    </div>
  );
}
