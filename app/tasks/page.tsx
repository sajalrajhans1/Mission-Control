"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { TaskRow } from "@/components/task-row";
import { EmptyState } from "@/components/empty-state";
import { useData, useUserNames } from "@/components/data-provider";
import { todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";

const subFilters = ["All", "Today", "Upcoming", "Completed"] as const;

export default function TasksPage() {
  const { tasks, projects, activeUserName, activeUser } = useData();
  const { user1, user2 } = useUserNames();

  const [activeSpace, setActiveSpace] = useState<"user1" | "user2" | "collab">("user1");
  const [subFilter, setSubFilter] = useState<(typeof subFilters)[number]>("All");

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [assignedTo, setAssignedTo] = useState(user1);
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [projectId, setProjectId] = useState("none");
  const [dueDate, setDueDate] = useState(todayISO());

  const today = todayISO();
  const activeProjects = projects.rows.filter((p) => !p.archived);

  // Set default tab to current active user on load
  useEffect(() => {
    if (activeUser === "user2") {
      setActiveSpace("user2");
      setAssignedTo(user2);
    } else {
      setActiveSpace("user1");
      setAssignedTo(user1);
    }
  }, [activeUser, user1, user2]);

  // Adjust default assignee when switching tabs
  const handleSpaceChange = (space: "user1" | "user2" | "collab") => {
    setActiveSpace(space);
    if (space === "user1") setAssignedTo(user1);
    else if (space === "user2") setAssignedTo(user2);
    else setAssignedTo("Both");
  };

  // Determine actual target name of activeSpace
  const targetAssigneeName = useMemo(() => {
    if (activeSpace === "user1") return user1;
    if (activeSpace === "user2") return user2;
    return "Both";
  }, [activeSpace, user1, user2]);

  // Filter tasks that are APPROVED and belong to the activeSpace
  const approvedTasks = useMemo(() => {
    return tasks.rows.filter(
      (task) => task.assigned_to === targetAssigneeName && task.approved !== false
    );
  }, [tasks.rows, targetAssigneeName]);

  // Sub-filter approved tasks (All, Today, Upcoming, Completed)
  const filtered = useMemo(() => {
    return approvedTasks.filter((task) => {
      if (subFilter === "Today") return !task.completed && task.due_date === today;
      if (subFilter === "Upcoming") return !task.completed && Boolean(task.due_date && task.due_date > today);
      if (subFilter === "Completed") return task.completed;
      return true;
    });
  }, [subFilter, approvedTasks, today]);

  // Get tasks AWAITING APPROVAL in the activeSpace
  // Scenario A: Logged-in user is the assignee -> they must approve or decline
  const incomingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || activeUserName !== spaceUser) return [];
    return tasks.rows.filter(
      (task) => task.assigned_to === spaceUser && task.approved === false
    );
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  // Scenario B: Logged-in user is the creator but assigned to other -> show as pending status
  const pendingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || activeUserName === spaceUser) return [];
    return tasks.rows.filter(
      (task) =>
        task.assigned_to === spaceUser &&
        task.approved === false &&
        task.created_by === activeUserName
    );
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  const createTask = async () => {
    if (!title.trim()) return;

    // approval is true if collab ("Both") or assigned to the active creator
    const approved = assignedTo === "Both" || assignedTo === activeUserName;

    await tasks.create({
      title: title.trim(),
      note: note.trim(),
      assigned_to: assignedTo,
      priority,
      project_id: projectId === "none" ? null : projectId,
      due_date: dueDate || null,
      completed_user1: false,
      completed_user2: false,
      created_by: activeUserName || "Unknown",
      approved
    });

    setTitle("");
    setNote("");
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Assign, approve, and track work between {user1} and {user2}.
        </p>
      </div>

      {/* Main Spaces Navigation Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => handleSpaceChange("user1")}
          className={cn(
            "py-3.5 px-6 font-semibold text-sm border-b-2 transition-colors",
            activeSpace === "user1"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-muted-foreground hover:text-zinc-700"
          )}
        >
          {user1}&apos;s Tasks
        </button>
        <button
          onClick={() => handleSpaceChange("user2")}
          className={cn(
            "py-3.5 px-6 font-semibold text-sm border-b-2 transition-colors",
            activeSpace === "user2"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-muted-foreground hover:text-zinc-700"
          )}
        >
          {user2}&apos;s Tasks
        </button>
        <button
          onClick={() => handleSpaceChange("collab")}
          className={cn(
            "py-3.5 px-6 font-semibold text-sm border-b-2 transition-colors",
            activeSpace === "collab"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-muted-foreground hover:text-zinc-700"
          )}
        >
          Collaborative Tasks
        </button>
      </div>

      {/* Task Creation Form */}
      <Card className="dark:bg-zinc-900/40 border-zinc-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-900 text-lg">Create New Task</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <Field label="Task Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTask()}
              placeholder="What needs doing?"
              className="bg-white dark:bg-zinc-950 border-zinc-200"
            />
          </Field>
          <Field label="Task Note (Important details)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTask()}
              placeholder="Details or comments..."
              className="bg-white dark:bg-zinc-950 border-zinc-200"
            />
          </Field>
          <Field label="Assigned To">
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="bg-white dark:bg-zinc-950 border-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={user1}>{user1}</SelectItem>
                <SelectItem value={user2}>{user2}</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
              <SelectTrigger className="bg-white dark:bg-zinc-950 border-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="bg-white dark:bg-zinc-950 border-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {activeProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due Date">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white dark:bg-zinc-950 border-zinc-200"
            />
          </Field>
          <Button onClick={createTask} className="w-full mt-2 xl:mt-0">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </CardContent>
      </Card>

      {/* Task Requests / Approvals Panel */}
      {incomingRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Incoming Task Requests ({incomingRequests.length})
            </CardTitle>
            <p className="text-xs text-amber-700">
              Tasks assigned to you by the other user. Approve them to add them to your task space.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {incomingRequests.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-4 p-3 rounded-xl border border-amber-200 bg-white shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-zinc-900 truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created by: <span className="font-medium text-zinc-700">{task.created_by}</span>
                    {task.note && <span className="italic ml-2 text-zinc-500">• Note: {task.note}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => tasks.update(task.id, { approved: true })}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => tasks.remove(task.id)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pendingRequests.length > 0 && (
        <Card className="border-zinc-200 bg-zinc-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-700 text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-zinc-500" />
              Sent Tasks Awaiting Approval ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pendingRequests.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-white text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-zinc-800">{task.title}</span>
                  {task.note && <span className="italic text-muted-foreground ml-2">• Note: {task.note}</span>}
                </div>
                <span className="text-zinc-500 italic font-medium">Awaiting {activeSpace === "user1" ? user2 : user1}&apos;s approval</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sub-Filters Tabs (Level 2) */}
      <div className="flex flex-wrap gap-2">
        {subFilters.map((item) => (
          <Button
            key={item}
            variant={subFilter === item ? "default" : "outline"}
            onClick={() => setSubFilter(item)}
            className="rounded-xl border-zinc-200 text-xs px-4"
          >
            {item}
          </Button>
        ))}
      </div>

      {/* Main Task List */}
      <div className="grid gap-3">
        {filtered.length ? (
          filtered.map((task) => <TaskRow key={task.id} task={task} />)
        ) : (
          <EmptyState title={`No tasks in this list.`} />
        )}
      </div>
    </div>
  );
}
