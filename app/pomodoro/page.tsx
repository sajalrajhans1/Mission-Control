"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  ListTodo
} from "lucide-react";
import { useData, useUserNames } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Types for settings
interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
  targetSessions: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

// Types for focus log entries
interface FocusSessionLog {
  id: string;
  taskTitle: string;
  duration: number; // minutes
  timestamp: string;
  mode: "work" | "shortBreak" | "longBreak";
}

// Synthesize noise buffer (White, Pink, Brown)
const createNoiseBuffer = (type: "white" | "pink" | "brown", ctx: AudioContext): AudioBuffer => {
  const bufferSize = 2 * ctx.sampleRate;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  if (type === "white") {
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  } else if (type === "brown") {
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Compensate volume loss
    }
  } else {
    // Pink noise Voss-McCartney algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }
  }
  return noiseBuffer;
};

export default function PomodoroPage() {
  const { tasks, activeUser, timetableBlocks } = useData();
  const { user1, user2 } = useUserNames();

  // Mode state: 'work' | 'shortBreak' | 'longBreak'
  const [mode, setMode] = useState<"work" | "shortBreak" | "longBreak">("work");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);

  // Settings state (initialized from localStorage on mount)
  const [settings, setSettings] = useState<TimerSettings>({
    work: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    targetSessions: 4,
    autoStartBreaks: true,
    autoStartWork: false
  });

  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Focus Task & Block Integration
  const [focusType, setFocusType] = useState<"task" | "block">("task");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [completedSessionsCount, setCompletedSessionsCount] = useState<number>(0);
  const [focusLogs, setFocusLogs] = useState<FocusSessionLog[]>([]);

  // Soundscape States
  const [ambientSoundType, setAmbientSoundType] = useState<"none" | "white" | "pink" | "brown" | "rain">("none");
  const [ambientVolume, setAmbientVolume] = useState<number>(0.3);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [alarmSound, setAlarmSound] = useState<"zen" | "digital" | "chime">("zen");
  const [isTicking, setIsTicking] = useState<boolean>(false);

  // Zen Mode State
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Web Audio Context & Synthesizer Nodes Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const ambientGainNodeRef = useRef<GainNode | null>(null);
  const tickerOscillatorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Timer Interval Ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Load stats, logs and settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("pomo_settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        // Set initial timer based on parsed settings
        setTimeLeft(parsed.work * 60);
      } catch (e) {
        console.error("Failed to parse pomo_settings", e);
      }
    }

    const savedLogs = localStorage.getItem("pomo_logs");
    if (savedLogs) {
      try {
        setFocusLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Failed to parse pomo_logs", e);
      }
    }

    const savedCount = localStorage.getItem("pomo_completed_count");
    if (savedCount) {
      setCompletedSessionsCount(Number(savedCount));
    }
  }, []);

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
  }, [selectedTaskId, activeFocusTask, activeUser, tasks]);

  // Safe Web Audio Context initializer
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current as AudioContext;
  }, []);

  const stopAmbientSound = useCallback(() => {
    if (ambientSourceNodeRef.current) {
      try {
        ambientSourceNodeRef.current.stop();
        ambientSourceNodeRef.current.disconnect();
      } catch {}
      ambientSourceNodeRef.current = null;
    }
    if (ambientGainNodeRef.current) {
      ambientGainNodeRef.current.disconnect();
      ambientGainNodeRef.current = null;
    }
  }, []);

  // Play ambient synthesized soundscapes
  const startAmbientSound = useCallback((type: "white" | "pink" | "brown" | "rain") => {
    stopAmbientSound();
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const buffer = createNoiseBuffer(type === "rain" ? "brown" : type, ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      // Apply lower base volume for white/pink noise to prevent spikes
      const scale = type === "white" ? 0.4 : type === "pink" ? 0.6 : 1.0;
      gainNode.gain.setValueAtTime(ambientVolume * scale, ctx.currentTime);

      if (type === "rain") {
        // Rain is filtered brown noise + modulated low pass filter
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        source.connect(filter);
        filter.connect(gainNode);
      } else {
        source.connect(gainNode);
      }

      gainNode.connect(ctx.destination);
      source.start();

      ambientSourceNodeRef.current = source;
      ambientGainNodeRef.current = gainNode;
    } catch (e) {
      console.error("Failed to start Web Audio ambient synthesizer", e);
    }
  }, [isMuted, ambientVolume, getAudioContext, stopAmbientSound]);

  // Adjust volume of synthesized sounds live
  useEffect(() => {
    if (ambientGainNodeRef.current && audioCtxRef.current) {
      const scale = ambientSoundType === "white" ? 0.4 : ambientSoundType === "pink" ? 0.6 : 1.0;
      ambientGainNodeRef.current.gain.setValueAtTime(
        isMuted ? 0 : ambientVolume * scale,
        audioCtxRef.current.currentTime
      );
    }
  }, [ambientVolume, isMuted, ambientSoundType]);

  // Monitor soundscapes mode changes
  useEffect(() => {
    if (ambientSoundType !== "none" && isPlaying) {
      startAmbientSound(ambientSoundType);
    } else {
      stopAmbientSound();
    }
    return () => stopAmbientSound();
  }, [ambientSoundType, isPlaying, startAmbientSound, stopAmbientSound]);

  // Synthesize single click (ticking metronome effect)
  const playTickSound = useCallback(() => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const nowTime = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1600, nowTime);

      gainNode.gain.setValueAtTime(0.02, nowTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, nowTime + 0.02);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(nowTime);
      osc.stop(nowTime + 0.03);
    } catch {}
  }, [isMuted, getAudioContext]);

  // Ticking metronome triggers
  useEffect(() => {
    if (isPlaying && isTicking) {
      tickerOscillatorIntervalRef.current = setInterval(() => {
        playTickSound();
      }, 1000);
    } else {
      if (tickerOscillatorIntervalRef.current) {
        clearInterval(tickerOscillatorIntervalRef.current);
      }
    }
    return () => {
      if (tickerOscillatorIntervalRef.current) {
        clearInterval(tickerOscillatorIntervalRef.current);
      }
    };
  }, [isPlaying, isTicking, playTickSound]);

  // Synthesize Completion Alarm Bells
  const playAlarmSound = useCallback(() => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const nowTime = ctx.currentTime;

      if (alarmSound === "zen") {
        // Multi-frequency soothing Zen Bowl oscillation
        const freqs = [380, 570, 760];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, nowTime);
          
          gainNode.gain.setValueAtTime(0, nowTime);
          gainNode.gain.linearRampToValueAtTime(0.3 / freqs.length, nowTime + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, nowTime + 4 - idx * 0.5);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(nowTime);
          osc.stop(nowTime + 4.5);
        });
      } else if (alarmSound === "digital") {
        // Triple high beep
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(950, nowTime);

        gainNode.gain.setValueAtTime(0, nowTime);
        gainNode.gain.setValueAtTime(0.25, nowTime + 0.05);
        gainNode.gain.setValueAtTime(0, nowTime + 0.25);
        gainNode.gain.setValueAtTime(0.25, nowTime + 0.35);
        gainNode.gain.setValueAtTime(0, nowTime + 0.55);
        gainNode.gain.setValueAtTime(0.25, nowTime + 0.65);
        gainNode.gain.setValueAtTime(0, nowTime + 0.85);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(nowTime);
        osc.stop(nowTime + 0.95);
      } else {
        // Arpeggiated soft wind chime
        const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, nowTime + idx * 0.15);
          
          gainNode.gain.setValueAtTime(0, nowTime + idx * 0.15);
          gainNode.gain.linearRampToValueAtTime(0.12, nowTime + idx * 0.15 + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, nowTime + idx * 0.15 + 1.5);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(nowTime + idx * 0.15);
          osc.stop(nowTime + idx * 0.15 + 1.8);
        });
      }
    } catch (e) {
      console.error("Failed to play alarm chime", e);
    }
  }, [isMuted, alarmSound, getAudioContext]);

  // Timer play / pause / switch handler
  const handleToggleTimer = useCallback(() => {
    // Unsuspend audio context on gesture (required by browsers)
    getAudioContext();
    setIsPlaying((prev) => !prev);
  }, [getAudioContext]);

  const handleResetTimer = useCallback(() => {
    setIsPlaying(false);
    setTimeLeft(totalSeconds);
  }, [totalSeconds]);

  const handleSkipMode = useCallback(() => {
    setIsPlaying(false);
    if (mode === "work") {
      // Auto switch to short break or long break based on session progress
      const nextMode = (completedSessionsCount + 1) % settings.longBreakInterval === 0 ? "longBreak" : "shortBreak";
      setMode(nextMode);
      setTimeLeft(nextMode === "shortBreak" ? settings.shortBreak * 60 : settings.longBreak * 60);
    } else {
      setMode("work");
      setTimeLeft(settings.work * 60);
    }
  }, [mode, completedSessionsCount, settings]);

  // Direct tab selectors
  const handleSelectMode = useCallback((newMode: "work" | "shortBreak" | "longBreak") => {
    setIsPlaying(false);
    setMode(newMode);
    if (newMode === "work") setTimeLeft(settings.work * 60);
    else if (newMode === "shortBreak") setTimeLeft(settings.shortBreak * 60);
    else setTimeLeft(settings.longBreak * 60);
  }, [settings]);

  // Session completed logic
  const handleSessionCompleted = useCallback(() => {
    // 1. Add log
    const duration = mode === "work" ? settings.work : mode === "shortBreak" ? settings.shortBreak : settings.longBreak;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    let logTitle = "General Focus Session";
    if (mode === "work") {
      if (focusType === "task" && activeFocusTask) {
        logTitle = activeFocusTask.title;
      } else if (focusType === "block" && activeFocusBlock) {
        logTitle = `Block: ${activeFocusBlock.title}`;
      }
    }

    const newLog: FocusSessionLog = {
      id: Math.random().toString(36).substring(2, 9),
      taskTitle: mode === "work" ? logTitle : mode === "shortBreak" ? "Short Break" : "Long Break",
      duration,
      timestamp,
      mode
    };

    setFocusLogs((prevLogs) => {
      const updatedLogs = [newLog, ...prevLogs].slice(0, 50); // limit to 50 logs
      localStorage.setItem("pomo_logs", JSON.stringify(updatedLogs));
      return updatedLogs;
    });

    // 2. Increment Work counter
    if (mode === "work") {
      const nextCount = completedSessionsCount + 1;
      setCompletedSessionsCount(nextCount);
      localStorage.setItem("pomo_completed_count", String(nextCount));

      // 3. Switch mode auto-trigger
      setTimeout(() => {
        const triggersLongBreak = nextCount % settings.longBreakInterval === 0;
        const nextMode = triggersLongBreak ? "longBreak" : "shortBreak";
        
        setMode(nextMode);
        setTimeLeft(nextMode === "shortBreak" ? settings.shortBreak * 60 : settings.longBreak * 60);
        
        if (settings.autoStartBreaks) {
          setIsPlaying(true);
        }
      }, 1200);
    } else {
      // Completed a break, switch back to work
      setTimeout(() => {
        setMode("work");
        setTimeLeft(settings.work * 60);

        if (settings.autoStartWork) {
          setIsPlaying(true);
        }
      }, 1200);
    }
  }, [mode, settings, activeFocusTask, activeFocusBlock, focusType, completedSessionsCount]);

  // Main countdown ticker hook
  useEffect(() => {
    if (isPlaying) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer expired!
            clearInterval(timerIntervalRef.current!);
            setIsPlaying(false);
            playAlarmSound();
            handleSessionCompleted();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isPlaying, playAlarmSound, handleSessionCompleted]);

  // Clear session stats and history
  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your focus session statistics?")) {
      setCompletedSessionsCount(0);
      setFocusLogs([]);
      localStorage.removeItem("pomo_completed_count");
      localStorage.removeItem("pomo_logs");
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
  }, [handleToggleTimer, handleResetTimer, handleSelectMode]);

  // Esc key handler specifically for Zen Mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isZenMode]);

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
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#fafafa] p-4 lg:p-8 overflow-y-auto scrollbar-sleek relative">
      
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-zinc-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Pomodoro Focus Room</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Customize your sessions, play ambient soundscapes, and align with your task checklist.</p>
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
            className="h-9 px-3 rounded-xl font-semibold gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white"
          >
            <Maximize2 className="h-4 w-4" />
            Zen Mode
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts helper card */}
      {shortcutsOpen && (
        <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-wrap gap-4 items-center justify-between animate-fade-in text-xs text-indigo-950 font-medium">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <span>⌨️ <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-[10px] font-bold">Space</kbd> Play / Pause</span>
            <span>🔄 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-[10px] font-bold">R</kbd> Reset Timer</span>
            <span>🔴 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-[10px] font-bold">W</kbd> Work Mode</span>
            <span>🟢 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-[10px] font-bold">S</kbd> Short Break</span>
            <span>🔵 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-[10px] font-bold">L</kbd> Long Break</span>
            <span>🧘 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-[10px] font-bold">F</kbd> Zen Focus Mode</span>
          </div>
          <button onClick={() => setShortcutsOpen(false)} className="text-indigo-500 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        
        {/* Left Side: Timer and Controls (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="border border-zinc-200/80 bg-white rounded-3xl p-6 lg:p-10 shadow-soft flex flex-col items-center relative overflow-hidden">
            {/* Background Glow accent */}
            <div className={cn(
              "absolute -right-20 -top-20 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all duration-1000",
              mode === "work" ? "bg-rose-500" : mode === "shortBreak" ? "bg-emerald-500" : "bg-sky-500"
            )} />

            {/* Mode Selectors */}
            <div className="flex bg-zinc-50 border p-1 rounded-2xl w-full max-w-sm mb-8 z-10 relative">
              <button
                onClick={() => handleSelectMode("work")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  mode === "work"
                    ? "bg-white text-rose-600 shadow-sm border border-rose-100"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                Work Focus
              </button>
              <button
                onClick={() => handleSelectMode("shortBreak")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  mode === "shortBreak"
                    ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                Short Break
              </button>
              <button
                onClick={() => handleSelectMode("longBreak")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  mode === "longBreak"
                    ? "bg-white text-sky-600 shadow-sm border border-sky-100"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                Long Break
              </button>
            </div>

            {/* Circular Countdown Progress ring */}
            <div className="relative flex items-center justify-center w-[280px] h-[280px] rounded-full border border-zinc-100 shadow-inner z-10 bg-zinc-50/10">
              <svg className="absolute w-[280px] h-[280px] -rotate-90 transform">
                <circle
                  cx="140"
                  cy="140"
                  r="120"
                  className="stroke-zinc-100"
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
                <span className="text-6xl font-extrabold text-zinc-800 tracking-tighter tabular-nums">
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
                className="h-11 w-11 rounded-2xl hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 shadow-sm"
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
                className="h-11 w-11 rounded-2xl hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 shadow-sm"
                title="Skip Session"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

             {/* Active focus target linking card */}
            {mode === "work" && (
              <div className="w-full max-w-md border rounded-2xl p-4 mt-8 bg-zinc-50/50 border-zinc-100 flex items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <ListTodo className="h-5 w-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                      {focusType === "task" ? "Focusing Task" : "Focusing Block"}
                    </p>
                    {focusType === "task" ? (
                      activeFocusTask ? (
                        <span className="text-xs font-bold text-zinc-800 truncate block mt-0.5">
                          {activeFocusTask.title}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic mt-0.5">No task linked</span>
                      )
                    ) : (
                      activeFocusBlock ? (
                        <span className="text-xs font-bold text-zinc-800 truncate block mt-0.5">
                          {activeFocusBlock.title} ({activeFocusBlock.block_date} {activeFocusBlock.start_time} - {activeFocusBlock.end_time})
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic mt-0.5">No block linked</span>
                      )
                    )}
                  </div>
                </div>

                {focusType === "task" && activeFocusTask ? (
                  <Button
                    onClick={handleCompleteActiveTask}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2.5 rounded-lg border-zinc-200 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-bold shrink-0 shadow-sm"
                  >
                    Done
                  </Button>
                ) : (
                  <span className="text-[10px] font-medium text-zinc-400 shrink-0 select-none">
                    Linked to stats
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Web Audio Synthesizer Panel */}
          <div className="border border-zinc-200/80 bg-white rounded-3xl p-6 shadow-soft flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Soundscape Generator</h3>
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
                      ? "bg-zinc-900 border-zinc-950 text-white"
                      : "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-600"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Volume slider & mute */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t pt-4 border-zinc-100">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="h-8 w-8 rounded-full"
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-zinc-600" />}
                </Button>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-700">Ambient Volume</span>
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
                  className="h-1.5 w-full bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-800"
                  disabled={isMuted}
                />
                <span className="text-[10px] font-bold text-zinc-700 min-w-[28px] text-right">
                  {Math.round(ambientVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Metronome Metronome click oscillator */}
            <div className="flex items-center justify-between gap-4 border-t pt-4 border-zinc-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ticking-chk"
                  checked={isTicking}
                  onChange={(e) => {
                    getAudioContext();
                    setIsTicking(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-850 focus:ring-zinc-800 cursor-pointer"
                />
                <label htmlFor="ticking-chk" className="text-xs font-bold text-zinc-700 cursor-pointer">
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
            <div className="border border-zinc-200/80 bg-white rounded-3xl p-6 shadow-soft animate-fade-in">
              <div className="border-b pb-3 mb-4 flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-800">Timer Settings</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600">Close</button>
              </div>
              
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Work (m)</label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.work}
                      onChange={(e) => setSettings({ ...settings, work: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Short (m)</label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.shortBreak}
                      onChange={(e) => setSettings({ ...settings, shortBreak: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Long (m)</label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.longBreak}
                      onChange={(e) => setSettings({ ...settings, longBreak: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Long Break Every</label>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={settings.longBreakInterval}
                      onChange={(e) => setSettings({ ...settings, longBreakInterval: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Daily Target</label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={settings.targetSessions}
                      onChange={(e) => setSettings({ ...settings, targetSessions: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">Chime Alarm Sound</label>
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
                          "flex-1 py-1.5 border rounded-xl text-xs font-bold transition-all",
                          alarmSound === s.key
                            ? "bg-zinc-800 border-zinc-900 text-white"
                            : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="chk-break" className="font-bold text-zinc-650 cursor-pointer">Auto Start Breaks</label>
                    <input
                      type="checkbox"
                      id="chk-break"
                      checked={settings.autoStartBreaks}
                      onChange={(e) => setSettings({ ...settings, autoStartBreaks: e.target.checked })}
                      className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-800"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="chk-work" className="font-bold text-zinc-650 cursor-pointer">Auto Start Work Cycles</label>
                    <input
                      type="checkbox"
                      id="chk-work"
                      checked={settings.autoStartWork}
                      onChange={(e) => setSettings({ ...settings, autoStartWork: e.target.checked })}
                      className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-800"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl">
                  Save Settings
                </Button>
              </form>
            </div>
          )}

          {/* Focus Target Dropdown Selection */}
          <div className="border border-zinc-200/80 bg-white rounded-3xl p-6 shadow-soft flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Focus Integrations</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Focus on an uncompleted task or a scheduled timetable block.</p>
            </div>

            {/* Segmented tab controls */}
            <div className="flex bg-zinc-50 border p-1 rounded-2xl w-full">
              <button
                type="button"
                onClick={() => setFocusType("task")}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all",
                  focusType === "task"
                    ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
                    : "text-zinc-500 hover:text-zinc-900"
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
                    ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                Timetable Blocks
              </button>
            </div>

            {focusType === "task" ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Select Target Task</label>
                {myPendingTasks.length === 0 ? (
                  <div className="p-3 bg-zinc-50 border rounded-xl text-xs text-muted-foreground italic text-center">
                    No pending tasks in your checklist.
                  </div>
                ) : (
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      setSelectedTaskId(e.target.value);
                      setSelectedBlockId("");
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose a task to track --</option>
                    {myPendingTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Select Target Block</label>
                {myTimetableBlocksSorted.length === 0 ? (
                  <div className="p-3 bg-zinc-50 border rounded-xl text-xs text-muted-foreground italic text-center">
                    No scheduled timetable blocks found.
                  </div>
                ) : (
                  <select
                    value={selectedBlockId}
                    onChange={(e) => {
                      setSelectedBlockId(e.target.value);
                      setSelectedTaskId("");
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose a block to track --</option>
                    {myTimetableBlocksSorted.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.block_date} {b.start_time} - {b.end_time})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Session Statistics Dashboard */}
          <div className="border border-zinc-200/80 bg-white rounded-3xl p-6 shadow-soft flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-zinc-800">Focus Performance</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Track sessions completed and aggregate focus metrics.</p>
              </div>
              <Button
                variant="ghost"
                onClick={handleClearHistory}
                className="h-8 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 font-bold px-2 rounded-xl"
              >
                Clear Stats
              </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-4 flex flex-col">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Total Focus Time</span>
                <span className="text-2xl font-extrabold text-zinc-800 mt-1">
                  {completedSessionsCount * settings.work} <span className="text-xs font-bold text-zinc-400">mins</span>
                </span>
                <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-semibold mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Increasing today</span>
                </div>
              </div>

              <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-4 flex flex-col">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Daily Sessions Completed</span>
                <span className="text-2xl font-extrabold text-zinc-800 mt-1">
                  {completedSessionsCount} <span className="text-xs font-bold text-zinc-400">/ {settings.targetSessions}</span>
                </span>
                <div className="flex items-center gap-1 text-[9px] text-zinc-400 mt-1">
                  <CheckCircle2 className="h-3 w-3 text-indigo-500" />
                  <span>Target: {settings.targetSessions} per day</span>
                </div>
              </div>
            </div>

            {/* Visual SVG Progress ring for daily target */}
            <div className="flex items-center gap-4 bg-zinc-50/30 border border-zinc-100 rounded-2xl p-4">
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90 transform">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    className="stroke-zinc-100"
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
                <span className="absolute text-[10px] font-bold text-zinc-700">
                  {Math.round(Math.min(100, (completedSessionsCount / settings.targetSessions) * 100))}%
                </span>
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold text-zinc-800 block">Daily Focus Target</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  {completedSessionsCount >= settings.targetSessions 
                    ? "✨ Target fully achieved today! Excellent work."
                    : `Complete ${settings.targetSessions - completedSessionsCount} more focus cycles to hit your daily goal.`}
                </span>
              </div>
            </div>

            {/* Session Logs list */}
            <div className="border-t pt-4 border-zinc-100">
              <div className="flex items-center gap-1.5 mb-2.5">
                <History className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-700">{"Today's Focus Log"}</span>
              </div>

              {focusLogs.length === 0 ? (
                <div className="p-3 bg-zinc-50 border border-dashed rounded-2xl text-[10px] text-muted-foreground italic text-center">
                  No focus cycles logged yet today. Focus session will record here.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-sleek">
                  {focusLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-zinc-100 bg-zinc-50/50 text-[10px] font-medium"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          log.mode === "work" ? "bg-rose-500" : log.mode === "shortBreak" ? "bg-emerald-500" : "bg-sky-500"
                        )} />
                        <span className="font-bold text-zinc-700 truncate">{log.taskTitle}</span>
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
