"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Link as LinkIcon,
  Calendar as CalendarIcon
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isSameDay,
  parseISO,
  differenceInDays
} from "date-fns";
import { useData, useActiveUser, useUserNames } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Hour grid helper constants
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const START_TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

const END_TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor((i + 1) / 2);
  const m = (i + 1) % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

const COLORS = [
  { value: "indigo", label: "Indigo", bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700", hover: "hover:bg-indigo-700" },
  { value: "emerald", label: "Emerald", bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", hover: "hover:bg-emerald-700" },
  { value: "rose", label: "Rose", bg: "bg-rose-500", text: "text-white", border: "border-rose-600", hover: "hover:bg-rose-605" },
  { value: "amber", label: "Amber", bg: "bg-amber-500", text: "text-white", border: "border-amber-600", hover: "hover:bg-amber-600" },
  { value: "purple", label: "Purple", bg: "bg-purple-600", text: "text-white", border: "border-purple-700", hover: "hover:bg-purple-700" },
  { value: "sky", label: "Sky", bg: "bg-sky-500", text: "text-white", border: "border-sky-600", hover: "hover:bg-sky-650" },
  { value: "pink", label: "Pink", bg: "bg-pink-500", text: "text-white", border: "border-pink-600", hover: "hover:bg-pink-605" }
];

const DAYS_OF_WEEK = [
  { label: "M", value: 1, name: "Monday" },
  { label: "T", value: 2, name: "Tuesday" },
  { label: "W", value: 3, name: "Wednesday" },
  { label: "T", value: 4, name: "Thursday" },
  { label: "F", value: 5, name: "Friday" },
  { label: "S", value: 6, name: "Saturday" },
  { label: "S", value: 0, name: "Sunday" }
];

// Helper to convert minutes to HH:MM string
function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hStr = Math.max(0, Math.min(24, h)).toString().padStart(2, "0");
  const mStr = Math.max(0, Math.min(59, m)).toString().padStart(2, "0");
  return `${hStr}:${mStr}`;
}

export default function TimetablePage() {
  const { timetableBlocks, tasks, activeUser } = useData();
  const { activeUserName } = useActiveUser();
  const { user1, user2 } = useUserNames();

  // Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic Clock State for Real-Time overlays
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Pointer Dragging States
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragColumnIndex, setDragColumnIndex] = useState<number | null>(null);
  const [dragStartMinutes, setDragStartMinutes] = useState<number | null>(null);
  const [dragCurrentMinutes, setDragCurrentMinutes] = useState<number | null>(null);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form States
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("10:00");
  const [blockTitle, setBlockTitle] = useState<string>("");
  const [blockColor, setBlockColor] = useState<string>("indigo");
  const [linkTask, setLinkTask] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  // Recurrence States
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurringDays, setRecurringDays] = useState<number[]>([]);

  // Edit Form State
  const [editingBlockId, setEditingBlockId] = useState<string>("");

  // Center scroll position at 08:00 AM on initial load
  useEffect(() => {
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollTop = 8 * 64; // Hour row is 64px tall
    }
  }, []);

  // Compute days of the current week (Mon - Sun)
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return "";
    const first = weekDays[0];
    const last = weekDays[6];
    if (first.getMonth() === last.getMonth()) {
      return `${format(first, "MMM d")} – ${format(last, "d, yyyy")}`;
    }
    return `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
  }, [weekDays]);

  // Filter pending tasks assigned to the active user (or both)
  const myPendingTasks = useMemo(() => {
    const cleanU1 = (user1 || "").trim().toLowerCase();
    const cleanU2 = (user2 || "").trim().toLowerCase();

    return tasks.rows.filter((t) => {
      const assigneeClean = (t.assigned_to || "").trim().toLowerCase();
      const isAssigned =
        assigneeClean === "both" ||
        assigneeClean === activeUser ||
        (activeUser === "user1" && assigneeClean === cleanU1) ||
        (activeUser === "user2" && assigneeClean === cleanU2);

      if (!isAssigned) return false;

      // Check if task is completed
      if (assigneeClean === "both") {
        return activeUser === "user1" ? !t.completed_user1 : !t.completed_user2;
      }
      return !t.completed;
    });
  }, [tasks.rows, activeUser, user1, user2]);

  // Check if a day has already passed (ignores current day)
  const isPastDay = (day: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dCopy = new Date(day);
    dCopy.setHours(0, 0, 0, 0);
    return dCopy.getTime() < today.getTime();
  };

  // Handle previous/next week navigation
  const prevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const nextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));
  const goToday = () => setCurrentDate(new Date());

  // Toggle day in recurrence checklist
  const toggleRecurringDay = (dayIndex: number) => {
    setRecurringDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  // Mouse selection gesture event handlers
  const handlePointerDown = (colIdx: number, day: Date, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only process left clicks
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor(y / 64 * 60);
    const rounded = Math.round(minutes / 30) * 30;

    e.currentTarget.setPointerCapture(e.pointerId);

    setIsDragging(true);
    setDragColumnIndex(colIdx);
    setDragStartMinutes(rounded);
    setDragCurrentMinutes(rounded);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragColumnIndex === null || dragStartMinutes === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor(y / 64 * 60);
    const rounded = Math.round(minutes / 30) * 30;
    setDragCurrentMinutes(Math.max(0, Math.min(1440, rounded)));
  };

  const handlePointerUp = (day: Date, e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragColumnIndex === null || dragStartMinutes === null || dragCurrentMinutes === null) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore capture release errors
    }

    setIsDragging(false);
    const min = Math.min(dragStartMinutes, dragCurrentMinutes);
    let max = Math.max(dragStartMinutes, dragCurrentMinutes);

    // If selection is too small, default to a 1 hour duration block
    if (max - min < 30) {
      max = min + 60;
    }

    setSelectedDay(format(day, "yyyy-MM-dd"));
    setStartTime(minutesToTimeString(min));
    setEndTime(minutesToTimeString(Math.min(1440, max)));
    setBlockTitle("");
    setBlockColor("indigo");
    setLinkTask(false);
    setSelectedTaskId("");

    // Prefill recurrence defaults based on selected day
    setIsRecurring(false);
    const startDayOfWeek = day.getDay();
    setRecurringDays([startDayOfWeek]);
    const nextWeekDate = addWeeks(day, 1);
    setRecurrenceEndDate(format(nextWeekDate, "yyyy-MM-dd"));

    setIsCreateOpen(true);

    // Clear dragging state
    setDragColumnIndex(null);
    setDragStartMinutes(null);
    setDragCurrentMinutes(null);
  };

  // Synchronize title when task is selected
  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    const selectedTask = tasks.rows.find((t) => t.id === taskId);
    if (selectedTask) {
      setBlockTitle(selectedTask.title);
    }
  };

  // Submit new block creation
  const handleCreateBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    if (!blockTitle.trim()) return;

    // Check block duration
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (eh < sh || (eh === sh && em <= sm)) {
      alert("End time must be after start time");
      return;
    }

    try {
      if (isRecurring && recurrenceEndDate) {
        const start = parseISO(selectedDay);
        const end = parseISO(recurrenceEndDate);
        const diff = differenceInDays(end, start);

        if (diff < 0) {
          alert("End date must be on or after start date");
          return;
        }
        if (diff > 90) {
          alert("Recurrence is limited to a maximum of 90 days to protect performance.");
          return;
        }
        if (recurringDays.length === 0) {
          alert("Please select at least one day of the week to repeat on.");
          return;
        }

        // Loop through dates and create matching blocks
        for (let i = 0; i <= diff; i++) {
          const current = addDays(start, i);
          const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ...
          if (recurringDays.includes(dayOfWeek)) {
            const dateStr = format(current, "yyyy-MM-dd");
            await timetableBlocks.create({
              user_key: activeUser,
              title: blockTitle.trim(),
              block_date: dateStr,
              start_time: startTime,
              end_time: endTime,
              task_id: linkTask && selectedTaskId ? selectedTaskId : null,
              color: blockColor
            });
          }
        }
      } else {
        // Single block creation
        await timetableBlocks.create({
          user_key: activeUser,
          title: blockTitle.trim(),
          block_date: selectedDay,
          start_time: startTime,
          end_time: endTime,
          task_id: linkTask && selectedTaskId ? selectedTaskId : null,
          color: blockColor
        });
      }
      setIsCreateOpen(false);
    } catch (err) {
      console.error("Failed to create timetable block:", err);
    }
  };

  // Edit / Open existing block
  const handleBlockClick = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering column pointer events
    const block = timetableBlocks.rows.find((b) => b.id === blockId);
    if (!block) return;

    setEditingBlockId(blockId);
    setBlockTitle(block.title);
    setSelectedDay(block.block_date);
    setStartTime(block.start_time);
    setEndTime(block.end_time);
    setBlockColor(block.color);
    setLinkTask(!!block.task_id);
    setSelectedTaskId(block.task_id || "");
    setIsEditOpen(true);
  };

  // Update existing block
  const handleUpdateBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlockId) return;

    // Check block duration
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (eh < sh || (eh === sh && em <= sm)) {
      alert("End time must be after start time");
      return;
    }

    try {
      await timetableBlocks.update(editingBlockId, {
        title: blockTitle.trim(),
        block_date: selectedDay,
        start_time: startTime,
        end_time: endTime,
        task_id: linkTask && selectedTaskId ? selectedTaskId : null,
        color: blockColor
      });
      setIsEditOpen(false);
    } catch (err) {
      console.error("Failed to update timetable block:", err);
    }
  };

  // Delete timetable block
  const handleDeleteBlock = async () => {
    if (!editingBlockId) return;
    try {
      await timetableBlocks.remove(editingBlockId);
      setIsEditOpen(false);
    } catch (err) {
      console.error("Failed to delete timetable block:", err);
    }
  };

  // Toggle task completion from within timetable block
  const handleToggleTaskCompletion = async (taskId: string, currentCompleted: boolean) => {
    const task = tasks.rows.find((t) => t.id === taskId);
    if (!task) return;

    const assigneeClean = (task.assigned_to || "").trim().toLowerCase();

    if (assigneeClean === "both") {
      if (activeUser === "user1") {
        const nextVal = !task.completed_user1;
        await tasks.update(taskId, {
          completed_user1: nextVal,
          completed: nextVal && !!task.completed_user2
        });
      } else if (activeUser === "user2") {
        const nextVal = !task.completed_user2;
        await tasks.update(taskId, {
          completed_user2: nextVal,
          completed: !!task.completed_user1 && nextVal
        });
      }
    } else {
      await tasks.update(taskId, { completed: !currentCompleted });
    }
  };

  // Map database blocks into days of the week
  const weekBlocks = useMemo(() => {
    return timetableBlocks.rows.flatMap((b) => {
      // Find matching date in the week days array
      const blockDateObj = parseISO(b.block_date);
      const matchingDayIndex = weekDays.findIndex((d) => isSameDay(d, blockDateObj));

      if (matchingDayIndex === -1) return [];

      // Extract time details
      const [sh, sm] = b.start_time.split(":").map(Number);
      const [eh, em] = b.end_time.split(":").map(Number);

      const top = (sh * 64) + (sm / 60 * 64);
      const height = ((eh - sh) * 64) + ((em - sm) / 60 * 64);

      // Check linked task completion
      let isTaskDone = false;
      let linkedTaskTitle = "";
      if (b.task_id) {
        const task = tasks.rows.find((t) => t.id === b.task_id);
        if (task) {
          linkedTaskTitle = task.title;
          const assigneeClean = (task.assigned_to || "").trim().toLowerCase();
          if (assigneeClean === "both") {
            isTaskDone = activeUser === "user1" ? task.completed_user1 : task.completed_user2;
          } else {
            isTaskDone = task.completed;
          }
        }
      }

      return [{
        ...b,
        dayIndex: matchingDayIndex,
        top,
        height,
        isTaskDone,
        linkedTaskTitle
      }];
    });
  }, [timetableBlocks.rows, weekDays, tasks.rows, activeUser]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#fafafa] p-4 lg:p-8">
      {/* Title & Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-zinc-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Weekly Timetable</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Time-block your schedule privately and sync with your tasks.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Scrollable date jump picker */}
          <Input
            type="date"
            value={format(currentDate, "yyyy-MM-dd")}
            onChange={(e) => {
              if (e.target.value) {
                setCurrentDate(parseISO(e.target.value));
              }
            }}
            className="h-9 w-36 px-2.5 rounded-xl border bg-white shadow-soft text-xs font-semibold text-zinc-700"
            title="Jump to date"
          />

          <Button variant="outline" size="sm" onClick={goToday} className="h-9 px-3 rounded-xl font-medium">
            Today
          </Button>

          <div className="flex items-center border rounded-xl bg-white shadow-soft">
            <Button variant="ghost" size="icon" onClick={prevWeek} className="h-9 w-9 rounded-l-xl border-r">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 text-xs font-semibold text-zinc-700 min-w-[160px] text-center">
              {weekRangeLabel}
            </span>
            <Button variant="ghost" size="icon" onClick={nextWeek} className="h-9 w-9 rounded-r-xl border-l">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => {
              const today = new Date();
              setSelectedDay(format(today, "yyyy-MM-dd"));
              setStartTime("09:00");
              setEndTime("10:00");
              setBlockTitle("");
              setBlockColor("indigo");
              setLinkTask(false);
              setSelectedTaskId("");

              // Pre-fill recurrence defaults
              setIsRecurring(false);
              setRecurringDays([today.getDay()]);
              setRecurrenceEndDate(format(addWeeks(today, 1), "yyyy-MM-dd"));

              setIsCreateOpen(true);
            }}
            className="h-9 rounded-xl gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Block
          </Button>
        </div>
      </div>

      {/* Scheduler Calendar Body */}
      <div className="flex-1 min-h-0 mt-6 flex flex-col border border-zinc-200/80 bg-white rounded-2xl shadow-soft overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-[64px_1fr] border-b border-zinc-100 bg-zinc-50/50">
          <div className="border-r border-zinc-100 py-3 text-center text-[10px] font-bold text-zinc-400">GMT</div>
          <div className="grid grid-cols-7 divide-x divide-zinc-100">
            {weekDays.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={idx} className="py-2.5 text-center flex flex-col items-center">
                  <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                    {format(day, "eee")}
                  </span>
                  <span
                    className={cn(
                      "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-zinc-700",
                      isToday && "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Hours Grid */}
        <div
          ref={gridContainerRef}
          className="flex-1 overflow-y-auto relative scrollbar-sleek"
        >
          <div className="grid grid-cols-[64px_1fr] min-h-[1536px]">
            {/* Time Labels */}
            <div className="border-r border-zinc-100 bg-zinc-50/20 divide-y divide-zinc-100/50">
              {HOURS.map((hour) => {
                const ampm = hour >= 12 ? "PM" : "AM";
                const displayH = hour % 12 === 0 ? 12 : hour % 12;
                return (
                  <div key={hour} className="h-16 text-[10px] font-semibold text-zinc-400 text-right pr-2.5 pt-1">
                    {displayH} {ampm}
                  </div>
                );
              })}
            </div>

            {/* Grid Columns */}
            <div className="relative divide-y divide-zinc-100/60 bg-grid-pattern">
              {/* Vertical Column Divider Guidelines */}
              <div className="absolute inset-0 grid grid-cols-7 divide-x divide-zinc-100/60 pointer-events-none z-0">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-full" />
                ))}
              </div>

              {/* Drag-to-Create Selection & Graying Overlay Columns */}
              <div className="absolute inset-0 grid grid-cols-7 z-10">
                {weekDays.map((day, dIdx) => {
                  const isToday = isSameDay(day, new Date());
                  const pastDay = isPastDay(day);

                  // Calculate past Y-height for Today column graying
                  const todayMinutes = now.getHours() * 60 + now.getMinutes();
                  const pastMinutesHeight = (todayMinutes / 60) * 64;

                  return (
                    <div
                      key={dIdx}
                      className="h-full relative cursor-pointer select-none touch-none"
                      onPointerDown={(e) => handlePointerDown(dIdx, day, e)}
                      onPointerMove={(e) => handlePointerMove(e)}
                      onPointerUp={(e) => handlePointerUp(day, e)}
                    >
                      {/* Gray out whole column if day is in the past */}
                      {pastDay && (
                        <div className="absolute inset-0 bg-zinc-200/20 pointer-events-none z-10" />
                      )}

                      {/* Gray out past hours of Today column */}
                      {isToday && (
                        <>
                          <div
                            className="absolute left-0 right-0 top-0 bg-zinc-200/20 pointer-events-none border-b border-dashed border-zinc-200 z-10"
                            style={{ height: `${pastMinutesHeight}px` }}
                          />
                          {/* Current Time Red horizontal Indicator Line */}
                          <div
                            className="absolute left-0 right-0 flex items-center pointer-events-none z-30"
                            style={{ top: `${pastMinutesHeight}px` }}
                          >
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1.25" />
                            <div className="h-0.5 flex-1 bg-red-500" />
                          </div>
                        </>
                      )}

                      {/* Live visual selection dashed preview block overlay */}
                      {isDragging && dragColumnIndex === dIdx && dragStartMinutes !== null && dragCurrentMinutes !== null && (
                        (() => {
                          const min = Math.min(dragStartMinutes, dragCurrentMinutes);
                          let max = Math.max(dragStartMinutes, dragCurrentMinutes);
                          if (max - min < 30) max = min + 60;

                          const top = (min / 60) * 64;
                          const height = ((max - min) / 60) * 64;

                          return (
                            <div
                              className="absolute left-1 right-1 bg-indigo-500/20 border-2 border-dashed border-indigo-500 rounded-xl z-20 pointer-events-none flex flex-col justify-center items-center text-indigo-700 text-[10px] font-bold shadow-sm"
                              style={{
                                top: `${top}px`,
                                height: `${height}px`
                              }}
                            >
                              <span>New Block</span>
                              <span>{minutesToTimeString(min)} - {minutesToTimeString(max)}</span>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Absolute Positioned Scheduled Blocks overlay */}
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none z-20">
                {Array.from({ length: 7 }).map((_, colIdx) => {
                  const dayBlocks = weekBlocks.filter((b) => b.dayIndex === colIdx);
                  return (
                    <div key={colIdx} className="h-full relative">
                      {dayBlocks.map((block) => {
                        const cl = COLORS.find((c) => c.value === block.color) || COLORS[0];
                        return (
                          <div
                            key={block.id}
                            onClick={(e) => handleBlockClick(block.id, e)}
                            className={cn(
                              "absolute left-1 right-1 p-2.5 rounded-xl border shadow-sm cursor-pointer transition-all pointer-events-auto flex flex-col justify-between overflow-hidden",
                              isDragging && "pointer-events-none", // Avoid intercepting gesture coords
                              block.isTaskDone
                                ? "opacity-60 bg-zinc-100 border-zinc-200 text-zinc-400 hover:bg-zinc-200"
                                : cn(cl.bg, cl.text, cl.border, cl.hover)
                            )}
                            style={{
                              top: `${block.top}px`,
                              height: `${block.height}px`
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                {block.task_id && (
                                  <LinkIcon className="h-3 w-3 shrink-0" />
                                )}
                                <span
                                  className={cn(
                                    "text-xs font-bold truncate block",
                                    block.isTaskDone && "line-through text-zinc-400"
                                  )}
                                >
                                  {block.title}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold opacity-90 shrink-0">
                              {block.start_time} - {block.end_time}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold">New Timetable Block</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBlockSubmit} className="space-y-4 pt-2">
            {/* Task Link Switcher */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-xs font-bold text-zinc-800">Link an existing task?</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tie this block to a task from your checklist.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={linkTask}
                onChange={(e) => setLinkTask(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Existing Task Selector dropdown */}
            {linkTask && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Select Task</label>
                {myPendingTasks.length === 0 ? (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>No pending tasks found for you. Please uncheck &quot;Link task&quot; or create a task first.</span>
                  </div>
                ) : (
                  <Select value={selectedTaskId} onValueChange={handleTaskChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a task to link..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myPendingTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Custom Title Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Block Title</label>
              <Input
                placeholder="e.g. Code Review, Lunch Break"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                disabled={linkTask && !selectedTaskId}
                required
              />
            </div>

            {/* Date and Times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-zinc-700">Date</label>
                <Input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Start Time</label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {START_TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">End Time</label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {END_TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Make Recurring Option */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-xs font-bold text-zinc-800">Repeat event?</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Repeat this block automatically across multiple days.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {isRecurring && (
              <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/50 space-y-3">
                {/* Day of Week Checklist */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-650 block">Repeat On</label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const active = recurringDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleRecurringDay(day.value)}
                          className={cn(
                            "h-7 w-7 rounded-full text-xs font-bold transition-all border flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 focus:outline-none",
                            active
                              ? "bg-indigo-600 border-indigo-700 text-white font-black"
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          )}
                          title={day.name}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recurrence End Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-650 block">Repeat Until</label>
                  <Input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    required={isRecurring}
                  />
                </div>
              </div>
            )}

            {/* Color selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Choose Block Color</label>
              <div className="flex flex-wrap gap-2.5">
                {COLORS.map((c) => {
                  const isSelected = blockColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setBlockColor(c.value)}
                      className={cn(
                        "h-8 w-8 rounded-full border transition-all flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 focus:outline-none",
                        c.bg,
                        c.border,
                        isSelected ? "ring-2 ring-indigo-500 ring-offset-2 scale-105" : "opacity-90"
                      )}
                      title={c.label}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4 text-white font-bold" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={linkTask && !selectedTaskId}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Create Block
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT / VIEW DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 font-bold">Edit Timetable Block</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateBlockSubmit} className="space-y-4 pt-2">
            {/* Task Link Display and Toggle */}
            {linkTask && selectedTaskId && (
              (() => {
                const task = tasks.rows.find((t) => t.id === selectedTaskId);
                if (!task) return null;

                const assigneeClean = (task.assigned_to || "").trim().toLowerCase();
                let isTaskDone = false;
                if (assigneeClean === "both") {
                  isTaskDone = activeUser === "user1" ? task.completed_user1 : task.completed_user2;
                } else {
                  isTaskDone = task.completed;
                }

                return (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-2">
                      <Check className={cn("h-4 w-4", isTaskDone ? "text-emerald-500" : "text-zinc-400")} />
                      <div>
                        <p className={cn("text-xs font-bold text-zinc-800", isTaskDone && "line-through text-zinc-400")}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Linked checklist task</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleTaskCompletion(selectedTaskId, isTaskDone)}
                      className={cn(
                        "h-7 text-[10px] px-2.5 rounded-lg font-bold border-2",
                        isTaskDone
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                      )}
                    >
                      {isTaskDone ? "Done" : "Mark Done"}
                    </Button>
                  </div>
                );
              })()
            )}

            {/* Custom Title Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Block Title</label>
              <Input
                placeholder="Title"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                disabled={linkTask}
                required
              />
            </div>

            {/* Date and Times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-zinc-700">Date</label>
                <Input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Start Time</label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {START_TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">End Time</label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {END_TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Choose Block Color</label>
              <div className="flex flex-wrap gap-2.5">
                {COLORS.map((c) => {
                  const isSelected = blockColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setBlockColor(c.value)}
                      className={cn(
                        "h-8 w-8 rounded-full border transition-all flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 focus:outline-none",
                        c.bg,
                        c.border,
                        isSelected ? "ring-2 ring-indigo-500 ring-offset-2 scale-105" : "opacity-90"
                      )}
                      title={c.label}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4 text-white font-bold" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-2 border-t mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDeleteBlock}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 gap-1 rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
