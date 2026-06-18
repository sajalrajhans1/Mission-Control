"use client";

import { createContext, useContext, useEffect, useMemo, useCallback, useRef, useState, type ReactNode } from "react";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/utils";
import type { Row, Insert } from "@/lib/database.types";

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
  activeUser: "user1" | "user2" | null;
  activeUserName: string;
  onlineUsers: string[];
  login: (user: "user1" | "user2", password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setPassword: (user: "user1" | "user2", newPassword?: string) => Promise<void>;
  isPasswordSet: (user: "user1" | "user2") => boolean;
  sendNotification: (forUser: "user1" | "user2", title: string, body: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

// Default vaults seeded when none exist in Supabase
const DEFAULT_VAULTS: Insert<"vaults">[] = [
  { name: "Prompts",      icon: "WandSparkles", order_index: 0, is_default: true },
  { name: "Ideas",        icon: "Lightbulb",    order_index: 1, is_default: true },
  { name: "Resources",    icon: "Link",          order_index: 2, is_default: true },
  { name: "Sticky Notes", icon: "StickyNote",   order_index: 3, is_default: true }
];

const DEFAULT_SETTINGS: Insert<"settings">[] = [
  { key: "user1_name", value: "Phoenix" },
  { key: "user2_name", value: "Friend" }
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
    user2: find("user2_name", "Friend")
  };
}

function triggerBrowserNotification(title: string, body?: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
    });
  }
}

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

  const [activeUser, setActiveUser] = useState<"user1" | "user2" | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Filter projects/tasks/files/milestones based on privacy setting in real time
  const filteredProjects = useMemo(() => {
    return {
      ...projects,
      rows: projects.rows.filter((p) => !p.is_private || p.created_by === activeUser)
    };
  }, [projects, activeUser]);

  const filteredTasks = useMemo(() => {
    return {
      ...tasks,
      rows: tasks.rows.filter((t) => {
        if (!t.project_id) return true;
        const p = projects.rows.find((proj) => proj.id === t.project_id);
        if (!p) return false;
        return !p.is_private || p.created_by === activeUser;
      })
    };
  }, [tasks, projects.rows, activeUser]);

  const filteredProjectFiles = useMemo(() => {
    return {
      ...projectFiles,
      rows: projectFiles.rows.filter((f) => {
        const p = projects.rows.find((proj) => proj.id === f.project_id);
        if (!p) return false;
        return !p.is_private || p.created_by === activeUser;
      })
    };
  }, [projectFiles, projects.rows, activeUser]);

  const filteredMilestones = useMemo(() => {
    return {
      ...projectMilestones,
      rows: projectMilestones.rows.filter((m) => {
        const p = projects.rows.find((proj) => proj.id === m.project_id);
        if (!p) return false;
        return !p.is_private || p.created_by === activeUser;
      })
    };
  }, [projectMilestones, projects.rows, activeUser]);

  const filteredTimetableBlocks = useMemo(() => {
    return {
      ...timetableBlocks,
      rows: timetableBlocks.rows.filter((b) => b.user_key === activeUser)
    };
  }, [timetableBlocks, activeUser]);

  useEffect(() => {
    const saved = sessionStorage.getItem("mc_session");
    if (saved === "user1" || saved === "user2") {
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

  const names = useMemo(() => getUserNamesFromRows(settings.rows), [settings.rows]);
  const activeUserName = activeUser === "user1" ? names.user1 : activeUser === "user2" ? names.user2 : "";

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
    async (user: "user1" | "user2", password?: string) => {
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
    async (user: "user1" | "user2", newPassword?: string) => {
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
    (user: "user1" | "user2") => {
      const key = `${user}_password`;
      const row = settings.rows.find((r) => r.key === key);
      return Boolean(row && row.value);
    },
    [settings]
  );

  const sendNotification = useCallback(
    async (forUser: "user1" | "user2", title: string, body: string) => {
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
      prompts,
      ideas,
      resources,
      stickyNotes,
      moneyEntries,
      savingsGoals,
      dailyLogs,
      wins,
      settings,
      vaults,
      vaultItems,
      projectFiles: filteredProjectFiles,
      projectMilestones: filteredMilestones,
      notifications,
      timetableBlocks: filteredTimetableBlocks,
      activeUser,
      activeUserName,
      onlineUsers,
      login,
      logout,
      setPassword,
      isPasswordSet,
      sendNotification
    }),
    [
      filteredProjects,
      filteredTasks,
      prompts,
      ideas,
      resources,
      stickyNotes,
      moneyEntries,
      savingsGoals,
      dailyLogs,
      wins,
      settings,
      vaults,
      vaultItems,
      filteredProjectFiles,
      filteredMilestones,
      notifications,
      filteredTimetableBlocks,
      activeUser,
      activeUserName,
      onlineUsers,
      login,
      logout,
      setPassword,
      isPasswordSet,
      sendNotification
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
      user2: find("user2_color", "#f97316")  // Orange default
    };
  }, [settings.rows]);
}

