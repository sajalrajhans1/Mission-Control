"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain, CheckSquare, Folder, Home, LogOut, Settings, WalletCards, Lock
} from "lucide-react";
import { useActiveUser, useUserNames, useUserColors } from "@/components/data-provider";
import { GlobalSearch } from "@/components/global-search";
import { QuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/vault", label: "Vault", icon: Brain },
  { href: "/money", label: "Money", icon: WalletCards },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeUser, activeUserName, login, logout, isPasswordSet } = useActiveUser();
  const names = useUserNames();
  const userColors = useUserColors();

  // Clear dark mode elements
  useEffect(() => {
    localStorage.removeItem("mc_theme");
    document.documentElement.classList.remove("dark");
  }, []);

  // Auth/Login & Lock State
  const [selectedProfile, setSelectedProfile] = useState<"user1" | "user2" | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Initialize lock state from sessionStorage
  useEffect(() => {
    const locked = sessionStorage.getItem("mc_locked") === "true";
    if (locked) {
      setIsLocked(true);
    }
  }, []);

  // Workspace Lock trigger
  const lock = () => {
    if (!activeUser) return;
    sessionStorage.setItem("mc_locked", "true");
    setIsLocked(true);
    setPassword("");
    setUnlockError(null);
  };

  // Keyboard shortcut listener: Alt+L, Ctrl+Alt+L, Ctrl+Shift+L, Alt+Space+L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeUser) return;

      const isLKey = e.key.toLowerCase() === "l";

      const matchesShortcut = 
        (e.altKey && isLKey) || 
        (e.ctrlKey && e.altKey && isLKey) ||
        (e.ctrlKey && e.shiftKey && isLKey) ||
        (e.altKey && e.code === "Space" && isLKey);

      if (matchesShortcut) {
        e.preventDefault();
        lock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    setAuthError(null);
    const res = await login(selectedProfile, password);
    if (res.success) {
      setPassword("");
      setSelectedProfile(null);
    } else {
      setAuthError(res.error || "Failed to log in.");
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    setUnlockError(null);
    const res = await login(activeUser, password);
    if (res.success) {
      setPassword("");
      setIsLocked(false);
      sessionStorage.removeItem("mc_locked");
    } else {
      setUnlockError("Incorrect password.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  if (!activeUser) {
    const uName = selectedProfile === "user1" ? names.user1 : selectedProfile === "user2" ? names.user2 : "";
    const isFirstTime = selectedProfile ? !isPasswordSet(selectedProfile) : false;

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <Card className="w-full max-w-[420px] shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-900 tracking-wider">
              MISSION CONTROL
            </CardTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {selectedProfile
                ? isFirstTime
                  ? `Set a password to secure your profile, ${uName}.`
                  : `Enter your password to unlock ${uName}'s profile.`
                : "Select your profile to enter the workspace."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!selectedProfile ? (
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4 rounded-xl text-base font-semibold hover:border-black"
                  onClick={() => setSelectedProfile("user1")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white font-bold shrink-0"
                    style={{ backgroundColor: userColors.user1 }}
                  >
                    {names.user1[0].toUpperCase()}
                  </div>
                  {names.user1}
                </Button>
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4 rounded-xl text-base font-semibold hover:border-black"
                  onClick={() => setSelectedProfile("user2")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white font-bold shrink-0"
                    style={{ backgroundColor: userColors.user2 }}
                  >
                    {names.user2[0].toUpperCase()}
                  </div>
                  {names.user2}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="grid gap-3">
                <Input
                  type="password"
                  placeholder={isFirstTime ? "Create new password" : "Enter password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="h-12 rounded-xl"
                />
                {authError && <p className="text-xs text-destructive">{authError}</p>}
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      setSelectedProfile(null);
                      setPassword("");
                      setAuthError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 rounded-xl">
                    {isFirstTime ? "Set & Enter" : "Enter"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLocked) {
    const color = activeUser === "user1" ? userColors.user1 : userColors.user2;
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 transition-all duration-300 relative">
        <div className="absolute inset-0 bg-cover bg-center opacity-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <Card className={cn(
          "w-full max-w-[420px] shadow-2xl bg-white/95 backdrop-blur-md rounded-2xl border border-zinc-200 transition-all duration-300 relative z-10",
          shake && "animate-shake"
        )}>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white font-bold text-xl shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: color }}>
              {activeUserName ? activeUserName[0].toUpperCase() : "M"}
            </div>
            <CardTitle className="text-2xl font-black tracking-widest text-zinc-900 tracking-wider">
              MISSION CONTROL
            </CardTitle>
            <p className="mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workspace Locked
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="grid gap-4">
              <div className="grid gap-1.5">
                <p className="text-xs text-center text-zinc-500 mb-2">
                  Enter password for <span className="font-bold text-zinc-700">{activeUserName}</span> to resume your session.
                </p>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="h-11 rounded-xl text-center text-sm border-zinc-200 focus-visible:ring-1"
                />
                {unlockError && (
                  <p className="text-xs text-red-500 text-center font-semibold mt-1">
                    {unlockError}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" className="h-11 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-semibold text-sm transition-all shadow-md">
                  Unlock Workspace
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setIsLocked(false);
                    sessionStorage.removeItem("mc_locked");
                    setPassword("");
                    setUnlockError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-650 transition-colors py-1.5 font-medium underline underline-offset-4"
                >
                  Switch Profile / Logout
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white px-4 py-5 lg:block">
        <Link href="/" className="mb-8 block px-2">
          <div className="text-xl font-bold tracking-tight">Mission Control</div>
          <div className="text-xs text-muted-foreground">Private two-person OS</div>
        </Link>
        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                pathname === item.href && "bg-black text-white hover:bg-black hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b bg-[#fafafa]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl border bg-white p-2",
                    pathname === item.href && "bg-black text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <GlobalSearch />
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: activeUser === "user1" ? userColors.user1 : userColors.user2 }}
                >
                  {(activeUserName ? activeUserName[0] : "").toUpperCase()}
                </div>
                <span className="hidden text-sm font-medium sm:inline">{activeUserName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lock}
                  className="h-9 w-9 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-105 dark:text-zinc-400 dark:hover:text-zinc-200"
                  title="Lock Workspace"
                >
                  <Lock className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>
        {!isSupabaseConfigured ? (
          <div className="border-b bg-white px-4 py-3 text-sm text-muted-foreground sm:px-6">
            Add Supabase environment variables from <code>.env.example</code> to connect live data.
          </div>
        ) : null}
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
      <QuickAdd />
    </div>
  );
}
