"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Check,
  ChevronRight,
  HelpCircle,
  TrendingUp,
  History,
  CheckCircle2,
  ListTodo,
  Keyboard,
  Brain,
  Sparkles
} from "lucide-react";
import { useData, useUserNames } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function PomodoroPage() {
  const data = useData();
  const { tasks, activeUser, timetableBlocks } = data;
  const { user1, user2 } = useUserNames();

  const {
    pomoMode: mode,
    setPomoMode: setMode,
    pomoIsPlaying: isPlaying,
    setPomoIsPlaying: setIsPlaying,
    pomoTimeLeft: timeLeft,
    setPomoTimeLeft: setTimeLeft,
    pomoSettings: settings,
    setPomoSettings: setSettings,
    pomoFocusType: focusType,
    setPomoFocusType: setFocusType,
    pomoTaskId: selectedTaskId,
    setPomoTaskId: setSelectedTaskId,
    pomoBlockId: selectedBlockId,
    setPomoBlockId: setSelectedBlockId,
    pomoCompletedCount: completedSessionsCount,
    setPomoCompletedCount: setCompletedSessionsCount,
    pomoLogs: focusLogs,
    setPomoLogs: setFocusLogs,
    pomoAmbientSoundType: ambientSoundType,
    setPomoAmbientSoundType: setAmbientSoundType,
    pomoAmbientVolume: ambientVolume,
    setPomoAmbientVolume: setAmbientVolume,
    pomoIsMuted: isMuted,
    setPomoIsMuted: setIsMuted,
    pomoAlarmSound: alarmSound,
    setPomoAlarmSound: setAlarmSound,
    pomoIsTicking: isTicking,
    setPomoIsTicking: setIsTicking,
    pomoIsZenMode: isZenMode,
    setPomoIsZenMode: setIsZenMode,
    playAlarmSound,
    getAudioContext
  } = data;

  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Total initial seconds for the current mode
  const totalSeconds = useMemo(() => {
    if (mode === "work") return settings.work * 60;
    if (mode === "shortBreak") return settings.shortBreak * 60;
    return settings.longBreak * 60;
  }, [mode, settings]);

  // SVG Progress Ring calculations
  const strokeDashoffset = useMemo(() => {
    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    const progress = timeLeft / totalSeconds;
    return circumference * (1 - progress);
  }, [timeLeft, totalSeconds]);

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

      if (assigneeClean === "both") {
        return activeUser === "user1" ? !t.completed_user1 : !t.completed_user2;
      }
      return !t.completed;
    });
  }, [tasks.rows, activeUser, user1, user2]);

  // Sync selected task title
  const activeFocusTask = useMemo(() => {
    return tasks.rows.find((t) => t.id === selectedTaskId);
  }, [tasks.rows, selectedTaskId]);

  // Sync selected timetable block
  const activeFocusBlock = useMemo(() => {
    return timetableBlocks?.rows.find((b) => b.id === selectedBlockId);
  }, [timetableBlocks?.rows, selectedBlockId]);

  // Filter timetable blocks for the active user
  const myTimetableBlocks = useMemo(() => {
    if (!timetableBlocks?.rows) return [];
    return timetableBlocks.rows.filter((b) => b.user_key === activeUser);
  }, [timetableBlocks?.rows, activeUser]);

  // Sort timetable blocks by date and time (most recent first)
  const myTimetableBlocksSorted = useMemo(() => {
    const list = [...myTimetableBlocks];
    list.sort((a, b) => {
      if (a.block_date !== b.block_date) {
        return b.block_date.localeCompare(a.block_date);
      }
      return b.start_time.localeCompare(a.start_time);
    });
    return list;
  }, [myTimetableBlocks]);

  // Handle task completion from within Pomodoro
  const handleCompleteActiveTask = useCallback(async () => {
    if (!selectedTaskId) return;
    const task = activeFocusTask;
    if (!task) return;

    const assigneeClean = (task.assigned_to || "").trim().toLowerCase();

    if (assigneeClean === "both") {
      if (activeUser === "user1") {
        const nextVal = !task.completed_user1;
        await tasks.update(selectedTaskId, {
          completed_user1: nextVal,
          completed: nextVal && !!task.completed_user2
        });
      } else if (activeUser === "user2") {
        const nextVal = !task.completed_user2;
        await tasks.update(selectedTaskId, {
          completed_user2: nextVal,
          completed: !!task.completed_user1 && nextVal
        });
      }
    } else {
      await tasks.update(selectedTaskId, { completed: true });
    }
    // Deselect task
    setSelectedTaskId("");
  }, [selectedTaskId, activeFocusTask, activeUser, tasks, setSelectedTaskId]);

  // Timer play / pause / switch handler
  const handleToggleTimer = useCallback(() => {
    getAudioContext();
    setIsPlaying(!isPlaying);
  }, [getAudioContext, isPlaying, setIsPlaying]);

  const handleResetTimer = useCallback(() => {
    setIsPlaying(false);
    setTimeLeft(totalSeconds);
  }, [totalSeconds, setIsPlaying, setTimeLeft]);

  const handleSkipMode = useCallback(() => {
    setIsPlaying(false);
    if (mode === "work") {
      const nextMode = (completedSessionsCount + 1) % settings.longBreakInterval === 0 ? "longBreak" : "shortBreak";
      setMode(nextMode);
      setTimeLeft(nextMode === "shortBreak" ? settings.shortBreak * 60 : settings.longBreak * 60);
    } else {
      setMode("work");
      setTimeLeft(settings.work * 60);
    }
  }, [mode, completedSessionsCount, settings, setMode, setTimeLeft, setIsPlaying]);

  const handleSelectMode = useCallback((newMode: "work" | "shortBreak" | "longBreak") => {
    setIsPlaying(false);
    setMode(newMode);
    if (newMode === "work") setTimeLeft(settings.work * 60);
    else if (newMode === "shortBreak") setTimeLeft(settings.shortBreak * 60);
    else setTimeLeft(settings.longBreak * 60);
  }, [settings, setMode, setTimeLeft, setIsPlaying]);



  // Clear session stats and history
  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your focus session statistics?")) {
      setCompletedSessionsCount(0);
      setFocusLogs([]);
    }
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Skip shortcuts if typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === " ") {
        e.preventDefault();
        handleToggleTimer();
      } else if (key === "r") {
        e.preventDefault();
        handleResetTimer();
      } else if (key === "w") {
        e.preventDefault();
        handleSelectMode("work");
      } else if (key === "s") {
        e.preventDefault();
        handleSelectMode("shortBreak");
      } else if (key === "l") {
        e.preventDefault();
        handleSelectMode("longBreak");
      } else if (key === "f") {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [handleToggleTimer, handleResetTimer, handleSelectMode, setIsZenMode]);

  // Esc key handler specifically for Zen Mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isZenMode, setIsZenMode]);

  // Settings Save Handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("pomo_settings", JSON.stringify(settings));
    // Reset timer to new work duration
    setTimeLeft(settings.work * 60);
    setIsPlaying(false);
    setSettingsOpen(false);
  };

  // Computed display clock values
  const displayMin = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const displaySec = (timeLeft % 60).toString().padStart(2, "0");

  // Dynamic Theme Styling configurations
  const theme = useMemo(() => {
    if (mode === "work") {
      return {
        accent: "text-rose-500",
        bgLight: "bg-rose-50/50",
        border: "border-rose-200",
        glow: "shadow-rose-100/50",
        btnBg: "bg-rose-500 hover:bg-rose-600",
        ringColor: "stroke-rose-500",
        title: "Work Session"
      };
    }
    if (mode === "shortBreak") {
      return {
        accent: "text-emerald-500",
        bgLight: "bg-emerald-50/50",
        border: "border-emerald-200",
        glow: "shadow-emerald-100/50",
        btnBg: "bg-emerald-500 hover:bg-emerald-600",
        ringColor: "stroke-emerald-500",
        title: "Short Break"
      };
    }
    return {
      accent: "text-sky-500",
      bgLight: "bg-sky-50/50",
      border: "border-sky-200",
      glow: "shadow-sky-100/50",
      btnBg: "bg-sky-500 hover:bg-sky-600",
      ringColor: "stroke-sky-500",
      title: "Long Break"
    };
  }, [mode]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-transparent p-4 lg:p-8 overflow-y-auto scrollbar-sleek relative">
      
      {/* ZEN FOCUS OVERLAY */}
      {isZenMode && (
        <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col items-center justify-center text-white select-none animate-fade-in">
          {/* Zen Exit Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsZenMode(false)}
            className="absolute top-6 right-6 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full"
            title="Exit Zen Mode (Esc)"
          >
            <Minimize2 className="h-5 w-5" />
          </Button>

          {/* Ambient indicator glowing ring */}
          <div className="relative flex items-center justify-center w-[360px] h-[360px] rounded-full bg-zinc-900/50 border border-zinc-800 shadow-2xl">
            {/* Animated Glow Circle */}
            <div className={cn(
              "absolute inset-0 rounded-full blur-2xl opacity-15 transition-all duration-1000",
              mode === "work" ? "bg-rose-500" : mode === "shortBreak" ? "bg-emerald-500" : "bg-sky-500",
              isPlaying && "animate-pulse"
            )} />

            {/* SVG Progress Ring */}
            <svg className="absolute w-[320px] h-[320px] -rotate-90 transform">
              <circle
                cx="160"
                cy="160"
                r="120"
                className="stroke-zinc-800"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="160"
                cy="160"
                r="120"
                className={cn("transition-all duration-300", theme.ringColor)}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 120}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Time digits */}
            <div className="flex flex-col items-center justify-center z-10">
              <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                {theme.title}
              </span>
              <span className="text-7xl font-bold tracking-tight mt-1 text-white tabular-nums">
                {displayMin}:{displaySec}
              </span>
              
              {/* Micro play/pause indicator */}
              <div className="flex gap-4 mt-6">
                <Button
                  size="icon"
                  onClick={handleToggleTimer}
                  className={cn("h-10 w-10 rounded-full shadow-md text-white transition-all", theme.btnBg)}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleResetTimer}
                  className="h-10 w-10 rounded-full border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active focus task/block label */}
          {mode === "work" && (focusType === "task" ? activeFocusTask : activeFocusBlock) && (
            <div className="mt-12 max-w-md text-center px-4 animate-fade-in">
              <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                {focusType === "task" ? "Current Focus Task" : "Current Focus Block"}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-lg font-bold text-zinc-200">
                  {focusType === "task" ? activeFocusTask?.title : activeFocusBlock?.title}
                </span>
                {focusType === "task" && activeFocusTask && (
                  <button
                    onClick={handleCompleteActiveTask}
                    className="h-6 w-6 rounded-full border border-zinc-700 text-zinc-500 hover:text-emerald-500 hover:border-emerald-500 flex items-center justify-center transition-all bg-zinc-900"
                    title="Mark Completed"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-white/20 dark:border-white/10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white text-wallpaper-safe">Pomodoro Focus Room</h1>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShortcutsOpen((prev) => !prev)}
            className="h-9 px-3 rounded-xl font-semibold gap-1.5"
          >
            <HelpCircle className="h-4 w-4" />
            Shortcuts
          </Button>
          <Button
            variant="outline"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="h-9 px-3 rounded-xl font-semibold gap-1.5"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button
            onClick={() => setIsZenMode(true)}
            className="h-9 px-3 rounded-xl font-semibold gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-dark-text dark:hover:bg-zinc-200 dark:text-dark-base"
          >
            <Maximize2 className="h-4 w-4" />
            Zen Mode
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts helper card */}
      {shortcutsOpen && (
        <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex flex-wrap gap-4 items-center justify-between animate-fade-in text-xs text-indigo-955 dark:text-indigo-200 font-medium">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <span className="flex items-center"><Keyboard className="h-3.5 w-3.5 text-indigo-500/85 dark:text-indigo-400/85 mr-1" /> <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-hover border border-zinc-200 dark:border-dark-muted rounded shadow-sm text-[10px] font-bold text-zinc-800 dark:text-dark-text mr-1">Space</kbd> Play / Pause</span>
            <span className="flex items-center"><RotateCcw className="h-3.5 w-3.5 text-indigo-500/85 dark:text-indigo-400/85 mr-1" /> <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-hover border border-zinc-200 dark:border-dark-muted rounded shadow-sm text-[10px] font-bold text-zinc-800 dark:text-dark-text mr-1">R</kbd> Reset Timer</span>
            <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 dark:bg-red-600 mr-1.5 shadow-sm" /> <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-hover border border-zinc-200 dark:border-dark-muted rounded shadow-sm text-[10px] font-bold text-zinc-800 dark:text-dark-text mr-1">W</kbd> Work Mode</span>
            <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-600 mr-1.5 shadow-sm" /> <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-hover border border-zinc-200 dark:border-dark-muted rounded shadow-sm text-[10px] font-bold text-zinc-800 dark:text-dark-text mr-1">S</kbd> Short Break</span>
            <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 dark:bg-blue-600 mr-1.5 shadow-sm" /> <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-hover border border-zinc-200 dark:border-dark-muted rounded shadow-sm text-[10px] font-bold text-zinc-800 dark:text-dark-text mr-1">L</kbd> Long Break</span>
            <span className="flex items-center"><Brain className="h-3.5 w-3.5 text-indigo-500/85 dark:text-indigo-400/85 mr-1" /> <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-hover border border-zinc-200 dark:border-dark-muted rounded shadow-sm text-[10px] font-bold text-zinc-800 dark:text-dark-text mr-1">F</kbd> Zen Focus Mode</span>
          </div>
          <button onClick={() => setShortcutsOpen(false)} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        
        {/* Left Side: Timer and Controls (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="border border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/35 backdrop-blur-xl rounded-[24px] p-6 lg:p-10 shadow-2xl flex flex-col items-center relative overflow-hidden">
            {/* Background Glow accent */}
            <div className={cn(
              "absolute -right-20 -top-20 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all duration-1000",
              mode === "work" ? "bg-rose-500" : mode === "shortBreak" ? "bg-emerald-500" : "bg-sky-500"
            )} />

            {/* Mode Selectors */}
            <div className="flex bg-white/20 dark:bg-black/25 backdrop-blur-md border border-white/25 dark:border-white/10 p-1 rounded-2xl w-full max-w-sm mb-8 z-10 relative">
              <button
                onClick={() => handleSelectMode("work")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  mode === "work"
                    ? "bg-white/40 dark:bg-white/15 text-rose-650 dark:text-rose-400 shadow-sm border border-white/20 dark:border-white/10"
                    : "text-slate-500 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Work Focus
              </button>
              <button
                onClick={() => handleSelectMode("shortBreak")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  mode === "shortBreak"
                    ? "bg-white/40 dark:bg-white/15 text-emerald-650 dark:text-emerald-400 shadow-sm border border-white/20 dark:border-white/10"
                    : "text-slate-500 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Short Break
              </button>
              <button
                onClick={() => handleSelectMode("longBreak")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  mode === "longBreak"
                    ? "bg-white/40 dark:bg-white/15 text-sky-650 dark:text-sky-400 shadow-sm border border-white/20 dark:border-white/10"
                    : "text-slate-500 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Long Break
              </button>
            </div>

            {/* Circular Countdown Progress ring */}
            <div className="relative flex items-center justify-center w-[280px] h-[280px] rounded-full border border-zinc-100 dark:border-dark-border shadow-inner z-10 bg-zinc-50/10">
              <svg className="absolute w-[280px] h-[280px] -rotate-90 transform">
                <circle
                  cx="140"
                  cy="140"
                  r="120"
                  className="stroke-zinc-100 dark:stroke-zinc-800/80"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="140"
                  cy="140"
                  r="120"
                  className={cn("transition-all duration-300", theme.ringColor)}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 120}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              {/* Countdown Digits */}
              <div className="flex flex-col items-center">
                <span className="text-6xl font-extrabold text-zinc-800 dark:text-dark-text tracking-tighter tabular-nums">
                  {displayMin}:{displaySec}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mt-1">
                  {theme.title}
                </span>
              </div>
            </div>

            {/* Timer Core Controls */}
            <div className="flex items-center gap-4 mt-8 z-10">
              <Button
                variant="outline"
                size="icon"
                onClick={handleResetTimer}
                className="h-11 w-11 rounded-2xl hover:bg-zinc-50 dark:hover:bg-dark-card text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-955 dark:hover:text-dark-text shadow-sm"
                title="Reset Timer"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleToggleTimer}
                className={cn("h-14 px-8 rounded-2xl text-white font-bold gap-2 text-base shadow-md transition-all min-w-[140px]", theme.btnBg)}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
                {isPlaying ? "Pause" : "Start"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSkipMode}
                className="h-11 w-11 rounded-2xl hover:bg-zinc-50 dark:hover:bg-dark-card text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-955 dark:hover:text-dark-text shadow-sm"
                title="Skip Session"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

             {/* Active focus target linking card */}
            {mode === "work" && (
              <div className="w-full max-w-md border border-white/20 dark:border-white/10 rounded-2xl p-4 mt-8 bg-white/25 dark:bg-black/25 backdrop-blur-md flex items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <ListTodo className="h-5 w-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                      {focusType === "task" ? "Focusing Task" : "Focusing Block"}
                    </p>
                    {focusType === "task" ? (
                      activeFocusTask ? (
                        <span className="text-xs font-bold text-zinc-800 dark:text-white truncate block mt-0.5">
                          {activeFocusTask.title}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic mt-0.5">No task linked</span>
                      )
                    ) : (
                      activeFocusBlock ? (
                        <span className="text-xs font-bold text-zinc-800 dark:text-white truncate block mt-0.5">
                          {activeFocusBlock.title} ({activeFocusBlock.block_date} {activeFocusBlock.start_time} - {activeFocusBlock.end_time})
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic mt-0.5">No block linked</span>
                      )
                    )}
                  </div>
                </div>

                {focusType === "task" && activeFocusTask ? (
                  <Button
                    onClick={handleCompleteActiveTask}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2.5 rounded-lg border-white/20 dark:border-white/10 text-slate-650 dark:text-dark-text-secondary hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-350 hover:border-emerald-500/30 font-bold shrink-0 shadow-sm"
                  >
                    Done
                  </Button>
                ) : (
                  <span className="text-[10px] font-medium text-slate-450 dark:text-slate-500 shrink-0 select-none">
                    Linked to stats
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Web Audio Synthesizer Panel */}
          <div className="border border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/35 backdrop-blur-xl rounded-[24px] p-6 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-dark-text">Soundscape Generator</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Native Web Audio ambient noise synthesis (zero delay, distraction-free).</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {(
                [
                  { type: "none", label: "Silent" },
                  { type: "white", label: "White Noise" },
                  { type: "pink", label: "Pink Noise" },
                  { type: "brown", label: "Brown Noise" },
                  { type: "rain", label: "Soft Rain" }
                ] as const
              ).map((s) => (
                <button
                  key={s.type}
                  onClick={() => {
                    getAudioContext();
                    setAmbientSoundType(s.type);
                  }}
                  className={cn(
                    "py-2 px-3 border rounded-xl text-xs font-bold transition-all shadow-sm",
                    ambientSoundType === s.type
                      ? "bg-zinc-900 dark:bg-dark-text border-zinc-950 dark:border-zinc-55 text-white dark:text-dark-base"
                      : "bg-white dark:bg-dark-base hover:bg-zinc-50 dark:hover:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-dark-text-secondary"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Volume slider & mute */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t pt-4 border-zinc-100 dark:border-dark-border/60">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="h-8 w-8 rounded-full"
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-zinc-650 dark:text-zinc-350" />}
                </Button>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-750 dark:text-zinc-250">Ambient Volume</span>
                  <span className="text-[9px] text-zinc-400">Control generator gain level</span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-1 max-w-xs">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVolume}
                  onChange={(e) => setAmbientVolume(Number(e.target.value))}
                  className="h-1.5 w-full bg-zinc-100 dark:bg-dark-hover rounded-lg appearance-none cursor-pointer accent-zinc-800 dark:accent-dark-text-secondary"
                  disabled={isMuted}
                />
                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-350 min-w-[28px] text-right">
                  {Math.round(ambientVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Metronome Metronome click oscillator */}
            <div className="flex items-center justify-between gap-4 border-t pt-4 border-zinc-100 dark:border-dark-border/60">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ticking-chk"
                  checked={isTicking}
                  onChange={(e) => {
                    getAudioContext();
                    setIsTicking(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-dark-muted text-zinc-850 dark:text-dark-text focus:ring-zinc-800 dark:bg-dark-card cursor-pointer"
                />
                <label htmlFor="ticking-chk" className="text-xs font-bold text-zinc-700 dark:text-dark-text-secondary cursor-pointer">
                  Concentration Metronome Ticking
                </label>
              </div>
              <span className="text-[9px] text-zinc-400">Clicking clock tone</span>
            </div>
          </div>
        </div>

        {/* Right Side: Task lists, statistics, settings (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Settings Section (Accordion-like drop) */}
          {settingsOpen && (
            <div className="border border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/35 backdrop-blur-xl rounded-[24px] p-6 shadow-2xl animate-fade-in flex flex-col gap-4">
              <div className="border-b pb-3 border-zinc-150 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Timer Settings</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold">Close</button>
              </div>
              
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Work (m)</label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.work}
                      onChange={(e) => setSettings({ ...settings, work: Number(e.target.value) })}
                      required
                      className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Short (m)</label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.shortBreak}
                      onChange={(e) => setSettings({ ...settings, shortBreak: Number(e.target.value) })}
                      required
                      className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Long (m)</label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.longBreak}
                      onChange={(e) => setSettings({ ...settings, longBreak: Number(e.target.value) })}
                      required
                      className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Long Break Every</label>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={settings.longBreakInterval}
                      onChange={(e) => setSettings({ ...settings, longBreakInterval: Number(e.target.value) })}
                      required
                      className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Daily Target</label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={settings.targetSessions}
                      onChange={(e) => setSettings({ ...settings, targetSessions: Number(e.target.value) })}
                      required
                      className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3 border-zinc-150 dark:border-white/10">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase block">Chime Alarm Sound</label>
                  <div className="flex gap-2">
                    {(
                      [
                        { key: "zen", name: "Zen Bowl" },
                        { key: "digital", name: "Beep" },
                        { key: "chime", name: "Wind Chime" }
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          getAudioContext();
                          setAlarmSound(s.key);
                          // Play a preview
                          setTimeout(() => {
                            if (alarmSound !== s.key) {
                              setAlarmSound(s.key);
                            }
                            playAlarmSound();
                          }, 50);
                        }}
                        className={cn(
                          "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border",
                          alarmSound === s.key
                            ? "bg-white/40 dark:bg-white/15 text-indigo-650 dark:text-indigo-400 border-white/25 dark:border-white/10 shadow-sm"
                            : "bg-transparent text-slate-500 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-white border-white/10 dark:border-white/5"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3 border-zinc-150 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="chk-break" className="font-bold text-slate-500 dark:text-dark-text-secondary cursor-pointer">Auto Start Breaks</label>
                    <input
                      type="checkbox"
                      id="chk-break"
                      checked={settings.autoStartBreaks}
                      onChange={(e) => setSettings({ ...settings, autoStartBreaks: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 dark:border-white/10 text-indigo-650 bg-white/20 dark:bg-black/20 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="chk-work" className="font-bold text-slate-500 dark:text-dark-text-secondary cursor-pointer">Auto Start Work Cycles</label>
                    <input
                      type="checkbox"
                      id="chk-work"
                      checked={settings.autoStartWork}
                      onChange={(e) => setSettings({ ...settings, autoStartWork: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 dark:border-white/10 text-indigo-650 bg-white/20 dark:bg-black/20 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl">
                  Save Settings
                </Button>
              </form>
            </div>
          )}
          <div className="border border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/35 backdrop-blur-xl rounded-[24px] p-6 shadow-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Focus Integrations</h3>
              <p className="text-[10px] text-slate-500 dark:text-dark-text-secondary mt-0.5">Focus on an uncompleted task or a scheduled timetable block.</p>
            </div>

            {/* Segmented tab controls */}
            <div className="flex bg-white/20 dark:bg-black/25 backdrop-blur-md border border-white/25 dark:border-white/10 p-1 rounded-2xl w-full">
              <button
                type="button"
                onClick={() => setFocusType("task")}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all",
                  focusType === "task"
                    ? "bg-white/40 dark:bg-white/15 text-indigo-650 dark:text-indigo-400 shadow-sm border border-white/20 dark:border-white/10"
                    : "text-slate-500 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Task Checklist
              </button>
              <button
                type="button"
                onClick={() => setFocusType("block")}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all",
                  focusType === "block"
                    ? "bg-white/40 dark:bg-white/15 text-indigo-650 dark:text-indigo-400 shadow-sm border border-white/20 dark:border-white/10"
                    : "text-slate-500 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Timetable Blocks
              </button>
            </div>

            {focusType === "task" ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Select Target Task</label>
                {myPendingTasks.length === 0 ? (
                  <div className="p-3 bg-white/20 dark:bg-black/20 border border-white/15 dark:border-white/5 rounded-xl text-xs text-slate-500 dark:text-dark-text-secondary italic text-center">
                    No pending tasks in your checklist.
                  </div>
                ) : (
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      setSelectedTaskId(e.target.value);
                      setSelectedBlockId("");
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-white/25 dark:border-white/10 bg-white/40 dark:bg-black/30 p-2.5 text-slate-800 dark:text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="" className="bg-white dark:bg-[#1e1f22] text-slate-800 dark:text-white">-- Choose a task to track --</option>
                    {myPendingTasks.map((t) => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-[#1e1f22] text-slate-800 dark:text-white">
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase">Select Target Block</label>
                {myTimetableBlocksSorted.length === 0 ? (
                  <div className="p-3 bg-white/20 dark:bg-black/20 border border-white/15 dark:border-white/5 rounded-xl text-xs text-slate-500 dark:text-dark-text-secondary italic text-center">
                    No scheduled timetable blocks found.
                  </div>
                ) : (
                  <select
                    value={selectedBlockId}
                    onChange={(e) => {
                      setSelectedBlockId(e.target.value);
                      setSelectedTaskId("");
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-white/25 dark:border-white/10 bg-white/40 dark:bg-black/30 p-2.5 text-slate-800 dark:text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="" className="bg-white dark:bg-[#1e1f22] text-slate-800 dark:text-white">-- Choose a block to track --</option>
                    {myTimetableBlocksSorted.map((b) => (
                      <option key={b.id} value={b.id} className="bg-white dark:bg-[#1e1f22] text-slate-800 dark:text-white">
                        {b.title} ({b.block_date} {b.start_time} - {b.end_time})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Session Statistics Dashboard */}
          <div className="border border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/35 backdrop-blur-xl rounded-[24px] p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white font-bold">Focus Performance</h3>
                <p className="text-[10px] text-slate-500 dark:text-dark-text-secondary mt-0.5">Track sessions completed and focus metrics.</p>
              </div>
              <Button
                variant="ghost"
                onClick={handleClearHistory}
                className="h-8 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-500/10 dark:hover:bg-red-950/20 font-bold px-2 rounded-xl"
              >
                Clear Stats
              </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/25 dark:bg-black/25 border border-white/20 dark:border-white/10 rounded-2xl p-4 flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase tracking-wide">Total Focus Time</span>
                <span className="text-2xl font-extrabold text-zinc-800 dark:text-white mt-1">
                  {completedSessionsCount * settings.work} <span className="text-xs font-bold text-slate-400">mins</span>
                </span>
                <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-semibold mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Increasing today</span>
                </div>
              </div>

              <div className="bg-white/25 dark:bg-black/25 border border-white/20 dark:border-white/10 rounded-2xl p-4 flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 dark:text-dark-text-secondary uppercase tracking-wide">Daily Sessions</span>
                <span className="text-2xl font-extrabold text-zinc-800 dark:text-white mt-1">
                  {completedSessionsCount} <span className="text-xs font-bold text-slate-400">/ {settings.targetSessions}</span>
                </span>
                <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-dark-text-secondary mt-1">
                  <CheckCircle2 className="h-3 w-3 text-indigo-500" />
                  <span>Target: {settings.targetSessions}</span>
                </div>
              </div>
            </div>

            {/* Visual SVG Progress ring for daily target */}
            <div className="flex items-center gap-4 bg-white/25 dark:bg-black/25 border border-white/20 dark:border-white/10 rounded-2xl p-4">
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90 transform">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    className="stroke-zinc-100 dark:stroke-zinc-800/80"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    className="stroke-indigo-600 transition-all duration-300"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 24}
                    strokeDashoffset={2 * Math.PI * 24 * (1 - Math.min(1, completedSessionsCount / settings.targetSessions))}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold text-zinc-700 dark:text-zinc-350">
                  {Math.round(Math.min(100, (completedSessionsCount / settings.targetSessions) * 100))}%
                </span>
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold text-zinc-800 dark:text-dark-text block">Daily Focus Target</span>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {completedSessionsCount >= settings.targetSessions ? (
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
                      Target fully achieved today! Excellent work.
                    </span>
                  ) : (
                    <span>Complete {settings.targetSessions - completedSessionsCount} more focus cycles to hit your daily goal.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Session Logs list */}
            <div className="border-t pt-4 border-zinc-100 dark:border-dark-border/60">
              <div className="flex items-center gap-1.5 mb-2.5">
                <History className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-350 font-bold">{"Today's Focus Log"}</span>
              </div>

              {focusLogs.length === 0 ? (
                <div className="p-3 bg-zinc-50/55 dark:bg-dark-base/30 border border-dashed rounded-2xl text-[10px] text-muted-foreground italic text-center">
                  No focus cycles logged yet today. Focus session will record here.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-sleek">
                  {focusLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-base/20 text-[10px] font-medium"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          log.mode === "work" ? "bg-rose-500" : log.mode === "shortBreak" ? "bg-emerald-500" : "bg-sky-500"
                        )} />
                        <span className="font-bold text-zinc-700 dark:text-dark-text-secondary truncate">{log.taskTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400 shrink-0">
                        <span>{log.duration}m</span>
                        <span>•</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
