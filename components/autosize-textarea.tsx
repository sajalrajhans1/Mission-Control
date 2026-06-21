"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function AutosaveTextarea({
  value,
  onSave,
  placeholder,
  minHeight = 160,
  readOnly = false,
  className
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) return;
    const timeout = window.setTimeout(() => onSave(draft), 500);
    return () => window.clearTimeout(timeout);
  }, [draft, onSave, value]);

  return (
    <Textarea
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      style={{ minHeight }}
      className={cn("leading-6", className)}
      readOnly={readOnly}
    />
  );
}
