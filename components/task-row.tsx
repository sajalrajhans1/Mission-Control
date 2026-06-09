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
  const { tasks, projects } = useData();
  const { activeUser, activeUserName } = useActiveUser();
  const { user1, user2 } = useUserNames();
  const userColors = useUserColors();
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

  const u1Init = user1 ? user1[0].toUpperCase() : "1";
  const u2Init = user2 ? user2[0].toUpperCase() : "2";

  const isBoth = task.assigned_to === "Both";

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {isBoth ? (
        <div className="flex gap-1.5 shrink-0">
          {/* User 1 Circle */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full text-xs font-bold transition-all border-2",
              activeUser !== "user1" && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-inherit"
            )}
            style={{
              backgroundColor: task.completed_user1 ? userColors.user1 : "transparent",
              borderColor: userColors.user1,
              color: task.completed_user1 ? "#ffffff" : userColors.user1
            }}
            onClick={() => {
              if (activeUser === "user1") {
                const nextVal = !task.completed_user1;
                tasks.update(task.id, {
                  completed_user1: nextVal,
                  completed: nextVal && task.completed_user2
                });
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
              "h-8 w-8 rounded-full text-xs font-bold transition-all border-2",
              activeUser !== "user2" && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-inherit"
            )}
            style={{
              backgroundColor: task.completed_user2 ? userColors.user2 : "transparent",
              borderColor: userColors.user2,
              color: task.completed_user2 ? "#ffffff" : userColors.user2
            }}
            onClick={() => {
              if (activeUser === "user2") {
                const nextVal = !task.completed_user2;
                tasks.update(task.id, {
                  completed_user2: nextVal,
                  completed: task.completed_user1 && nextVal
                });
              }
            }}
            disabled={activeUser !== "user2"}
            title={`${user2}: ${task.completed_user2 ? "Done" : "Pending"}`}
          >
            {task.completed_user2 ? <Check className="h-3 w-3 text-white" /> : <span>{u2Init}</span>}
          </Button>
        </div>
      ) : (
        /* Single User Circle */
        (() => {
          const isUser1 = task.assigned_to === user1;
          const assignedColor = isUser1 ? userColors.user1 : userColors.user2;
          const isAssignedToActiveUser = task.assigned_to === activeUserName;
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
              onClick={() => {
                if (isAssignedToActiveUser) {
                  tasks.update(task.id, { completed: !task.completed });
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
            "truncate font-medium text-zinc-900 dark:text-zinc-50",
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
          <div className="mt-2 text-xs border-t pt-1.5 border-zinc-100">
            {isEditingNote ? (
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={handleSaveNote}
                onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
                placeholder="Write a note..."
                className="w-full text-xs px-2 py-1 bg-zinc-50 border rounded outline-none border-zinc-200 focus:border-zinc-500"
                autoFocus
              />
            ) : (
              <p
                onClick={() => setIsEditingNote(true)}
                className="text-muted-foreground hover:bg-zinc-50 cursor-pointer p-1 rounded transition-colors italic"
              >
                Note: {task.note}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsEditingNote(true)}
            className="mt-1.5 text-[10px] text-zinc-400 hover:text-zinc-600 hover:underline cursor-pointer block"
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
                ? "bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800"
                : (() => {
                    const info = getDueDateLabel(task.due_date!);
                    if (info.variant === "overdue") {
                      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900 font-semibold";
                    }
                    if (info.variant === "today") {
                      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-semibold";
                    }
                    if (info.variant === "tomorrow") {
                      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900 font-semibold";
                    }
                    if (info.variant === "upcoming") {
                      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900";
                    }
                    return "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800";
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
              task.priority === "High"
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900"
                : task.priority === "Medium"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900"
                : "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
            )}
          >
            {task.priority}
          </Badge>
        ) : null}
      </div>
      {isCreator && (
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
