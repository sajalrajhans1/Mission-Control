"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, Pencil, Plus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { useData } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/database.types";

const PROJECT_COLORS = [
  { label: "Gray", value: "#e5e7eb" },
  { label: "Red", value: "#fca5a5" },
  { label: "Orange", value: "#fdba74" },
  { label: "Yellow", value: "#fde68a" },
  { label: "Green", value: "#86efac" },
  { label: "Blue", value: "#93c5fd" },
  { label: "Purple", value: "#c4b5fd" },
  { label: "Pink", value: "#f9a8d4" }
];

type DeleteMode = "tasks" | "move";

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, tasks } = useData();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);

  // Rename state
  const [renaming, setRenaming] = useState<Row<"projects"> | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete state
  const [deleting, setDeleting] = useState<Row<"projects"> | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>("move");

  const cards = useMemo(() => {
    return projects.rows
      .filter((p) => showArchived || !p.archived)
      .map((project) => {
        const projectTasks = tasks.rows.filter((task) => task.project_id === project.id);
        const completed = projectTasks.filter((task) => task.completed).length;
        return { project, total: projectTasks.length, completed };
      });
  }, [projects.rows, tasks.rows, showArchived]);

  const createProject = async () => {
    if (!name.trim()) return;
    await projects.create({ name, color: color ?? null, description: "" });
    setName("");
    setColor(undefined);
  };

  const confirmRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    await projects.update(renaming.id, { name: renameValue.trim() });
    setRenaming(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (deleteMode === "tasks") {
      const projectTaskIds = tasks.rows.filter((t) => t.project_id === deleting.id).map((t) => t.id);
      for (const id of projectTaskIds) {
        await tasks.remove(id);
      }
    } else {
      const projectTaskIds = tasks.rows.filter((t) => t.project_id === deleting.id).map((t) => t.id);
      for (const id of projectTaskIds) {
        await tasks.update(id, { project_id: null });
      }
    }
    await projects.remove(deleting.id);
    setDeleting(null);
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational workspace &amp; collaborative project boards.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)} className="dark:border-zinc-800">
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </div>

      <Card className="dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-zinc-50">New Project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="Startup idea / Business lane..."
              className="flex-1 dark:border-zinc-800 dark:bg-zinc-950"
            />
            <Button onClick={createProject}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => setColor(color === c.value ? undefined : c.value)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  color === c.value ? "border-black dark:border-white" : "border-transparent"
                )}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ project, total, completed }) => (
          <div key={project.id} className="relative group">
            <button
              onClick={() => router.push(`/projects/${project.id}`)}
              className="w-full text-left"
            >
              <Card
                className={cn(
                  "transition-shadow hover:shadow-soft dark:border-zinc-800 dark:bg-zinc-900",
                  project.archived ? "opacity-60" : ""
                )}
                style={project.color ? { borderLeftColor: project.color, borderLeftWidth: 4 } : undefined}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-zinc-900 dark:text-zinc-50">{project.name}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{completed} done</span>
                    <span>{total} total</span>
                  </div>
                  <Progress value={total ? (completed / total) * 100 : 0} className="h-2" />
                </CardContent>
              </Card>
            </button>
            <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
              <Button
                variant="ghost" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur dark:bg-zinc-950/80"
                onClick={(e) => { e.stopPropagation(); setRenaming(project); setRenameValue(project.name); }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur dark:bg-zinc-950/80"
                onClick={(e) => { e.stopPropagation(); projects.update(project.id, { archived: !project.archived }); }}
              >
                {project.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur dark:bg-zinc-950/80 text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleting(project); setDeleteMode("move"); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {!cards.length ? (
          <div className="col-span-4">
            <EmptyState title={showArchived ? "No projects." : "No active projects."} />
          </div>
        ) : null}
      </div>

      {/* Rename dialog */}
      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            autoFocus
            className="dark:border-zinc-800 dark:bg-zinc-950"
          />
          <Button onClick={confirmRename}>Save</Button>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">What should happen to tasks in this project?</p>
          <div className="grid gap-2">
            <button
              onClick={() => setDeleteMode("move")}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-colors hover:bg-accent dark:border-zinc-800 dark:hover:bg-zinc-800",
                deleteMode === "move" ? "border-black dark:border-zinc-300 font-medium" : ""
              )}
            >
              Move tasks to &ldquo;No Project&rdquo; (recommended)
            </button>
            <button
              onClick={() => setDeleteMode("tasks")}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-colors hover:bg-accent dark:border-zinc-800 dark:hover:bg-zinc-800",
                deleteMode === "tasks" ? "border-black dark:border-zinc-300 font-medium" : ""
              )}
            >
              Delete all associated tasks
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} className="flex-1 dark:border-zinc-800">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="flex-1">
              Delete project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
