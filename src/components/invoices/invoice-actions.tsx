"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send, RotateCcw, Trash2, Upload } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function InvoiceActions({
  id,
  status,
  overdue,
  reminderContext,
  oblioReady = false,
  anafReady = false,
  prodFiled = false,
  oblioNumber = null,
  oblioLink = null,
}: {
  id: string;
  status: string;
  overdue?: boolean;
  oblioReady?: boolean;
  /** ANAF e conectat direct PE PROD: butonul Oblio dispare, ramane panoul e-Factura. */
  anafReady?: boolean;
  /** Depusa la ANAF pe prod: nu se mai poate sterge, doar anula. */
  prodFiled?: boolean;
  oblioNumber?: string | null;
  oblioLink?: string | null;
  reminderContext?: {
    series: string;
    number: string;
    clientCompany: string;
    dueAt: string | null;
    total: number;
    currency: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [pendingDel, startDel] = useTransition();
  // Notificarea spune despre ce factura e vorba, nu doar ca s-a intamplat ceva.
  const label = reminderContext
    ? `${reminderContext.series} ${reminderContext.number}`
    : null;
  const sub = reminderContext
    ? `${reminderContext.clientCompany} · ${reminderContext.total.toLocaleString("ro-RO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${reminderContext.currency}`
    : undefined;

  async function setStatus(next: string, paidAt?: string | null) {
    setPending(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, paidAt }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(label ? `${label} — failed to update` : "Failed to update");
      return;
    }
    toast.success(
      next === "paid"
        ? `${label ?? "Invoice"} · marked paid`
        : `${label ?? "Invoice"} · status → ${next}`,
      {
        description:
          next === "paid"
            ? [sub, "Income entry created"].filter(Boolean).join(" · ")
            : sub,
      },
    );
    router.refresh();
  }

  const [oblio, setOblio] = useState<{ number: string; link: string | null } | null>(
    oblioNumber ? { number: oblioNumber, link: oblioLink } : null,
  );
  const [oblioPending, setOblioPending] = useState(false);

  /*
   * Emite factura si in Oblio. De acolo pleaca la SPV — automat daca e bifat
   * "Trimite automat e-Factura la SPV" in preferintele contului, altfel din
   * butonul lor. Aplicatia asta nu are certificat digital, deci nu poate
   * incarca ea la ANAF.
   */
  async function sendToOblio() {
    setOblioPending(true);
    try {
      const res = await fetch(`/api/invoices/${id}/oblio`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(label ? `${label} — Oblio refused it` : "Oblio refused it", {
          description: typeof data?.error === "string" ? data.error : undefined,
        });
        return;
      }
      setOblio({ number: data.oblioNumber, link: data.oblioLink ?? null });
      toast.success(
        data.already
          ? `Already in Oblio as ${data.oblioNumber}`
          : `${label ?? "Invoice"} issued in Oblio as ${data.oblioNumber}`,
        { description: data.already ? undefined : "Oblio forwards it to SPV." },
      );
      router.refresh();
    } finally {
      setOblioPending(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this invoice? If it was marked paid, the linked Income entry is also removed.")) return;
    startDel(async () => {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(label ? `${label} — failed to delete` : "Failed to delete", {
          description: typeof body?.error === "string" ? body.error : undefined,
        });
        return;
      }
      toast.success(label ? `${label} deleted` : "Invoice deleted", {
        description: sub,
      });
      router.push("/invoices");
    });
  }

  function sendReminder() {
    if (!reminderContext) return;
    const r = reminderContext;
    const dueLine = r.dueAt
      ? `Due date: ${fmtDate(r.dueAt)}\n`
      : "";
    const subject = `Reminder: Invoice ${r.series} ${r.number} from PROJECT CIP S.R.L.`;
    const body =
      `Hi,\n\n` +
      `Just a friendly reminder that invoice ${r.series} ${r.number} for ${r.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency} ` +
      `(${r.clientCompany}) is still outstanding.\n` +
      dueLine +
      `\nThe PDF is attached for your reference.\n\n` +
      `Thanks,\nCiprian / Project CIP S.R.L.`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {overdue && reminderContext && (
        <Button
          variant="destructive"
          onClick={sendReminder}
        >
          <Send className="h-3.5 w-3.5" />
          Send reminder
        </Button>
      )}
      {status === "draft" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("issued")}
        >
          <Send className="h-3.5 w-3.5" />
          Mark issued
        </Button>
      )}
      {status !== "paid" ? (
        <Button
          variant="accent"
          disabled={pending}
          onClick={() =>
            setStatus("paid", new Date().toISOString().slice(0, 10))
          }
        >
          <Check className="h-3.5 w-3.5" />
          Mark paid
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("issued", null)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Unmark paid
        </Button>
      )}
      {oblio ? (
        oblio.link ? (
          <Button variant="outline" asChild>
            <a href={oblio.link} target="_blank" rel="noreferrer">
              <Upload className="h-3.5 w-3.5" />
              Oblio · {oblio.number}
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <Upload className="h-3.5 w-3.5" />
            Oblio · {oblio.number}
          </Button>
        )
      ) : oblioReady && !anafReady ? (
        <Button variant="outline" disabled={oblioPending} onClick={sendToOblio}>
          <Upload className={cn("h-3.5 w-3.5", oblioPending && "animate-pulse")} />
          {oblioPending ? "Sending…" : "Issue in Oblio"}
        </Button>
      ) : null}
      {!prodFiled && (
        <Button
          variant="ghost"
          disabled={pendingDel}
          onClick={remove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      )}
    </div>
  );
}
