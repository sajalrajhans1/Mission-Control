"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Bell, CheckCheck, Trash2, Inbox } from "lucide-react";
import { useData, useActiveUser } from "@/components/data-provider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 0) return "Just now"; // Handle slight clock offsets
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

export function NotificationsMenu() {
  const { notifications } = useData();
  const { activeUser } = useActiveUser();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter notifications intended for the active user
  const myNotifications = useMemo(() => {
    if (!activeUser) return [];
    return notifications.rows.filter((n) => n.for_user === activeUser);
  }, [notifications.rows, activeUser]);

  const unreadCount = useMemo(() => {
    return myNotifications.filter((n) => !n.read).length;
  }, [myNotifications]);

  // Toggle dropdown
  const toggleOpen = () => setIsOpen((prev) => !prev);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Actions
  const markAsRead = async (id: string) => {
    await notifications.update(id, { read: true });
  };

  const markAllAsRead = async () => {
    if (!supabase || !activeUser) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("notifications")
        .update({ read: true })
        .eq("for_user", activeUser)
        .eq("read", false);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering markAsRead on item click
    await notifications.remove(id);
  };

  const clearAll = async () => {
    if (!supabase || !activeUser) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("notifications")
        .delete()
        .eq("for_user", activeUser);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleOpen}
        className={cn(
          "relative h-9 w-9 rounded-xl text-zinc-600 hover:text-zinc-900 transition-colors",
          isOpen && "bg-zinc-100 text-zinc-955"
        )}
        title="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-4 py-3">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {myNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                className={cn(
                  "group relative flex gap-3 p-4 text-left cursor-pointer transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40",
                  !n.read && "bg-indigo-50/10 hover:bg-indigo-50/20"
                )}
              >
                {/* Status Dot */}
                <div className="flex pt-1 shrink-0">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      n.read ? "bg-transparent" : "bg-indigo-600 animate-pulse"
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className={cn("text-xs font-semibold text-zinc-900 dark:text-zinc-100", !n.read && "font-bold")}>
                    {n.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-normal break-words">
                    {n.body}
                  </p>
                  <p className="mt-1.5 text-[10px] text-zinc-400 font-medium">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>

                {/* Delete Button (visible on hover) */}
                <button
                  onClick={(e) => deleteNotification(n.id, e)}
                  className="absolute right-3 top-4 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-900/40 hover:bg-red-50/40 dark:hover:bg-red-950/20 shadow-soft transition-all"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {myNotifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900 text-zinc-400">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200">All caught up!</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No new notifications here.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {myNotifications.length > 0 && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/30 px-4 py-2 flex justify-end">
              <button
                onClick={clearAll}
                className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 py-1 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
