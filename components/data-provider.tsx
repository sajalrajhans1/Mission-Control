"use client";

import { createContext, useContext, useEffect, useMemo, useCallback, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { parseSharingTags } from "@/lib/utils";
import type { Row, Insert } from "@/lib/database.types";

export interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
  targetSessions: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export interface FocusSessionLog {
  id: string;
  taskTitle: string;
  duration: number; // minutes
  timestamp: string;
  mode: "work" | "shortBreak" | "longBreak";
}

type DataContextValue = {
  projects: ReturnType<typeof useRealtimeTable<"projects">>;
  tasks: ReturnType<typeof useRealtimeTable<"tasks">>;
  prompts: ReturnType<typeof useRealtimeTable<"prompts">>;
  ideas: ReturnType<typeof useRealtimeTable<"ideas">>;
  resources: ReturnType<typeof useRealtimeTable<"resources">>;
  stickyNotes: ReturnType<typeof useRealtimeTable<"sticky_notes">>;
  moneyEntries: ReturnType<typeof useRealtimeTable<"money_entries">>;
  savingsGoals: ReturnType<typeof useRealtimeTable<"savings_goals">>;
  dailyLogs: ReturnType<typeof useRealtimeTable<"daily_logs">>;
  wins: ReturnType<typeof useRealtimeTable<"wins">>;
  settings: ReturnType<typeof useRealtimeTable<"settings">>;
  vaults: ReturnType<typeof useRealtimeTable<"vaults">>;
  vaultItems: ReturnType<typeof useRealtimeTable<"vault_items">>;
  projectFiles: ReturnType<typeof useRealtimeTable<"project_files">>;
  projectMilestones: ReturnType<typeof useRealtimeTable<"project_milestones">>;
  notifications: ReturnType<typeof useRealtimeTable<"notifications">>;
  timetableBlocks: ReturnType<typeof useRealtimeTable<"timetable_blocks">>;
  workDeliverables: ReturnType<typeof useRealtimeTable<"work_deliverables">>;
  taskCardPositions: ReturnType<typeof useRealtimeTable<"task_card_positions">>;
  taskCardConnections: ReturnType<typeof useRealtimeTable<"task_card_connections">>;
  activeUser: "user1" | "user2" | "user3" | null;
  activeUserName: string;
  activePartner: "user2" | "user3";
  setActivePartner: (partner: "user2" | "user3") => void;
  onlineUsers: string[];
  login: (user: "user1" | "user2" | "user3", password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setPassword: (user: "user1" | "user2" | "user3", newPassword?: string) => Promise<void>;
  isPasswordSet: (user: "user1" | "user2" | "user3") => boolean;
  sendNotification: (forUser: "user1" | "user2" | "user3", title: string, body: string) => Promise<void>;
  
  // Pomodoro Timer context fields
  pomoMode: "work" | "shortBreak" | "longBreak";
  setPomoMode: Dispatch<SetStateAction<"work" | "shortBreak" | "longBreak">>;
  pomoIsPlaying: boolean;
  setPomoIsPlaying: Dispatch<SetStateAction<boolean>>;
  pomoTimeLeft: number;
  setPomoTimeLeft: Dispatch<SetStateAction<number>>;
  pomoSettings: TimerSettings;
  setPomoSettings: (settings: TimerSettings) => void;
  pomoFocusType: "task" | "block";
  setPomoFocusType: Dispatch<SetStateAction<"task" | "block">>;
  pomoTaskId: string;
  setPomoTaskId: Dispatch<SetStateAction<string>>;
  pomoBlockId: string;
  setPomoBlockId: Dispatch<SetStateAction<string>>;
  pomoCompletedCount: number;
  setPomoCompletedCount: (count: number) => void;
  pomoLogs: FocusSessionLog[];
  setPomoLogs: (logs: FocusSessionLog[]) => void;
  pomoAmbientSoundType: "none" | "white" | "pink" | "brown" | "rain";
  setPomoAmbientSoundType: Dispatch<SetStateAction<"none" | "white" | "pink" | "brown" | "rain">>;
  pomoAmbientVolume: number;
  setPomoAmbientVolume: Dispatch<SetStateAction<number>>;
  pomoIsMuted: boolean;
  setPomoIsMuted: Dispatch<SetStateAction<boolean>>;
  pomoAlarmSound: "zen" | "digital" | "chime";
  setPomoAlarmSound: Dispatch<SetStateAction<"zen" | "digital" | "chime">>;
  pomoIsTicking: boolean;
  setPomoIsTicking: Dispatch<SetStateAction<boolean>>;
  pomoIsZenMode: boolean;
  setPomoIsZenMode: Dispatch<SetStateAction<boolean>>;
  playAlarmSound: () => void;
  startAmbientSound: (type: "white" | "pink" | "brown" | "rain") => void;
  stopAmbientSound: () => void;
  getAudioContext: () => AudioContext;
  isScreensaverActive: boolean;
  setIsScreensaverActive: Dispatch<SetStateAction<boolean>>;
};

const DataContext = createContext<DataContextValue | null>(null);

// Default vaults seeded when none exist in Supabase
const DEFAULT_VAULTS: Insert<"vaults">[] = [
  { name: "Prompts",      icon: "WandSparkles", order_index: 0, is_default: true },
  { name: "Ideas",        icon: "Lightbulb",    order_index: 1, is_default: true },
  { name: "Resources",    icon: "Link",          order_index: 2, is_default: true },
  { name: "Sticky Notes", icon: "StickyNote",   order_index: 3, is_default: true },
  { name: "Work Deliverables", icon: "Briefcase", order_index: 4, is_default: true }
];

const DEFAULT_SETTINGS: Insert<"settings">[] = [
  { key: "user1_name", value: "Phoenix" },
  { key: "user2_name", value: "Friend" },
  { key: "user3_name", value: "Mr. Bill" },
  { key: "user3_password", value: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5" },
  { key: "user3_color", value: "#10b981" }
];

// Helper to hash password on client
async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getUserNamesFromRows(rows: Row<"settings">[]) {
  const find = (key: string, fallback: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return fallback;
    const v = row.value;
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "value" in v) return String((v as { value: unknown }).value);
    return fallback;
  };
  return {
    user1: find("user1_name", "Phoenix"),
    user2: find("user2_name", "Friend"),
    user3: find("user3_name", "Mr. Bill")
  };
}

function triggerBrowserNotification(title: string, body?: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
    });
  }
}

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
      output[i] *= 3.5;
    }
  } else {
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

export function DataProvider({ children }: { children: ReactNode }) {
  const projects = useRealtimeTable("projects", { column: "name", ascending: true });
  const tasks = useRealtimeTable("tasks", { column: "created_at", ascending: false });
  const prompts = useRealtimeTable("prompts", { column: "updated_at", ascending: false });
  const ideas = useRealtimeTable("ideas", { column: "created_at", ascending: false });
  const resources = useRealtimeTable("resources", { column: "title", ascending: true });
  const stickyNotes = useRealtimeTable("sticky_notes", { column: "updated_at", ascending: false });
  const moneyEntries = useRealtimeTable("money_entries", { column: "entry_date", ascending: false });
  const savingsGoals = useRealtimeTable("savings_goals", { column: "created_at", ascending: false });
  const dailyLogs = useRealtimeTable("daily_logs", { column: "log_date", ascending: false });
  const wins = useRealtimeTable("wins", { column: "created_at", ascending: false });
  const settings = useRealtimeTable("settings", { column: "key", ascending: true });
  const vaults = useRealtimeTable("vaults", { column: "order_index", ascending: true });
  const vaultItems = useRealtimeTable("vault_items", { column: "created_at", ascending: false });
  const projectFiles = useRealtimeTable("project_files", { column: "created_at", ascending: false });
  const projectMilestones = useRealtimeTable("project_milestones", { column: "due_date", ascending: true });
  const notifications = useRealtimeTable("notifications", { column: "created_at", ascending: false });
  const timetableBlocks = useRealtimeTable("timetable_blocks", { column: "start_time", ascending: true });
  const workDeliverables = useRealtimeTable("work_deliverables", { column: "delivery_date", ascending: false });
  const taskCardPositions = useRealtimeTable("task_card_positions", { column: "card_id", ascending: true });
  const taskCardConnections = useRealtimeTable("task_card_connections", { column: "created_at", ascending: true });

  const [activeUser, setActiveUser] = useState<"user1" | "user2" | "user3" | null>(null);
  const [activePartner, setActivePartnerState] = useState<"user2" | "user3">("user2");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isScreensaverActive, setIsScreensaverActive] = useState<boolean>(false);

  const setActivePartner = useCallback((partner: "user2" | "user3") => {
    setActivePartnerState(partner);
    sessionStorage.setItem("mc_partner", partner);
  }, []);

  // Sync active partner from sessionStorage if exists
  useEffect(() => {
    const savedPartner = sessionStorage.getItem("mc_partner");
    if (savedPartner === "user2" || savedPartner === "user3") {
      setActivePartnerState(savedPartner);
    }
  }, []);

  // Ensure activePartner is correct when switching activeUser
  useEffect(() => {
    if (activeUser === "user3") {
      setActivePartnerState("user3");
    } else if (activeUser === "user2") {
      setActivePartnerState("user2");
    }
  }, [activeUser]);

  // ─── Pomodoro Global States ───────────────────────────────────────────────────
  const [pomoMode, setPomoMode] = useState<"work" | "shortBreak" | "longBreak">("work");
  const [pomoIsPlaying, setPomoIsPlaying] = useState<boolean>(false);
  const [pomoTimeLeft, setPomoTimeLeft] = useState<number>(25 * 60);
  const [pomoCompletedCount, setPomoCompletedCount] = useState<number>(0);
  const [pomoLogs, setPomoLogs] = useState<FocusSessionLog[]>([]);
  const [pomoFocusType, setPomoFocusType] = useState<"task" | "block">("task");
  const [pomoTaskId, setPomoTaskId] = useState<string>("");
  const [pomoBlockId, setPomoBlockId] = useState<string>("");
  
  const [pomoSettings, setPomoSettings] = useState<TimerSettings>({
    work: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    targetSessions: 4,
    autoStartBreaks: true,
    autoStartWork: false
  });

  const [pomoAmbientSoundType, setPomoAmbientSoundType] = useState<"none" | "white" | "pink" | "brown" | "rain">("none");
  const [pomoAmbientVolume, setPomoAmbientVolume] = useState<number>(0.3);
  const [pomoIsMuted, setPomoIsMuted] = useState<boolean>(false);
  const [pomoAlarmSound, setPomoAlarmSound] = useState<"zen" | "digital" | "chime">("zen");
  const [pomoIsTicking, setPomoIsTicking] = useState<boolean>(false);
  const [pomoIsZenMode, setPomoIsZenMode] = useState<boolean>(false);

  const names = useMemo(() => getUserNamesFromRows(settings.rows), [settings.rows]);
  const activeUserName = activeUser === "user1" ? names.user1 : activeUser === "user2" ? names.user2 : activeUser === "user3" ? names.user3 : "";

  // Web Audio Context & Synthesizer Nodes Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const ambientGainNodeRef = useRef<GainNode | null>(null);
  const tickerOscillatorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const expectedEndTimeRef = useRef<number | null>(null);

  // Derivations for active targets
  const activeFocusTask = useMemo(() => {
    return tasks.rows.find((t) => t.id === pomoTaskId);
  }, [tasks.rows, pomoTaskId]);

  const activeFocusBlock = useMemo(() => {
    return timetableBlocks?.rows.find((b) => b.id === pomoBlockId);
  }, [timetableBlocks?.rows, pomoBlockId]);

  const pomoIsPlayingRef = useRef(pomoIsPlaying);
  useEffect(() => {
    pomoIsPlayingRef.current = pomoIsPlaying;
  }, [pomoIsPlaying]);

  // Load stats, logs and settings from localStorage when activeUser changes
  useEffect(() => {
    if (!activeUser) return;

    const savedSettings = localStorage.getItem(`pomo_settings_${activeUser}`);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setPomoSettings(parsed);
        if (!pomoIsPlayingRef.current) {
          setPomoTimeLeft(parsed.work * 60);
        }
      } catch (e) {
        console.error("Failed to parse pomo_settings", e);
      }
    } else {
      const defaults = {
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        longBreakInterval: 4,
        targetSessions: 4,
        autoStartBreaks: true,
        autoStartWork: false
      };
      setPomoSettings(defaults);
      if (!pomoIsPlayingRef.current) {
        setPomoTimeLeft(defaults.work * 60);
      }
    }

    const savedLogs = localStorage.getItem(`pomo_logs_${activeUser}`);
    if (savedLogs) {
      try {
        setPomoLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Failed to parse pomo_logs", e);
      }
    } else {
      setPomoLogs([]);
    }

    const savedCount = localStorage.getItem(`pomo_completed_count_${activeUser}`);
    if (savedCount) {
      setPomoCompletedCount(Number(savedCount));
    } else {
      setPomoCompletedCount(0);
    }
  }, [activeUser]);

  // Save setters
  const savePomoSettings = useCallback((newSettings: TimerSettings) => {
    setPomoSettings(newSettings);
    if (activeUser) {
      localStorage.setItem(`pomo_settings_${activeUser}`, JSON.stringify(newSettings));
    }
  }, [activeUser]);

  const savePomoLogs = useCallback((newLogs: FocusSessionLog[]) => {
    setPomoLogs(newLogs);
    if (activeUser) {
      localStorage.setItem(`pomo_logs_${activeUser}`, JSON.stringify(newLogs));
    }
  }, [activeUser]);

  const savePomoCompletedCount = useCallback((newCount: number) => {
    setPomoCompletedCount(newCount);
    if (activeUser) {
      localStorage.setItem(`pomo_completed_count_${activeUser}`, String(newCount));
    }
  }, [activeUser]);

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
    if (pomoIsMuted) return;

    try {
      const ctx = getAudioContext();
      const buffer = createNoiseBuffer(type === "rain" ? "brown" : type, ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      const scale = type === "white" ? 0.4 : type === "pink" ? 0.6 : 1.0;
      gainNode.gain.setValueAtTime(pomoAmbientVolume * scale, ctx.currentTime);

      if (type === "rain") {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        
        source.connect(filter);
        filter.connect(gainNode);
      } else {
        source.connect(gainNode);
      }

      gainNode.connect(ctx.destination);
      source.start(0);

      ambientSourceNodeRef.current = source;
      ambientGainNodeRef.current = gainNode;
    } catch (e) {
      console.error("Failed to start ambient sound", e);
    }
  }, [pomoIsMuted, pomoAmbientVolume, stopAmbientSound, getAudioContext]);

  // Synthesize Completion Alarm Bells
  const playAlarmSound = useCallback(() => {
    if (pomoIsMuted) return;
    try {
      const ctx = getAudioContext();
      const nowTime = ctx.currentTime;

      if (pomoAlarmSound === "zen") {
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
      } else if (pomoAlarmSound === "digital") {
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
        const freqs = [523.25, 659.25, 783.99, 1046.5];
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
  }, [pomoIsMuted, pomoAlarmSound, getAudioContext]);

  // Session completed logic
  const handleSessionCompleted = useCallback(() => {
    const duration = pomoMode === "work" ? pomoSettings.work : pomoMode === "shortBreak" ? pomoSettings.shortBreak : pomoSettings.longBreak;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    let logTitle = "General Focus Session";
    if (pomoMode === "work") {
      if (pomoFocusType === "task" && activeFocusTask) {
        logTitle = activeFocusTask.title;
      } else if (pomoFocusType === "block" && activeFocusBlock) {
        logTitle = `Block: ${activeFocusBlock.title}`;
      }
    }

    const newLog: FocusSessionLog = {
      id: Math.random().toString(36).substring(2, 9),
      taskTitle: pomoMode === "work" ? logTitle : pomoMode === "shortBreak" ? "Short Break" : "Long Break",
      duration,
      timestamp,
      mode: pomoMode
    };

    const nextLogs = [newLog, ...pomoLogs].slice(0, 50);
    savePomoLogs(nextLogs);

    if (pomoMode === "work") {
      const nextCount = pomoCompletedCount + 1;
      savePomoCompletedCount(nextCount);

      setTimeout(() => {
        const triggersLongBreak = nextCount % pomoSettings.longBreakInterval === 0;
        const nextMode = triggersLongBreak ? "longBreak" : "shortBreak";
        setPomoMode(nextMode);
        setPomoTimeLeft(nextMode === "shortBreak" ? pomoSettings.shortBreak * 60 : pomoSettings.longBreak * 60);
        
        if (pomoSettings.autoStartBreaks) {
          setPomoIsPlaying(true);
        }
      }, 1200);
    } else {
      setTimeout(() => {
        setPomoMode("work");
        setPomoTimeLeft(pomoSettings.work * 60);

        if (pomoSettings.autoStartWork) {
          setPomoIsPlaying(true);
        }
      }, 1200);
    }
  }, [pomoMode, pomoSettings, activeFocusTask, activeFocusBlock, pomoFocusType, pomoCompletedCount, pomoLogs, savePomoLogs, savePomoCompletedCount]);

  // Metronome metronome ticking oscillator sound effect loop
  useEffect(() => {
    if (pomoIsPlaying && pomoIsTicking && !pomoIsMuted) {
      tickerOscillatorIntervalRef.current = setInterval(() => {
        try {
          const ctx = getAudioContext();
          const nowTime = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = "sine";
          osc.frequency.setValueAtTime(450, nowTime);
          
          gainNode.gain.setValueAtTime(0, nowTime);
          gainNode.gain.linearRampToValueAtTime(0.02, nowTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.00001, nowTime + 0.08);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(nowTime);
          osc.stop(nowTime + 0.1);
        } catch {}
      }, 1000);
    } else {
      if (tickerOscillatorIntervalRef.current) clearInterval(tickerOscillatorIntervalRef.current);
    }

    return () => {
      if (tickerOscillatorIntervalRef.current) clearInterval(tickerOscillatorIntervalRef.current);
    };
  }, [pomoIsPlaying, pomoIsTicking, pomoIsMuted, getAudioContext]);

  // Ambient soundscape loop trigger
  useEffect(() => {
    if (pomoAmbientSoundType === "none" || pomoIsMuted) {
      stopAmbientSound();
    } else {
      startAmbientSound(pomoAmbientSoundType);
    }
    return () => {
      stopAmbientSound();
    };
  }, [pomoAmbientSoundType, pomoIsMuted, pomoAmbientVolume, startAmbientSound, stopAmbientSound]);

  // Initialize Web Worker for background Pomodoro ticking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const workerCode = `
      let timerId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timerId) clearInterval(timerId);
          timerId = setInterval(() => {
            self.postMessage('tick');
          }, 1000);
        } else if (e.data === 'stop') {
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;

    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  }, []);

  // Synchronize playing state with the Web Worker and track end timestamp
  useEffect(() => {
    if (pomoIsPlaying) {
      if (expectedEndTimeRef.current === null) {
        expectedEndTimeRef.current = Date.now() + pomoTimeLeft * 1000;
      }
      if (workerRef.current) {
        workerRef.current.postMessage("start");
      }
    } else {
      expectedEndTimeRef.current = null;
      if (workerRef.current) {
        workerRef.current.postMessage("stop");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomoIsPlaying]);

  // Handle worker ticking and calculate precise elapsed time
  useEffect(() => {
    if (!workerRef.current) return;

    workerRef.current.onmessage = (e) => {
      if (e.data === "tick") {
        if (pomoIsPlaying && expectedEndTimeRef.current !== null) {
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((expectedEndTimeRef.current - now) / 1000));
          setPomoTimeLeft(remaining);

          if (remaining <= 0) {
            expectedEndTimeRef.current = null;
            if (workerRef.current) {
              workerRef.current.postMessage("stop");
            }
            setPomoIsPlaying(false);
            playAlarmSound();
            handleSessionCompleted();
          }
        }
      }
    };
  }, [pomoIsPlaying, playAlarmSound, handleSessionCompleted]);

  // Handle tab refocus/visibility change to immediately synchronize elapsed time
  useEffect(() => {
    const handleSync = () => {
      if (pomoIsPlaying && expectedEndTimeRef.current !== null) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((expectedEndTimeRef.current - now) / 1000));
        setPomoTimeLeft(remaining);

        if (remaining <= 0) {
          expectedEndTimeRef.current = null;
          if (workerRef.current) {
            workerRef.current.postMessage("stop");
          }
          setPomoIsPlaying(false);
          playAlarmSound();
          handleSessionCompleted();
        }
      }
    };

    window.addEventListener("visibilitychange", handleSync);
    window.addEventListener("focus", handleSync);

    return () => {
      window.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [pomoIsPlaying, playAlarmSound, handleSessionCompleted]);

  // Helper to filter vault-like items (prompts, ideas, resources, vault items) based on title suffixes
  const filterVaultLikeItem = useCallback((title: string) => {
    const tags = parseSharingTags(title);
    
    // Legacy items (no tags): visible to everyone
    if (!tags.author) return true;

    // If logged in as Sajal (user1)
    if (activeUser === "user1") {
      // Sajal's own items
      if (tags.author === "user1") {
        if (tags.share === "private") return true;
        if (tags.share === "both") return true;
        if (tags.share === "user2") return activePartner === "user2";
        if (tags.share === "user3") return activePartner === "user3";
      }
      // Samarth's items
      if (tags.author === "user2") {
        return tags.share === "user1" && activePartner === "user2";
      }
      // Mr. Bill's items
      if (tags.author === "user3") {
        return tags.share === "user1" && activePartner === "user3";
      }
      return false;
    }

    // If logged in as Samarth (user2)
    if (activeUser === "user2") {
      if (tags.author === "user2") return true;
      if (tags.author === "user1") {
        return tags.share === "user2" || tags.share === "both";
      }
      return false;
    }

    // If logged in as Mr. Bill (user3)
    if (activeUser === "user3") {
      if (tags.author === "user3") return true;
      if (tags.author === "user1") {
        return tags.share === "user3" || tags.share === "both";
      }
      return false;
    }

    return false;
  }, [activeUser, activePartner]);

  // Filter projects/tasks/files/milestones based on privacy setting in real time
  const filteredProjects = useMemo(() => {
    return {
      ...projects,
      rows: projects.rows.filter((p) => {
        const creator = p.created_by || "";
        const isPrivate = p.is_private;

        if (activeUser === "user1") {
          if (creator === "user1" && isPrivate) return true;
          if (creator === "user1" && !isPrivate && !creator.includes("_")) return true;
          if (activePartner === "user2") {
            return creator === "user1_user2" || creator === "user2";
          } else {
            return creator === "user1_user3" || creator === "user3";
          }
        }

        if (activeUser === "user2") {
          if (creator === "user2") return true;
          if (creator === "user1_user2") return true;
          if (creator === "user1" && !isPrivate) return true;
          return false;
        }

        if (activeUser === "user3") {
          if (creator === "user3") return true;
          if (creator === "user1_user3") return true;
          if (creator === "user1" && !isPrivate) return true;
          return false;
        }

        return false;
      })
    };
  }, [projects, activeUser, activePartner]);

  const filteredTasks = useMemo(() => {
    return {
      ...tasks,
      rows: tasks.rows.filter((t) => {
        // 1. Task-level privacy: If private, only visible to creator
        if (t.is_private) {
          const isCreator = (t.created_by || "").trim().toLowerCase() === (activeUserName || "").trim().toLowerCase();
          if (!isCreator) return false;
        }

        // 2. Project-level privacy
        if (t.project_id) {
          const p = filteredProjects.rows.find((proj) => proj.id === t.project_id);
          if (!p) return false;
        }

        // 3. Collaborative/Direct task filtering
        const assigneeClean = (t.assigned_to || "").trim().toLowerCase();
        const cleanU2 = (names.user2 || "").trim().toLowerCase();
        const cleanU3 = (names.user3 || "").trim().toLowerCase();
        const creatorClean = (t.created_by || "").trim().toLowerCase();

        const currentPartner = activeUser === "user1" ? activePartner : (activeUser === "user2" ? "user2" : "user3");

        if (currentPartner === "user2") {
          const isMrBillTask = creatorClean === cleanU3 || assigneeClean === cleanU3;
          return !isMrBillTask;
        } else {
          const isSamarthTask = creatorClean === cleanU2 || assigneeClean === cleanU2;
          return !isSamarthTask;
        }
      })
    };
  }, [tasks, filteredProjects.rows, activeUser, activeUserName, activePartner, names]);

  const filteredProjectFiles = useMemo(() => {
    return {
      ...projectFiles,
      rows: projectFiles.rows.filter((f) => {
        const p = filteredProjects.rows.find((proj) => proj.id === f.project_id);
        return !!p;
      })
    };
  }, [projectFiles, filteredProjects.rows]);

  const filteredMilestones = useMemo(() => {
    return {
      ...projectMilestones,
      rows: projectMilestones.rows.filter((m) => {
        const p = filteredProjects.rows.find((proj) => proj.id === m.project_id);
        return !!p;
      })
    };
  }, [projectMilestones, filteredProjects.rows]);

  const filteredTimetableBlocks = useMemo(() => {
    return {
      ...timetableBlocks,
      rows: timetableBlocks.rows.filter((b) => b.user_key === activeUser)
    };
  }, [timetableBlocks, activeUser]);

  const filteredWorkDeliverables = useMemo(() => {
    return {
      ...workDeliverables,
      rows: workDeliverables.rows.filter((wd) => wd.user_key === activeUser)
    };
  }, [workDeliverables, activeUser]);

  const filteredPositions = useMemo(() => {
    return {
      ...taskCardPositions,
      rows: taskCardPositions.rows.filter((pos) => {
        // Position-level privacy
        if (pos.is_private && pos.created_by !== activeUser) return false;

        // Project-level visibility (if this position represents a project card)
        if (pos.card_id !== "general") {
          const p = filteredProjects.rows.find((proj) => proj.id === pos.card_id);
          if (!p) return false;
        }
        return true;
      })
    };
  }, [taskCardPositions, filteredProjects.rows, activeUser]);

  const filteredConnections = useMemo(() => {
    return {
      ...taskCardConnections,
      rows: taskCardConnections.rows.filter((conn) => {
        // Connection-level privacy
        if (conn.is_private && conn.created_by !== activeUser) return false;

        // Both source and target must be visible projects (or 'general')
        const isCardVisible = (cardId: string) => {
          if (cardId === "general") return true;
          const p = filteredProjects.rows.find((proj) => proj.id === cardId);
          return !!p;
        };
        return isCardVisible(conn.source_id) && isCardVisible(conn.target_id);
      })
    };
  }, [taskCardConnections, filteredProjects.rows, activeUser]);

  const filteredVaults = useMemo(() => {
    return {
      ...vaults,
      rows: vaults.rows.filter((v) => {
        if (v.is_default || !v.created_by) return true;
        const creator = v.created_by || "";

        if (activeUser === "user1") {
          if (creator === "user1_private") return true;
          if (creator === "user1" && !creator.includes("_")) return true;
          if (activePartner === "user2") {
            return creator === "user1_user2" || creator === "user2";
          } else {
            return creator === "user1_user3" || creator === "user3";
          }
        }

        if (activeUser === "user2") {
          if (creator === "user2_private" || creator === "user2") return true;
          if (creator === "user1_user2") return true;
          if (creator === "user1" && !creator.includes("_")) return true;
          return false;
        }

        if (activeUser === "user3") {
          if (creator === "user3_private" || creator === "user3") return true;
          if (creator === "user1_user3") return true;
          if (creator === "user1" && !creator.includes("_")) return true;
          return false;
        }

        return false;
      })
    };
  }, [vaults, activeUser, activePartner]);

  const filteredPrompts = useMemo(() => {
    return {
      ...prompts,
      rows: prompts.rows.filter((item) => filterVaultLikeItem(item.title))
    };
  }, [prompts, filterVaultLikeItem]);

  const filteredIdeas = useMemo(() => {
    return {
      ...ideas,
      rows: ideas.rows.filter((item) => filterVaultLikeItem(item.title))
    };
  }, [ideas, filterVaultLikeItem]);

  const filteredResources = useMemo(() => {
    return {
      ...resources,
      rows: resources.rows.filter((item) => filterVaultLikeItem(item.title))
    };
  }, [resources, filterVaultLikeItem]);

  const filteredVaultItems = useMemo(() => {
    const visibleVaultIds = new Set(filteredVaults.rows.map((v) => v.id));
    return {
      ...vaultItems,
      rows: vaultItems.rows.filter((item) => visibleVaultIds.has(item.vault_id) && filterVaultLikeItem(item.title))
    };
  }, [vaultItems, filteredVaults.rows, filterVaultLikeItem]);

  const filteredMoneyEntries = useMemo(() => {
    return {
      ...moneyEntries,
      rows: moneyEntries.rows.filter((e) => {
        if (activeUser === "user1") {
          return e.added_by === "user1" || e.request_to === activePartner || e.added_by === activePartner;
        }
        if (activeUser === "user2") {
          return e.added_by === "user2" || e.request_to === "user2";
        }
        if (activeUser === "user3") {
          return e.added_by === "user3" || e.request_to === "user3";
        }
        return false;
      })
    };
  }, [moneyEntries, activeUser, activePartner]);

  const filteredSavingsGoals = useMemo(() => {
    return {
      ...savingsGoals,
      rows: savingsGoals.rows.filter((g) => {
        if (activeUser === "user1") {
          return g.created_by === "user1" || g.created_by === activePartner;
        }
        if (activeUser === "user2") {
          return g.created_by === "user1" || g.created_by === "user2";
        }
        if (activeUser === "user3") {
          return g.created_by === "user1" || g.created_by === "user3";
        }
        return false;
      })
    };
  }, [savingsGoals, activeUser, activePartner]);

  const filteredStickyNotes = useMemo(() => {
    return {
      ...stickyNotes,
      rows: stickyNotes.rows.filter((item) => {
        if (item.is_private) {
          return (item.author || "").trim().toLowerCase() === (activeUserName || "").trim().toLowerCase();
        }

        const authorClean = (item.author || "").trim().toLowerCase();
        const cleanU1 = (names.user1 || "").trim().toLowerCase();
        const cleanU2 = (names.user2 || "").trim().toLowerCase();
        const cleanU3 = (names.user3 || "").trim().toLowerCase();

        const currentPartner = activeUser === "user1" ? activePartner : (activeUser === "user2" ? "user2" : "user3");

        if (authorClean === cleanU1) {
          const bodyText = item.body || "";
          if (bodyText.includes("[share:user2]")) {
            return currentPartner === "user2";
          }
          if (bodyText.includes("[share:user3]")) {
            return currentPartner === "user3";
          }
          return true; // Default to showing to both workspaces
        }

        if (currentPartner === "user2") {
          return authorClean === cleanU2;
        } else {
          return authorClean === cleanU3;
        }
      })
    };
  }, [stickyNotes, activeUser, activeUserName, activePartner, names]);

  useEffect(() => {
    const saved = sessionStorage.getItem("mc_session");
    if (saved === "user1" || saved === "user2" || saved === "user3") {
      setActiveUser(saved);
    }
  }, []);

  // Web Notification permission request
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Global realtime database change listener for browser notifications
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeUserName) return;

    interface DbRow {
      id?: string;
      title?: string;
      assigned_to?: string;
      created_by?: string;
      amount?: number;
      is_request?: boolean;
      description?: string;
      added_by?: string;
      author?: string;
      uploaded_by?: string;
      name?: string;
      completed?: boolean;
      completed_user1?: boolean;
      completed_user2?: boolean;
      approved?: boolean;
      request_status?: string;
      phoenix?: string;
      friend?: string;
      key?: string;
      value?: unknown;
      created_at?: string;
      for_user?: string;
      body?: string;
    }

    const channel = supabase
      .channel("global-db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const { table, eventType, new: newRow, old: oldRow } = payload as {
          table: string;
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: DbRow;
          old: DbRow;
        };

        if (eventType === "INSERT") {
          if (table === "notifications") {
            if (newRow.for_user === activeUser) {
              triggerBrowserNotification(newRow.title || "New Notification", newRow.body);
            }
          }
        } else if (eventType === "UPDATE") {
          if (table === "settings" && oldRow) {
            if (newRow.key && newRow.key.startsWith("project_chat_")) {
              const newMsgs = Array.isArray(newRow.value) ? newRow.value : [];
              const oldMsgs = Array.isArray(oldRow.value) ? oldRow.value : [];
              if (newMsgs.length > oldMsgs.length) {
                const latestMsg = newMsgs[newMsgs.length - 1];
                const senderClean = (latestMsg?.sender || "").trim().toLowerCase();
                const activeClean = (activeUserName || "").trim().toLowerCase();
                const cleanU1 = (names.user1 || "").trim().toLowerCase();
                const cleanU2 = (names.user2 || "").trim().toLowerCase();
                
                const isSentByMe = senderClean === activeClean || 
                  (activeUser === "user1" && senderClean === cleanU1) ||
                  (activeUser === "user2" && senderClean === cleanU2);

                if (latestMsg && !isSentByMe) {
                  triggerBrowserNotification(
                    `New Chat Message from ${latestMsg.sender}`,
                    latestMsg.message
                  );
                }
              }
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUser, activeUserName, names, settings.rows]);

  // Online Presence Status Listener
  useEffect(() => {
    if (!activeUserName || !isSupabaseConfigured || !supabase) return;

    const channel = supabase.channel("online-status", {
      config: {
        presence: {
          key: activeUserName,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [activeUserName]);

  // Auto-seed vaults + settings into Supabase when they're empty
  const seeded = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (seeded.current) return;
    if (vaults.loading || settings.loading) return;

    seeded.current = true;

    if (vaults.rows.length === 0) {
      for (const v of DEFAULT_VAULTS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from("vaults").insert(v as any).then(() => {});
      }
    }

    const existingKeys = settings.rows.map((r) => r.key);
    for (const s of DEFAULT_SETTINGS) {
      if (!existingKeys.includes(s.key)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from("settings").insert(s as any).then(() => {});
      }
    }
  }, [vaults.loading, vaults.rows.length, settings.loading, settings.rows]);

  const login = useCallback(
    async (user: "user1" | "user2" | "user3", password?: string) => {
      const key = `${user}_password`;
      const row = settings.rows.find((r) => r.key === key);
      const storedHash = row ? (typeof row.value === "string" ? row.value : null) : null;

      if (!storedHash) {
        if (!password || !password.trim()) {
          return { success: false, error: "Password is required to set up your profile." };
        }
        const hash = await sha256(password.trim());
        if (row) {
          await settings.update(row.id, { value: hash });
        } else {
          await settings.create({ key, value: hash });
        }
        sessionStorage.setItem("mc_session", user);
        setActiveUser(user);
        return { success: true };
      }
 
      if (!password || !password.trim()) {
        return { success: false, error: "Password is required." };
      }
      const inputHash = await sha256(password.trim());
      if (inputHash === storedHash) {
        sessionStorage.setItem("mc_session", user);
        setActiveUser(user);
        return { success: true };
      }
      return { success: false, error: "Incorrect password." };
    },
    [settings]
  );
 
  const logout = useCallback(() => {
    sessionStorage.removeItem("mc_session");
    setActiveUser(null);
  }, []);

  const setPassword = useCallback(
    async (user: "user1" | "user2" | "user3", newPassword?: string) => {
      const key = `${user}_password`;
      const row = settings.rows.find((r) => r.key === key);
      const hash = newPassword ? await sha256(newPassword.trim()) : null;
      if (row) {
        await settings.update(row.id, { value: hash });
      } else {
        await settings.create({ key, value: hash });
      }
    },
    [settings]
  );

  const isPasswordSet = useCallback(
    (user: "user1" | "user2" | "user3") => {
      const key = `${user}_password`;
      const row = settings.rows.find((r) => r.key === key);
      return Boolean(row && row.value);
    },
    [settings]
  );

  const sendNotification = useCallback(
    async (forUser: "user1" | "user2" | "user3", title: string, body: string) => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("notifications").insert({
          for_user: forUser,
          title,
          body,
          read: false
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      projects: filteredProjects,
      tasks: filteredTasks,
      prompts: filteredPrompts,
      ideas: filteredIdeas,
      resources: filteredResources,
      stickyNotes: filteredStickyNotes,
      moneyEntries: filteredMoneyEntries,
      savingsGoals: filteredSavingsGoals,
      dailyLogs,
      wins,
      settings,
      vaults: filteredVaults,
      vaultItems: filteredVaultItems,
      projectFiles: filteredProjectFiles,
      projectMilestones: filteredMilestones,
      notifications,
      timetableBlocks: filteredTimetableBlocks,
      workDeliverables: filteredWorkDeliverables,
      taskCardPositions: filteredPositions,
      taskCardConnections: filteredConnections,
      activeUser,
      activeUserName,
      activePartner,
      setActivePartner,
      onlineUsers,
      login,
      logout,
      setPassword,
      isPasswordSet,
      sendNotification,
      
      // Pomodoro exports
      pomoMode,
      setPomoMode,
      pomoIsPlaying,
      setPomoIsPlaying,
      pomoTimeLeft,
      setPomoTimeLeft,
      pomoSettings,
      setPomoSettings: savePomoSettings,
      pomoFocusType,
      setPomoFocusType,
      pomoTaskId,
      setPomoTaskId,
      pomoBlockId,
      setPomoBlockId,
      pomoCompletedCount,
      setPomoCompletedCount: savePomoCompletedCount,
      pomoLogs,
      setPomoLogs: savePomoLogs,
      pomoAmbientSoundType,
      setPomoAmbientSoundType,
      pomoAmbientVolume,
      setPomoAmbientVolume,
      pomoIsMuted,
      setPomoIsMuted,
      pomoAlarmSound,
      setPomoAlarmSound,
      pomoIsTicking,
      setPomoIsTicking,
      pomoIsZenMode,
      setPomoIsZenMode,
      playAlarmSound,
      startAmbientSound,
      stopAmbientSound,
      getAudioContext,
      isScreensaverActive,
      setIsScreensaverActive
    }),
    [
      filteredProjects,
      filteredTasks,
      filteredPrompts,
      filteredIdeas,
      filteredResources,
      filteredStickyNotes,
      filteredMoneyEntries,
      filteredSavingsGoals,
      dailyLogs,
      wins,
      settings,
      filteredVaults,
      filteredVaultItems,
      filteredProjectFiles,
      filteredMilestones,
      notifications,
      filteredTimetableBlocks,
      filteredWorkDeliverables,
      filteredPositions,
      filteredConnections,
      activeUser,
      activeUserName,
      activePartner,
      setActivePartner,
      onlineUsers,
      login,
      logout,
      setPassword,
      isPasswordSet,
      sendNotification,
      
      pomoMode,
      pomoIsPlaying,
      pomoTimeLeft,
      pomoSettings,
      pomoFocusType,
      pomoTaskId,
      pomoBlockId,
      pomoCompletedCount,
      pomoLogs,
      pomoAmbientSoundType,
      pomoAmbientVolume,
      pomoIsMuted,
      pomoAlarmSound,
      pomoIsTicking,
      pomoIsZenMode,
      playAlarmSound,
      startAmbientSound,
      stopAmbientSound,
      getAudioContext,
      savePomoSettings,
      savePomoLogs,
      savePomoCompletedCount,
      isScreensaverActive
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider.");
  return context;
}

export function useUserNames() {
  const { settings } = useData();
  return useMemo(() => getUserNamesFromRows(settings.rows), [settings.rows]);
}

export function useActiveUser() {
  const { activeUser, activeUserName, login, logout, setPassword, isPasswordSet } = useData();
  return { activeUser, activeUserName, login, logout, setPassword, isPasswordSet };
}

export function useUserColors() {
  const { settings } = useData();
  return useMemo(() => {
    const find = (key: string, fallback: string) => {
      const row = settings.rows.find((r) => r.key === key);
      if (!row) return fallback;
      const v = row.value;
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && "value" in v) return String((v as { value: unknown }).value);
      return fallback;
    };
    return {
      user1: find("user1_color", "#6366f1"), // Indigo default
      user2: find("user2_color", "#f97316"), // Orange default
      user3: find("user3_color", "#10b981")  // Emerald default
    };
  }, [settings.rows]);
}

