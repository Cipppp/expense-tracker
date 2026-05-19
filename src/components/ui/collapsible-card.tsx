"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type CollapsibleCardProps = {
  title: string;
  description?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  children,
  className,
}: CollapsibleCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} asChild>
      <Card className={cn("overflow-hidden", className)}>
        <CollapsiblePrimitive.Trigger asChild>
          <button
            type="button"
            className="w-full text-left group/collapse focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CardHeader className="cursor-pointer hover:bg-secondary/40 transition-colors duration-200 ease-expo flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5 flex-1 min-w-0">
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 ease-expo",
                  open && "rotate-180",
                )}
              />
            </CardHeader>
          </button>
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <Separator />
          <div className="p-6">{children}</div>
        </CollapsiblePrimitive.Content>
      </Card>
    </CollapsiblePrimitive.Root>
  );
}
