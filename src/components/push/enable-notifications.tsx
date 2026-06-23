"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellSlash, Check } from "@/lib/icons";
import { cn } from "@/lib/utils";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State =
  | "loading"
  | "unsupported"
  | "default"
  | "granted"
  | "denied"
  | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function EnableNotifications() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as State);
  }, []);

  async function enable() {
    if (!VAPID) {
      toast.error("Notificările nu sunt configurate (lipsește cheia).");
      return;
    }
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        if (perm === "denied")
          toast.error("Notificările sunt blocate din setările telefonului.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
        });
      }
      const person = (() => {
        try {
          return localStorage.getItem("gratitude:author");
        } catch {
          return null;
        }
      })();
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          person,
        }),
      });
      if (!res.ok) throw new Error();
      setState("granted");
      toast.success("Notificările sunt active");
    } catch {
      setState("default");
      toast.error("N-am putut activa notificările.");
    }
  }

  async function test() {
    await fetch("/api/push/test", { method: "POST" }).catch(() => {});
    toast.message("Am trimis un test — ar trebui să-ți apară imediat.");
  }

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <BellSlash className="h-3.5 w-3.5" />
        Pe iPhone: adaugă întâi aplicația pe ecranul de start, apoi deschide-o
        de acolo ca să poți activa notificările.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <BellSlash className="h-3.5 w-3.5" />
        Notificările sunt blocate — activează-le din setările telefonului pentru
        această aplicație.
      </p>
    );
  }

  if (state === "granted") {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="h-3.5 w-3.5" />
          Notificări active
        </span>
        <button
          type="button"
          onClick={test}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          trimite un test
        </button>
      </div>
    );
  }

  // default / working
  return (
    <button
      type="button"
      onClick={enable}
      disabled={state === "working"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/5 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60",
      )}
    >
      <Bell className="h-3.5 w-3.5" />
      {state === "working" ? "Se activează…" : "Activează notificările"}
    </button>
  );
}
