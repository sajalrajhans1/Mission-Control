"use client";

import { useMemo, useState, useEffect } from "react";
import { 
  TrendingUp, WalletCards, ListTodo, Pin, StickyNote, Trash2, Lock, Unlock,
  Plus, Sliders, X, ChevronUp, ChevronDown, Play, Pause, RotateCcw, Calendar, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AutosaveTextarea } from "@/components/autosize-textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData, useUserNames, useActiveUser, useUserColors } from "@/components/data-provider";
import { currentMonthRange, formatMoney, cn } from "@/lib/utils";
import type { Row, Json } from "@/lib/database.types";

interface DesktopWidget {
  id: "progress" | "money" | "notepad" | "mini-pomo" | "mini-schedule";
  title: string;
  visible: boolean;
  size: "small" | "medium" | "large";
  order: number;
}

const DEFAULT_WIDGETS: DesktopWidget[] = [
  { id: "progress", title: "Progress Tracker", visible: true, size: "medium", order: 0 },
  { id: "money", title: "Money Overview", visible: true, size: "medium", order: 1 },
  { id: "notepad", title: "Shared Priority List", visible: true, size: "medium", order: 2 },
  { id: "mini-pomo", title: "Mini Focus Timer", visible: false, size: "small", order: 3 },
  { id: "mini-schedule", title: "Today's Schedule", visible: false, size: "small", order: 4 },
];

const getNoteCleanBody = (body: string) => {
  return (body || "").replace(/\s*\[share:(user2|user3|both)\]/g, "");
};

const getNoteShareSetting = (body: string): "both" | "user2" | "user3" => {
  if (!body) return "both";
  if (body.includes("[share:user2]")) return "user2";
  if (body.includes("[share:user3]")) return "user3";
  return "both";
};

