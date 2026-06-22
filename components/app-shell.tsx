"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain, CheckSquare, Folder, Home, LogOut, Settings, WalletCards, Lock, Calendar, Timer,
  GripHorizontal, X, Play, Pause, Tv, SkipForward, ChevronsLeft, ChevronsRight, Sun, Moon
} from "lucide-react";
import { useActiveUser, useUserNames, useUserColors, useData } from "@/components/data-provider";
import { GlobalSearch } from "@/components/global-search";
import { QuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/timetable", label: "Timetable", icon: Calendar },
  { href: "/pomodoro", label: "Pomodoro", icon: Timer },
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

  // Sidebar open/collapse state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Handle auto-collapse sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-dark-surface text-zinc-900 dark:text-dark-text transition-colors duration-300">
      {/* Mobile backdrop shadow */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/15 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r border-zinc-200/40 dark:border-dark-border/40 bg-white/70 dark:bg-dark-base/60 backdrop-blur-lg px-4 py-5 transition-all duration-300 ease-in-out transform",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link href="/" className="mb-8 block px-2">
          <div className="text-xl font-bold tracking-tight text-zinc-900 dark:text-dark-text">Mission Control</div>
          <div className="text-xs text-zinc-500 dark:text-dark-text-secondary">Private two-person OS</div>
        </Link>
        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 dark:text-dark-text-secondary hover:bg-zinc-200/50 dark:hover:bg-dark-hover hover:text-zinc-900 dark:hover:text-dark-text transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                pathname === item.href && "bg-zinc-900 dark:bg-dark-text text-white dark:text-dark-base shadow-sm hover:bg-zinc-900 dark:hover:bg-dark-text hover:text-white dark:hover:text-dark-base scale-100 hover:scale-100"
              )}
              onClick={() => {
                // Auto close on navigation if on mobile
                if (window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          isSidebarOpen ? "lg:pl-64" : "lg:pl-0"
        )}
      >
        <header className="sticky top-0 z-20 border-b border-zinc-200/40 dark:border-dark-border/40 bg-[#f5f5f7]/85 dark:bg-dark-base/85 backdrop-blur-md px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="h-9 w-9 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-dark-text-secondary dark:hover:text-dark-text hover:bg-zinc-200/50 dark:hover:bg-dark-hover transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
                title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {isSidebarOpen ? (
                  <ChevronsLeft className="h-5 w-5" />
                ) : (
                  <ChevronsRight className="h-5 w-5 animate-pulse" />
                )}
              </Button>
              
              <div className="flex gap-2 overflow-x-auto lg:hidden">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl border border-zinc-200/50 dark:border-dark-border bg-white/70 dark:bg-dark-card/60 p-2 text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-900 dark:hover:text-dark-text backdrop-blur-md transition-all duration-200",
                      pathname === item.href && "bg-zinc-900 dark:bg-dark-text text-white dark:text-dark-base hover:bg-zinc-900 hover:text-white dark:hover:bg-dark-text dark:hover:text-dark-base shadow-md"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <GlobalSearch />
              <div className="h-4 w-px bg-zinc-200 dark:bg-dark-border" />
              <NotificationsMenu />
              <div className="h-4 w-px bg-zinc-200 dark:bg-dark-border" />
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: activeUser === "user1" ? userColors.user1 : userColors.user2 }}
                >
                  {(activeUserName ? activeUserName[0] : "").toUpperCase()}
                </div>
                <span className="hidden text-sm font-medium sm:inline text-zinc-700 dark:text-dark-text-secondary">{activeUserName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 dark:text-dark-text-secondary dark:hover:text-dark-text dark:hover:bg-dark-hover transition-all duration-200"
                  title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                >
                  {theme === "light" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lock}
                  className="h-9 w-9 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 dark:text-dark-text-secondary dark:hover:text-dark-text dark:hover:bg-dark-hover transition-all duration-200"
                  title="Lock Workspace"
                >
                  <Lock className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-200"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>
        {!isSupabaseConfigured ? (
          <div className="border-b border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-base px-4 py-3 text-sm text-muted-foreground sm:px-6">
            Add Supabase environment variables from <code>.env.example</code> to connect live data.
          </div>
        ) : null}
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
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
