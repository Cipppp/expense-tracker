"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send, RotateCcw, Trash2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";

export function InvoiceActions({
  id,
  status,
  overdue,
  reminderContext,
}: {
  id: string;
  status: string;
  overdue?: boolean;
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

  async function setStatus(next: string, paidAt?: string | null) {
    setPending(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, paidAt }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    toast.success(
      next === "paid"
        ? "Marked paid — Income entry created"
        : `Status → ${next}`,
    );
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this invoice? If it was marked paid, the linked Income entry is also removed.")) return;
    startDel(async () => {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Invoice deleted");
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
      <Button
        variant="ghost"
        disabled={pendingDel}
        onClick={remove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
    </div>
  );
}
