"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { useData, useActiveUser } from "@/components/data-provider";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { todayISO, cn } from "@/lib/utils";
import type { Json } from "@/lib/database.types";

const COLOR_OPTIONS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Emerald", value: "#10b981" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Orange", value: "#f97316" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Slate", value: "#64748b" }
];

export default function SettingsPage() {
  const router = useRouter();
  const { settings } = useData();
  const { activeUser, setPassword } = useActiveUser();

  const user1Row = settings.rows.find((r) => r.key === "user1_name");
  const user2Row = settings.rows.find((r) => r.key === "user2_name");

  // Local state so typing is instant — saves on blur or Enter
  const [user1, setUser1] = useState("");
  const [user2, setUser2] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const user1ColorRow = settings.rows.find((r) => r.key === "user1_color");
  const user2ColorRow = settings.rows.find((r) => r.key === "user2_color");

  const [user1Color, setUser1Color] = useState("#6366f1");
  const [user2Color, setUser2Color] = useState("#f97316");

  // Sync from Supabase once rows arrive
  useEffect(() => {
    if (user1Row) {
      const v = user1Row.value;
      setUser1(typeof v === "string" ? v : "Phoenix");
    }
  }, [user1Row]);

  useEffect(() => {
    if (user2Row) {
      const v = user2Row.value;
      setUser2(typeof v === "string" ? v : "Friend");
    }
  }, [user2Row]);

  useEffect(() => {
    if (user1ColorRow) {
      const v = user1ColorRow.value;
      setUser1Color(typeof v === "string" ? v : "#6366f1");
    }
  }, [user1ColorRow]);

  useEffect(() => {
    if (user2ColorRow) {
      const v = user2ColorRow.value;
      setUser2Color(typeof v === "string" ? v : "#f97316");
    }
  }, [user2ColorRow]);

  const handleSaveColor = async (colorVal: string) => {
    if (activeUser === "user1") {
      setUser1Color(colorVal);
      await saveSetting(user1ColorRow, "user1_color", colorVal);
    } else if (activeUser === "user2") {
      setUser2Color(colorVal);
      await saveSetting(user2ColorRow, "user2_color", colorVal);
    }
  };

  const saveSetting = async (row: typeof user1Row, key: string, val: Json) => {
    if (row) {
      await settings.update(row.id, { value: val });
    } else {
      await settings.create({ key, value: val });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpdatePassword = async () => {
    if (!activeUser || !newPassword.trim()) return;
    await setPassword(activeUser, newPassword);
    setNewPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 3000);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!isSupabaseConfigured) return;
    const tables = [
      "tasks", "projects", "prompts", "ideas", "resources",
      "sticky_notes", "money_entries", "daily_logs", "wins",
      "settings", "vaults", "vault_items", "project_files"
    ];
    const backup: Record<string, unknown[]> = {};
    for (const table of tables) {
      const { data } = await supabase.from(table).select("*");
      backup[table] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mission-control-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isSupabaseConfigured) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as Record<string, unknown[]>;
      const tableOrder = [
        "projects", "vaults", "tasks", "prompts", "ideas", "resources",
        "sticky_notes", "money_entries", "daily_logs", "wins", "settings", "vault_items", "project_files"
      ];
      for (const table of tableOrder) {
        const rows = backup[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        for (let i = 0; i < rows.length; i += 50) {
          await supabase.from(table).upsert(rows.slice(i, i + 50) as never[], { onConflict: "id" });
        }
      }
      setImportStatus("✓ Import complete. Reload the page to see changes.");
    } catch (err) {
      setImportStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure your workspace.</p>
      </div>

      {/* ── User Name ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-zinc-900">
            Username
            {saved && <span className="text-sm font-normal text-green-600">Saved ✓</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {activeUser === "user1" && (
            <Field label="Your Name">
              <Input
                value={user1}
                placeholder="Phoenix"
                onChange={(e) => setUser1(e.target.value)}
                onBlur={() => saveSetting(user1Row, "user1_name", user1 || "Phoenix")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveSetting(user1Row, "user1_name", user1 || "Phoenix");
                }}
              />
            </Field>
          )}
          {activeUser === "user2" && (
            <Field label="Your Name">
              <Input
                value={user2}
                placeholder="Friend"
                onChange={(e) => setUser2(e.target.value)}
                onBlur={() => saveSetting(user2Row, "user2_name", user2 || "Friend")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveSetting(user2Row, "user2_name", user2 || "Friend");
                }}
              />
            </Field>
          )}
          <p className="col-span-2 text-xs text-muted-foreground">
            Press Enter or click outside to save. This name appears everywhere in the app.
          </p>
        </CardContent>
      </Card>

      {/* ── Profile Color ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-900">Profile Color</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Select a color to represent your profile picture and badges across the workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            {COLOR_OPTIONS.map((c) => {
              const isActive = activeUser === "user1" ? user1Color === c.value : user2Color === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => handleSaveColor(c.value)}
                  className={cn(
                    "h-10 px-4 rounded-xl text-xs font-semibold text-white shadow-sm border transition-all hover:scale-105",
                    isActive ? "ring-2 ring-black ring-offset-2 scale-105" : "border-zinc-200"
                  )}
                  style={{ backgroundColor: c.value }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Desktop Background ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-900">Desktop Background</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Customize your workspace background using high-definition static images or live video wallpapers.
          </p>
          <div>
            <Button onClick={() => router.push("/settings/wallpaper")}>
              Choose Wallpaper
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Change Password ──────────────────────────────────────────────── */}
      {activeUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-900">Security</CardTitle>
          </CardHeader>
          <CardContent className="max-w-xs grid gap-3">
            <Field label="Change Your Password">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPassword.trim()) {
                    handleUpdatePassword();
                  }
                }}
              />
            </Field>
            <Button onClick={handleUpdatePassword} disabled={!newPassword.trim()}>
              Update Password
            </Button>
            {passwordSaved && <p className="text-xs text-green-600">Password updated successfully! ✓</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Backup ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-900">Backup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Export your entire workspace as a JSON file for safekeeping.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExport} disabled={!isSupabaseConfigured}>
              Export Workspace
            </Button>
            <label>
              <Button variant="outline" asChild disabled={!isSupabaseConfigured || importing}>
                <span>
                  {importing ? "Importing…" : "Import Workspace"}
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImport}
                disabled={!isSupabaseConfigured || importing}
              />
            </label>
          </div>
          {importStatus && <p className="text-sm text-muted-foreground">{importStatus}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
