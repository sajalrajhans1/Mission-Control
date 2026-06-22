"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain, Folder, Home, LogOut, Settings, WalletCards, Lock, Calendar,
  GripHorizontal, X, Play, Pause, Tv, SkipForward, Sun, Moon,
  Maximize2, Minimize2, Laptop, FolderOpen, ListTodo, Plus, Clock
} from "lucide-react";
import { useActiveUser, useUserNames, useUserColors, useData } from "@/components/data-provider";
import { GlobalSearch } from "@/components/global-search";
import { QuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeUser, activeUserName, login, logout, isPasswordSet } = useActiveUser();
  const names = useUserNames();
  const userColors = useUserColors();
  const { stickyNotes } = useData();

  // --- Wallpapers Preset ---
  const WALLPAPERS = useMemo(() => [
    { name: "Aurora Nordic", path: "/wallpapers/aurora_nordic.png" },
    { name: "Minimalist Silk", path: "/wallpapers/minimalist_silk.png" },
    { name: "Obsidian Gold", path: "/wallpapers/obsidian_gold.png" },
    { name: "Misty Mountains", path: "/wallpapers/misty_mountains.png" }
  ], []);

  const [activeWallpaper, setActiveWallpaper] = useState("/wallpapers/aurora_nordic.png");
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mc_wallpaper");
    if (saved) {
      setActiveWallpaper(saved);
    }
  }, []);

  const handleSelectWallpaper = (path: string) => {
    setActiveWallpaper(path);
    localStorage.setItem("mc_wallpaper", path);
    setShowWallpaperPicker(false);
  };

  // --- Fullscreen State ---
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error entering fullscreen mode:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error("Error exiting fullscreen mode:", err);
      });
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Create sticky note helper from dock
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
    if (pathname !== "/") {
      router.push("/");
    }
  };

  // Map route pathnames to macOS active app headers
  const activeAppName = useMemo(() => {
    if (pathname === "/") return "Finder";
    if (pathname === "/tasks") return "Tasks";
    if (pathname === "/timetable") return "Calendar";
    if (pathname === "/pomodoro") return "Focus";
    if (pathname === "/projects" || pathname.startsWith("/projects/")) return "Projects";
    if (pathname === "/vault") return "Vault";
    if (pathname === "/money") return "Finance";
    if (pathname === "/settings") return "Settings";
    return "Finder";
  }, [pathname]);

  // Dock items list configuration
  const dockItems = useMemo(() => [
    { href: "/vault", label: "Vault", icon: FolderOpen },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/timetable", label: "Schedule", icon: Calendar },
    { href: "/pomodoro", label: "Focus", icon: Clock },
    { href: "/money", label: "Finance", icon: WalletCards },
    { href: "/projects", label: "Projects", icon: Folder },
    { href: "/settings", label: "Settings", icon: Settings }
  ], []);

  // Theme Controller State
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("mc_theme") as "light" | "dark" | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initialTheme = savedTheme || systemTheme;
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("mc_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Real-time Clock for Apple-like Lock Screen
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
      setDateStr(d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
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
  const lock = useCallback(() => {
    if (!activeUser) return;
    sessionStorage.setItem("mc_locked", "true");
    setIsLocked(true);
    setPassword("");
    setUnlockError(null);
  }, [activeUser]);

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
  }, [activeUser, lock]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]/60 dark:bg-dark-base/60 backdrop-blur-2xl px-4 transition-colors duration-300">
        <div className="w-full max-w-[320px] flex flex-col items-center gap-5 p-6 rounded-3xl bg-white/70 dark:bg-dark-card/60 border border-zinc-200/50 dark:border-dark-border/50 shadow-2xl backdrop-blur-md transition-all duration-300 relative z-10">
          <div className="text-center w-full">
            <h2 className="text-xl font-light tracking-widest text-zinc-900 dark:text-dark-text uppercase">
              MISSION CONTROL
            </h2>
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-dark-text-secondary">
              {selectedProfile
                ? isFirstTime
                  ? `Set a password for ${uName}`
                  : `Enter password for ${uName}`
                : "Select profile to unlock workspace"}
            </p>
          </div>
          <div className="w-full">
            {!selectedProfile ? (
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="h-14 justify-start gap-4 rounded-2xl text-xs font-semibold border-zinc-200/50 dark:border-dark-border bg-white/50 dark:bg-dark-base/50 hover:bg-zinc-100 dark:hover:bg-dark-card text-zinc-900 dark:text-dark-text transition-all duration-200"
                  onClick={() => setSelectedProfile("user1")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white font-extrabold text-sm shrink-0"
                    style={{ backgroundColor: userColors.user1 }}
                  >
                    {names.user1[0].toUpperCase()}
                  </div>
                  {names.user1}
                </Button>
                <Button
                  variant="outline"
                  className="h-14 justify-start gap-4 rounded-2xl text-xs font-semibold border-zinc-200/50 dark:border-dark-border bg-white/50 dark:bg-dark-base/50 hover:bg-zinc-100 dark:hover:bg-dark-card text-zinc-900 dark:text-dark-text transition-all duration-200"
                  onClick={() => setSelectedProfile("user2")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white font-extrabold text-sm shrink-0"
                    style={{ backgroundColor: userColors.user2 }}
                  >
                    {names.user2[0].toUpperCase()}
                  </div>
                  {names.user2}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <Input
                  type="password"
                  placeholder={isFirstTime ? "Create new password" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="h-9 text-xs text-center rounded-xl bg-zinc-100/50 dark:bg-dark-base/50 border-zinc-200/40 dark:border-dark-border text-zinc-900 dark:text-dark-text placeholder-zinc-400 focus-visible:ring-1 focus-visible:ring-dark-border focus-visible:border-dark-border"
                />
                {authError && <p className="text-[10px] text-destructive text-center font-bold animate-pulse">{authError}</p>}
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 rounded-xl h-9 text-xs text-zinc-500 dark:text-dark-text-secondary hover:bg-zinc-100 dark:hover:bg-dark-card"
                    onClick={() => {
                      setSelectedProfile(null);
                      setPassword("");
                      setAuthError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 rounded-xl h-9 text-xs bg-zinc-900 dark:bg-dark-text hover:bg-zinc-800 dark:hover:bg-dark-text/90 text-white dark:text-dark-base font-bold shadow transition-all active:scale-[0.98]">
                    {isFirstTime ? "Set" : "Unlock"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLocked) {
    const color = activeUser === "user1" ? userColors.user1 : userColors.user2;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f5f5f7]/60 dark:bg-dark-base/60 backdrop-blur-2xl px-4 transition-all duration-500">
        {/* iOS/macOS styled Large clock */}
        <div className="flex flex-col items-center gap-1 mb-8 select-none animate-in fade-in slide-in-from-top-4 duration-500 text-zinc-800 dark:text-dark-text">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-zinc-500 dark:text-dark-text-secondary">
            {dateStr}
          </span>
          <h1 className="text-6xl font-light tracking-tighter font-sans">
            {timeStr}
          </h1>
        </div>

        <div className={cn(
          "w-full max-w-[280px] flex flex-col items-center gap-5 p-6 rounded-3xl bg-white/70 dark:bg-dark-card/60 border border-zinc-200/50 dark:border-dark-border/50 shadow-2xl backdrop-blur-md transition-all duration-300 relative z-10",
          shake && "animate-shake"
        )}>
          {/* Avatar */}
          <div 
            className="flex h-20 w-20 items-center justify-center rounded-full text-white font-extrabold text-2xl shadow-inner border border-white/10 hover:scale-105 transition-transform" 
            style={{ backgroundColor: color }}
          >
            {activeUserName ? activeUserName[0].toUpperCase() : "M"}
          </div>

          <div className="text-center">
            <span className="text-xs font-extrabold text-zinc-900 dark:text-dark-text">
              {activeUserName}
            </span>
            <p className="text-[9px] font-bold text-zinc-500 dark:text-dark-text-secondary uppercase tracking-widest mt-0.5">
              Locked
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="h-9 text-xs text-center rounded-xl bg-zinc-100/50 dark:bg-dark-base/50 border-zinc-200/40 dark:border-dark-border text-zinc-900 dark:text-dark-text placeholder-zinc-400 focus-visible:ring-1 focus-visible:ring-dark-border focus-visible:border-dark-border"
            />
            {unlockError && (
              <p className="text-[10px] text-red-500 text-center font-bold animate-pulse">
                {unlockError}
              </p>
            )}
            
            <Button 
              type="submit" 
              className="h-9 rounded-xl bg-zinc-900 dark:bg-dark-text hover:bg-zinc-800 dark:hover:bg-dark-text/90 text-white dark:text-dark-base font-bold text-xs transition-all active:scale-[0.98] mt-1 shadow"
            >
              Unlock
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
              className="text-[9px] text-zinc-500 hover:text-zinc-700 dark:text-dark-text-secondary dark:hover:text-dark-text transition-colors py-1 font-bold uppercase tracking-wider mt-1 text-center"
            >
              Switch Profile
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative flex flex-col justify-between overflow-hidden bg-cover bg-center transition-all duration-500 ease-in-out"
      style={{
        backgroundImage: `url(${activeWallpaper})`,
        backgroundAttachment: "fixed",
      }}
    >
      {/* Translucent overlay for better contrast */}
      <div className="absolute inset-0 bg-slate-900/5 dark:bg-black/20 backdrop-blur-[0.5px] pointer-events-none z-0" />

      {/* TOP SLIM macOS MENU BAR */}
      <header className="fixed top-0 inset-x-0 h-8 z-40 flex items-center justify-between px-4 bg-white/70 dark:bg-[#1e1f22]/75 border-b border-slate-200/20 dark:border-white/5 backdrop-blur-xl text-[11px] font-medium text-slate-800 dark:text-dark-text select-none shadow-sm">
        {/* Left Side: Brand & active app name */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 font-bold hover:opacity-80 transition-opacity">
            <Brain className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            <span className="font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">Mission Control</span>
          </Link>
          <span className="font-bold text-slate-900 dark:text-white border-l border-slate-300 dark:border-white/10 pl-4">{activeAppName}</span>
          <div className="hidden md:flex items-center gap-3 text-slate-500 dark:text-white/50 text-[10px] uppercase tracking-wider ml-2">
            <span className="hover:text-slate-900 dark:hover:text-white cursor-default transition-colors">File</span>
            <span className="hover:text-slate-900 dark:hover:text-white cursor-default transition-colors">Edit</span>
            <span className="hover:text-slate-900 dark:hover:text-white cursor-default transition-colors">View</span>
            <span className="hover:text-slate-900 dark:hover:text-white cursor-default transition-colors">Go</span>
            <span className="hover:text-slate-900 dark:hover:text-white cursor-default transition-colors">Help</span>
          </div>
        </div>

        {/* Right Side: mock widget elements, clock, and system buttons */}
        <div className="flex items-center gap-2.5">
          <GlobalSearch iconOnly />
          
          <NotificationsMenu slim />
          
          <div className="h-3.5 w-px bg-slate-350 dark:bg-white/10 mx-1" />

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-650 hover:text-slate-900 dark:text-dark-text-secondary dark:hover:text-dark-text hover:bg-slate-950/5 dark:hover:bg-white/10 transition-all active:scale-95"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Dark Mode toggle */}
          <button
            onClick={toggleTheme}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-655 hover:text-slate-900 dark:text-dark-text-secondary dark:hover:text-dark-text hover:bg-slate-950/5 dark:hover:bg-white/10 transition-all active:scale-95"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>

          {/* Lock workspace */}
          <button
            onClick={lock}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-655 hover:text-slate-900 dark:text-dark-text-secondary dark:hover:text-dark-text hover:bg-slate-950/5 dark:hover:bg-white/10 transition-all active:scale-95"
            title="Lock Workspace"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-350 hover:bg-red-50 dark:hover:bg-red-950/10 transition-all active:scale-95"
            title="Log Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-350 dark:bg-white/10 mx-1" />

          {/* User profile */}
          <div className="flex items-center gap-1.5 cursor-default">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold shadow shadow-black/20"
              style={{ backgroundColor: activeUser === "user1" ? userColors.user1 : userColors.user2 }}
              title={activeUserName}
            >
              {(activeUserName ? activeUserName[0] : "").toUpperCase()}
            </div>
            <span className="hidden sm:inline font-semibold text-slate-900 dark:text-white">{activeUserName}</span>
          </div>

          <div className="h-3.5 w-px bg-slate-350 dark:bg-white/10 mx-1" />

          {/* Live system clock */}
          <span className="font-mono text-slate-900 dark:text-white tabular-nums font-bold">
            {timeStr}
          </span>
        </div>
      </header>

      {/* MAIN VIEWPORT CANVAS */}
      <main className="relative z-10 flex-1 w-full mx-auto max-w-[1400px] px-4 sm:px-6 pt-12 pb-24 flex flex-col justify-start">
        {!isSupabaseConfigured && (
          <div className="mt-2 mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400 animate-pulse">
            Add Supabase environment variables from <code>.env.example</code> to connect live data.
          </div>
        )}
        {children}
      </main>

      {/* PERSISTENT BOTTOM macOS-STYLE DOCK */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-max max-w-[95%] animate-in slide-in-from-bottom-5 duration-500 select-none">
        <div className="relative flex items-center gap-3.5 bg-white/20 dark:bg-black/35 border border-white/25 dark:border-white/5 backdrop-blur-2xl shadow-2xl rounded-3xl px-4 py-2 hover:shadow-black/20 transition-all duration-300">
          
          <Link href="/" className="flex flex-col items-center group relative hover:-translate-y-1.5 transition-transform duration-200">
            <div className={cn(
              "p-2.5 rounded-2xl border transition-all duration-200 shadow-md",
              pathname === "/" 
                ? "bg-white/40 dark:bg-white/15 border-white/40 dark:border-white/20 scale-105" 
                : "bg-white/10 dark:bg-white/5 border-white/10 hover:bg-white/25 hover:border-white/25"
            )}>
              <Home className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">Desktop</span>
            {pathname === "/" && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-glow" />}
          </Link>

          {dockItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className="flex flex-col items-center group relative hover:-translate-y-1.5 transition-transform duration-200"
              >
                <div className={cn(
                  "p-2.5 rounded-2xl border transition-all duration-200 shadow-md",
                  isActive 
                    ? "bg-white/40 dark:bg-white/15 border-white/40 dark:border-white/20 scale-105" 
                    : "bg-white/10 dark:bg-white/5 border-white/10 hover:bg-white/25 hover:border-white/25"
                )}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">{item.label}</span>
                {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-glow" />}
              </Link>
            );
          })}

          <div className="h-6 w-px bg-white/20 shrink-0" />

          {/* Wallpaper preset selector */}
          <div className="relative">
            <button 
              onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
              className={cn(
                "p-2.5 rounded-2xl border transition-all duration-200 shadow-md relative flex flex-col items-center group hover:-translate-y-1.5",
                showWallpaperPicker ? "bg-white/30 border-white/40 scale-105" : "bg-white/10 dark:bg-white/5 border-white/10 hover:bg-white/25 hover:border-white/25"
              )}
            >
              <Laptop className="h-5 w-5 text-white" />
              <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">Wallpaper</span>
            </button>

            {showWallpaperPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-48 rounded-2xl border border-white/20 bg-slate-900/90 dark:bg-black/90 backdrop-blur-2xl p-3 shadow-2xl flex flex-col gap-2 z-50 animate-in slide-in-from-bottom-2 duration-150">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest text-center">Change Background</span>
                <div className="grid grid-cols-2 gap-2">
                  {WALLPAPERS.map((wp) => (
                    <button
                      key={wp.name}
                      onClick={() => handleSelectWallpaper(wp.path)}
                      className={cn(
                        "group relative aspect-video rounded-lg overflow-hidden border transition-all hover:scale-105",
                        activeWallpaper === wp.path ? "border-indigo-400 scale-102 ring-1 ring-indigo-400" : "border-white/10 hover:border-white/30"
                      )}
                      title={wp.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={wp.path} alt={wp.name} className="w-full h-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] text-white py-0.5 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">{wp.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick-add Note button */}
          <button 
            onClick={handleCreateNote}
            className="p-2.5 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/25 hover:border-white/25 transition-all duration-200 shadow-md relative flex flex-col items-center group hover:-translate-y-1.5"
          >
            <Plus className="h-5 w-5 text-white" />
            <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">Add Note</span>
          </button>

        </div>
      </div>

      <QuickAdd />
      <FloatingPomodoro />
    </div>
  );
}

function FloatingPomodoro() {
  const router = useRouter();
  const pathname = usePathname();
  const data = useData();
  const {
    pomoMode: mode,
    pomoIsPlaying: isPlaying,
    pomoTimeLeft: timeLeft,
    pomoSettings: settings,
    pomoFocusType: focusType,
    pomoTaskId,
    pomoBlockId,
    setPomoIsPlaying: setIsPlaying,
    setPomoTimeLeft: setTimeLeft,
    setPomoMode: setMode,
    tasks,
    timetableBlocks,
    getAudioContext
  } = data;

  const [isDismissed, setIsDismissed] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPiPAvailable, setIsPiPAvailable] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);

  // Reset dismissed state when navigating to /pomodoro page
  useEffect(() => {
    if (pathname === "/pomodoro") {
      setIsDismissed(false);
    }
  }, [pathname]);

  // Check if PiP is available on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const video = document.createElement("video");
      setIsPiPAvailable(
        "documentPictureInPicture" in window || 
        (video.requestPictureInPicture && typeof video.requestPictureInPicture === "function")
      );
    }
  }, []);

  const totalSeconds = useMemo(() => {
    if (mode === "work") return settings.work * 60;
    if (mode === "shortBreak") return settings.shortBreak * 60;
    return settings.longBreak * 60;
  }, [mode, settings]);

  const activeFocusTask = useMemo(() => {
    return tasks.rows.find((t) => t.id === pomoTaskId);
  }, [tasks.rows, pomoTaskId]);

  const activeFocusBlock = useMemo(() => {
    return timetableBlocks?.rows.find((b) => b.id === pomoBlockId);
  }, [timetableBlocks?.rows, pomoBlockId]);

  const focusTitle = useMemo(() => {
    if (mode === "work") {
      if (focusType === "task" && activeFocusTask) return activeFocusTask.title;
      if (focusType === "block" && activeFocusBlock) return activeFocusBlock.title;
      return "General Focus";
    }
    return mode === "shortBreak" ? "Short Break" : "Long Break";
  }, [mode, focusType, activeFocusTask, activeFocusBlock]);

  // Render timer on offscreen canvas for Picture-in-Picture window
  useEffect(() => {
    if (!isPiPActive) return;

    const canvas = canvasRef.current || document.createElement("canvas");
    if (!canvasRef.current) {
      canvas.width = 240;
      canvas.height = 240;
      canvasRef.current = canvas;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, 240, 240);

      const progress = timeLeft / totalSeconds;
      const angle = -Math.PI / 2 + 2 * Math.PI * progress;

      // Draw background progress circle
      ctx.beginPath();
      ctx.arc(120, 110, 85, 0, 2 * Math.PI);
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 14;
      ctx.stroke();

      // Draw active progress circle
      ctx.beginPath();
      ctx.arc(120, 110, 85, -Math.PI / 2, angle);
      ctx.strokeStyle = mode === "work" ? "#6366f1" : "#10b981";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();

      // Time Text
      const m = Math.floor(timeLeft / 60).toString().padStart(2, "0");
      const s = (timeLeft % 60).toString().padStart(2, "0");
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 38px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${m}:${s}`, 120, 100);

      // Mode Status
      ctx.fillStyle = mode === "work" ? "#818cf8" : "#34d399";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText((mode === "work" ? "FOCUSING" : "BREAK").toUpperCase(), 120, 140);

      // Focus Label Title
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "11px sans-serif";
      const cleanTitle = focusTitle.length > 22 ? focusTitle.substring(0, 20) + "..." : focusTitle;
      ctx.fillText(cleanTitle, 120, 205);
    };

    draw();
    const interval = setInterval(draw, 250);
    return () => clearInterval(interval);
  }, [timeLeft, totalSeconds, mode, focusTitle, isPiPActive]);

  // Handle PiP toggle triggers
  const handleTogglePiP = async () => {
    try {
      if (isPiPActive) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
        setIsPiPActive(false);
        return;
      }

      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      canvasRef.current = canvas;

      const video = videoRef.current || document.createElement("video");
      video.muted = true;
      video.playsInline = true;

      const stream = canvas.captureStream(5);
      video.srcObject = stream;
      videoRef.current = video;

      video.onloadedmetadata = async () => {
        try {
          await video.play();
          await video.requestPictureInPicture();
          setIsPiPActive(true);
        } catch (err) {
          console.error("Error playing video for PiP:", err);
        }
      };

      video.addEventListener("enterpictureinpicture", () => {
        setIsPiPActive(true);
      });
      
      video.addEventListener("leavepictureinpicture", () => {
        setIsPiPActive(false);
        if (videoRef.current) {
          const s = videoRef.current.srcObject as MediaStream;
          if (s) {
            s.getTracks().forEach((track) => track.stop());
          }
          videoRef.current.srcObject = null;
        }
      });

    } catch (error) {
      console.error("Failed to start PiP timer:", error);
    }
  };

  // Draggable calculations
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartOffset.current = {
      x: e.clientX + position.x,
      y: window.innerHeight - e.clientY - position.y
    };
    if (dragRef.current) {
      dragRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newX = dragStartOffset.current.x - e.clientX;
    const newY = window.innerHeight - e.clientY - dragStartOffset.current.y;
    
    // Clamp coordinates inside browser viewport
    const clampedX = Math.max(12, Math.min(window.innerWidth - 240, newX));
    const clampedY = Math.max(12, Math.min(window.innerHeight - 130, newY));
    
    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      if (dragRef.current) {
        dragRef.current.releasePointerCapture(e.pointerId);
      }
    }
  };

  // Skip logic
  const handleSkipMode = () => {
    setIsPlaying(false);
    if (mode === "work") {
      const nextMode = (data.pomoCompletedCount + 1) % settings.longBreakInterval === 0 ? "longBreak" : "shortBreak";
      setMode(nextMode);
      setTimeLeft(nextMode === "shortBreak" ? settings.shortBreak * 60 : settings.longBreak * 60);
    } else {
      setMode("work");
      setTimeLeft(settings.work * 60);
    }
  };

  // Hide the floating widget on the main /pomodoro page, or if closed, or if not running
  const isTimerActive = timeLeft < totalSeconds || isPlaying;
  if (pathname === "/pomodoro" || isDismissed || !isTimerActive) return null;

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");
  const progressPercent = (timeLeft / totalSeconds) * 100;

  return (
    <div
      ref={dragRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
        touchAction: "none"
      }}
      className={cn(
        "fixed z-50 w-[220px] rounded-2xl bg-dark-card/90 text-white border border-dark-border p-3 shadow-2xl backdrop-blur-md select-none transition-shadow",
        isDragging ? "shadow-dark-base/80 cursor-grabbing ring-1 ring-dark-muted" : "cursor-grab hover:shadow-dark-base/50"
      )}
    >
      {/* Top Drag bar / controls */}
      <div className="flex items-center justify-between gap-2 mb-1.5 text-dark-text-secondary">
        <GripHorizontal className="h-3.5 w-3.5 opacity-50 text-dark-text-secondary/60 shrink-0" />
        
        {/* Simple inline progress bar */}
        <div className="flex-1 h-1 bg-dark-hover rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              mode === "work" ? "bg-indigo-500" : "bg-emerald-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="h-4 w-4 text-dark-text-secondary hover:text-white transition-colors flex items-center justify-center rounded hover:bg-dark-hover"
          title="Dismiss Widget"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Main content click navigates back to timer page */}
      <div
        onClick={() => router.push("/pomodoro")}
        className="cursor-pointer group flex flex-col items-center py-1"
        title="Open Pomodoro Settings"
      >
        <span className="font-mono text-3xl font-bold tracking-tight group-hover:text-dark-text transition-colors">
          {minutes}:{seconds}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isPlaying ? "animate-pulse" : "opacity-60",
              mode === "work" ? "bg-indigo-500" : "bg-emerald-500"
            )}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-dark-text-secondary group-hover:text-dark-text">
            {mode === "work" ? "Focus" : "Break"}
          </span>
        </div>
        <p className="text-[9px] text-dark-text-secondary/80 text-center truncate max-w-full px-2 mt-1 leading-normal font-medium group-hover:text-dark-text-secondary">
          {focusTitle}
        </p>
      </div>

      {/* Bottom Button Row */}
      <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-dark-border/80">
        <button
          onClick={() => { getAudioContext(); setIsPlaying(!isPlaying); }}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center transition-colors border",
            isPlaying 
              ? "bg-dark-hover border-dark-muted text-white hover:bg-dark-muted" 
              : "bg-zinc-100 dark:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text-secondary hover:bg-white dark:hover:bg-dark-hover"
          )}
          title={isPlaying ? "Pause Timer" : "Start Timer"}
        >
          {isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
        </button>

        <button
          onClick={handleSkipMode}
          className="h-7 w-7 rounded-lg bg-dark-hover border border-dark-muted text-dark-text-secondary hover:text-white flex items-center justify-center transition-colors"
          title="Skip Cycle"
        >
          <SkipForward className="h-3 w-3" />
        </button>

        {isPiPAvailable && (
          <button
            onClick={handleTogglePiP}
            className={cn(
              "h-7 w-7 rounded-lg border flex items-center justify-center transition-colors",
              isPiPActive
                ? "bg-indigo-950 border-indigo-800 text-indigo-400"
                : "bg-dark-hover border-dark-muted text-dark-text-secondary hover:text-white"
            )}
            title={isPiPActive ? "Close Floating Timer (PiP)" : "Float Timer (PiP)"}
          >
            <Tv className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
