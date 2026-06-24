"use client";

import { useState, useEffect } from "react";
import { Check, Trash2, Calendar } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useData, useUserNames, useActiveUser, useUserColors } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/database.types";

function getDueDateLabel(dueDateStr: string) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dueDateStr === todayStr) {
      return { label: "Today", variant: "today" };
    }
    
    const parsedDue = parseISO(dueDateStr);
    const parsedToday = parseISO(todayStr);
    const diffDays = differenceInCalendarDays(parsedDue, parsedToday);

    if (diffDays === 1) {
      return { label: "Tomorrow", variant: "tomorrow" };
    } else if (diffDays === -1) {
      return { label: "Yesterday", variant: "overdue" };
    } else if (diffDays < 0) {
      return { label: `Overdue (${Math.abs(diffDays)}d ago)`, variant: "overdue" };
    } else if (diffDays <= 7) {
      return { label: format(parsedDue, "eeee"), variant: "upcoming" };
    } else {
      return { label: format(parsedDue, "MMM d"), variant: "future" };
    }
  } catch {
    return { label: dueDateStr, variant: "future" };
  }
}

export function TaskRow({ task, compact = false }: { task: Row<"tasks">; compact?: boolean }) {
  const { tasks, projects, sendNotification, activeUser, activePartner } = useData();
  const { activeUserName } = useActiveUser();
  const { user1, user2, user3 } = useUserNames();
  const userColors = useUserColors();

  const partnerUserKey = activeUser === "user1" ? activePartner : (activeUser === "user2" ? "user2" : "user3");
  const partnerUserName = partnerUserKey === "user3" ? user3 : user2;
  const partnerColor = partnerUserKey === "user3" ? userColors.user3 : userColors.user2;
  const partnerInit = partnerUserName ? (partnerUserName.length > 3 ? partnerUserName.slice(0, 3) : partnerUserName) : "PT";
  const project = projects.rows.find((item) => item.id === task.project_id);
  const isCreator = task.created_by === activeUserName || task.created_by === "Unknown";

  const [noteDraft, setNoteDraft] = useState(task.note || "");
  const [isEditingNote, setIsEditingNote] = useState(false);

  useEffect(() => {
    setNoteDraft(task.note || "");
  }, [task.note]);

  const handleSaveNote = async () => {
    setIsEditingNote(false);
    if (noteDraft.trim() !== task.note) {
      await tasks.update(task.id, { note: noteDraft.trim() });
    }
  };

  const u1Init = user1 ? (user1.length > 3 ? user1.slice(0, 3) : user1) : "U1";

  const isBoth = (task.assigned_to || "").trim().toLowerCase() === "both";
  const canDelete = isCreator || isBoth;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white/35 p-3 dark:border-white/10 dark:bg-black/35 backdrop-blur-xl shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] hover:border-white/40">
      {isBoth ? (
        <div className="flex gap-1.5 shrink-0">
          {/* User 1 Circle */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full text-[10px] font-bold transition-all border-2",
              activeUser !== "user1" && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-inherit"
            )}
            style={{
              backgroundColor: task.completed_user1 ? userColors.user1 : "transparent",
              borderColor: userColors.user1,
              color: task.completed_user1 ? "#ffffff" : userColors.user1
            }}
            onClick={async () => {
              if (activeUser === "user1") {
                const nextVal = !task.completed_user1;
                await tasks.update(task.id, {
                  completed_user1: nextVal,
                  completed: nextVal && !!task.completed_user2
                });
                if (nextVal) {
                  sendNotification(
                    activePartner,
                    "Task Component Done",
                    `${user1} completed their part of: ${task.title}`
                  );
                }
              }
            }}
            disabled={activeUser !== "user1"}
            title={`${user1}: ${task.completed_user1 ? "Done" : "Pending"}`}
          >
            {task.completed_user1 ? <Check className="h-3 w-3 text-white" /> : <span>{u1Init}</span>}
          </Button>

          {/* User 2 Circle */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full text-[10px] font-bold transition-all border-2",
              activeUser !== partnerUserKey && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-inherit"
            )}
            style={{
              backgroundColor: task.completed_user2 ? partnerColor : "transparent",
              borderColor: partnerColor,
              color: task.completed_user2 ? "#ffffff" : partnerColor
            }}
            onClick={async () => {
              if (activeUser === partnerUserKey) {
                const nextVal = !task.completed_user2;
                await tasks.update(task.id, {
                  completed_user2: nextVal,
                  completed: !!task.completed_user1 && nextVal
                });
                if (nextVal) {
                  sendNotification(
                    "user1",
                    "Task Component Done",
                    `${partnerUserName} completed their part of: ${task.title}`
                  );
                }
              }
            }}
            disabled={activeUser !== partnerUserKey}
            title={`${partnerUserName}: ${task.completed_user2 ? "Done" : "Pending"}`}
          >
            {task.completed_user2 ? <Check className="h-3 w-3 text-white" /> : <span>{partnerInit}</span>}
          </Button>
        </div>
      ) : (
        /* Single User Circle */
        (() => {
          const u1 = (user1 || "").trim().toLowerCase();
          const activeName = (activeUserName || "").trim().toLowerCase();
          const taskAssignee = (task.assigned_to || "").trim().toLowerCase();
          
          const isUser1 = taskAssignee === u1;
          const assignedColor = isUser1 ? userColors.user1 : partnerColor;
          const isAssignedToActiveUser = activeName !== "" && taskAssignee === activeName;
          return (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full shrink-0 border-2",
                !isAssignedToActiveUser && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-inherit"
              )}
              style={{
                backgroundColor: task.completed ? assignedColor : "transparent",
                borderColor: assignedColor,
                color: task.completed ? "#ffffff" : assignedColor
              }}
              onClick={async () => {
                if (isAssignedToActiveUser) {
                  const nextVal = !task.completed;
                  await tasks.update(task.id, { completed: nextVal });
                  if (nextVal) {
                    const otherUserKey = activeUser === "user1" ? activePartner : "user1";
                    sendNotification(
                      otherUserKey,
                      "Task Completed",
                      `${activeUserName} completed: ${task.title}`
                    );
                  }
                }
              }}
              disabled={!isAssignedToActiveUser}
              aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
              title={!isAssignedToActiveUser ? `Only ${task.assigned_to} can complete this task` : undefined}
            >
              {task.completed ? <Check className="h-4 w-4 text-white" /> : null}
            </Button>
          );
        })()
      )}

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate font-medium text-zinc-900 dark:text-dark-text",
            task.completed && "text-muted-foreground line-through opacity-70"
          )}
        >
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Assigned: {task.assigned_to}</span>
          {project ? <span>Project: {project.name}</span> : null}
          {task.created_by && task.created_by !== "Unknown" ? (
            <span>By: {task.created_by}</span>
          ) : null}
        </div>

        {/* Editable Task Note */}
        {task.note || isEditingNote ? (
          <div className="mt-2 text-xs border-t pt-1.5 border-white/15 dark:border-white/5">
            {isEditingNote ? (
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={handleSaveNote}
                onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
                placeholder="Write a note..."
                className="w-full text-xs px-2 py-1 bg-white/20 dark:bg-black/30 border border-white/20 dark:border-white/10 rounded outline-none text-slate-800 dark:text-white placeholder-slate-400 focus:border-indigo-500"
                autoFocus
              />
            ) : (
              <p
                onClick={() => setIsEditingNote(true)}
                className="text-slate-600 dark:text-dark-text-secondary hover:bg-white/40 dark:hover:bg-white/5 cursor-pointer p-1 rounded transition-colors italic"
              >
                Note: {task.note}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsEditingNote(true)}
            className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-700 dark:text-dark-text-secondary dark:hover:text-dark-text hover:underline cursor-pointer block"
          >
            + Add Note
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.due_date && (
          <Badge
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 font-medium text-xs rounded-md border shadow-none",
              task.completed
                ? "bg-white/10 text-slate-400 border-white/10 dark:bg-white/5 dark:text-dark-text-secondary dark:border-white/5"
                : (() => {
                    const info = getDueDateLabel(task.due_date!);
                    if (info.variant === "overdue") {
                      return "bg-red-500/15 text-red-700 border-red-500/30 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 font-semibold";
                    }
                    if (info.variant === "today") {
                      return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 font-semibold";
                    }
                    if (info.variant === "tomorrow") {
                      return "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50 font-semibold";
                    }
                    if (info.variant === "upcoming") {
                      return "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50";
                    }
                    return "bg-white/20 text-slate-700 border-white/20 dark:bg-white/10 dark:text-dark-text-secondary dark:border-white/10";
                  })()
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{getDueDateLabel(task.due_date).label}</span>
          </Badge>
        )}
        {!compact ? (
          <Badge
            className={cn(
              "border shadow-none",
              task.priority === "High"
                ? "bg-red-500/15 text-red-700 border-red-500/30 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 font-semibold"
                : task.priority === "Medium"
                ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 font-semibold"
                : "bg-white/20 text-slate-700 border-white/20 dark:bg-white/10 dark:text-dark-text-secondary dark:border-white/10"
            )}
          >
            {task.priority}
          </Badge>
        ) : null}
      </div>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-red-50 hover:text-destructive shrink-0"
          onClick={() => tasks.remove(task.id)}
          title="Delete Task"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
