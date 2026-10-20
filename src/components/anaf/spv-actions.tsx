"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/*
 * Deschiderea PDF-ului il marcheaza citit pe server; aici doar reimprospatam
 * pagina dupa, ca punctul rosu si insigna din meniu sa dispara.
 */
export function MessageLink({ id, unread, children }: { id: string; unread: boolean; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <a
      href={`/api/anaf/spv/${id}/pdf`}
      target="_blank"
      rel="noopener"
      onClick={() => unread && setTimeout(() => router.refresh(), 800)}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-secondary"
    >
      {children}
    </a>
  );
}

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/anaf/spv/read", { method: "POST", body: "{}" }).catch(() => null);
        setBusy(false);
        if (!res?.ok) return toast.error("Couldn't mark them read");
        router.refresh();
      }}
    >
      Mark all read
    </Button>
  );
}