export default function HomePage() {
  const { 
    tasks, moneyEntries, stickyNotes, settings, onlineUsers, sendNotification, 
    isScreensaverActive, setIsScreensaverActive,
    pomoMode, setPomoMode, pomoIsPlaying, setPomoIsPlaying, pomoTimeLeft, setPomoTimeLeft,
    pomoSettings, pomoTaskId, pomoBlockId, pomoCompletedCount, timetableBlocks, getAudioContext,
    activePartner
  } = useData();
  const { activeUser, activeUserName } = useActiveUser();
  const { user1, user2, user3 } = useUserNames();
  const userColors = useUserColors();
  const month = currentMonthRange();

  const isUser1Online = onlineUsers.includes(user1);
  const isUser2Online = onlineUsers.includes(user2);
  const isUser3Online = onlineUsers.includes(user3);

  // --- Clock & Date Widget State ---
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    if (!currentTime) return "Good morning";
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  }, [currentTime]);

  const timeString = useMemo(() => {
    if (!currentTime) return "";
    return currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [currentTime]);

  const dateString = useMemo(() => {
    if (!currentTime) return "";
    return currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentTime]);

  // --- Widgets Configuration (Sonoma-Style) ---
  const [widgets, setWidgets] = useState<DesktopWidget[]>(DEFAULT_WIDGETS);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (activeUser && typeof window !== "undefined") {
      const saved = localStorage.getItem(`mc_desktop_widgets_${activeUser}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as DesktopWidget[];
          const merged = DEFAULT_WIDGETS.map((def) => {
            const found = parsed.find((p) => p.id === def.id);
            return found ? found : def;
          });
          merged.sort((a, b) => {
            const aVal = parsed.find(p => p.id === a.id);
            const bVal = parsed.find(p => p.id === b.id);
            return (aVal?.order ?? a.order) - (bVal?.order ?? b.order);
          });
          setWidgets(merged);
        } catch (e) {
          console.error("Failed to parse desktop widgets settings", e);
        }
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }
    }
  }, [activeUser]);

  useEffect(() => {
    const handleToggleEdit = () => {
      setIsEditMode((prev) => !prev);
    };
    window.addEventListener("toggle-desktop-edit-mode", handleToggleEdit);
    return () => window.removeEventListener("toggle-desktop-edit-mode", handleToggleEdit);
  }, []);

  const saveWidgets = (newWidgets: DesktopWidget[]) => {
    setWidgets(newWidgets);
    if (activeUser && typeof window !== "undefined") {
      localStorage.setItem(`mc_desktop_widgets_${activeUser}`, JSON.stringify(newWidgets));
    }
  };

  const moveWidget = (id: string, direction: -1 | 1) => {
    const currentIdx = widgets.findIndex((w) => w.id === id);
    if (currentIdx === -1) return;
    const newIdx = currentIdx + direction;
    if (newIdx < 0 || newIdx >= widgets.length) return;

    const updated = [...widgets];
    const temp = updated[currentIdx];
    updated[currentIdx] = updated[newIdx];
    updated[newIdx] = temp;

    const sequenced = updated.map((w, idx) => ({ ...w, order: idx }));
    saveWidgets(sequenced);
  };

  const setWidgetSize = (id: string, size: "small" | "medium" | "large") => {
    saveWidgets(
      widgets.map((w) => (w.id === id ? { ...w, size } : w))
    );
  };

  const toggleWidgetVisibility = (id: string) => {
    saveWidgets(
      widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const visibleWidgets = useMemo(() => {
    return [...widgets]
      .filter((w) => w.visible)
      .sort((a, b) => a.order - b.order);
  }, [widgets]);

  const getSizeClass = (size: "small" | "medium" | "large") => {
    if (size === "small") return "col-span-12 lg:col-span-5";
    if (size === "medium") return "col-span-12 lg:col-span-7";
    return "col-span-12";
  };

  // --- Shared Priority List ---
  const listKey = useMemo(() => {
    if (activeUser === "user1") {
      return `shared_priority_list_user1_${activePartner}`;
    }
    return activeUser === "user2" ? "shared_priority_list_user1_user2" : "shared_priority_list_user1_user3";
  }, [activeUser, activePartner]);

  const priorityRow = settings.rows.find((r) => r.key === listKey) || 
    (listKey === "shared_priority_list_user1_user2" ? settings.rows.find((r) => r.key === "shared_priority_list") : undefined);

  const parsedPriority = useMemo(() => {
    if (!priorityRow || !priorityRow.value) return { text: "", updatedBy: "", updatedAt: "" };
    const val = priorityRow.value as { text?: string; updatedBy?: string; updatedAt?: string };
    return {
      text: val.text || "",
      updatedBy: val.updatedBy || "",
      updatedAt: val.updatedAt || "",
    };
  }, [priorityRow]);

  const [localText, setLocalText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setLocalText(parsedPriority.text);
    }
  }, [parsedPriority.text, isEditing]);

  const savePriorityList = async (textToSave: string) => {
    if (textToSave === parsedPriority.text) return;
    setIsSaving(true);
    const updatedValue = {
      text: textToSave,
      updatedBy: activeUserName || "Unknown",
      updatedAt: new Date().toLocaleString(),
    };

    if (priorityRow) {
      await settings.update(priorityRow.id, { value: updatedValue as unknown as Json });
    } else {
      await settings.create({ key: listKey, value: updatedValue as unknown as Json });
    }
    
    let otherUserKey: "user1" | "user2" | "user3" = "user2";
    if (activeUser === "user3" || activeUser === "user2") {
      otherUserKey = "user1";
    } else {
      otherUserKey = activePartner;
    }

    sendNotification(
      otherUserKey,
      "Priority List Updated",
      `${activeUserName} updated the shared priority list`
    );
    setIsSaving(false);
  };

  const handleBlur = () => {
    setIsEditing(false);
    savePriorityList(localText);
  };

  const handleSave = () => {
    setIsEditing(false);
    savePriorityList(localText);
  };

  // --- Sticky Notes ---
  const [deletingNote, setDeletingNote] = useState<Row<"sticky_notes"> | null>(null);

  const notes = useMemo(
    () => stickyNotes.rows
      .filter((item) => !item.is_private || item.author === activeUserName)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [stickyNotes.rows, activeUserName]
  );

  // --- Calculations ---
  const currencySymbol = activeUser === "user3" ? "€" : "₹";

  const myKey = activeUser || "user1";
  const otherKey = myKey === "user1" ? activePartner : "user1";

  const partnerUserName = useMemo(() => {
    return activeUser === "user1" ? (activePartner === "user3" ? user3 : user2) : (activeUser === "user2" ? user2 : user3);
  }, [activeUser, activePartner, user2, user3]);

  const monthEntries = useMemo(() => {
    return moneyEntries.rows.filter(
      (entry) => entry.entry_date >= month.start && entry.entry_date <= month.end
    );
  }, [moneyEntries.rows, month.start, month.end]);

  const income = useMemo(() => {
    const userIncome = monthEntries
      .filter((e) => e.added_by === myKey && e.type === "Income" && !e.is_request)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const settledRequests = monthEntries
      .filter((e) => e.added_by === myKey && e.request_to === otherKey && e.is_request && e.request_status === "settled")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    return userIncome + settledRequests;
  }, [monthEntries, myKey, otherKey]);

  const expenses = useMemo(() => {
    const userExpenses = monthEntries
      .filter((e) => e.added_by === myKey && e.type === "Expense" && !e.is_request)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const approvedRequests = monthEntries
      .filter((e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && (e.request_status === "approved" || e.request_status === "settled"))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    return userExpenses + approvedRequests;
  }, [monthEntries, myKey, otherKey]);

  const progress = useMemo(() => {
    const list = activeUser === "user1" ? [user1, partnerUserName] : [partnerUserName, user1];
    return list.map((person) => {
      const owned = tasks.rows.filter(
        (task) => task.assigned_to === person || task.assigned_to === "Both"
      );
      const done = owned.filter((task) => task.completed).length;
      return { person, done, total: owned.length, percent: owned.length ? (done / owned.length) * 100 : 0 };
    });
  }, [tasks.rows, activeUser, user1, partnerUserName]);

  const handleCreateNote = async () => {
    await stickyNotes.create({
      title: "New Note",
      body: "Write details here...",
      color: "Yellow",
      is_private: false,
      pinned: false,
      author: activeUserName || "Unknown",
      read: false
    });
  };

  const renderWidget = (id: string) => {
    switch (id) {
      case "progress":
        return (
          <Card className="h-full border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text transition-all duration-300 rounded-2xl flex flex-col justify-between">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text text-sm font-bold tracking-wider uppercase">
                <TrendingUp className="h-4 w-4" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 grid gap-4">
              {progress.map((item) => (
                <div key={item.person} className="grid gap-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="font-medium flex items-center gap-1.5 drop-shadow-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.person === user1 ? userColors.user1 : (item.person === user3 ? userColors.user3 : userColors.user2) }}
                      />
                      {item.person}
                    </span>
                    <span className="opacity-90">
                      {item.done} / {item.total} tasks
                    </span>
                  </div>
                  <Progress value={item.percent} className="h-2 bg-white/20 dark:bg-white/10" />
                </div>
              ))}
            </CardContent>
          </Card>
        );

      case "money":
        return (
          <Card className="h-full border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text transition-all duration-300 rounded-2xl flex flex-col justify-between">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text text-sm font-bold tracking-wider uppercase">
                <WalletCards className="h-4 w-4" />
                Money Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 grid grid-cols-3 gap-3">
              <div className="bg-black/10 dark:bg-black/25 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Income</p>
                <p className="font-bold text-base text-white mt-1">{formatMoney(income, currencySymbol)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/25 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Expenses</p>
                <p className="font-bold text-base text-white mt-1">{formatMoney(expenses, currencySymbol)}</p>
              </div>
              <div className="bg-black/10 dark:bg-black/25 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Net</p>
                <p className="font-bold text-base text-white mt-1">{formatMoney(income - expenses, currencySymbol)}</p>
              </div>
            </CardContent>
          </Card>
        );

      case "notepad":
        return (
          <Card className="h-full border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text flex flex-col justify-between transition-all duration-300 rounded-2xl">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text text-sm font-bold tracking-wider uppercase">
                <ListTodo className="h-4 w-4 text-primary" />
                Shared Priority List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col gap-3">
              <Textarea
                className="flex-1 min-h-[150px] lg:min-h-[180px] resize-none rounded-xl border border-white/15 dark:border-white/10 bg-black/10 dark:bg-black/25 p-3 text-sm text-white placeholder-white/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
                placeholder="Write down the shared priorities here..."
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  setIsEditing(true);
                }}
                onBlur={handleBlur}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/70 font-semibold truncate max-w-[200px]">
                  {isSaving ? "Saving..." : parsedPriority.updatedBy ? `Edited by ${parsedPriority.updatedBy} on ${parsedPriority.updatedAt}` : "Not edited yet"}
                </span>
                <Button size="sm" variant="outline" className="rounded-xl px-4 border-white/20 bg-white/10 text-white hover:bg-white/25 hover:text-white" onClick={handleSave} disabled={isSaving}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case "mini-pomo": {
        const minutes = Math.floor(pomoTimeLeft / 60).toString().padStart(2, "0");
        const seconds = (pomoTimeLeft % 60).toString().padStart(2, "0");
        const pomoTimeString = `${minutes}:${seconds}`;

        const totalSeconds = pomoMode === "work"
          ? pomoSettings.work * 60
          : pomoMode === "shortBreak"
            ? pomoSettings.shortBreak * 60
            : pomoSettings.longBreak * 60;

        const percent = totalSeconds > 0 ? (pomoTimeLeft / totalSeconds) * 100 : 0;

        const radius = 38;
        const strokeWidth = 3.5;
        const normalizedRadius = radius - strokeWidth * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (percent / 100) * circumference;

        const activeFocusTask = tasks.rows.find((t) => t.id === pomoTaskId);
        const activeFocusBlock = timetableBlocks?.rows.find((b) => b.id === pomoBlockId);

        return (
          <Card className="h-full border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text transition-all duration-300 rounded-2xl flex flex-col justify-between">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text text-sm font-bold tracking-wider uppercase">
                <Clock className="h-4 w-4 text-indigo-400" />
                Focus Timer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col items-center justify-center gap-3">
              <div className="relative flex items-center justify-center">
                <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                  <circle
                    stroke="rgba(255,255,255,0.1)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                  />
                  <circle
                    stroke={pomoMode === "work" ? "#6366f1" : "#f59e0b"}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference + " " + circumference}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold font-mono tracking-tighter text-white">
                    {pomoTimeString}
                  </span>
                  <span className="text-[8px] uppercase font-extrabold tracking-wider text-white/60">
                    {pomoMode === "work" ? "Focus" : pomoMode === "shortBreak" ? "Break" : "L. Break"}
                  </span>
                </div>
              </div>

              <div className="w-full text-center min-h-[16px]">
                {activeFocusTask ? (
                  <p className="text-[10px] font-bold text-white/90 truncate max-w-full" title={`Task: ${activeFocusTask.title}`}>
                    🎯 {activeFocusTask.title}
                  </p>
                ) : activeFocusBlock ? (
                  <p className="text-[10px] font-bold text-white/90 truncate max-w-full" title={`Block: ${activeFocusBlock.title}`}>
                    📅 {activeFocusBlock.title}
                  </p>
                ) : (
                  <p className="text-[10px] text-white/40 italic">No task selected</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white hover:text-white"
                  onClick={() => {
                    getAudioContext();
                    setPomoIsPlaying(!pomoIsPlaying);
                  }}
                >
                  {pomoIsPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white hover:text-white"
                  onClick={() => {
                    setPomoIsPlaying(false);
                    const total = pomoMode === "work" ? pomoSettings.work * 60 : pomoMode === "shortBreak" ? pomoSettings.shortBreak * 60 : pomoSettings.longBreak * 60;
                    setPomoTimeLeft(total);
                  }}
                  title="Reset"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white hover:text-white"
                  onClick={() => {
                    setPomoIsPlaying(false);
                    if (pomoMode === "work") {
                      const nextMode = (pomoCompletedCount + 1) % pomoSettings.longBreakInterval === 0 ? "longBreak" : "shortBreak";
                      setPomoMode(nextMode);
                      setPomoTimeLeft(nextMode === "shortBreak" ? pomoSettings.shortBreak * 60 : pomoSettings.longBreak * 60);
                    } else {
                      setPomoMode("work");
                      setPomoTimeLeft(pomoSettings.work * 60);
                    }
                  }}
                  title="Skip"
                >
                  <Plus className="h-3 w-3 rotate-45" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      }

      case "mini-schedule": {
        const todayStr = (() => {
          const d = new Date();
          const year = d.getFullYear();
          const m = (d.getMonth() + 1).toString().padStart(2, "0");
          const day = d.getDate().toString().padStart(2, "0");
          return `${year}-${m}-${day}`;
        })();

        const todaysBlocks = timetableBlocks?.rows
          ? timetableBlocks.rows
              .filter((b) => b.block_date === todayStr)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
          : [];

        const getBlockColorClass = (color: string) => {
          const mapping = {
            Indigo: "bg-indigo-500/20 text-indigo-200 border-indigo-500/30",
            Emerald: "bg-emerald-500/20 text-emerald-250 border-emerald-500/30",
            Rose: "bg-rose-500/20 text-rose-250 border-rose-500/30",
            Amber: "bg-amber-500/20 text-amber-250 border-amber-500/30",
            Cyan: "bg-cyan-500/20 text-cyan-250 border-cyan-500/30",
            Violet: "bg-violet-500/20 text-violet-250 border-violet-500/30",
          };
          return mapping[color as keyof typeof mapping] || "bg-slate-500/20 text-slate-200 border-slate-500/30";
        };

        return (
          <Card className="h-full border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text transition-all duration-300 rounded-2xl flex flex-col justify-between">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text text-sm font-bold tracking-wider uppercase">
                <Calendar className="h-4 w-4 text-emerald-400" />
                {"Today's Schedule"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-y-auto max-h-[160px] custom-scrollbar gap-2">
              {todaysBlocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-white/40 text-[11px] italic">
                  No events today
                </div>
              ) : (
                todaysBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl border backdrop-blur-md transition-all duration-350 hover:bg-white/5",
                      getBlockColorClass(block.color)
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-[11px] font-bold truncate text-white">{block.title}</p>
                      <p className="text-[9px] opacity-80 mt-0.5">
                        {block.start_time} – {block.end_time}
                      </p>
                    </div>
                    <span className="text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white/10 shrink-0">
                      {block.color}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      }
      
      default:
        return null;
    }
  };

  if (isScreensaverActive) {
    return (
      <div 
        className="fixed inset-0 z-40 bg-transparent flex flex-col items-center justify-center select-none cursor-pointer animate-in fade-in duration-500"
        onClick={() => setIsScreensaverActive(false)}
      >
        {/* Top/Center: macOS Clock & Date Widget (Scaled up for screensaver) */}
        <div className="flex flex-col items-center justify-center text-center select-none scale-[1.35] sm:scale-[1.6] transition-transform duration-700 animate-in zoom-in-95 ease-out">
          <span className="text-sm font-bold uppercase tracking-widest text-white">
            {dateString}
          </span>
          <h1 className="text-6xl sm:text-7xl font-extralight tracking-tighter text-white mt-1 font-sans">
            {timeString}
          </h1>
          <div className="mt-2 flex items-center gap-3 bg-black/25 dark:bg-black/35 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-white shadow-lg">
            <span className="text-sm font-semibold tracking-wide">
              {greeting}, {activeUserName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col gap-8 pb-10"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsEditMode(true);
        }
      }}
    >
      {/* Top/Center: macOS Clock & Date Widget */}
      <div className="flex flex-col items-center justify-center text-center mt-4 mb-2 select-none animate-in fade-in slide-in-from-top-4 duration-500">
        <span 
          className="text-sm font-bold uppercase tracking-widest text-white cursor-pointer hover:opacity-80 transition-opacity"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsScreensaverActive(true);
          }}
          title="Double-click to activate screensaver"
        >
          {dateString}
        </span>
        <h1 
          className="text-6xl sm:text-7xl font-extralight tracking-tighter text-white mt-1 font-sans cursor-pointer hover:opacity-80 transition-opacity"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsScreensaverActive(true);
          }}
          title="Double-click to activate screensaver"
        >
          {timeString}
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 bg-black/25 dark:bg-black/35 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-white shadow-lg">
          <span className="text-sm font-semibold tracking-wide">
            {greeting}, {activeUserName}
          </span>
          <div className="h-3 w-px bg-white/20" />
          
          {activeUser === "user1" ? (
            <>
              {/* Samarth Status */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex h-2.5 w-2.5 shrink-0">
                  {isUser2Online && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isUser2Online ? "bg-emerald-500" : "bg-white/40")}></span>
                </div>
                <span className="text-xs text-white/80 font-medium">
                  {user2}: {isUser2Online ? "online" : "offline"}
                </span>
              </div>

              <div className="h-3 w-px bg-white/20" />

              {/* Mr. Bill Status */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex h-2.5 w-2.5 shrink-0">
                  {isUser3Online && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isUser3Online ? "bg-emerald-500" : "bg-white/40")}></span>
                </div>
                <span className="text-xs text-white/80 font-medium">
                  {user3}: {isUser3Online ? "online" : "offline"}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative flex h-2.5 w-2.5 shrink-0">
                {isUser1Online && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isUser1Online ? "bg-emerald-500" : "bg-white/40")}></span>
              </div>
              <span className="text-xs text-white/80 font-medium">
                {user1} is {isUser1Online ? "online" : "offline"}
              </span>
            </div>
          )}
        </div>
      </div>

      {visibleWidgets.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">
          {visibleWidgets.map((widget) => {
            const sizeClass = getSizeClass(widget.size);
            const wiggleClass = "relative";

            return (
              <div key={widget.id} className={cn(sizeClass, wiggleClass)}>
                {isEditMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      saveWidgets(widgets.map((w) => w.id === widget.id ? { ...w, visible: false } : w));
                    }}
                    className="absolute -top-2.5 -left-2.5 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white border border-white/20 shadow-lg transition-transform hover:scale-110 active:scale-95"
                    title={`Hide ${widget.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {renderWidget(widget.id)}
              </div>
            );
          })}
        </div>
      )}

      {/* Scattered Sticky Notes Section */}
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-wider text-white uppercase flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Sticky Notes
          </h2>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCreateNote}
            className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/25 hover:text-white flex items-center gap-1 text-xs font-semibold px-3 py-1 shadow"
          >
            <Plus className="h-4 w-4" />
            New Note
          </Button>
        </div>

        {/* Sticky Notes Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {notes.map((item, idx) => {
            const isCreator = item.author === activeUserName;
            const postItColors = {
              Yellow: "bg-amber-100/35 border-amber-300/30 text-amber-50 dark:bg-amber-955/30 dark:border-amber-900/40 dark:text-amber-250",
              Blue: "bg-blue-100/35 border-blue-300/30 text-blue-50 dark:bg-blue-955/30 dark:border-blue-900/40 dark:text-blue-250",
              Green: "bg-emerald-100/35 border-emerald-300/30 text-emerald-50 dark:bg-emerald-955/30 dark:border-emerald-900/40 dark:text-emerald-250",
              Pink: "bg-pink-100/35 border-pink-300/30 text-pink-50 dark:bg-pink-955/30 dark:border-pink-900/40 dark:text-pink-250"
            };
            
            const tilts = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2"];
            const tiltClass = tilts[idx % tilts.length];

            return (
              <div 
                key={item.id} 
                className={cn(
                  "relative min-h-[220px] rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 hover:rotate-0 hover:scale-102 hover:shadow-2xl flex flex-col justify-between",
                  postItColors[item.color as keyof typeof postItColors] ?? "bg-white/20 border-white/25 text-white",
                  tiltClass
                )}
              >
                {item.pinned && (
                  <div className="absolute -top-2 right-3 p-1 rounded-full bg-white/15 dark:bg-black/25 border border-white/25 text-white shadow-md z-10" title="Pinned">
                    <Pin className="h-3 w-3 fill-amber-300 stroke-amber-400 rotate-[30deg]" />
                  </div>
                )}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <Input
                    className="border-transparent dark:border-transparent bg-transparent dark:bg-transparent px-0 text-sm font-bold shadow-none focus-visible:ring-0 w-full text-white dark:text-inherit"
                    value={item.title}
                    onChange={(e) => {
                      const updatedVal = e.target.value;
                      stickyNotes.update(item.id, { title: updatedVal });
                    }}
                    readOnly={!isCreator}
                  />
                  {isCreator && (
                    <div className="flex shrink-0 gap-1 opacity-60 hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                        title={item.is_private ? "Make Public" : "Make Private"}
                        onClick={() => stickyNotes.update(item.id, { is_private: !item.is_private })}
                      >
                        {item.is_private ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                        title={item.pinned ? "Unpin" : "Pin"}
                        onClick={() => stickyNotes.update(item.id, { pinned: !item.pinned })}
                      >
                        <Pin className={cn("h-3 w-3", item.pinned ? "fill-current" : "")} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                        onClick={() => setDeletingNote(item)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 text-xs leading-relaxed text-white/95 pr-1">
                  <AutosaveTextarea
                    value={getNoteCleanBody(item.body)}
                    onSave={(newBody) => {
                      const shareSetting = getNoteShareSetting(item.body);
                      const suffix = shareSetting === "both" ? "" : ` [share:${shareSetting}]`;
                      stickyNotes.update(item.id, { body: newBody.trim() + suffix });
                    }}
                    minHeight={100}
                    readOnly={!isCreator}
                    className="border-transparent dark:border-transparent bg-transparent dark:bg-transparent p-0 shadow-none focus-visible:ring-0 text-inherit dark:text-inherit resize-none w-full text-xs"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-white/80 border-t border-white/10 pt-2 shrink-0">
                  <span className="flex items-center gap-1.5 font-semibold min-w-0 flex-1 truncate">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.author === user1 ? userColors.user1 : (item.author === user3 ? userColors.user3 : userColors.user2) }}
                    />
                    <span className="truncate">{item.author}</span>
                  </span>

                   {isCreator && (
                    <Select
                      value={(() => {
                        if (item.is_private) return "private";
                        if (activeUser === "user1") {
                          const share = getNoteShareSetting(item.body);
                          return share;
                        }
                        return "share";
                      })()}
                      onValueChange={(val) => {
                        const cleanBody = getNoteCleanBody(item.body);
                        if (val === "private") {
                          stickyNotes.update(item.id, { is_private: true, body: cleanBody });
                        } else {
                          const suffix = val === "both" || val === "share" ? "" : ` [share:${val}]`;
                          stickyNotes.update(item.id, { is_private: false, body: cleanBody.trim() + suffix });
                        }
                      }}
                    >
                      <SelectTrigger className="h-5 w-fit border-none bg-transparent hover:bg-white/10 text-[9px] font-bold text-white/70 hover:text-white rounded px-1.5 flex gap-1 focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-white text-[10px] rounded-lg">
                        {activeUser === "user1" ? (
                          <>
                            <SelectItem value="private">Share: Only Me</SelectItem>
                            <SelectItem value="user2">Share: {user2}</SelectItem>
                            <SelectItem value="user3">Share: {user3}</SelectItem>
                            <SelectItem value="both">Share: Everyone</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="private">Share: Private</SelectItem>
                            <SelectItem value="share">Share: {user1}</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}

                  {item.is_private && !isCreator && (
                    <span className="flex items-center gap-0.5 text-[8px] text-amber-300 bg-amber-955/65 px-1.5 py-0.5 rounded font-bold border border-amber-900/40 shrink-0 mx-1">
                      <Lock className="h-2 w-2" />
                      Private
                    </span>
                  )}
                  <button
                    onClick={() => stickyNotes.update(item.id, { read: !item.read })}
                    className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-white/10 shrink-0", item.read ? "opacity-60" : "font-bold text-white")}
                  >
                    {item.read ? "Read" : "Unread"}
                  </button>
                </div>
              </div>
            );
          })}
          {!notes.length ? (
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
              <div className="py-12 rounded-2xl border border-dashed border-white/20 bg-white/10 dark:bg-black/15 backdrop-blur-md flex flex-col items-center justify-center text-white/70 shadow-lg">
                <StickyNote className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No sticky notes created yet.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sonoma Customization Drawer */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 dark:bg-black/90 backdrop-blur-2xl border-t border-white/15 py-5 px-6 rounded-t-3xl shadow-[0_-10px_35px_rgba(0,0,0,0.6)] transform transition-transform duration-300 ease-in-out",
          isEditMode ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-400" />
                Customize Desktop Widgets
              </h3>
              <p className="text-[11px] text-white/60 mt-0.5">
                Toggle widget visibility, resize widgets, or rearrange their order. Double-click the background to exit Edit Mode.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsEditMode(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md transition-all active:scale-95"
            >
              Done
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 pb-24">
            {widgets.map((widget, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === widgets.length - 1;

              return (
                <div key={widget.id} className="bg-white/5 dark:bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3 text-white">
                  <div className="flex items-start justify-between min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{widget.title}</p>
                      <p className="text-[10px] text-white/50 font-medium mt-0.5">
                        {widget.visible ? "Active on Desktop" : "Hidden"}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all text-xs font-semibold shrink-0",
                        widget.visible
                          ? "bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25"
                      )}
                    >
                      {widget.visible ? "Hide" : "Add"}
                    </button>
                  </div>

                  {widget.visible && (
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
                      {/* Size Selectors */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Size</span>
                        <div className="flex rounded-lg bg-black/35 p-0.5 border border-white/5">
                          {(["small", "medium", "large"] as const).map((size) => (
                            <button
                              key={size}
                              onClick={() => setWidgetSize(widget.id, size)}
                              className={cn(
                                "text-[9px] font-extrabold uppercase px-2 py-1 rounded-md transition-all",
                                widget.size === size
                                  ? "bg-indigo-600 text-white shadow-md"
                                  : "text-white/60 hover:text-white hover:bg-white/5"
                              )}
                            >
                              {size === "small" ? "S" : size === "medium" ? "M" : "L"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reordering */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Order</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveWidget(widget.id, -1)}
                            disabled={isFirst}
                            className={cn(
                              "p-1 rounded-md border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:hover:bg-white/5",
                              isFirst && "cursor-not-allowed"
                            )}
                            title="Move Up"
                          >
                            <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
                          </button>
                          <button
                            onClick={() => moveWidget(widget.id, 1)}
                            disabled={isLast}
                            className={cn(
                              "p-1 rounded-md border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:hover:bg-white/5",
                              isLast && "cursor-not-allowed"
                            )}
                            title="Move Down"
                          >
                            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletingNote)}
        onOpenChange={(open) => !open && setDeletingNote(null)}
        title="Delete Sticky Note?"
        description="Are you sure you want to delete this sticky note?"
        onConfirm={() => {
          if (deletingNote) {
            stickyNotes.remove(deletingNote.id);
          }
        }}
      />
    </div>
  );
}
