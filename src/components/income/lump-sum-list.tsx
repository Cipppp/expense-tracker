"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "@/lib/icons";
import { fmtDate, fmtUsd } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  date: string;
  description: string;
  source: string;
  amountUsd: number;
};

export function LumpSumList({ rows }: { rows: Row[] }) {
  const router = useRouter();

  async function remove(id: string) {
    const res = await fetch(`/api/income/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Removed");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        No project payments yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[110px]">Date</TableHead>
          <TableHead>Source / description</TableHead>
          <TableHead className="text-right w-[140px]">Amount</TableHead>
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-muted-foreground text-xs num">
              {fmtDate(r.date)}
            </TableCell>
            <TableCell>
              <div className="font-medium text-sm">{r.description}</div>
              <div className="text-xs text-muted-foreground">{r.source}</div>
            </TableCell>
            <TableCell className="text-right num text-success font-medium">
              {fmtUsd(r.amountUsd)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(r.id)}
                aria-label="Delete payment"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
