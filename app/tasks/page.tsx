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
  const { tasks, projects, activeUserName, activeUser, sendNotification } = useData();
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
    const target = (targetAssigneeName || "").trim().toLowerCase();
    return tasks.rows.filter(
      (task) => (task.assigned_to || "").trim().toLowerCase() === target && task.approved !== false
    );
  }, [tasks.rows, targetAssigneeName]);

  // Sub-filter approved tasks (All, Today, Upcoming, Completed)
  const filtered = useMemo(() => {
    return approvedTasks.filter((task) => {
      if (subFilter === "Today") return !task.completed && task.due_date === today;
      if (subFilter === "Upcoming") return !task.completed && Boolean(task.due_date && task.due_date > today);
      if (subFilter === "Completed") return task.completed;
      return !task.completed; // "All" = all active (non-completed) tasks
    });
  }, [subFilter, approvedTasks, today]);

  // Get tasks AWAITING APPROVAL in the activeSpace
  // Scenario A: Logged-in user is the assignee -> they must approve or decline
  const incomingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || (activeUserName || "").trim().toLowerCase() !== spaceUser.trim().toLowerCase()) return [];
    const spaceUserLower = spaceUser.trim().toLowerCase();
    return tasks.rows.filter(
      (task) => (task.assigned_to || "").trim().toLowerCase() === spaceUserLower && task.approved === false
    );
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  // Scenario B: Logged-in user is the creator but assigned to other -> show as pending status
  const pendingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || (activeUserName || "").trim().toLowerCase() === spaceUser.trim().toLowerCase()) return [];
    const spaceUserLower = spaceUser.trim().toLowerCase();
    const activeUserNameLower = (activeUserName || "").trim().toLowerCase();
    return tasks.rows.filter(
      (task) =>
        (task.assigned_to || "").trim().toLowerCase() === spaceUserLower &&
        task.approved === false &&
        (task.created_by || "").trim().toLowerCase() === activeUserNameLower
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

    const otherUserKey = activeUser === "user1" ? "user2" : "user1";
    if (assignedTo === "Both") {
      sendNotification(
        otherUserKey,
        "New Task Assigned to Both",
        `${activeUserName} created: ${title.trim()}`
      );
    } else {
      const targetUser = assignedTo === user1 ? "user1" : "user2";
      if (targetUser === otherUserKey) {
        sendNotification(
          otherUserKey,
          "New Task Assigned to you",
          `${activeUserName} created: ${title.trim()}`
        );
      }
    }

    setTitle("");
    setNote("");
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Tasks</h1>
      </div>

      {/* Main Spaces Navigation Tabs */}
      <div className="flex p-1 bg-white/20 dark:bg-black/25 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/10 w-fit">
        <button
          onClick={() => handleSpaceChange("user1")}
          className={cn(
            "py-2 px-5 font-semibold text-xs rounded-xl transition-all duration-200",
            activeSpace === "user1"
              ? "bg-white/45 dark:bg-white/15 border-white/45 dark:border-white/20 text-zinc-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-dark-text-secondary hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          {user1}&apos;s Tasks
        </button>
        <button
          onClick={() => handleSpaceChange("user2")}
          className={cn(
            "py-2 px-5 font-semibold text-xs rounded-xl transition-all duration-200",
            activeSpace === "user2"
              ? "bg-white/45 dark:bg-white/15 border-white/45 dark:border-white/20 text-zinc-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-dark-text-secondary hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          {user2}&apos;s Tasks
        </button>
        <button
          onClick={() => handleSpaceChange("collab")}
          className={cn(
            "py-2 px-5 font-semibold text-xs rounded-xl transition-all duration-200",
            activeSpace === "collab"
              ? "bg-white/45 dark:bg-white/15 border-white/45 dark:border-white/20 text-zinc-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-dark-text-secondary hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          Collaborative Tasks
        </button>
      </div>

      {/* Task Creation Form */}
      <Card className="bg-white/30 dark:bg-black/35 backdrop-blur-xl border border-white/25 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-900 dark:text-white text-base font-bold">Create New Task</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_1fr_1.1fr_1fr_1.1fr_1fr_auto] xl:items-end">
          <Field label="Task Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTask()}
              placeholder="What needs doing?"
              className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
            />
          </Field>
          <Field label="Task Note">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTask()}
              placeholder="Details or comments..."
              className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
            />
          </Field>
          <Field label="Assigned To">
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-xl border-white/20 dark:border-white/10 text-slate-800 dark:text-white rounded-xl">
                <SelectItem value={user1}>{user1}</SelectItem>
                <SelectItem value={user2}>{user2}</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
              <SelectTrigger className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-xl border-white/20 dark:border-white/10 text-slate-800 dark:text-white rounded-xl">
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-xl border-white/20 dark:border-white/10 text-slate-800 dark:text-white rounded-xl">
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
              className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white rounded-xl"
            />
          </Field>
          <Button onClick={createTask} className="w-full mt-2 xl:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all active:scale-[0.98]">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </CardContent>
      </Card>

      {/* Task Requests / Approvals Panel */}
      {incomingRequests.length > 0 && (
        <Card className="bg-amber-500/10 dark:bg-amber-950/20 backdrop-blur-xl border border-amber-500/20 dark:border-amber-500/10 shadow-xl rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 dark:text-amber-300 text-base font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Incoming Task Requests ({incomingRequests.length})
            </CardTitle>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              Tasks assigned to you by the other user. Approve them to add them to your task space.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {incomingRequests.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/35 backdrop-blur-md shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{task.title}</p>
                  <p className="text-xs text-slate-500 dark:text-dark-text-secondary mt-0.5">
                    Created by: <span className="font-medium text-zinc-700 dark:text-white">{task.created_by}</span>
                    {task.note && <span className="italic ml-2 text-slate-600 dark:text-dark-text-secondary">• Note: {task.note}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all active:scale-95"
                    onClick={async () => {
                      await tasks.update(task.id, { approved: true });
                      const otherUserKey = activeUser === "user1" ? "user2" : "user1";
                      sendNotification(
                         otherUserKey,
                         "Task Request Approved",
                         `${activeUserName} approved your task: ${task.title}`
                      );
                    }}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl border border-red-500/20 text-red-650 hover:bg-red-500/10 dark:text-red-405 dark:border-red-500/10 dark:hover:bg-red-950/20 font-bold transition-all active:scale-95"
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
        <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-700 dark:text-dark-text-secondary text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-zinc-500" />
              Sent Tasks Awaiting Approval ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pendingRequests.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl border border-white/10 dark:border-white/5 bg-white/30 dark:bg-black/25 text-xs text-slate-800 dark:text-dark-text">
                <div className="min-w-0">
                  <span className="font-medium">{task.title}</span>
                  {task.note && <span className="italic text-slate-500 dark:text-dark-text-secondary ml-2">• Note: {task.note}</span>}
                </div>
                <span className="text-slate-500 dark:text-dark-text-secondary italic font-medium">Awaiting {activeSpace === "user1" ? user2 : user1}&apos;s approval</span>
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
            variant="ghost"
            onClick={() => setSubFilter(item)}
            className={cn(
              "rounded-xl border border-transparent text-xs px-4 py-2 transition-all font-semibold",
              subFilter === item 
                ? "bg-indigo-650 text-white dark:bg-indigo-600/90 shadow-md shadow-indigo-600/20 border-indigo-400/20" 
                : "bg-white/25 dark:bg-black/25 border-white/10 dark:border-white/5 text-slate-700 dark:text-dark-text hover:bg-white/40 dark:hover:bg-white/5"
            )}
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
