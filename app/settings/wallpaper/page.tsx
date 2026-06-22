"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Tv, Image as ImageIcon } from "lucide-react";
import { WALLPAPERS, WallpaperVideoPreview } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export default function WallpaperSettingsPage() {
  const [activeWallpaper, setActiveWallpaper] = useState("/wallpapers/aurora_nordic.png");

  useEffect(() => {
    const saved = localStorage.getItem("mc_wallpaper");
    if (saved) {
      setActiveWallpaper(saved);
    }
  }, []);

  const handleSelectWallpaper = (path: string) => {
    setActiveWallpaper(path);
    localStorage.setItem("mc_wallpaper", path);
    window.dispatchEvent(new Event("mc_wallpaper_changed"));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header and Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <Link 
          href="/settings"
          className="p-2.5 rounded-xl bg-white/10 dark:bg-black/35 border border-white/20 dark:border-white/10 text-white hover:bg-white/20 dark:hover:bg-white/10 transition-all shadow-lg backdrop-blur-md"
        >
          <ArrowLeft className="h-5 w-5 text-wallpaper-safe" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white text-wallpaper-safe">
            Desktop Background
          </h1>
          <p className="text-sm text-white/80 text-wallpaper-safe mt-1 font-medium">
            Customize the look and feel of your collaborative desktop environment.
          </p>
        </div>
      </div>

      {/* Grid of Wallpapers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {WALLPAPERS.map((wp) => {
          const isVideo = wp.path.endsWith(".mp4") || wp.path.includes(".m3u8");
          const isActive = activeWallpaper === wp.path;

          return (
            <div 
              key={wp.name}
              onClick={() => handleSelectWallpaper(wp.path)}
              className={cn(
                "group relative aspect-video rounded-2xl overflow-hidden border bg-slate-950/20 backdrop-blur-md cursor-pointer shadow-xl transition-all duration-300 hover:scale-103 hover:shadow-2xl",
                isActive 
                  ? "border-indigo-400 ring-2 ring-indigo-400/50 shadow-indigo-500/20" 
                  : "border-white/15 dark:border-white/5 hover:border-white/30 dark:hover:border-white/15"
              )}
            >
              {/* Media Preview Container */}
              <div className="absolute inset-0 w-full h-full z-0">
                {isVideo ? (
                  <WallpaperVideoPreview path={wp.path} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={wp.path} 
                    alt={wp.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                )}
              </div>

              {/* Shading/Vignette Overlay for visual contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-75 group-hover:opacity-60 transition-opacity z-1" />

              {/* Tag Badges (Video vs. Static) */}
              <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                <div className="bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1 text-[9px] text-white/90 font-bold uppercase tracking-wider">
                  {isVideo ? (
                    <>
                      <Tv className="h-3 w-3 text-indigo-400" />
                      <span>Video</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-3 w-3 text-emerald-400" />
                      <span>Static</span>
                    </>
                  )}
                </div>
              </div>

              {/* Checkmark Badge on Active selection */}
              {isActive && (
                <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-indigo-500 border border-white/20 flex items-center justify-center text-white shadow-lg animate-in zoom-in-50 duration-200 z-10">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}

              {/* Footer info panel */}
              <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end z-10">
                <span className="text-sm font-bold text-white tracking-wide truncate drop-shadow">
                  {wp.name}
                </span>
                {isActive && (
                  <span className="text-[10px] text-indigo-300 font-bold mt-0.5 tracking-wider uppercase">
                    Active Background
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
