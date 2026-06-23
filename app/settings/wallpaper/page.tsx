"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Tv } from "lucide-react";
import { WALLPAPERS } from "@/components/app-shell";
import { useActiveUser } from "@/components/data-provider";
import { cn } from "@/lib/utils";

export default function WallpaperSettingsPage() {
  const { activeUser } = useActiveUser();
  const [activeWallpaper, setActiveWallpaper] = useState("/wallpapers/aurora_nordic.png");

  useEffect(() => {
    const saved = activeUser ? localStorage.getItem(`mc_wallpaper_${activeUser}`) : null;
    const finalWallpaper = saved || localStorage.getItem("mc_wallpaper") || "/wallpapers/aurora_nordic.png";
    setActiveWallpaper(finalWallpaper);
  }, [activeUser]);

  const handleSelectWallpaper = (path: string) => {
    setActiveWallpaper(path);
    if (activeUser) {
      localStorage.setItem(`mc_wallpaper_${activeUser}`, path);
    }
    localStorage.setItem("mc_wallpaper", path);
    window.dispatchEvent(new Event("mc_wallpaper_changed"));
  };

  const staticWallpapers = WALLPAPERS.filter(wp => wp.path.endsWith(".png") || wp.path.endsWith(".jpg"));
  const liveWallpapers = WALLPAPERS.filter(wp => !wp.path.endsWith(".png") && !wp.path.endsWith(".jpg"));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500 select-none">
      
      {/* Header macOS Style */}
      <div className="flex items-center gap-4 mb-10 pb-4 border-b border-white/10">
        <Link 
          href="/settings"
          className="p-2 rounded-xl bg-white/10 dark:bg-black/35 border border-white/20 dark:border-white/10 text-white hover:bg-white/20 dark:hover:bg-white/10 transition-all shadow-md backdrop-blur-md"
        >
          <ArrowLeft className="h-4 w-4 text-wallpaper-safe" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Wallpaper
        </h1>
      </div>

      {/* Sections Wrapper */}
      <div className="flex flex-col gap-10">
        
        {/* Section 1: Static Wallpapers */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/80">
            Desktop Pictures
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {staticWallpapers.map((wp) => {
              const isActive = activeWallpaper === wp.path;
              return (
                <div 
                  key={wp.name} 
                  className="flex flex-col gap-2 group cursor-pointer"
                  onClick={() => handleSelectWallpaper(wp.path)}
                >
                  <div 
                    className={cn(
                      "relative aspect-[16/10] rounded-xl overflow-hidden border bg-white/5 transition-all duration-300",
                      isActive 
                        ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-black" 
                        : "border-white/10 group-hover:border-white/30"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={wp.path} 
                      alt={wp.name} 
                      className="w-full h-full object-cover" 
                    />
                    {isActive && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-indigo-500 border border-white/20 flex items-center justify-center text-white shadow-lg">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-center text-white/90 group-hover:text-white transition-colors truncate px-1 text-wallpaper-safe">
                    {wp.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Live Wallpapers */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/80">
            Dynamic Wallpapers
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {liveWallpapers.map((wp) => {
              const isActive = activeWallpaper === wp.path;
              const isStream = wp.path.includes(".m3u8");

              return (
                <div 
                  key={wp.name} 
                  className="flex flex-col gap-2 group cursor-pointer"
                  onClick={() => handleSelectWallpaper(wp.path)}
                >
                  <div 
                    className={cn(
                      "relative aspect-[16/10] rounded-xl overflow-hidden border bg-black/45 transition-all duration-300",
                      isActive 
                        ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-black" 
                        : "border-white/10 group-hover:border-white/30"
                    )}
                  >
                    {isStream ? (
                      /* Live stream static representation */
                      <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 to-slate-900/60 flex items-center justify-center">
                        <Tv className="h-5 w-5 text-white/30" />
                      </div>
                    ) : (
                      /* Render video statically (preload metadata, no autoplay) */
                      <video 
                        src={wp.path} 
                        className="w-full h-full object-cover pointer-events-none" 
                        preload="metadata"
                      />
                    )}
                    {isActive && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-indigo-500 border border-white/20 flex items-center justify-center text-white shadow-lg">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-center text-white/90 group-hover:text-white transition-colors truncate px-1 text-wallpaper-safe">
                    {wp.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
