"use client";

import { createContext, useContext, useEffect, useMemo, useCallback, useRef, useState, type ReactNode } from "react";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Row, Insert } from "@/lib/database.types";

type DataContextValue = {
  projects: ReturnType<typeof useRealtimeTable<"projects">>;
  tasks: ReturnType<typeof useRealtimeTable<"tasks">>;
  prompts: ReturnType<typeof useRealtimeTable<"prompts">>;
  ideas: ReturnType<typeof useRealtimeTable<"ideas">>;
  resources: ReturnType<typeof useRealtimeTable<"resources">>;
  stickyNotes: ReturnType<typeof useRealtimeTable<"sticky_notes">>;
  moneyEntries: ReturnType<typeof useRealtimeTable<"money_entries">>;
  dailyLogs: ReturnType<typeof useRealtimeTable<"daily_logs">>;
  wins: ReturnType<typeof useRealtimeTable<"wins">>;
  settings: ReturnType<typeof useRealtimeTable<"settings">>;
  vaults: ReturnType<typeof useRealtimeTable<"vaults">>;
  vaultItems: ReturnType<typeof useRealtimeTable<"vault_items">>;
  projectFiles: ReturnType<typeof useRealtimeTable<"project_files">>;
  activeUser: "user1" | "user2" | null;
  activeUserName: string;
  login: (user: "user1" | "user2", password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setPassword: (user: "user1" | "user2", newPassword?: string) => Promise<void>;
  isPasswordSet: (user: "user1" | "user2") => boolean;
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

export function DataProvider({ children }: { children: ReactNode }) {
  const projects = useRealtimeTable("projects", { column: "name", ascending: true });
  const tasks = useRealtimeTable("tasks", { column: "created_at", ascending: false });
  const prompts = useRealtimeTable("prompts", { column: "updated_at", ascending: false });
  const ideas = useRealtimeTable("ideas", { column: "created_at", ascending: false });
  const resources = useRealtimeTable("resources", { column: "title", ascending: true });
  const stickyNotes = useRealtimeTable("sticky_notes", { column: "updated_at", ascending: false });
  const moneyEntries = useRealtimeTable("money_entries", { column: "entry_date", ascending: false });
  const dailyLogs = useRealtimeTable("daily_logs", { column: "log_date", ascending: false });
  const wins = useRealtimeTable("wins", { column: "created_at", ascending: false });
  const settings = useRealtimeTable("settings", { column: "key", ascending: true });
  const vaults = useRealtimeTable("vaults", { column: "order_index", ascending: true });
  const vaultItems = useRealtimeTable("vault_items", { column: "created_at", ascending: false });
  const projectFiles = useRealtimeTable("project_files", { column: "created_at", ascending: false });

  const [activeUser, setActiveUser] = useState<"user1" | "user2" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("mc_session");
    if (saved === "user1" || saved === "user2") {
      setActiveUser(saved);
    }
  }, []);

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

  const names = useMemo(() => getUserNamesFromRows(settings.rows), [settings.rows]);
  const activeUserName = activeUser === "user1" ? names.user1 : activeUser === "user2" ? names.user2 : "";

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
        localStorage.setItem("mc_session", user);
        setActiveUser(user);
        return { success: true };
      }

      if (!password || !password.trim()) {
        return { success: false, error: "Password is required." };
      }
      const inputHash = await sha256(password.trim());
      if (inputHash === storedHash) {
        localStorage.setItem("mc_session", user);
        setActiveUser(user);
        return { success: true };
      }
      return { success: false, error: "Incorrect password." };
    },
    [settings]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("mc_session");
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

  const value = useMemo(
    () => ({
      projects,
      tasks,
      prompts,
      ideas,
      resources,
      stickyNotes,
      moneyEntries,
      dailyLogs,
      wins,
      settings,
      vaults,
      vaultItems,
      projectFiles,
      activeUser,
      activeUserName,
      login,
      logout,
      setPassword,
      isPasswordSet
    }),
    [
      projects,
      tasks,
      prompts,
      ideas,
      resources,
      stickyNotes,
      moneyEntries,
      dailyLogs,
      wins,
      settings,
      vaults,
      vaultItems,
      projectFiles,
      activeUser,
      activeUserName,
      login,
      logout,
      setPassword,
      isPasswordSet
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

