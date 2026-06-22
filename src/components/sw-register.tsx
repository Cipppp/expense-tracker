"use client";

import { useEffect } from "react";

/** Registers the push service worker once, on the client, after login. */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures are non-fatal */
      });
    }
  }, []);
  return null;
}
