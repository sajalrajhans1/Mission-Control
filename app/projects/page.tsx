"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, Plus, Trash2, Briefcase, Lock, Users, Clock, Archive, ArchiveRestore
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

function formatDeadline(isoString: string | null) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return "";
  }
}

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, tasks, projectMilestones, activeUser } = useData();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);
  const [projectType, setProjectType] = useState<"normal" | "client">("normal");
  const [isPrivate, setIsPrivate] = useState(false);
  const [clientDeadline, setClientDeadline] = useState("");
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
        const projectTasks = tasks.rows.filter((task) => task.project_id === project.id && task.approved !== false);
        const completed = projectTasks.filter((task) => task.completed).length;

        // Milestones
        const milestones = projectMilestones.rows.filter((m) => m.project_id === project.id);
        const completedMilestones = milestones.filter((m) => m.completed).length;

        return {
          project,
          total: projectTasks.length,
          completed,
          milestonesTotal: milestones.length,
          milestonesCompleted: completedMilestones
        };
      });
  }, [projects.rows, tasks.rows, projectMilestones.rows, showArchived]);

  const createProject = async () => {
    if (!name.trim()) return;
    await projects.create({
      name: name.trim(),
      color: color ?? null,
      description: "",
      project_type: projectType,
      is_private: isPrivate,
      created_by: activeUser,
      client_briefing: "",
      client_deadline: clientDeadline ? new Date(clientDeadline).toISOString() : null
    });
    setName("");
    setColor(undefined);
    setProjectType("normal");
    setIsPrivate(false);
    setClientDeadline("");
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
          <h1 className="text-3xl font-bold tracking-tight text-white text-wallpaper-safe">Projects</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)} className="bg-white/15 dark:bg-black/25 hover:bg-white/25 dark:hover:bg-black/40 backdrop-blur border border-white/20 dark:border-white/10 text-white hover:text-white">
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </div>

      <Card className="bg-white/30 dark:bg-black/35 backdrop-blur-xl border border-white/25 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-wallpaper-safe font-bold">New Project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="Startup idea / Business lane / Client name..."
              className="flex-1 bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-white placeholder-white/50 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
            />
            <Button onClick={createProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 items-end">
            {/* Project Type Selection */}
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-white/70">Project Type</label>
              <div className="flex rounded-lg border border-white/25 dark:border-white/10 p-0.5 bg-white/10 dark:bg-black/25 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setProjectType("normal")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                    projectType === "normal"
                      ? "bg-white/40 dark:bg-white/15 shadow-sm text-white"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  Normal Project
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType("client")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                    projectType === "client"
                      ? "bg-white/40 dark:bg-white/15 shadow-sm text-white"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  Client Project
                </button>
              </div>
            </div>

            {/* Visibility / Privacy Selection */}
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-white/70">Visibility</label>
              <div className="flex rounded-lg border border-white/25 dark:border-white/10 p-0.5 bg-white/10 dark:bg-black/25 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    !isPrivate
                      ? "bg-white/40 dark:bg-white/15 shadow-sm text-white"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  Collab
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                    isPrivate
                      ? "bg-white/40 dark:bg-white/15 shadow-sm text-white"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  Private
                </button>
              </div>
            </div>

            {/* Client Deadline (Visible only if Client Project is active) */}
            {projectType === "client" ? (
              <div className="grid gap-1.5 animate-in fade-in slide-in-from-top-1 duration-250">
                <label className="text-xs font-semibold text-white/70">Client Deadline</label>
                <Input
                  type="datetime-local"
                  value={clientDeadline}
                  onChange={(e) => setClientDeadline(e.target.value)}
                  className="h-9.5 text-xs py-1 bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-white placeholder-white/50 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 pb-1.5">
                <label className="text-xs font-semibold text-white/70 mr-2">Color Tag:</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => setColor(color === c.value ? undefined : c.value)}
                      className={cn(
                        "h-5 w-5 rounded-full border transition-transform hover:scale-110",
                        color === c.value ? "border-black dark:border-white ring-1 ring-zinc-300" : "border-transparent"
                      )}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Color tag selector in case of Client Project */}
          {projectType === "client" && (
            <div className="flex items-center gap-2 border-t border-white/15 pt-2 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-white/70 mr-2">Color Tag:</label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setColor(color === c.value ? undefined : c.value)}
                    className={cn(
                      "h-5 w-5 rounded-full border transition-transform hover:scale-110",
                      color === c.value ? "border-black dark:border-white ring-1 ring-zinc-300" : "border-transparent"
                    )}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ project, total, completed, milestonesTotal, milestonesCompleted }) => (
          <div key={project.id} className="relative group">
            <button
              onClick={() => router.push(`/projects/${project.id}`)}
              className="w-full text-left h-full"
            >
              <Card
                className={cn(
                  "transition-all duration-200 hover:shadow-2xl bg-white/30 dark:bg-black/35 backdrop-blur-xl border border-white/25 dark:border-white/10 rounded-2xl h-full flex flex-col justify-between overflow-hidden",
                  project.archived ? "opacity-60" : ""
                )}
                style={project.color ? { borderLeftColor: project.color, borderLeftWidth: 4 } : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {/* Project Type Badge */}
                    {project.project_type === "client" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/25">
                        <Briefcase className="h-2.5 w-2.5 shrink-0" />
                        Client
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/10 text-white/80 border border-white/15 dark:bg-white/5 dark:text-white/70 dark:border-white/10">
                        Normal
                      </span>
                    )}
                    {/* Privacy Badge */}
                    {project.is_private ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                        <Lock className="h-2.5 w-2.5 shrink-0" />
                        Private
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                        <Users className="h-2.5 w-2.5 shrink-0" />
                        Collab
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base text-white text-wallpaper-safe font-bold truncate">
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 pt-0">
                  {/* Milestones progress (for Client project if it has milestones) */}
                  {project.project_type === "client" && milestonesTotal > 0 ? (
                    <div className="grid gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-medium">
                        <span className="flex items-center gap-1">Timeline: {milestonesCompleted}/{milestonesTotal} done</span>
                      </div>
                      <Progress value={(milestonesCompleted / milestonesTotal) * 100} className="h-2 bg-blue-500/20" />
                    </div>
                  ) : (
                    <div className="grid gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-medium">
                        <span>Tasks: {completed}/{total} done</span>
                      </div>
                      <Progress value={total ? (completed / total) * 100 : 0} className="h-2" />
                    </div>
                  )}

                  {/* Deadline text */}
                  {project.project_type === "client" && project.client_deadline && (
                    <div className="flex items-center gap-1 text-[10px] text-white/60 font-semibold border-t border-white/10 pt-2 mt-1">
                      <Clock className="h-3 w-3 text-white/40 shrink-0" />
                      <span className="truncate">Due: {formatDeadline(project.client_deadline)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </button>
            <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
              <Button
                variant="ghost" size="icon" className="h-7 w-7 bg-white/20 hover:bg-white/30 dark:bg-black/40 dark:hover:bg-black/60 backdrop-blur border border-white/20 dark:border-white/10 text-white hover:text-white"
                onClick={(e) => { e.stopPropagation(); setRenaming(project); setRenameValue(project.name); }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 bg-white/20 hover:bg-white/30 dark:bg-black/40 dark:hover:bg-black/60 backdrop-blur border border-white/20 dark:border-white/10 text-white hover:text-white"
                onClick={(e) => { e.stopPropagation(); projects.update(project.id, { archived: !project.archived }); }}
              >
                {project.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 bg-red-500/20 hover:bg-red-500/30 backdrop-blur border border-red-500/30 text-red-200 hover:text-red-100"
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
            className="bg-white/10 dark:bg-black/30 border-white/25 dark:border-white/10 text-white placeholder-white/50 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
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
          <p className="text-sm text-white/70">What should happen to tasks in this project?</p>
          <div className="grid gap-2">
            <button
              onClick={() => setDeleteMode("move")}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-all bg-white/10 dark:bg-black/35 hover:bg-white/20 dark:hover:bg-black/50 border-white/20 dark:border-white/10 text-white",
                deleteMode === "move" ? "border-indigo-500/50 dark:border-indigo-500/50 bg-indigo-500/10 dark:bg-indigo-500/20 text-white font-medium" : ""
              )}
            >
              Move tasks to &ldquo;No Project&rdquo; (recommended)
            </button>
            <button
              onClick={() => setDeleteMode("tasks")}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-all bg-white/10 dark:bg-black/35 hover:bg-white/20 dark:hover:bg-black/50 border-white/20 dark:border-white/10 text-white",
                deleteMode === "tasks" ? "border-indigo-500/50 dark:border-indigo-500/50 bg-indigo-500/10 dark:bg-indigo-500/20 text-white font-medium" : ""
              )}
            >
              Delete all associated tasks
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} className="flex-1 bg-white/15 dark:bg-black/25 hover:bg-white/25 dark:hover:bg-black/40 border-white/20 dark:border-white/10 text-white hover:text-white">
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
