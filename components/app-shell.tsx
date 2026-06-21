"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain, CheckSquare, Folder, Home, LogOut, Settings, WalletCards, Lock, Calendar, Timer,
  GripHorizontal, X, Play, Pause, Tv, SkipForward, Menu
} from "lucide-react";
import { useActiveUser, useUserNames, useUserColors, useData } from "@/components/data-provider";
import { GlobalSearch } from "@/components/global-search";
import { QuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-2xl px-4 transition-all duration-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        
        <Card className={cn(
          "w-full max-w-[380px] shadow-2xl bg-zinc-900/90 border-zinc-800 text-zinc-50 rounded-2xl backdrop-blur-md transition-all duration-300 relative z-10 p-6 flex flex-col items-center gap-6",
          shake && "animate-shake"
        )}>
          {/* Avatar & Header */}
          <div className="flex flex-col items-center text-center gap-3 w-full">
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-full text-white font-extrabold text-xl shadow-lg border border-white/10 hover:scale-105 transition-transform" 
              style={{ backgroundColor: color }}
            >
              {activeUserName ? activeUserName[0].toUpperCase() : "M"}
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black tracking-widest text-white uppercase">
                MISSION CONTROL
              </h2>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Workspace Locked
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-4">
            <div className="space-y-3">
              <p className="text-xs text-center text-zinc-400">
                Enter password for <span className="font-semibold text-white">{activeUserName}</span> to resume.
              </p>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="h-11 rounded-xl text-center text-sm bg-zinc-950/50 border-zinc-800 text-white placeholder-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700"
              />
              {unlockError && (
                <p className="text-xs text-red-400 text-center font-semibold animate-pulse">
                  {unlockError}
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-3 mt-1">
              <Button 
                type="submit" 
                className="h-11 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-sm transition-all shadow-md active:scale-[0.98]"
              >
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
                className="text-[10px] text-zinc-500 hover:text-zinc-350 transition-colors py-1 font-bold uppercase tracking-wider"
              >
                Switch Profile / Logout
              </button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Mobile backdrop shadow */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/10 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r bg-white px-4 py-5 transition-transform duration-300 ease-in-out transform",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
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
        <header className="sticky top-0 z-20 border-b bg-[#fafafa]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="h-9 w-9 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-150 shrink-0"
                title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
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
            </div>
            <div className="ml-auto flex items-center gap-3">
              <GlobalSearch />
              <div className="h-4 w-px bg-zinc-200" />
              <NotificationsMenu />
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
        "fixed z-50 w-[220px] rounded-2xl bg-zinc-900/90 text-white border border-zinc-800 p-3 shadow-2xl backdrop-blur-md select-none transition-shadow",
        isDragging ? "shadow-zinc-950/80 cursor-grabbing ring-1 ring-zinc-700" : "cursor-grab hover:shadow-zinc-950/50"
      )}
    >
      {/* Top Drag bar / controls */}
      <div className="flex items-center justify-between gap-2 mb-1.5 text-zinc-500">
        <GripHorizontal className="h-3.5 w-3.5 opacity-50 text-zinc-400 shrink-0" />
        
        {/* Simple inline progress bar */}
        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
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
          className="h-4 w-4 text-zinc-400 hover:text-white transition-colors flex items-center justify-center rounded hover:bg-zinc-800"
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
        <span className="font-mono text-3xl font-bold tracking-tight group-hover:text-zinc-200 transition-colors">
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">
            {mode === "work" ? "Focus" : "Break"}
          </span>
        </div>
        <p className="text-[9px] text-zinc-500 text-center truncate max-w-full px-2 mt-1 leading-normal font-medium group-hover:text-zinc-400">
          {focusTitle}
        </p>
      </div>

      {/* Bottom Button Row */}
      <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-zinc-800/80">
        <button
          onClick={() => { getAudioContext(); setIsPlaying(!isPlaying); }}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center transition-colors border",
            isPlaying 
              ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700" 
              : "bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-white"
          )}
          title={isPlaying ? "Pause Timer" : "Start Timer"}
        >
          {isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
        </button>

        <button
          onClick={handleSkipMode}
          className="h-7 w-7 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
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
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
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
