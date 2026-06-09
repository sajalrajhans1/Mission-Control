"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Archive, ArchiveRestore, Download, FileText, Link2,
  Paperclip, Plus, Trash2, Send, MessageSquare, ListTodo, Paperclip as PaperclipIcon,
  Briefcase, Lock, Unlock, Users, CheckCircle2, Circle, Clock, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { TaskRow } from "@/components/task-row";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { useData, useUserNames, useActiveUser, useUserColors } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import type { Row, Json } from "@/lib/database.types";
import { RichTextEditor } from "@/components/rich-text-editor";

type Tab = "tasks" | "docs" | "chat";

type ChatMessage = {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = React.use(params);
  const router = useRouter();
  const { projects, tasks, projectFiles, projectMilestones, settings } = useData();
  const { activeUserName } = useActiveUser();
  const names = useUserNames();
  const userColors = useUserColors();

  const [activeTab, setActiveTab] = useState<Tab>("tasks");

  // State for adding tasks, docs, and chat messages
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [deletingFile, setDeletingFile] = useState<Row<"project_files"> | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [newTaskAssigned, setNewTaskAssigned] = useState("Both");
  const [newTaskPriority, setNewTaskPriority] = useState<"Low" | "Medium" | "High">("Medium");

  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Milestone creation state
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");

  // Client Briefing state
  const [briefingDraft, setBriefingDraft] = useState("");
  const [activeScopeTab, setActiveScopeTab] = useState<"briefing" | "prd">("briefing");

  // Find active project
  const project = projects.rows.find((p) => p.id === projectId);
  const projectTasks = tasks.rows.filter((task) => task.project_id === projectId && task.approved !== false);
  const filesList = projectFiles.rows.filter((f) => f.project_id === projectId);

  // Project milestones
  const milestones = projectMilestones.rows.filter((m) => m.project_id === projectId);

  // Chat preference row
  const chatKey = `project_chat_${projectId}`;
  const chatRow = settings.rows.find((r) => r.key === chatKey);
  const chatHistory = useMemo<ChatMessage[]>(() => {
    if (!chatRow || !chatRow.value) return [];
    return Array.isArray(chatRow.value) ? (chatRow.value as unknown as ChatMessage[]) : [];
  }, [chatRow]);

  // Description / PRD Autosave
  const [prdDraft, setPrdDraft] = useState("");
  useEffect(() => {
    if (project) {
      setPrdDraft(project.description || "");
      setBriefingDraft(project.client_briefing || "");
    }
  }, [project]);

  // Scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [activeTab, chatHistory]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <EmptyState title="Project not found." />
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  const savePrd = async (val: string) => {
    await projects.update(project.id, { description: val });
  };

  const saveBriefing = async (val: string) => {
    await projects.update(project.id, { client_briefing: val });
  };

  const handleAddMilestone = async () => {
    if (!milestoneTitle.trim()) return;
    await projectMilestones.create({
      project_id: projectId,
      title: milestoneTitle.trim(),
      due_date: milestoneDueDate ? new Date(milestoneDueDate).toISOString() : null,
      completed: false
    });
    setMilestoneTitle("");
    setMilestoneDueDate("");
  };

  const handleToggleMilestone = async (id: string, completed: boolean) => {
    await projectMilestones.update(id, { completed });
  };

  const handleDeleteMilestone = async (id: string) => {
    await projectMilestones.remove(id);
  };

  // Attach link doc helper
  const addDocLink = async () => {
    if (!docName.trim() || !docUrl.trim()) return;
    await projectFiles.create({
      project_id: projectId,
      name: docName.trim(),
      url: docUrl.trim(),
      file_data: null,
      uploaded_by: activeUserName || "User"
    });
    setDocName("");
    setDocUrl("");
  };

  // Upload local document helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await projectFiles.create({
        project_id: projectId,
        name: file.name,
        file_data: base64,
        url: null,
        uploaded_by: activeUserName || "User"
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Add Task helper
  const addProjectTask = async () => {
    if (!newTaskTitle.trim()) return;
    await tasks.create({
      title: newTaskTitle.trim(),
      project_id: projectId,
      assigned_to: newTaskAssigned,
      priority: newTaskPriority,
      due_date: null,
      completed_user1: false,
      completed_user2: false,
      created_by: activeUserName || "Unknown",
      note: newTaskNote.trim(),
      approved: newTaskAssigned === "Both" || newTaskAssigned === activeUserName
    });
    setNewTaskTitle("");
    setNewTaskNote("");
  };

  // Send Chat Message helper
  const sendMsg = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatMessage.trim()) return;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: activeUserName || "Unknown",
      message: chatMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedValue = [...chatHistory, newMessage];

    if (chatRow) {
      await settings.update(chatRow.id, { value: updatedValue as unknown as Json });
    } else {
      await settings.create({ key: chatKey, value: updatedValue as unknown as Json });
    }
    setChatMessage("");
  };

  return (
    <div className="grid gap-6">
      {/* Header Navigator */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="p-2 hover:bg-zinc-100 rounded-xl transition-colors shrink-0">
            <ArrowLeft className="h-5 w-5 text-zinc-600" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* Type Badge */}
              {project.project_type === "client" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  Client Project
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  Normal Project
                </span>
              )}
              {/* Privacy Badge */}
              {project.is_private ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">
                  <Lock className="h-3 w-3 shrink-0" />
                  Private Project
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <Users className="h-3 w-3 shrink-0" />
                  Collaborative Project
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex flex-wrap items-center gap-2.5">
              {project.name}
              {project.archived && (
                <span className="text-xs bg-zinc-200 text-zinc-700 px-2.5 py-0.5 rounded-full font-medium">Archived</span>
              )}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Privacy Toggle Switch */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border dark:border-zinc-800 flex items-center gap-1.5 bg-white text-zinc-700 hover:text-zinc-950 dark:bg-zinc-950 dark:text-zinc-300"
            onClick={() => projects.update(project.id, { is_private: !project.is_private })}
          >
            {project.is_private ? <Unlock className="h-4 w-4 text-emerald-500 hover:scale-110 transition-transform" /> : <Lock className="h-4 w-4 text-amber-500 hover:scale-110 transition-transform" />}
            {project.is_private ? "Make Collaborative" : "Make Private"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border dark:border-zinc-800"
            onClick={() => projects.update(project.id, { archived: !project.archived })}
          >
            {project.archived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            {project.archived ? "Restore Project" : "Archive Project"}
          </Button>
        </div>
      </div>

      {/* Main Two Column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left Hand Screen: Scope & Roadmap */}
        <div className="grid gap-6 content-start">
          {project.project_type === "client" ? (
            <>
              {/* Project Scope Card */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-3 border-b bg-zinc-50/50 dark:bg-zinc-900/50 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-zinc-900 dark:text-zinc-50 text-base flex items-center gap-1.5 font-bold">
                      <FileText className="h-4.5 w-4.5 text-blue-500" />
                      Project Scope
                    </CardTitle>
                    <div className="flex border rounded-lg p-0.5 bg-white dark:bg-zinc-950 dark:border-zinc-800 text-xs shrink-0 shadow-sm">
                      <button
                        onClick={() => setActiveScopeTab("briefing")}
                        className={cn(
                          "px-2.5 py-1 font-semibold rounded-md transition-all",
                          activeScopeTab === "briefing"
                            ? "bg-zinc-150 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                            : "text-muted-foreground hover:text-zinc-700"
                        )}
                      >
                        Client Briefing
                      </button>
                      <button
                        onClick={() => setActiveScopeTab("prd")}
                        className={cn(
                          "px-2.5 py-1 font-semibold rounded-md transition-all",
                          activeScopeTab === "prd"
                            ? "bg-zinc-150 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                            : "text-muted-foreground hover:text-zinc-700"
                        )}
                      >
                        PRD Specs
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {activeScopeTab === "briefing" ? (
                    <RichTextEditor
                      initialValue={briefingDraft}
                      onSave={saveBriefing}
                      placeholder="Paste the client's original brief, requirements, Fiverr instructions, or communication details here... (Saves on click-away)"
                    />
                  ) : (
                    <RichTextEditor
                      initialValue={prdDraft}
                      onSave={savePrd}
                      placeholder="Write your technical specs, milestones detail, deliverables, and PRD requirements here... (Saves on click-away)"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Milestones Card */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-zinc-900 dark:text-zinc-50 text-base flex items-center gap-1.5 font-bold">
                      <Calendar className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
                      Timeline &amp; Milestones
                    </CardTitle>
                    {milestones.length > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {milestones.filter(m => m.completed).length} / {milestones.length} done
                      </span>
                    )}
                  </div>
                  {milestones.length > 0 && (
                    <Progress
                      value={(milestones.filter(m => m.completed).length / milestones.length) * 100} 
                      className="h-1.5 mt-2 bg-blue-100/30"
                    />
                  )}
                </CardHeader>
                <CardContent className="grid gap-4 pt-4">
                  {/* Quick Add Form */}
                  <div className="grid gap-2 border p-3.5 rounded-xl bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Add Milestone Checkpoint</h4>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 grid gap-1">
                        <label className="text-[10px] font-semibold text-zinc-400">Title</label>
                        <Input
                          value={milestoneTitle}
                          onChange={(e) => setMilestoneTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
                          placeholder="e.g. Deliver first UI prototypes..."
                          className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200"
                        />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-[10px] font-semibold text-zinc-400">Due Date &amp; Time</label>
                        <Input
                          type="datetime-local"
                          value={milestoneDueDate}
                          onChange={(e) => setMilestoneDueDate(e.target.value)}
                          className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 w-full sm:w-[180px]"
                        />
                      </div>
                      <Button onClick={handleAddMilestone} size="sm" className="h-8.5 shrink-0 px-3">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* Timeline List */}
                  <div className="relative pl-6 border-l border-zinc-200 dark:border-zinc-800 space-y-4 ml-3 pt-2">
                    {milestones.map((m) => {
                      const isOverdue = m.due_date && new Date(m.due_date) < new Date() && !m.completed;
                      return (
                        <div key={m.id} className="relative group/item">
                          {/* Visual Node */}
                          <span className="absolute -left-[31px] top-1 z-10 p-0.5 rounded-full transition-transform group-hover/item:scale-110">
                            {m.completed ? (
                              <CheckCircle2
                                className="h-5 w-5 text-emerald-500 fill-emerald-50 cursor-pointer dark:bg-zinc-950"
                                onClick={() => handleToggleMilestone(m.id, false)}
                              />
                            ) : (
                              <Circle
                                className={cn(
                                  "h-5 w-5 bg-white cursor-pointer dark:bg-zinc-950",
                                  isOverdue ? "text-red-500 fill-red-50" : "text-zinc-400"
                                )}
                                onClick={() => handleToggleMilestone(m.id, true)}
                              />
                            )}
                          </span>
                          
                          {/* Milestone Card */}
                          <div className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-white dark:bg-zinc-900/50 dark:border-zinc-800 hover:shadow-soft transition-all">
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                "text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-words leading-tight",
                                m.completed ? "line-through text-zinc-400 dark:text-zinc-500 font-medium" : ""
                              )}>
                                {m.title}
                              </p>
                              {m.due_date && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-zinc-500">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>
                                    {new Date(m.due_date).toLocaleString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true
                                    })}
                                  </span>
                                  {isOverdue && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-bold ml-1.5">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
                              onClick={() => handleDeleteMilestone(m.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {milestones.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground pr-6">
                        <Calendar className="h-8 w-8 opacity-45 mb-1.5" />
                        <p className="text-xs font-semibold">No milestones added yet.</p>
                        <p className="text-[10px] mt-0.5">Map out dates/times to create your client roadmap.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            /* Normal Project PRD specs */
            <Card className="h-full">
              <CardHeader className="pb-3 border-b bg-zinc-50/50 dark:bg-zinc-900/50 dark:border-zinc-800">
                <CardTitle className="text-zinc-900 dark:text-zinc-50 text-base flex items-center gap-1.5 font-bold">
                  <FileText className="h-4.5 w-4.5 text-zinc-500" />
                  Product Requirements Document (PRD)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <RichTextEditor
                  initialValue={prdDraft}
                  onSave={savePrd}
                  placeholder="Paste startup ideation details or describe the product requirements document (PRD) here... (Saves on click-away)"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Hand Screen: Navigator Panel (Tabs) */}
        <div className="flex flex-col h-[600px] lg:h-auto min-h-[500px]">
          <Card className="flex flex-col h-full overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            {/* Navigator Tab Selector */}
            <div className="flex border-b bg-zinc-50/50 dark:bg-zinc-900/50 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab("tasks")}
                className={cn(
                  "flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors",
                  activeTab === "tasks" ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" : "border-transparent text-muted-foreground hover:text-zinc-700"
                )}
              >
                <ListTodo className="h-4 w-4" />
                Tasks ({projectTasks.length})
              </button>
              <button
                onClick={() => setActiveTab("docs")}
                className={cn(
                  "flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors",
                  activeTab === "docs" ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" : "border-transparent text-muted-foreground hover:text-zinc-700"
                )}
              >
                <PaperclipIcon className="h-4 w-4" />
                Docs ({filesList.length})
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors",
                  activeTab === "chat" ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" : "border-transparent text-muted-foreground hover:text-zinc-700"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Chat ({chatHistory.length})
              </button>
            </div>

            {/* Tab Contents Panel */}
            <div className="flex-1 overflow-y-auto p-4 dark:bg-zinc-950/20">
              {/* TASKS TAB */}
              {activeTab === "tasks" && (
                <div className="grid gap-4">
                  <div className="grid gap-3 border p-4 rounded-xl bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <Field label="Task Title">
                      <Input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addProjectTask()}
                        placeholder="Add deliverables..."
                        className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-805"
                      />
                    </Field>
                    <Field label="Task Note">
                      <Input
                        value={newTaskNote}
                        onChange={(e) => setNewTaskNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addProjectTask()}
                        placeholder="Important details..."
                        className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-805"
                      />
                    </Field>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Assignee">
                        <Select value={newTaskAssigned} onValueChange={setNewTaskAssigned}>
                          <SelectTrigger className="bg-white dark:bg-zinc-950 border-zinc-200"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={names.user1}>{names.user1}</SelectItem>
                            <SelectItem value={names.user2}>{names.user2}</SelectItem>
                            <SelectItem value="Both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Priority">
                        <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as typeof newTaskPriority)}>
                          <SelectTrigger className="bg-white dark:bg-zinc-950 border-zinc-200"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Button onClick={addProjectTask} className="w-full mt-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    {projectTasks.map((task) => (
                      <TaskRow key={task.id} task={task} compact />
                    ))}
                    {projectTasks.length === 0 && (
                      <EmptyState title="No project tasks." />
                    )}
                  </div>
                </div>
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === "docs" && (
                <div className="grid gap-4">
                  <div className="grid gap-3 border p-4 rounded-xl bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <div className="grid gap-2">
                      <Field label="Link Title">
                        <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Google Drive PRD..." className="bg-white dark:bg-zinc-955 border-zinc-200" />
                      </Field>
                      <Field label="Document Link URL">
                        <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://drive.google.com/..." className="bg-white dark:bg-zinc-955 border-zinc-200" />
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <Button onClick={addDocLink} disabled={!docName.trim() || !docUrl.trim()} size="sm">
                        <Link2 className="h-4 w-4 mr-2" />
                        Attach Link
                      </Button>
                      <label className="flex items-center gap-2 rounded-xl border px-3 py-1.5 cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-xs font-semibold transition-colors">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Upload File</span>
                        <input type="file" accept="*/*" onChange={handleFileUpload} className="sr-only" />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {filesList.map((file) => (
                      <div key={file.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-white dark:bg-zinc-900/30 dark:border-zinc-800">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate text-zinc-800 dark:text-zinc-200" title={file.name}>{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">By {file.uploaded_by}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {file.file_data ? (
                            <a href={file.file_data} download={file.name} className="p-1 hover:bg-accent dark:hover:bg-zinc-800 rounded">
                              <Download className="h-3.5 w-3.5 text-zinc-650 dark:text-zinc-350" />
                            </a>
                          ) : (
                            <a href={file.url || "#"} target="_blank" rel="noreferrer" className="p-1 hover:bg-accent dark:hover:bg-zinc-800 rounded">
                              <Link2 className="h-3.5 w-3.5 text-zinc-650 dark:text-zinc-350" />
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeletingFile(file)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {filesList.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4 italic">No documents attached yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <div className="flex flex-col h-[480px] justify-between">
                  {/* Message History list */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                    {chatHistory.map((msg) => {
                      const isMe = msg.sender === activeUserName;
                      const senderColor = msg.sender === names.user1 ? userColors.user1 : userColors.user2;

                      return (
                        <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                            {!isMe && (
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: senderColor }}
                              />
                            )}
                            <span>{msg.sender}</span>
                            <span>•</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <div
                            className={cn(
                              "px-3.5 py-2 rounded-2xl text-sm leading-5 shadow-sm break-words",
                              isMe ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-none" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 rounded-tl-none"
                            )}
                          >
                            {msg.message}
                          </div>
                        </div>
                      );
                    })}
                    {chatHistory.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <MessageSquare className="h-8 w-8 opacity-45 mb-1.5" />
                        <p className="text-xs font-medium">No messages yet.</p>
                        <p className="text-[10px] mt-0.5">Start the conversation about this project.</p>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={sendMsg} className="flex gap-2 border-t pt-3 bg-white dark:bg-zinc-950 mt-1 shrink-0">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="rounded-xl flex-1 text-sm focus-visible:ring-1 dark:bg-zinc-900 dark:border-zinc-800"
                    />
                    <Button type="submit" size="icon" className="rounded-xl shrink-0" disabled={!chatMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Delete document confirmation */}
      <ConfirmDialog
        open={Boolean(deletingFile)}
        onOpenChange={(open) => !open && setDeletingFile(null)}
        title="Delete Document?"
        description={`Are you sure you want to delete attachment "${deletingFile?.name}"?`}
        onConfirm={() => {
          if (deletingFile) projectFiles.remove(deletingFile.id);
        }}
      />
    </div>
  );
}
