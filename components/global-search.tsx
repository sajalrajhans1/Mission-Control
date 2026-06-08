"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/components/data-provider";

export function GlobalSearch() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalized = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!normalized) return [];
    return [
      ...data.tasks.rows.map((item) => ({ type: "Task", title: item.title, text: item.assigned_to, href: "/tasks" })),
      ...data.prompts.rows.map((item) => ({ type: "Prompt", title: item.title, text: item.content, href: "/vault" })),
      ...data.ideas.rows.map((item) => ({ type: "Idea", title: item.title, text: item.description, href: "/vault" })),
      ...data.projects.rows.map((item) => ({ type: "Project", title: item.name, text: "", href: "/projects" })),
      ...data.resources.rows.map((item) => ({ type: "Resource", title: item.title, text: item.url, href: "/vault" })),
      ...data.stickyNotes.rows.map((item) => ({ type: "Sticky", title: item.title, text: item.body, href: "/vault" })),
      ...data.vaultItems.rows.map((item) => ({ type: "Vault", title: item.title, text: item.body, href: "/vault" }))
    ]
      .filter((item) => `${item.title} ${item.text}`.toLowerCase().includes(normalized))
      .slice(0, 20);
  }, [data, normalized]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="min-w-44 justify-start text-muted-foreground">
        <Search className="h-4 w-4" />
        Search
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tasks, ideas, prompts, vault…"
            autoFocus
          />
          <div className="grid gap-2">
            {results.map((item, index) => (
              <Link
                key={`${item.type}-${item.title}-${index}`}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl border p-3 hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{item.title}</span>
                  <Badge>{item.type}</Badge>
                </div>
                {item.text ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.text}</p>
                ) : null}
              </Link>
            ))}
            {normalized && results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No matches.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
