"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { 
  TrendingUp, WalletCards, ListTodo, Pin, StickyNote, Trash2, Lock, Unlock,
  Sparkles, Laptop, FolderOpen, Clock, Calendar, Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AutosaveTextarea } from "@/components/autosize-textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useData, useUserNames, useActiveUser, useUserColors } from "@/components/data-provider";
import { currentMonthRange, formatMoney, cn } from "@/lib/utils";
import type { Row, Json } from "@/lib/database.types";


export default function HomePage() {
  const { tasks, moneyEntries, stickyNotes, settings, onlineUsers, sendNotification } = useData();
  const { activeUser, activeUserName } = useActiveUser();
  const { user1, user2 } = useUserNames();
  const userColors = useUserColors();
  const month = currentMonthRange();

  const otherUserName = activeUserName === user1 ? user2 : user1;
  const isOtherUserOnline = onlineUsers.includes(otherUserName);

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

  // --- Clock & Date Widget State ---
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    if (!currentTime) return "Good morning";
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  }, [currentTime]);

  const timeString = useMemo(() => {
    if (!currentTime) return "";
    return currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [currentTime]);

  const dateString = useMemo(() => {
    if (!currentTime) return "";
    return currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentTime]);

  // --- Shared Priority List ---
  const priorityRow = settings.rows.find((r) => r.key === "shared_priority_list");
  const parsedPriority = useMemo(() => {
    if (!priorityRow || !priorityRow.value) return { text: "", updatedBy: "", updatedAt: "" };
    const val = priorityRow.value as { text?: string; updatedBy?: string; updatedAt?: string };
    return {
      text: val.text || "",
      updatedBy: val.updatedBy || "",
      updatedAt: val.updatedAt || "",
    };
  }, [priorityRow]);

  const [localText, setLocalText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setLocalText(parsedPriority.text);
    }
  }, [parsedPriority.text, isEditing]);

  const savePriorityList = async (textToSave: string) => {
    if (textToSave === parsedPriority.text) return;
    setIsSaving(true);
    const updatedValue = {
      text: textToSave,
      updatedBy: activeUserName || "Unknown",
      updatedAt: new Date().toLocaleString(),
    };

    if (priorityRow) {
      await settings.update(priorityRow.id, { value: updatedValue as unknown as Json });
    } else {
      await settings.create({ key: "shared_priority_list", value: updatedValue as unknown as Json });
    }
    const otherUserKey = activeUser === "user1" ? "user2" : "user1";
    sendNotification(
      otherUserKey,
      "Priority List Updated",
      `${activeUserName} updated the shared priority list`
    );
    setIsSaving(false);
  };

  const handleBlur = () => {
    setIsEditing(false);
    savePriorityList(localText);
  };

  const handleSave = () => {
    setIsEditing(false);
    savePriorityList(localText);
  };

  // --- Sticky Notes ---
  const [deletingNote, setDeletingNote] = useState<Row<"sticky_notes"> | null>(null);

  const notes = useMemo(
    () => stickyNotes.rows
      .filter((item) => !item.is_private || item.author === activeUserName)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [stickyNotes.rows, activeUserName]
  );

  // --- Calculations ---
  const currencySymbol = "₹";

  const myKey = activeUser || "user1";
  const otherKey = myKey === "user1" ? "user2" : "user1";

  const monthEntries = useMemo(() => {
    return moneyEntries.rows.filter(
      (entry) => entry.entry_date >= month.start && entry.entry_date <= month.end
    );
  }, [moneyEntries.rows, month.start, month.end]);

  const income = useMemo(() => {
    const userIncome = monthEntries
      .filter((e) => e.added_by === myKey && e.type === "Income" && !e.is_request)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const settledRequests = monthEntries
      .filter((e) => e.added_by === myKey && e.request_to === otherKey && e.is_request && e.request_status === "settled")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    return userIncome + settledRequests;
  }, [monthEntries, myKey, otherKey]);

  const expenses = useMemo(() => {
    const userExpenses = monthEntries
      .filter((e) => e.added_by === myKey && e.type === "Expense" && !e.is_request)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const approvedRequests = monthEntries
      .filter((e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && (e.request_status === "approved" || e.request_status === "settled"))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    return userExpenses + approvedRequests;
  }, [monthEntries, myKey, otherKey]);

  const progress = useMemo(() => {
    return [user1, user2].map((person) => {
      const owned = tasks.rows.filter(
        (task) => task.assigned_to === person || task.assigned_to === "Both"
      );
      const done = owned.filter((task) => task.completed).length;
      return { person, done, total: owned.length, percent: owned.length ? (done / owned.length) * 100 : 0 };
    });
  }, [tasks.rows, user1, user2]);
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
  };

  return (
    <div 
      className="relative -mx-4 -my-6 sm:-mx-6 p-4 sm:p-8 min-h-[calc(100vh-65px)] transition-all duration-500 ease-in-out select-none flex flex-col justify-between gap-8 rounded-2xl overflow-hidden"
      style={{
        backgroundImage: `url(${activeWallpaper})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {/* Translucent overlay for better contrast */}
      <div className="absolute inset-0 bg-slate-900/5 dark:bg-black/20 backdrop-blur-[1px] pointer-events-none z-0" />

      <div className="relative z-10 flex-1 flex flex-col gap-8 pb-20">
        
        {/* Top/Center: macOS Clock & Date Widget */}
        <div className="flex flex-col items-center justify-center text-center mt-4 mb-2 select-none animate-in fade-in slide-in-from-top-4 duration-500">
          <span className="text-sm font-bold uppercase tracking-widest text-white/90 drop-shadow-md">
            {dateString}
          </span>
          <h1 className="text-6xl sm:text-7xl font-extralight tracking-tighter text-white drop-shadow-lg mt-1 font-sans">
            {timeString}
          </h1>
          <div className="mt-2 flex items-center gap-3 bg-black/25 dark:bg-black/35 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-white shadow-lg">
            <Sparkles className="h-4.5 w-4.5 text-yellow-300 animate-pulse" />
            <span className="text-sm font-semibold tracking-wide">
              {greeting}, {activeUserName}
            </span>
            <div className="h-3 w-px bg-white/20" />
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              {isOtherUserOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isOtherUserOnline ? "bg-emerald-500" : "bg-white/40")}></span>
            </div>
            <span className="text-xs text-white/80 font-medium">
              {otherUserName} is {isOtherUserOnline ? "online" : "offline"}
            </span>
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Progress Widget (Glassmorphic) */}
          <Card className="lg:col-span-7 border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text transition-all duration-300 rounded-2xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text drop-shadow-sm text-sm font-bold tracking-wider uppercase">
                <TrendingUp className="h-4 w-4" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 grid gap-4">
              {progress.map((item) => (
                <div key={item.person} className="grid gap-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="font-medium flex items-center gap-1.5 drop-shadow-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.person === user1 ? userColors.user1 : userColors.user2 }}
                      />
                      {item.person}
                    </span>
                    <span className="opacity-90">
                      {item.done} / {item.total} tasks
                    </span>
                  </div>
                  <Progress value={item.percent} className="h-2 bg-white/20 dark:bg-white/10" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Money Overview Widget (Glassmorphic) */}
          <div className="lg:col-span-7 grid gap-6">
            <Card className="border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text transition-all duration-300 rounded-2xl">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text drop-shadow-sm text-sm font-bold tracking-wider uppercase">
                  <WalletCards className="h-4 w-4" />
                  Money Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 grid grid-cols-3 gap-3">
                <div className="bg-black/10 dark:bg-black/25 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Income</p>
                  <p className="font-bold text-base text-white mt-1">{formatMoney(income, currencySymbol)}</p>
                </div>
                <div className="bg-black/10 dark:bg-black/25 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Expenses</p>
                  <p className="font-bold text-base text-white mt-1">{formatMoney(expenses, currencySymbol)}</p>
                </div>
                <div className="bg-black/10 dark:bg-black/25 p-3 rounded-xl border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Net</p>
                  <p className="font-bold text-base text-white mt-1">{formatMoney(income - expenses, currencySymbol)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shared Priority Notepad (Glassmorphic) */}
          <Card className="lg:col-span-5 border border-white/25 dark:border-white/10 bg-white/25 dark:bg-black/35 backdrop-blur-xl p-5 shadow-2xl text-white dark:text-dark-text flex flex-col justify-between h-full transition-all duration-300 rounded-2xl">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="flex items-center gap-2 text-white dark:text-dark-text drop-shadow-sm text-sm font-bold tracking-wider uppercase">
                <ListTodo className="h-4 w-4 text-primary" />
                Shared Priority List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col gap-3">
              <Textarea
                className="flex-1 min-h-[150px] lg:min-h-[180px] resize-none rounded-xl border border-white/15 dark:border-white/10 bg-black/10 dark:bg-black/25 p-3 text-sm text-white placeholder-white/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
                placeholder="Write down the shared priorities here..."
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  setIsEditing(true);
                }}
                onBlur={handleBlur}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/70 font-semibold truncate max-w-[200px]">
                  {isSaving ? "Saving..." : parsedPriority.updatedBy ? `Edited by ${parsedPriority.updatedBy} on ${parsedPriority.updatedAt}` : "Not edited yet"}
                </span>
                <Button size="sm" variant="outline" className="rounded-xl px-4 border-white/20 bg-white/10 text-white hover:bg-white/25 hover:text-white" onClick={handleSave} disabled={isSaving}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scattered Sticky Notes Section */}
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-wider text-white uppercase drop-shadow-sm flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Sticky Notes
            </h2>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleCreateNote}
              className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/25 hover:text-white flex items-center gap-1 text-xs font-semibold px-3 py-1 shadow"
            >
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          </div>

          {/* Sticky Notes Grid */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {notes.map((item, idx) => {
              const isCreator = item.author === activeUserName;
              const postItColors = {
                Yellow: "bg-amber-100/35 border-amber-300/30 text-amber-50 dark:bg-amber-955/30 dark:border-amber-900/40 dark:text-amber-250",
                Blue: "bg-blue-100/35 border-blue-300/30 text-blue-50 dark:bg-blue-955/30 dark:border-blue-900/40 dark:text-blue-250",
                Green: "bg-emerald-100/35 border-emerald-300/30 text-emerald-50 dark:bg-emerald-955/30 dark:border-emerald-900/40 dark:text-emerald-250",
                Pink: "bg-pink-100/35 border-pink-300/30 text-pink-50 dark:bg-pink-955/30 dark:border-pink-900/40 dark:text-pink-250"
              };
              
              const tilts = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2"];
              const tiltClass = tilts[idx % tilts.length];

              return (
                <div 
                  key={item.id} 
                  className={cn(
                    "relative min-h-[220px] rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 hover:rotate-0 hover:scale-102 hover:shadow-2xl flex flex-col justify-between",
                    postItColors[item.color as keyof typeof postItColors] ?? "bg-white/20 border-white/25 text-white",
                    tiltClass
                  )}
                >
                  {item.pinned && (
                    <div className="absolute -top-2.5 right-3 text-base filter drop-shadow-md" title="Pinned">📌</div>
                  )}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Input
                      className="border-transparent dark:border-transparent bg-transparent dark:bg-transparent px-0 text-sm font-bold shadow-none focus-visible:ring-0 w-full text-white dark:text-inherit"
                      value={item.title}
                      onChange={(e) => {
                        const updatedVal = e.target.value;
                        stickyNotes.update(item.id, { title: updatedVal });
                      }}
                      readOnly={!isCreator}
                    />
                    {isCreator && (
                      <div className="flex shrink-0 gap-1 opacity-60 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                          title={item.is_private ? "Make Public" : "Make Private"}
                          onClick={() => stickyNotes.update(item.id, { is_private: !item.is_private })}
                        >
                          {item.is_private ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                          title={item.pinned ? "Unpin" : "Pin"}
                          onClick={() => stickyNotes.update(item.id, { pinned: !item.pinned })}
                        >
                          <Pin className={cn("h-3 w-3", item.pinned ? "fill-current" : "")} />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                          onClick={() => setDeletingNote(item)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-xs leading-relaxed text-white/95 pr-1">
                    <AutosaveTextarea
                      value={item.body}
                      onSave={(body) => {
                        stickyNotes.update(item.id, { body });
                      }}
                      minHeight={100}
                      readOnly={!isCreator}
                      className="border-transparent dark:border-transparent bg-transparent dark:bg-transparent p-0 shadow-none focus-visible:ring-0 text-inherit dark:text-inherit resize-none w-full text-xs"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-white/80 border-t border-white/10 pt-2 shrink-0">
                    <span className="flex items-center gap-1.5 font-semibold min-w-0 flex-1 truncate">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.author === user1 ? userColors.user1 : userColors.user2 }}
                      />
                      <span className="truncate">{item.author}</span>
                    </span>
                    {item.is_private && (
                      <span className="flex items-center gap-0.5 text-[8px] text-amber-300 bg-amber-955/65 px-1.5 py-0.5 rounded font-bold border border-amber-900/40 shrink-0 mx-1">
                        <Lock className="h-2 w-2" />
                        Private
                      </span>
                    )}
                    <button
                      onClick={() => stickyNotes.update(item.id, { read: !item.read })}
                      className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-white/10 shrink-0", item.read ? "opacity-60" : "font-bold text-white")}
                    >
                      {item.read ? "Read" : "Unread"}
                    </button>
                  </div>
                </div>
              );
            })}
            {!notes.length ? (
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
                <div className="py-12 rounded-2xl border border-dashed border-white/20 bg-white/10 dark:bg-black/15 backdrop-blur-md flex flex-col items-center justify-center text-white/70 shadow-lg">
                  <StickyNote className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">No sticky notes created yet.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* BOTTOM macOS-STYLE DOCK */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-max max-w-[95%] animate-in slide-in-from-bottom-5 duration-500">
        <div className="relative flex items-center gap-3 bg-white/15 dark:bg-black/35 border border-white/15 dark:border-white/5 backdrop-blur-xl shadow-2xl rounded-2xl px-4 py-2">
          
          <Link href="/vault" className="flex flex-col items-center group relative hover:-translate-y-1 transition-transform">
            <div className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 transition-colors shadow">
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Vault</span>
          </Link>

          <Link href="/tasks" className="flex flex-col items-center group relative hover:-translate-y-1 transition-transform">
            <div className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 transition-colors shadow">
              <ListTodo className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Tasks</span>
          </Link>

          <Link href="/timetable" className="flex flex-col items-center group relative hover:-translate-y-1 transition-transform">
            <div className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 transition-colors shadow">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Schedule</span>
          </Link>

          <Link href="/pomodoro" className="flex flex-col items-center group relative hover:-translate-y-1 transition-transform">
            <div className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 transition-colors shadow">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Focus</span>
          </Link>

          <Link href="/money" className="flex flex-col items-center group relative hover:-translate-y-1 transition-transform">
            <div className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 transition-colors shadow">
              <WalletCards className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Finance</span>
          </Link>

          <div className="h-6 w-px bg-white/20" />

          {/* Wallpaper selector trigger */}
          <div className="relative">
            <button 
              onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
              className={cn(
                "p-2.5 rounded-xl border transition-colors shadow relative flex flex-col items-center group hover:-translate-y-1",
                showWallpaperPicker ? "bg-white/25 border-white/30" : "bg-white/10 dark:bg-white/5 border-white/10 hover:bg-white/20"
              )}
            >
              <Laptop className="h-5 w-5 text-white" />
              <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Wallpaper</span>
            </button>

            {showWallpaperPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-48 rounded-xl border border-white/20 bg-slate-900/90 dark:bg-black/90 backdrop-blur-xl p-3 shadow-2xl flex flex-col gap-2 z-50 animate-in slide-in-from-bottom-2 duration-150">
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

          <button 
            onClick={handleCreateNote}
            className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 transition-colors shadow relative flex flex-col items-center group hover:-translate-y-1"
          >
            <Plus className="h-5 w-5 text-white" />
            <span className="absolute -top-8 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">Add Note</span>
          </button>

        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletingNote)}
        onOpenChange={(open) => !open && setDeletingNote(null)}
        title="Delete Sticky Note?"
        description="Are you sure you want to delete this sticky note?"
        onConfirm={() => {
          if (deletingNote) {
            stickyNotes.remove(deletingNote.id);
          }
        }}
      />
    </div>
  );
}
