"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RefreshCw, Trash2, Eye, EyeOff } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Manage the Bearer token for the external time-log API. The token is shown
 * masked by default; generating a new one invalidates the old. The example
 * curl uses the live origin so it's copy-pasteable into Conductor.
 */
export function ApiAccessManager({
  token,
  clientNames,
}: {
  token: string | null;
  clientNames: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [reveal, setReveal] = useState(false);
  // Keep the freshly-minted token in state so we can show it in full once,
  // even though the server only round-trips it on generation.
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const current = freshToken ?? token;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";

  async function act(action: "generate" | "revoke") {
    setPending(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelogTokenAction: action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Failed", { description: String(data?.error ?? "") });
        return;
      }
      if (action === "generate") {
        setFreshToken(data.token ?? null);
        setReveal(true);
        toast.success("New token generated");
      } else {
        setFreshToken(null);
        toast.success("Token revoked — API disabled");
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );
  }

  const masked = current
    ? `${current.slice(0, 6)}${"•".repeat(20)}${current.slice(-4)}`
    : null;

  const curlExample = current
    ? `curl -X POST ${origin}/api/timelog \\
  -H "Authorization: Bearer ${current}" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"30m ${clientNames[0] ?? "safeINIT"} worked on the API"}'`
    : "";

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        A secret token that lets external tools (Conductor, scripts, Apple
        Shortcuts) log time without signing in. Treat it like a password — it
        can create income entries.
      </p>

      {!current ? (
        <Button variant="accent" disabled={pending} onClick={() => act("generate")}>
          <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
          Generate token
        </Button>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Token
            </label>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs font-mono break-all">
                {reveal ? current : masked}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setReveal((r) => !r)}
                title={reveal ? "Hide" : "Reveal"}
                aria-label={reveal ? "Hide token" : "Reveal token"}
              >
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copy(current, "Token")}
                title="Copy token"
                aria-label="Copy token"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Example request
              </label>
              <button
                type="button"
                onClick={() => copy(curlExample, "curl command")}
                className="text-[11px] text-accent hover:underline underline-offset-2"
              >
                Copy curl
              </button>
            </div>
            <pre className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-[11px] font-mono overflow-x-auto leading-relaxed">
              {curlExample}
            </pre>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Accepted shapes:{" "}
              <code className="text-foreground">{`{"text":"30m netop fixed bug"}`}</code>{" "}
              (free-form),{" "}
              <code className="text-foreground">{`{"client":"netop","minutes":30}`}</code>{" "}
              (append to today&apos;s block), or{" "}
              <code className="text-foreground">{`{"client":"netop","start":"10:00","end":"18:00"}`}</code>{" "}
              (exact block). Optional <code className="text-foreground">date</code>:{" "}
              today / yesterday / yyyy-mm-dd.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => act("generate")}>
              <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => act("revoke")}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Revoke
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
