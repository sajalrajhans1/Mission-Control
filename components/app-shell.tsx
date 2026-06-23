"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain, Folder, Home, LogOut, Settings, WalletCards, Lock, Calendar,
  Maximize2, Minimize2, Laptop, FolderOpen, ListTodo, Plus, Clock
} from "lucide-react";
import { useActiveUser, useUserNames, useUserColors, useData } from "@/components/data-provider";
import { GlobalSearch } from "@/components/global-search";
import { QuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface HlsInstance {
  loadSource(src: string): void;
  attachMedia(media: HTMLVideoElement): void;
}

interface HlsConstructor {
  new (): HlsInstance;
  isSupported(): boolean;
}
// --- Wallpapers Preset ---
export const WALLPAPERS = [
  { name: "Aurora Nordic", path: "/wallpapers/aurora_nordic.png" },
  { name: "Minimalist Silk", path: "/wallpapers/minimalist_silk.png" },
  { name: "Obsidian Gold", path: "/wallpapers/obsidian_gold.png" },
  { name: "Misty Mountains", path: "/wallpapers/misty_mountains.png" },
  { name: "Cyberpunk Grid", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4" },
  { name: "Abstract Flow", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260419_065931_e3ca7b53-d32e-4ad5-81de-dc9d6fcfda6d.mp4" },
  { name: "Deep Space", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260411_104032_69319010-2458-492b-b04d-b40a5dfa4482.mp4" },
  { name: "Techno Rings", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4" },
  { name: "Digital Wave", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4" },
  { name: "Abstract Neon", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260611_183632_c311af08-e4b7-458f-81e7-79847a49b3d3.mp4" },
  { name: "Fluid Dynamic", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_055001_8e16d972-3b2b-441c-86ad-2901a54682f9.mp4" },
  { name: "Golden Horizon", path: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260302_085844_21a8f4b3-dea5-4ede-be16-d53f6973bb14.mp4" },
  { name: "Live Stream", path: "https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeUser, activeUserName, login, logout, isPasswordSet } = useActiveUser();
  const names = useUserNames();
  const userColors = useUserColors();
  const {
    stickyNotes,
    notifications,
    isScreensaverActive,
    setIsScreensaverActive,
    pomoTimeLeft,
    pomoIsPlaying,
    pomoMode,
    pomoSettings
  } = useData();

  const isTimerActive = useMemo(() => {
    if (!pomoSettings) return false;
    const totalSeconds = pomoMode === "work"
      ? pomoSettings.work * 60
      : pomoMode === "shortBreak"
        ? pomoSettings.shortBreak * 60
        : pomoSettings.longBreak * 60;
    return pomoTimeLeft < totalSeconds || pomoIsPlaying;
  }, [pomoTimeLeft, pomoIsPlaying, pomoMode, pomoSettings]);

  const timerString = useMemo(() => {
    const minutes = Math.floor(pomoTimeLeft / 60).toString().padStart(2, "0");
    const seconds = (pomoTimeLeft % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [pomoTimeLeft]);

  const timerLabel = useMemo(() => {
    if (pomoMode === "work") return "Focus";
    if (pomoMode === "shortBreak") return "Short Break";
    return "Long Break";
  }, [pomoMode]);

  const [activeWallpaper, setActiveWallpaper] = useState("/wallpapers/aurora_nordic.png");

  useEffect(() => {
    const loadWallpaper = () => {
      const saved = localStorage.getItem("mc_wallpaper");
      if (saved) {
        setActiveWallpaper(saved);
      }
    };
    loadWallpaper();

    window.addEventListener("mc_wallpaper_changed", loadWallpaper);
    window.addEventListener("storage", loadWallpaper);
    return () => {
      window.removeEventListener("mc_wallpaper_changed", loadWallpaper);
      window.removeEventListener("storage", loadWallpaper);
    };
  }, []);



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

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

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

  const shellVideoRef = useRef<HTMLVideoElement>(null);
  const lockVideoRef = useRef<HTMLVideoElement>(null);

  // Handle HLS live stream wallpaper binding (using hls.js)
  useEffect(() => {
    const isVideo = activeWallpaper.endsWith(".mp4") || activeWallpaper.includes(".m3u8");
    if (!isVideo || !activeWallpaper.includes(".m3u8")) return;

    const video = lockVideoRef.current || shellVideoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeWallpaper;
    } else {
      const Hls = (window as unknown as { Hls?: HlsConstructor }).Hls;
      if (Hls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(activeWallpaper);
        hls.attachMedia(video);
      } else {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js";
        script.onload = () => {
          const LoadedHls = (window as unknown as { Hls?: HlsConstructor }).Hls;
          if (LoadedHls && LoadedHls.isSupported()) {
            const hls = new LoadedHls();
            hls.loadSource(activeWallpaper);
            hls.attachMedia(video);
          }
        };
        document.body.appendChild(script);
        return () => {
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
        };
      }
    }
  }, [activeWallpaper, isLocked]);

  // Initialize lock state from sessionStorage
  useEffect(() => {
    const locked = sessionStorage.getItem("mc_locked") === "true";
    if (locked) {
      setIsLocked(true);
    }
  }, []);

  // Enforce fullscreen when locked
  useEffect(() => {
    if (!isLocked) return;

    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request rejected/deferred:", err);
        });
      }
    };

    // Attempt immediate fullscreen
    enterFullscreen();

    // Re-request on any user click or key press while locked
    const handleInteraction = () => {
      enterFullscreen();
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, [isLocked]);

  // --- Top Status Bar Interactive Menu Dropdowns ---
  const [activeMenu, setActiveMenu] = useState<"File" | "Edit" | "View" | "Go" | "Help" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setActiveMenu(null);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleMenuClick = (menu: "File" | "Edit" | "View" | "Go" | "Help") => {
    setActiveMenu(menu);
    setMenuOpen(true);
  };

  const handleMenuHover = (menu: "File" | "Edit" | "View" | "Go" | "Help") => {
    if (menuOpen) {
      setActiveMenu(menu);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setActiveMenu(null);
  };

  const myNotifications = useMemo(() => {
    if (!activeUser) return [];
    return notifications.rows.filter((n) => n.for_user === activeUser);
  }, [notifications.rows, activeUser]);

  const clearAllNotifications = async () => {
    if (!activeUser) return;
    for (const n of myNotifications) {
      await notifications.remove(n.id);
    }
  };

  // Workspace Lock trigger
  const lock = useCallback(() => {
    if (!activeUser) return;
    sessionStorage.setItem("mc_locked", "true");
    setIsLocked(true);
    setPassword("");
    setUnlockError(null);
  }, [activeUser]);

  // Keyboard shortcuts listener (⌥L, ⌥T, ⌥F, ⌘N, ⌘D, ⌘K, ⌘H, ⌘W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeUser) return;

      const key = e.key.toLowerCase();
      const isMetaOrCtrl = e.metaKey || e.ctrlKey;

      // Lock Screen: Alt+L or Command+L
      if ((e.altKey && key === "l") || (isMetaOrCtrl && key === "l")) {
        e.preventDefault();
        lock();
      }
      // Toggle Fullscreen: Alt+F
      if (e.altKey && key === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
      // New Task: Command+N or Alt+N
      if ((isMetaOrCtrl && key === "n") || (e.altKey && key === "n")) {
        e.preventDefault();
        router.push("/tasks");
      }
      // New Note: Command+D or Alt+D
      if ((isMetaOrCtrl && key === "d") || (e.altKey && key === "d")) {
        e.preventDefault();
        handleCreateNote();
      }
      // Clear Alerts: Command+K or Alt+K
      if ((isMetaOrCtrl && key === "k") || (e.altKey && key === "k")) {
        e.preventDefault();
        clearAllNotifications();
      }
      // Go to Desktop: Command+H or Alt+H
      if ((isMetaOrCtrl && key === "h") || (e.altKey && key === "h")) {
        e.preventDefault();
        router.push("/");
      }
      // Wallpapers picker: Command+W or Alt+W
      if ((e.altKey && key === "w") || (isMetaOrCtrl && key === "w")) {
        e.preventDefault();
        router.push("/settings/wallpaper");
      }
      // Screensaver: Alt+S
      if (e.altKey && key === "s") {
        e.preventDefault();
        if (pathname !== "/") {
          router.push("/");
        }
        setIsScreensaverActive(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeUser, lock, toggleFullscreen, router, handleCreateNote, clearAllNotifications, pathname, setIsScreensaverActive]);



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
    const isVideo = activeWallpaper.endsWith(".mp4") || activeWallpaper.includes(".m3u8");
    return (
      <div 
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cover bg-center px-4 transition-all duration-500"
        style={!isVideo ? {
          backgroundImage: `url(${activeWallpaper})`,
        } : undefined}
      >
        {isVideo && (
          <video 
            ref={lockVideoRef}
            key={activeWallpaper}
            className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none transform-gpu"
            style={{ 
              transform: "scale(1.01) translate3d(0,0,0)",
              backfaceVisibility: "hidden"
            }}
            autoPlay
            muted
            loop
            playsInline
          >
            <source src={activeWallpaper} type={activeWallpaper.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4"} />
          </video>
        )}
        {/* Dark glassmorphic mask */}
        <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/50 backdrop-blur-2xl z-0" />

        <div className="flex flex-col items-center gap-1 mb-8 select-none animate-in fade-in slide-in-from-top-4 duration-500 text-white relative z-10">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-white">
            {dateStr}
          </span>
          <h1 className="text-6xl font-light tracking-tighter font-sans text-white">
            {timeStr}
          </h1>
        </div>

        <div className={cn(
          "w-full max-w-[280px] flex flex-col items-center gap-5 p-6 rounded-3xl bg-white/20 dark:bg-black/25 border border-white/20 shadow-2xl backdrop-blur-xl transition-all duration-300 relative z-10",
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
            <span className="text-xs font-extrabold text-white">
              {activeUserName}
            </span>
            <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
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
              className="h-9 text-xs text-center rounded-xl bg-white/10 dark:bg-black/20 border-white/20 text-white placeholder-white/50 focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:border-white/40"
            />
            {unlockError && (
              <p className="text-[10px] text-red-400 text-center font-bold animate-pulse">
                {unlockError}
              </p>
            )}
            
            <Button 
              type="submit" 
              className="h-9 rounded-xl bg-white hover:bg-white/90 text-slate-900 dark:bg-white dark:hover:bg-white/90 dark:text-black font-bold text-xs transition-all active:scale-[0.98] mt-1 shadow"
            >
              Unlock
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const isVideo = activeWallpaper.endsWith(".mp4") || activeWallpaper.includes(".m3u8");

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-500 ease-in-out">
      {/* FIXED VIEWPORT-LOCKED WALLPAPER CANVAS */}
      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none select-none overflow-hidden">
        {isVideo ? (
          <video 
            ref={shellVideoRef}
            key={activeWallpaper}
            className="w-full h-full object-cover transform-gpu"
            style={{ 
              transform: "scale(1.01) translate3d(0,0,0)",
              backfaceVisibility: "hidden"
            }}
            autoPlay
            muted
            loop
            playsInline
          >
            <source src={activeWallpaper} type={activeWallpaper.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4"} />
          </video>
        ) : (
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${activeWallpaper})`,
            }}
          />
        )}
        {/* Translucent overlay for better contrast */}
        <div className="absolute inset-0 bg-slate-900/5 dark:bg-black/20 backdrop-blur-[0.5px]" />
      </div>

      {/* TOP SLIM macOS MENU BAR */}
      <header className={cn(
        "fixed top-0 inset-x-0 h-8 z-40 flex items-center justify-between px-4 bg-white/70 dark:bg-[#1e1f22]/75 border-b border-slate-200/20 dark:border-white/5 backdrop-blur-xl text-[11px] font-medium text-slate-800 dark:text-dark-text select-none shadow-sm transition-all duration-500",
        isScreensaverActive && "-translate-y-full opacity-0 pointer-events-none"
      )}>
        {/* Left Side: Brand & active app name */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 font-bold hover:opacity-80 transition-opacity">
            <Brain className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            <span className="font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">Mission Control</span>
          </Link>
          <span className="font-bold text-slate-900 dark:text-white border-l border-slate-300 dark:border-white/10 pl-4">{activeAppName}</span>
          <div className="hidden md:flex items-center gap-1.5 relative" ref={menuRef}>
            {/* File Menu */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick("File")}
                onMouseEnter={() => handleMenuHover("File")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors cursor-default select-none",
                  activeMenu === "File" ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white" : "hover:bg-slate-950/5 dark:hover:bg-white/5 text-slate-700 dark:text-dark-text-secondary"
                )}
              >
                File
              </button>
              {menuOpen && activeMenu === "File" && (
                <div className="absolute left-0 mt-1 w-44 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-2xl p-1 shadow-2xl z-50 text-[11px] text-slate-700 dark:text-dark-text animate-in fade-in slide-in-from-top-1 duration-100">
                  <button onClick={() => { router.push("/tasks"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>New Task</span>
                    <span className="opacity-55 font-mono text-[9px]">⌘N</span>
                  </button>
                  <button onClick={() => { handleCreateNote(); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>New Note</span>
                    <span className="opacity-55 font-mono text-[9px]">⌘D</span>
                  </button>
                  <div className="h-px bg-slate-200/50 dark:bg-white/5 my-1" />
                  <button onClick={() => { lock(); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Lock Screen</span>
                    <span className="opacity-55 font-mono text-[9px]">⌥L</span>
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick("Edit")}
                onMouseEnter={() => handleMenuHover("Edit")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors cursor-default select-none",
                  activeMenu === "Edit" ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white" : "hover:bg-slate-955/5 dark:hover:bg-white/5 text-slate-700 dark:text-dark-text-secondary"
                )}
              >
                Edit
              </button>
              {menuOpen && activeMenu === "Edit" && (
                <div className="absolute left-0 mt-1 w-48 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-2xl p-1 shadow-2xl z-50 text-[11px] text-slate-700 dark:text-dark-text animate-in fade-in slide-in-from-top-1 duration-100">
                  <button onClick={() => { clearAllNotifications(); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Clear Alerts</span>
                    <span className="opacity-55 font-mono text-[9px]">⌘K</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick("View")}
                onMouseEnter={() => handleMenuHover("View")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors cursor-default select-none",
                  activeMenu === "View" ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white" : "hover:bg-slate-955/5 dark:hover:bg-white/5 text-slate-700 dark:text-dark-text-secondary"
                )}
              >
                View
              </button>
              {menuOpen && activeMenu === "View" && (
                <div className="absolute left-0 mt-1 w-44 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-2xl p-1 shadow-2xl z-50 text-[11px] text-slate-700 dark:text-dark-text animate-in fade-in slide-in-from-top-1 duration-100">
                  <button onClick={() => { router.push("/"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Go to Desktop</span>
                    <span className="opacity-55 font-mono text-[9px]">⌘H</span>
                  </button>
                  <button onClick={() => { toggleFullscreen(); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Toggle Fullscreen</span>
                    <span className="opacity-55 font-mono text-[9px]">⌥F</span>
                  </button>
                  <button onClick={() => { router.push("/"); setIsScreensaverActive(true); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Activate Screensaver</span>
                    <span className="opacity-55 font-mono text-[9px]">⌥S</span>
                  </button>
                  <button onClick={() => { router.push("/settings/wallpaper"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Wallpapers...</span>
                    <span className="opacity-55 font-mono text-[9px]">⌘W</span>
                  </button>
                </div>
              )}
            </div>

            {/* Go Menu */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick("Go")}
                onMouseEnter={() => handleMenuHover("Go")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors cursor-default select-none",
                  activeMenu === "Go" ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white" : "hover:bg-slate-955/5 dark:hover:bg-white/5 text-slate-700 dark:text-dark-text-secondary"
                )}
              >
                Go
              </button>
              {menuOpen && activeMenu === "Go" && (
                <div className="absolute left-0 mt-1 w-40 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-2xl p-1 shadow-2xl z-50 text-[11px] text-slate-700 dark:text-dark-text animate-in fade-in slide-in-from-top-1 duration-100">
                  <button onClick={() => { router.push("/"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <Home className="h-3 w-3 opacity-60" /> Desktop
                  </button>
                  <button onClick={() => { router.push("/vault"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <FolderOpen className="h-3 w-3 opacity-60" /> Vault
                  </button>
                  <button onClick={() => { router.push("/tasks"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <ListTodo className="h-3 w-3 opacity-60" /> Tasks
                  </button>
                  <button onClick={() => { router.push("/timetable"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <Calendar className="h-3 w-3 opacity-60" /> Schedule
                  </button>
                  <button onClick={() => { router.push("/pomodoro"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <Clock className="h-3 w-3 opacity-60" /> Focus
                  </button>
                  <button onClick={() => { router.push("/money"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <WalletCards className="h-3 w-3 opacity-60" /> Finance
                  </button>
                  <button onClick={() => { router.push("/settings"); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center gap-2">
                    <Settings className="h-3 w-3 opacity-60" /> Settings
                  </button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick("Help")}
                onMouseEnter={() => handleMenuHover("Help")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors cursor-default select-none",
                  activeMenu === "Help" ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white" : "hover:bg-slate-955/5 dark:hover:bg-white/5 text-slate-700 dark:text-dark-text-secondary"
                )}
              >
                Help
              </button>
              {menuOpen && activeMenu === "Help" && (
                <div className="absolute left-0 mt-1 w-44 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-2xl p-1 shadow-2xl z-50 text-[11px] text-slate-700 dark:text-dark-text animate-in fade-in slide-in-from-top-1 duration-100">
                  <button onClick={() => { setShowShortcutsHelp(true); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>Keyboard Shortcuts</span>
                  </button>
                  <button onClick={() => { setShowAboutDialog(true); closeMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-indigo-600 hover:text-white dark:hover:text-white rounded-lg flex items-center justify-between">
                    <span>About Mission Control</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: mock widget elements, clock, and system buttons */}
        <div className="flex items-center gap-2.5">
          {pathname !== "/pomodoro" && isTimerActive && (
            <Link
              href="/pomodoro"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider transition-all select-none border shadow-sm",
                pomoIsPlaying
                  ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/25 hover:bg-indigo-500/25"
                  : "bg-amber-500/15 text-amber-200 border-amber-500/25 hover:bg-amber-500/25"
              )}
              title="Return to Pomodoro Focus Room"
            >
              <Clock className={cn("h-3 w-3", pomoIsPlaying && "animate-pulse")} />
              <span>{timerLabel}: {timerString}</span>
            </Link>
          )}

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
      <div className={cn(
        "fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-max max-w-[95%] select-none transition-all duration-500",
        isScreensaverActive 
          ? "translate-y-[150%] opacity-0 pointer-events-none" 
          : "animate-in slide-in-from-bottom-5 duration-500"
      )}>
        <div className="relative flex items-end gap-3.5 bg-white/15 dark:bg-black/35 border border-white/25 dark:border-white/5 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[24px] px-4 pt-3.5 pb-2 hover:shadow-black/25 transition-all duration-300">
          
          <Link href="/" className="w-10 h-10 flex-shrink-0 relative flex items-center justify-center group origin-bottom">
            <div 
              className={cn(
                "p-2.5 rounded-2xl border shadow-md transition-all ease-out transform-gpu will-change-transform group-hover:scale-[1.28] group-hover:-translate-y-3 group-active:scale-95 origin-bottom",
                pathname === "/" 
                  ? "bg-white/40 dark:bg-white/15 border-white/40 dark:border-white/20" 
                  : "bg-white/10 dark:bg-white/5 border-white/10 group-hover:bg-white/25 group-hover:border-white/25"
              )}
              style={{ 
                WebkitBoxReflect: "below 2px linear-gradient(transparent 70%, rgba(255, 255, 255, 0.08))",
                transition: "transform 0.3s cubic-bezier(0.25, 1, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
              }}
            >
              <Home className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">Desktop</span>
            {pathname === "/" && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400 dark:bg-indigo-300 shadow-[0_0_8px_#818cf8]" />}
          </Link>

          {dockItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className="w-10 h-10 flex-shrink-0 relative flex items-center justify-center group origin-bottom"
              >
                <div 
                  className={cn(
                    "p-2.5 rounded-2xl border shadow-md transition-all ease-out transform-gpu will-change-transform group-hover:scale-[1.28] group-hover:-translate-y-3 group-active:scale-95 origin-bottom",
                    isActive 
                      ? "bg-white/40 dark:bg-white/15 border-white/40 dark:border-white/20" 
                      : "bg-white/10 dark:bg-white/5 border-white/10 group-hover:bg-white/25 group-hover:border-white/25"
                  )}
                  style={{ 
                    WebkitBoxReflect: "below 2px linear-gradient(transparent 70%, rgba(255, 255, 255, 0.08))",
                    transition: "transform 0.3s cubic-bezier(0.25, 1, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
                  }}
                >
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">{item.label}</span>
                {isActive && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400 dark:bg-indigo-300 shadow-[0_0_8px_#818cf8]" />}
              </Link>
            );
          })}

          <div className="h-10 w-px bg-white/20 shrink-0 self-center" />

          {/* Wallpaper preset selector */}
          <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center group origin-bottom">
            <Link 
              href="/settings/wallpaper"
              className={cn(
                "p-2.5 rounded-2xl border shadow-md transition-all ease-out transform-gpu will-change-transform group-hover:scale-[1.28] group-hover:-translate-y-3 group-active:scale-95 origin-bottom",
                pathname === "/settings/wallpaper"
                  ? "bg-white/30 border-white/40" 
                  : "bg-white/10 dark:bg-white/5 border-white/10 group-hover:bg-white/25 group-hover:border-white/25"
              )}
              style={{ 
                WebkitBoxReflect: "below 2px linear-gradient(transparent 70%, rgba(255, 255, 255, 0.08))",
                transition: "transform 0.3s cubic-bezier(0.25, 1, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
              }}
            >
              <Laptop className="h-5 w-5 text-white" />
            </Link>
            <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">Wallpaper</span>
          </div>

          {/* Quick-add Note button */}
          <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center group origin-bottom">
            <button 
              onClick={handleCreateNote}
              className="p-2.5 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/10 shadow-md transition-all ease-out transform-gpu will-change-transform group-hover:scale-[1.28] group-hover:-translate-y-3 group-active:scale-95 group-hover:bg-white/25 group-hover:border-white/25 origin-bottom"
              style={{ 
                WebkitBoxReflect: "below 2px linear-gradient(transparent 70%, rgba(255, 255, 255, 0.08))",
                transition: "transform 0.3s cubic-bezier(0.25, 1, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
              }}
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
            <span className="absolute -top-9 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider pointer-events-none shadow">Add Note</span>
          </div>
        </div>
      </div>

      <QuickAdd />

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-xs mt-2">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">Lock Workspace</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌥L / ⌘L</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">Toggle Dark Theme</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌥T</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">Toggle Fullscreen</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌥F</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">New Task</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌘N / ⌥N</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">New Note</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌘D / ⌥D</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">Clear Alerts</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌘K / ⌥K</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">Go to Desktop</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌘H / ⌥H</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
              <span className="opacity-80">Activate Screensaver</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌥S</kbd>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="opacity-80">Change Wallpaper</span>
              <kbd className="px-2 py-0.5 bg-slate-200/50 dark:bg-white/10 rounded font-mono text-[10px]">⌘W / ⌥W</kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* About Dialog */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="max-w-xs text-center flex flex-col items-center p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-xl border border-white/20 mb-3 hover:scale-105 transition-transform duration-300">
            <Brain className="h-9 w-9 text-white" />
          </div>
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Mission Control</DialogTitle>
          <span className="text-[10px] opacity-60 font-semibold tracking-wider uppercase mt-0.5">Version 2.0.0 (Premium)</span>
          <div className="text-xs opacity-80 leading-relaxed max-w-[240px] mt-3">
            A luxury productivity suite for creators, organizers, and developers. Designed with glassmorphic aesthetics and modern fluid controls.
          </div>
          <div className="text-[9px] opacity-40 font-mono mt-5">
            © 2026 DeepMind Antigravity Group
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



export function WallpaperVideoPreview({ path }: { path: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !path.includes(".m3u8")) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = path;
    } else {
      const Hls = (window as unknown as { Hls?: HlsConstructor }).Hls;
      if (Hls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(path);
        hls.attachMedia(video);
      } else {
        const scriptId = "hls-js-cdn-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement;
        if (!script) {
          script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js";
          document.body.appendChild(script);
        }

        const handleLoad = () => {
          const LoadedHls = (window as unknown as { Hls?: HlsConstructor }).Hls;
          if (LoadedHls && LoadedHls.isSupported()) {
            const hls = new LoadedHls();
            hls.loadSource(path);
            hls.attachMedia(video);
          }
        };

        if ((window as unknown as { Hls?: HlsConstructor }).Hls) {
          handleLoad();
        } else {
          script.addEventListener("load", handleLoad);
          return () => {
            script.removeEventListener("load", handleLoad);
          };
        }
      }
    }
  }, [path]);

  return (
    <video
      ref={videoRef}
      src={path.includes(".m3u8") ? undefined : path}
      className="w-full h-full object-cover"
      muted
      autoPlay
      loop
      playsInline
    />
  );
}
