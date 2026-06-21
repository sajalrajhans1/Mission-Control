"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Plus,
  Check,
  X,
  AlertCircle,
  Lock,
  Unlock,
  Link2,
  Link2Off,
  Compass,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useData, useUserNames, useUserColors } from "@/components/data-provider";
import { todayISO, cn } from "@/lib/utils";

const subFilters = ["All", "Today", "Upcoming", "Completed"] as const;

// Hex to RGB parser helper for glassmorphism project-colored cards
const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return { r: 99, g: 102, b: 241 }; // Default Indigo
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
};

export default function TasksPage() {
  const {
    tasks,
    projects,
    taskCardPositions,
    taskCardConnections,
    activeUserName,
    activeUser,
    sendNotification
  } = useData();

  const { user1, user2 } = useUserNames();
  const userColors = useUserColors();

  // Space tabs (assignee filter)
  const [activeSpace, setActiveSpace] = useState<"user1" | "user2" | "collab">("user1");
  const [subFilter, setSubFilter] = useState<(typeof subFilters)[number]>("All");

  // Canvas Viewport Panning State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Card dragging state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cardPositionsLocal, setCardPositionsLocal] = useState<Record<string, { x: number; y: number }>>({});

  // Dynamic Card Heights (for accurate SVG connection sockets positioning)
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  // Active Connection line drawing state
  const [activeLine, setActiveLine] = useState<{
    sourceId: string;
    side: "left" | "right";
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  // Task creation local titles mapped by card/project ID
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLDivElement>(null);
  const today = todayISO();
  const activeProjects = projects.rows.filter((p) => !p.archived);

  // Sync default assignee tab with active user
  useEffect(() => {
    if (activeUser === "user2") {
      setActiveSpace("user2");
    } else {
      setActiveSpace("user1");
    }
  }, [activeUser]);

  const targetAssigneeName = useMemo(() => {
    if (activeSpace === "user1") return user1;
    if (activeSpace === "user2") return user2;
    return "Both";
  }, [activeSpace, user1, user2]);

  // Check if database tables are not loaded or missing (migration warning)
  const migrationRequired = Boolean(taskCardPositions.error || taskCardConnections.error);

  // Group all visible cards (General + Projects)
  const allVisibleCards = useMemo(() => {
    const list = [
      { id: "general", name: "General Tasks", color: "#475569", isPrivate: false, createdBy: "" }
    ];
    activeProjects.forEach((p) => {
      list.push({
        id: p.id,
        name: p.name,
        color: p.color || "#6366f1",
        isPrivate: p.is_private,
        createdBy: p.created_by || ""
      });
    });
    return list;
  }, [activeProjects]);

  // Compute card positions (merges Supabase data, local drag states, and a default grid layout)
  const getCardPosition = (cardId: string) => {
    if (cardPositionsLocal[cardId]) {
      return cardPositionsLocal[cardId];
    }
    const dbRow = taskCardPositions.rows.find((p) => p.card_id === cardId);
    if (dbRow) {
      return { x: Number(dbRow.x), y: Number(dbRow.y) };
    }
    // Default position distributed horizontally
    const index = allVisibleCards.findIndex((c) => c.id === cardId);
    const cols = 3;
    const colWidth = 380;
    const rowHeight = 480;
    const c = index >= 0 ? index % cols : 0;
    const r = index >= 0 ? Math.floor(index / cols) : 0;
    return { x: 100 + c * colWidth, y: 100 + r * rowHeight };
  };

  // Determine card height
  const getSocketCoords = (cardId: string, side: "left" | "right") => {
    const pos = getCardPosition(cardId);
    const h = cardHeights[cardId] || 250;
    return {
      x: side === "left" ? pos.x : pos.x + 320,
      y: pos.y + h / 2
    };
  };

  // Compute Connected Groups in JS
  const groups = useMemo(() => {
    const parent: Record<string, string> = {};
    allVisibleCards.forEach((c) => {
      parent[c.id] = c.id;
    });

    const find = (i: string): string => {
      if (parent[i] === i) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    };

    const union = (i: string, j: string) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootI] = rootJ;
      }
    };

    taskCardConnections.rows.forEach((conn) => {
      if (parent[conn.source_id] && parent[conn.target_id]) {
        union(conn.source_id, conn.target_id);
      }
    });

    const cardGroups: Record<string, string[]> = {};
    allVisibleCards.forEach((c) => {
      const root = find(c.id);
      if (!cardGroups[root]) cardGroups[root] = [];
      cardGroups[root].push(c.id);
    });

    return Object.values(cardGroups).filter((g) => g.length > 1);
  }, [allVisibleCards, taskCardConnections.rows]);

  const getCardGroupInfo = (cardId: string) => {
    const groupIdx = groups.findIndex((g) => g.includes(cardId));
    if (groupIdx === -1) return null;
    const groupCards = groups[groupIdx];
    // Check if any connection inside this group is private
    const hasPrivateConnection = taskCardConnections.rows.some(
      (conn) =>
        groupCards.includes(conn.source_id) &&
        groupCards.includes(conn.target_id) &&
        conn.is_private
    );
    return {
      index: groupIdx + 1,
      size: groupCards.length,
      cards: groupCards,
      isPrivate: hasPrivateConnection
    };
  };

  // Task requests & approval metrics
  const approvedTasks = useMemo(() => {
    const target = (targetAssigneeName || "").trim().toLowerCase();
    return tasks.rows.filter(
      (task) =>
        (task.assigned_to || "").trim().toLowerCase() === target && task.approved !== false
    );
  }, [tasks.rows, targetAssigneeName]);

  const filteredTasks = useMemo(() => {
    return approvedTasks.filter((task) => {
      if (subFilter === "Today") return !task.completed && task.due_date === today;
      if (subFilter === "Upcoming") return !task.completed && Boolean(task.due_date && task.due_date > today);
      if (subFilter === "Completed") return task.completed;
      return !task.completed; // All active tasks
    });
  }, [subFilter, approvedTasks, today]);

  const incomingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || (activeUserName || "").trim().toLowerCase() !== spaceUser.trim().toLowerCase()) return [];
    return tasks.rows.filter(
      (task) =>
        (task.assigned_to || "").trim().toLowerCase() === spaceUser.trim().toLowerCase() &&
        task.approved === false
    );
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  const pendingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || (activeUserName || "").trim().toLowerCase() === spaceUser.trim().toLowerCase()) return [];
    return tasks.rows.filter(
      (task) =>
        (task.assigned_to || "").trim().toLowerCase() === spaceUser.trim().toLowerCase() &&
        task.approved === false &&
        (task.created_by || "").trim().toLowerCase() === (activeUserName || "").trim().toLowerCase()
    );
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  // Card/Project theme styles builder
  const getCardTheme = (colorStr: string) => {
    const rgb = hexToRgb(colorStr);
    return {
      accent: colorStr,
      border: colorStr,
      bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.02)`,
      headerBg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
      glow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
    };
  };

  // Canvas Panning Operations
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (activeLine) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const curX = Math.round(e.clientX - rect.left - pan.x);
        const curY = Math.round(e.clientY - rect.top - pan.y);
        setActiveLine((prev) => (prev ? { ...prev, curX, curY } : null));
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      const target = e.currentTarget as HTMLElement;
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {}
    } else if (activeLine) {
      handleSocketPointerUp(e);
    }
  };

  // Card Dragging Operations
  const handleCardDragStart = (cardId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const pos = getCardPosition(cardId);
    setDraggedCardId(cardId);
    setDragStart({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleCardDragMove = (cardId: string, e: React.PointerEvent) => {
    if (draggedCardId !== cardId) return;
    e.stopPropagation();
    const newX = Math.round(e.clientX - dragStart.x);
    const newY = Math.round(e.clientY - dragStart.y);
    setCardPositionsLocal((prev) => ({
      ...prev,
      [cardId]: { x: newX, y: newY }
    }));
  };

  const handleCardDragEnd = async (cardId: string, e: React.PointerEvent) => {
    if (draggedCardId !== cardId) return;
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {}

    setDraggedCardId(null);
    const local = cardPositionsLocal[cardId];
    if (local) {
      const existing = taskCardPositions.rows.find((p) => p.card_id === cardId);
      if (existing) {
        await taskCardPositions.update(existing.id, {
          x: local.x,
          y: local.y
        });
      } else {
        await taskCardPositions.create({
          card_id: cardId,
          x: local.x,
          y: local.y,
          is_private: false,
          created_by: activeUser || "user1"
        });
      }
    }
  };

  // Node Connections Operations
  const handleSocketPointerDown = (
    cardId: string,
    side: "left" | "right",
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    const pos = getCardPosition(cardId);
    const h = cardHeights[cardId] || 250;
    const startX = side === "left" ? pos.x : pos.x + 320;
    const startY = pos.y + h / 2;

    setActiveLine({
      sourceId: cardId,
      side,
      startX,
      startY,
      curX: startX,
      curY: startY
    });

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  };

  const handleSocketPointerUp = async (e: React.PointerEvent) => {
    if (!activeLine) return;
    const clientX = e.clientX;
    const clientY = e.clientY;

    const hoveredCard = allVisibleCards.find((card) => {
      const el = document.getElementById(`card-${card.id}`);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom &&
        card.id !== activeLine.sourceId
      );
    });

    if (hoveredCard) {
      // Connect in alphabetical order to avoid duplicate paths
      const sorted = [activeLine.sourceId, hoveredCard.id].sort();
      const source = sorted[0];
      const targetCard = sorted[1];

      const exists = taskCardConnections.rows.some(
        (c) => c.source_id === source && c.target_id === targetCard
      );

      if (!exists) {
        await taskCardConnections.create({
          source_id: source,
          target_id: targetCard,
          is_private: false,
          created_by: activeUser || "user1"
        });
      }
    }

    setActiveLine(null);
  };

  // Remove single connection
  const handleDisconnect = async (id: string) => {
    await taskCardConnections.remove(id);
  };

  // Reset positions of all cards to defaults
  const handleResetPositions = async () => {
    for (const pos of taskCardPositions.rows) {
      await taskCardPositions.remove(pos.card_id);
    }
    setCardPositionsLocal({});
  };

  // Disconnect all lines from a single card
  const handleDisconnectCard = async (cardId: string) => {
    const cardConns = taskCardConnections.rows.filter(
      (c) => c.source_id === cardId || c.target_id === cardId
    );
    for (const c of cardConns) {
      await taskCardConnections.remove(c.id);
    }
  };

  // Card/Project privacy toggle
  const toggleCardPrivacy = async (cardId: string, currentPrivate: boolean) => {
    if (cardId === "general") {
      const existing = taskCardPositions.rows.find((p) => p.card_id === "general");
      if (existing) {
        await taskCardPositions.update(existing.id, { is_private: !currentPrivate });
      } else {
        await taskCardPositions.create({
          card_id: "general",
          x: 100,
          y: 100,
          is_private: !currentPrivate,
          created_by: activeUser || "user1"
        });
      }
    } else {
      await projects.update(cardId, { is_private: !currentPrivate });
    }
  };

  // Toggle privacy of an entire connected group (all connection links inside it)
  const handleToggleGroupPrivacy = async (cardId: string, makePrivate: boolean) => {
    const groupInfo = getCardGroupInfo(cardId);
    if (!groupInfo) return;
    const groupCards = groupInfo.cards;

    const groupConns = taskCardConnections.rows.filter(
      (c) => groupCards.includes(c.source_id) && groupCards.includes(c.target_id)
    );

    for (const c of groupConns) {
      await taskCardConnections.update(c.id, { is_private: makePrivate });
    }
  };

  // Task-level additions
  const handleCreateTask = async (cardId: string) => {
    const title = taskTitles[cardId] || "";
    if (!title.trim()) return;

    const approved = targetAssigneeName === "Both" || targetAssigneeName === activeUserName;

    await tasks.create({
      title: title.trim(),
      note: "",
      assigned_to: targetAssigneeName || "Both",
      priority: "Medium",
      project_id: cardId === "general" ? null : cardId,
      due_date: todayISO(),
      completed_user1: false,
      completed_user2: false,
      created_by: activeUserName || "Unknown",
      approved,
      is_private: false
    });

    setTaskTitles((prev) => ({ ...prev, [cardId]: "" }));
  };

  // Task action triggers: toggle privacy, cycle priority
  const handleToggleTaskPrivacy = async (taskId: string, currentPrivate: boolean) => {
    await tasks.update(taskId, { is_private: !currentPrivate });
  };

  const handleCyclePriority = async (taskId: string, currentPriority: "Low" | "Medium" | "High") => {
    const priorities: ("Low" | "Medium" | "High")[] = ["Low", "Medium", "High"];
    const nextIdx = (priorities.indexOf(currentPriority) + 1) % priorities.length;
    await tasks.update(taskId, { priority: priorities[nextIdx] });
  };

  // Center canvas on contents
  const handleRecenterCanvas = () => {
    setPan({ x: 0, y: 0 });
  };

  if (migrationRequired) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-3xl gap-4 max-w-xl mx-auto mt-12">
        <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-500 animate-pulse" />
        <h2 className="text-xl font-bold text-amber-900 dark:text-amber-300">Database Upgrade Required</h2>
        <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
          The interactive canvas features require new schema columns. Please copy the SQL migration contents of{" "}
          <code className="bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded font-mono text-xs text-amber-800 dark:text-amber-300">
            supabase/migrations/016_tasks_canvas.sql
          </code>{" "}
          and execute them inside your Supabase SQL Editor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Tasks Canvas</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Drag cards, draw visual node links, and organize your cooperative milestone groups.
          </p>
        </div>

        {/* Level 1: Sub-Navigation Assignee Tab Bar (Premium capsule design) */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-full border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm self-start">
          <button
            onClick={() => setActiveSpace("user1")}
            className={cn(
              "py-1.5 px-4 font-semibold text-xs rounded-full transition-all duration-200",
              activeSpace === "user1"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            {user1}&apos;s Tasks
          </button>
          <button
            onClick={() => setActiveSpace("user2")}
            className={cn(
              "py-1.5 px-4 font-semibold text-xs rounded-full transition-all duration-200",
              activeSpace === "user2"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            {user2}&apos;s Tasks
          </button>
          <button
            onClick={() => setActiveSpace("collab")}
            className={cn(
              "py-1.5 px-4 font-semibold text-xs rounded-full transition-all duration-200",
              activeSpace === "collab"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            Collaborative
          </button>
        </div>
      </div>

      {/* Task Approvals Notification Panel */}
      {incomingRequests.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10 shadow-sm">
          <CardContent className="p-4 flex flex-col gap-3">
            <h3 className="text-amber-800 dark:text-amber-400 text-sm font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Incoming Task Requests ({incomingRequests.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {incomingRequests.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-zinc-900/60 shadow-sm text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{task.title}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Assigned by {task.created_by}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]"
                      onClick={async () => {
                        await tasks.update(task.id, { approved: true });
                        const otherUserKey = activeUser === "user1" ? "user2" : "user1";
                        sendNotification(otherUserKey, "Task Request Approved", `${activeUserName} approved your task: ${task.title}`);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 rounded-lg border-red-200 text-red-700 hover:bg-red-50 text-[10px]"
                      onClick={() => tasks.remove(task.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingRequests.length > 0 && (
        <Card className="border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 shadow-sm">
          <CardContent className="p-4 flex flex-col gap-2.5">
            <h3 className="text-zinc-700 dark:text-zinc-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-zinc-500" />
              Sent Tasks Awaiting Approval ({pendingRequests.length})
            </h3>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-zinc-900/60 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{task.title}</span>
                    {task.note && <span className="italic text-muted-foreground ml-2">• Note: {task.note}</span>}
                  </div>
                  <span className="text-zinc-500 italic font-medium">Awaiting {activeSpace === "user1" ? user2 : user1}&apos;s approval</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Level 2: Sub-Filters Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {subFilters.map((item) => (
            <Button
              key={item}
              variant={subFilter === item ? "default" : "outline"}
              onClick={() => setSubFilter(item)}
              className="rounded-full border-zinc-200/80 text-xs px-4 h-8"
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRecenterCanvas}
            title="Recenter Grid View"
            className="h-8 w-8 rounded-full"
          >
            <Compass className="h-4 w-4 text-zinc-500" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleResetPositions}
            title="Reset All Card Coordinates"
            className="h-8 w-8 rounded-full"
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" />
          </Button>
        </div>
      </div>

      {/* INFINITE DRAGGABLE CANVAS VIEWER */}
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        className={cn(
          "relative overflow-hidden w-full h-[660px] border border-zinc-200 dark:border-zinc-800 rounded-3xl select-none shadow-inner",
          "bg-[radial-gradient(circle,#e4e4e7_1px,transparent_1px)] dark:bg-[radial-gradient(circle,#27272a_1px,transparent_1px)] bg-[size:30px_30px]",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {/* SVG connection lines overlay */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <g transform={`translate(${pan.x}, ${pan.y})`}>
            {/* Draw existing visual connections */}
            {taskCardConnections.rows.map((conn) => {
              // Ensure both cards are visible in the layout
              const hasSource = allVisibleCards.some((c) => c.id === conn.source_id);
              const hasTarget = allVisibleCards.some((c) => c.id === conn.target_id);
              if (!hasSource || !hasTarget) return null;

              const posSource = getCardPosition(conn.source_id);
              const posTarget = getCardPosition(conn.target_id);

              const leftCardId = posSource.x < posTarget.x ? conn.source_id : conn.target_id;
              const rightCardId = posSource.x < posTarget.x ? conn.target_id : conn.source_id;

              const p1 = getSocketCoords(leftCardId, "right");
              const p2 = getSocketCoords(rightCardId, "left");

              // Compute nice Bezier curve path
              const dx = Math.max(60, Math.abs(p2.x - p1.x) * 0.4);
              const pathData = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

              // Midpoint of curve for deletion indicator button
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;

              return (
                <g key={conn.id} className="group pointer-events-auto">
                  {/* Glowing background line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={conn.is_private ? "#fb7185" : "#a1a1aa"}
                    strokeWidth={4}
                    className="opacity-10 group-hover:opacity-40 transition-opacity cursor-pointer"
                  />
                  {/* Solid bezier curve string */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={conn.is_private ? "#f43f5e" : "#64748b"}
                    strokeWidth={2}
                    strokeDasharray={conn.is_private ? "5,5" : undefined}
                    className="transition-all"
                  />
                  {/* Delete button foreignObject */}
                  <foreignObject
                    x={mx - 10}
                    y={my - 10}
                    width={20}
                    height={20}
                    className="overflow-visible pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      onClick={() => handleDisconnect(conn.id)}
                      className="flex items-center justify-center w-5 h-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-full shadow hover:scale-110 transition-transform"
                      title="Remove Connection Line"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </foreignObject>
                </g>
              );
            })}

            {/* Active temporary dragging connection line */}
            {activeLine && (
              <path
                d={`M ${activeLine.startX} ${activeLine.startY} C ${
                  activeLine.startX + (activeLine.side === "right" ? 80 : -80)
                } ${activeLine.startY}, ${
                  activeLine.curX + (activeLine.side === "right" ? -80 : 80)
                } ${activeLine.curY}, ${activeLine.curX} ${activeLine.curY}`}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2.5}
                strokeDasharray="4,4"
                className="animate-pulse"
              />
            )}
          </g>
        </svg>

        {/* Viewport transform coordinates space */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          {allVisibleCards.map((card) => {
            const pos = getCardPosition(card.id);
            const isGeneral = card.id === "general";
            const cardTheme = getCardTheme(card.color);
            const groupInfo = getCardGroupInfo(card.id);

            // Filter tasks assigned to this project card
            const cardTasks = filteredTasks.filter((t) =>
              isGeneral ? t.project_id === null : t.project_id === card.id
            );

            // Card position coordinates
            return (
              <div
                key={card.id}
                id={`card-${card.id}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: 320,
                  borderColor: cardTheme.border,
                  boxShadow: `0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 16px ${cardTheme.glow}`
                }}
                ref={(el) => {
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    if (cardHeights[card.id] !== rect.height) {
                      setCardHeights((prev) => ({ ...prev, [card.id]: rect.height }));
                    }
                  }
                }}
                className={cn(
                  "absolute pointer-events-auto flex flex-col rounded-2xl border bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-shadow select-none",
                  draggedCardId === card.id && "shadow-2xl z-50 ring-2 ring-zinc-400/50"
                )}
              >
                {/* Visual Connection Sockets (Left/Right margins) */}
                <button
                  onPointerDown={(e) => handleSocketPointerDown(card.id, "left", e)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2.5 w-5 h-5 bg-zinc-200 hover:bg-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-600 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm z-30 transition-transform active:scale-95 cursor-crosshair"
                  title="Link from left"
                />
                <button
                  onPointerDown={(e) => handleSocketPointerDown(card.id, "right", e)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2.5 w-5 h-5 bg-zinc-200 hover:bg-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-600 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm z-30 transition-transform active:scale-95 cursor-crosshair"
                  title="Link from right"
                />

                {/* Card Header (Drag Handle) */}
                <div
                  onPointerDown={(e) => handleCardDragStart(card.id, e)}
                  onPointerMove={(e) => handleCardDragMove(card.id, e)}
                  onPointerUp={(e) => handleCardDragEnd(card.id, e)}
                  style={{ backgroundColor: cardTheme.headerBg }}
                  className="flex items-center justify-between p-3.5 border-b rounded-t-2xl cursor-grab active:cursor-grabbing border-zinc-200/80 dark:border-zinc-800"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 truncate flex items-center gap-1.5">
                      {!isGeneral && card.isPrivate && <Lock className="h-3 w-3 text-red-500 shrink-0" />}
                      {card.name}
                    </span>
                    {groupInfo && (
                      <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                        <Link2 className="h-3 w-3 shrink-0" />
                        Group {groupInfo.index} ({groupInfo.size} cards)
                        {groupInfo.isPrivate && <Lock className="h-2.5 w-2.5 text-rose-500 shrink-0" />}
                      </span>
                    )}
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                    {/* Project/Card Privacy Toggle */}
                    {!isGeneral && (
                      <button
                        onClick={() => toggleCardPrivacy(card.id, card.isPrivate)}
                        className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-700"
                        title={card.isPrivate ? "Make Project Public" : "Make Project Private"}
                      >
                        {card.isPrivate ? (
                          <Lock className="h-3.5 w-3.5 text-rose-500" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    {/* Group Privacy Toggle */}
                    {groupInfo && (
                      <button
                        onClick={() => handleToggleGroupPrivacy(card.id, !groupInfo.isPrivate)}
                        className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors"
                        title={groupInfo.isPrivate ? "Make Group Public" : "Make Group Private"}
                      >
                        {groupInfo.isPrivate ? (
                          <EyeOff className="h-3.5 w-3.5 text-rose-500" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-700" />
                        )}
                      </button>
                    )}

                    {/* Disconnect links */}
                    {groupInfo && (
                      <button
                        onClick={() => handleDisconnectCard(card.id)}
                        className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-red-500"
                        title="Disconnect Card from Group"
                      >
                        <Link2Off className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Content - Tasks list */}
                <div className="p-3.5 flex flex-col gap-3 min-h-[140px] max-h-[280px] overflow-y-auto scrollbar-sleek bg-white/40 dark:bg-zinc-900/40">
                  {cardTasks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {cardTasks.map((task) => {
                        const isBoth = (task.assigned_to || "").trim().toLowerCase() === "both";
                        const assignedColor = task.assigned_to === user1 ? userColors.user1 : userColors.user2;

                        return (
                          <div
                            key={task.id}
                            className="group/task flex items-center justify-between gap-2.5 p-2 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-shadow text-xs"
                          >
                            {/* Checkbox(es) */}
                            {isBoth ? (
                              <div className="flex gap-1 shrink-0">
                                {/* User 1 Checkbox */}
                                <button
                                  disabled={activeUser !== "user1"}
                                  onClick={async () => {
                                    const nextVal = !task.completed_user1;
                                    await tasks.update(task.id, {
                                      completed_user1: nextVal,
                                      completed: nextVal && task.completed_user2
                                    });
                                    if (nextVal) {
                                      sendNotification("user2", "Task Component Done", `${user1} completed their part of: ${task.title}`);
                                    }
                                  }}
                                  className={cn(
                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all",
                                    activeUser !== "user1" && "opacity-50 cursor-not-allowed"
                                  )}
                                  style={{
                                    borderColor: userColors.user1,
                                    backgroundColor: task.completed_user1 ? userColors.user1 : "transparent",
                                    color: task.completed_user1 ? "#ffffff" : userColors.user1
                                  }}
                                  title={`${user1}: ${task.completed_user1 ? "Done" : "Pending"}`}
                                >
                                  {task.completed_user1 ? (
                                    <Check className="h-2.5 w-2.5 text-white" />
                                  ) : (
                                    user1.slice(0, 1)
                                  )}
                                </button>
                                {/* User 2 Checkbox */}
                                <button
                                  disabled={activeUser !== "user2"}
                                  onClick={async () => {
                                    const nextVal = !task.completed_user2;
                                    await tasks.update(task.id, {
                                      completed_user2: nextVal,
                                      completed: task.completed_user1 && nextVal
                                    });
                                    if (nextVal) {
                                      sendNotification("user1", "Task Component Done", `${user2} completed their part of: ${task.title}`);
                                    }
                                  }}
                                  className={cn(
                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all",
                                    activeUser !== "user2" && "opacity-50 cursor-not-allowed"
                                  )}
                                  style={{
                                    borderColor: userColors.user2,
                                    backgroundColor: task.completed_user2 ? userColors.user2 : "transparent",
                                    color: task.completed_user2 ? "#ffffff" : userColors.user2
                                  }}
                                  title={`${user2}: ${task.completed_user2 ? "Done" : "Pending"}`}
                                >
                                  {task.completed_user2 ? (
                                    <Check className="h-2.5 w-2.5 text-white" />
                                  ) : (
                                    user2.slice(0, 1)
                                  )}
                                </button>
                              </div>
                            ) : (
                              /* Single User Checkbox */
                              <button
                                disabled={activeUserName !== task.assigned_to}
                                onClick={async () => {
                                  const nextVal = !task.completed;
                                  await tasks.update(task.id, { completed: nextVal });
                                  if (nextVal) {
                                    const otherUserKey = activeUser === "user1" ? "user2" : "user1";
                                    sendNotification(otherUserKey, "Task Completed", `${activeUserName} completed: ${task.title}`);
                                  }
                                }}
                                className={cn(
                                  "h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                                  activeUserName !== task.assigned_to && "opacity-50 cursor-not-allowed"
                                )}
                                style={{
                                  borderColor: assignedColor,
                                  backgroundColor: task.completed ? assignedColor : "transparent"
                                }}
                                title={activeUserName !== task.assigned_to ? `Only ${task.assigned_to} can complete this task` : undefined}
                              >
                                {task.completed && <Check className="h-3 w-3 text-white" />}
                              </button>
                            )}

                            {/* Title & note */}
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "font-medium text-zinc-900 dark:text-zinc-100 truncate",
                                  task.completed && "line-through text-zinc-400 dark:text-zinc-600"
                                )}
                              >
                                {task.title}
                              </p>
                              {task.note && (
                                <p className="text-[10px] text-zinc-400 truncate italic">
                                  {task.note}
                                </p>
                              )}
                            </div>

                            {/* Badges/Toggles */}
                            <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover/task:opacity-100 transition-opacity">
                              {/* Task Privacy padlock */}
                              <button
                                onClick={() => handleToggleTaskPrivacy(task.id, task.is_private)}
                                className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-700"
                                title={task.is_private ? "Private Task" : "Public Task"}
                              >
                                {task.is_private ? (
                                  <Lock className="h-3 w-3 text-rose-500" />
                                ) : (
                                  <Unlock className="h-3 w-3" />
                                )}
                              </button>

                              {/* Clickable priority cyclic switcher */}
                              <button
                                onClick={() => handleCyclePriority(task.id, task.priority)}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-bold transition-all border scale-90",
                                  task.priority === "High"
                                    ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400"
                                    : task.priority === "Medium"
                                    ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400"
                                    : "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-800/20 dark:text-zinc-400"
                                )}
                              >
                                {task.priority.slice(0, 1)}
                              </button>

                              {/* Task removal */}
                              <button
                                onClick={() => tasks.remove(task.id)}
                                className="p-0.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors text-zinc-400 hover:text-red-500"
                                title="Delete Task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 text-[11px] text-zinc-400">
                      <span>No tasks in this view</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Quick task addition field */}
                <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 rounded-b-2xl flex gap-1.5">
                  <Input
                    placeholder="Add task..."
                    value={taskTitles[card.id] || ""}
                    onChange={(e) =>
                      setTaskTitles((prev) => ({ ...prev, [card.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTask(card.id)}
                    className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200/80 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-400/40"
                  />
                  <Button
                    size="icon"
                    onClick={() => handleCreateTask(card.id)}
                    className="h-8 w-8 shrink-0 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
