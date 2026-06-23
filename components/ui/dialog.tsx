"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 dark:bg-black/50 backdrop-blur-xs" />
      <DialogPrimitive.Content
        style={{ transform: "translate3d(-50%, -50%, 0)" }}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-[85vh] w-[min(560px,calc(100vw-32px))] gap-4 overflow-y-auto rounded-xl border border-zinc-200/50 dark:border-dark-border/50 bg-white/95 dark:bg-dark-base/95 p-5 shadow-soft dark:shadow-2xl backdrop-blur-md text-zinc-900 dark:text-dark-text",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 hover:bg-accent">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
