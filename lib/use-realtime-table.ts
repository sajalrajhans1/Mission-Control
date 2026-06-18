"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Insert, Row, TableName, Update } from "@/lib/database.types";

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_PREFIX = "mc_";

function lsKey(table: string) {
  return `${STORAGE_PREFIX}${table}`;
}

function lsRead<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(lsKey(table));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function lsWrite<T>(table: string, rows: T[]) {
  try {
    localStorage.setItem(lsKey(table), JSON.stringify(rows));
    // Notify same-window listeners (different hook instances)
    window.dispatchEvent(new StorageEvent("storage", { key: lsKey(table) }));
  } catch {
    // quota exceeded etc — silently ignore
  }
}

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

// ─── Default seeds ────────────────────────────────────────────────────────────

function seedDefaults() {
  // Vaults
  const vaults = lsRead<Record<string, unknown>>("vaults");
  if (vaults.length === 0) {
    const defaults = [
      { id: uuid(), name: "Prompts", icon: "WandSparkles", order_index: 0, is_default: true, created_at: nowISO(), updated_at: nowISO() },
      { id: uuid(), name: "Ideas", icon: "Lightbulb", order_index: 1, is_default: true, created_at: nowISO(), updated_at: nowISO() },
      { id: uuid(), name: "Resources", icon: "Link", order_index: 2, is_default: true, created_at: nowISO(), updated_at: nowISO() },
      { id: uuid(), name: "Sticky Notes", icon: "StickyNote", order_index: 3, is_default: true, created_at: nowISO(), updated_at: nowISO() },
      { id: uuid(), name: "Work Deliverables", icon: "Briefcase", order_index: 4, is_default: true, created_at: nowISO(), updated_at: nowISO() }
    ];
    lsWrite("vaults", defaults);
  }

  // Settings
  const settings = lsRead<Record<string, unknown>>("settings");
  const settingKeys = settings.map((s) => s.key);
  const defaultSettings = [
    { key: "user1_name", value: "Phoenix" },
    { key: "user2_name", value: "Friend" }
  ];
  let changed = false;
  for (const ds of defaultSettings) {
    if (!settingKeys.includes(ds.key)) {
      settings.push({ id: uuid(), ...ds, created_at: nowISO(), updated_at: nowISO() });
      changed = true;
    }
  }
  if (changed) lsWrite("settings", settings);
}

// ─── localStorage hook ────────────────────────────────────────────────────────

function useLocalTable<T extends TableName>(
  table: T,
  sort: { column?: keyof Row<T> & string; ascending?: boolean }
) {
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [loading, setLoading] = useState(!isSupabaseConfigured);
  const initialized = useRef(false);

  const reload = useCallback(() => {
    const data = lsRead<Row<T>>(table);
    const col = sort.column;
    if (col) {
      data.sort((a, b) => {
        const av = a[col as keyof Row<T>];
        const bv = b[col as keyof Row<T>];
        const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
        return sort.ascending ? cmp : -cmp;
      });
    }
    setRows(data);
    setLoading(false);
  }, [table, sort.column, sort.ascending]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    if (!initialized.current) {
      seedDefaults();
      initialized.current = true;
    }
    reload();

    const handler = (e: StorageEvent) => {
      if (e.key === lsKey(table)) reload();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [reload, table]);

  const api = useMemo(() => ({
    create: async (values: Insert<T>) => {
      if (isSupabaseConfigured) return { data: null as unknown as Row<T>, error: null };
      const now = nowISO();
      const row = { id: uuid(), created_at: now, updated_at: now, ...values } as unknown as Row<T>;
      const current = lsRead<Row<T>>(table);
      lsWrite(table, [...current, row]);
      reload();
      return { data: row, error: null };
    },
    update: async (id: string, values: Update<T>) => {
      if (isSupabaseConfigured) return { data: null, error: null };
      const current = lsRead<Row<T>>(table);
      const updated = current.map((r) =>
        r.id === id ? { ...r, ...(values as object), updated_at: nowISO() } as Row<T> : r
      );
      lsWrite(table, updated);
      reload();
      return { data: updated.find((r) => r.id === id) ?? null, error: null };
    },
    remove: async (id: string) => {
      if (isSupabaseConfigured) return { error: null };
      const current = lsRead<Row<T>>(table);
      lsWrite(table, current.filter((r) => r.id !== id));
      reload();
      return { error: null };
    }
  }), [table, reload]);

  return { rows, loading, error: null as string | null, refetch: reload, ...api };
}

// ─── Supabase hook (original) ─────────────────────────────────────────────────

type SupabaseMutationBuilder = {
  insert: (values: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } };
  update: (values: unknown) => { eq: (column: string, value: string) => { select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } } };
  delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
};

function useSupabaseTable<T extends TableName>(
  table: T,
  sort: { column?: keyof Row<T> & string; ascending?: boolean }
) {
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select("*");
    if (sort.column) query = query.order(sort.column, { ascending: sort.ascending ?? false });
    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    else setRows((data ?? []) as unknown as Row<T>[]);
    setLoading(false);
  }, [table, sort.column, sort.ascending]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchRows();
    const channel = supabase
      .channel(`${table}-changes`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        setRows((current) => {
          if (payload.eventType === "INSERT") return [payload.new as Row<T>, ...current];
          if (payload.eventType === "UPDATE") {
            return current.map((row) => (row.id === (payload.new as Row<T>).id ? (payload.new as Row<T>) : row));
          }
          if (payload.eventType === "DELETE") {
            return current.filter((row) => row.id !== (payload.old as Row<T>).id);
          }
          return current;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRows, table]);

  const api = useMemo(() => {
    const tableApi = supabase.from(table) as unknown as SupabaseMutationBuilder;
    return {
      create: async (values: Insert<T>) => {
        return await tableApi.insert(values).select().single();
      },
      update: async (id: string, values: Update<T>) => {
        return await tableApi.update(values).eq("id", id).select().single();
      },
      remove: async (id: string) => {
        return await tableApi.delete().eq("id", id);
      }
    };
  }, [table]);

  return { rows, loading, error, refetch: fetchRows, ...api };
}

// ─── Public export ─────────────────────────────────────────────────────────────

export function useRealtimeTable<T extends TableName>(
  table: T,
  sort: { column?: keyof Row<T> & string; ascending?: boolean } = { column: "created_at" as keyof Row<T> & string, ascending: false }
) {
  const ls = useLocalTable(table, sort);
  const sb = useSupabaseTable(table, sort);

  // Always call both hooks (rules of hooks) — return the appropriate one
  return isSupabaseConfigured ? sb : ls;
}
