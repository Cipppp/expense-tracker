"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Send to client" — emails the invoice PDF + activity report (and optionally
 * the e-Factura XML) to the client, with an editable quick message.
 */
export function InvoiceSend({
  invoiceId,
  clientEmail,
  defaultSubject,
  defaultMessage,
}: {
  invoiceId: string;
  clientEmail: string | null;
  defaultSubject: string;
  defaultMessage: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [includeReport, setIncludeReport] = useState(true);
  const [includeXml, setIncludeXml] = useState(false);

  async function send() {
    setPending(true);
    const res = await fetch(`/api/invoices/${invoiceId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to.trim() || undefined,
        subject,
        message,
        includeActivityReport: includeReport,
        includeXml,
      }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Couldn't send", { description: String(data?.error ?? "") });
      return;
    }
    toast.success(`Sent to ${data.to}`, {
      description: `Attached: ${(data.attachments ?? []).join(", ")}`,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" />
        Send to client
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Email invoice to client</DialogTitle>
            <DialogDescription>
              Attaches the invoice PDF and the chosen extras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs uppercase tracking-wider text-muted-foreground">
                To
              </Label>
              <Input
                id="to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@company.com"
              />
              {!clientEmail && (
                <p className="text-[11px] text-muted-foreground">
                  No email saved for this client — type one, or add it in Settings → Clients.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subj" className="text-xs uppercase tracking-wider text-muted-foreground">
                Subject
              </Label>
              <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg" className="text-xs uppercase tracking-wider text-muted-foreground">
                Message
              </Label>
              <textarea
                id="msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeReport}
                  onChange={(e) => setIncludeReport(e.target.checked)}
                  className="accent-accent"
                />
                Attach activity report (.xlsx)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeXml}
                  onChange={(e) => setIncludeXml(e.target.checked)}
                  className="accent-accent"
                />
                Attach e-Factura XML
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="accent" onClick={send} disabled={pending || !to.trim()}>
              <Send className="h-3.5 w-3.5" />
              {pending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
