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
  Calendar,
  Eye,
  EyeOff,
  ListTodo,
  Kanban,
  Workflow,
  User,
  Users,
  Grid,
  ChevronDown,
  ChevronRight,
  Tag,
  Search,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData, useUserNames, useUserColors } from "@/components/data-provider";
import { todayISO, cn } from "@/lib/utils";

const subFilters = ["All", "Today", "Upcoming", "Completed"] as const;

// Hex to RGB helper for glassmorphic project-colored card glows
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

interface TaskItem {
  id: string;
  title: string;
  assigned_to: string;
  project_id: string | null;
  priority: "Low" | "Medium" | "High";
  due_date: string | null;
  completed: boolean;
  completed_user1: boolean;
  completed_user2: boolean;
  created_by: string;
  note: string;
  approved: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

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

  // Navigation & Filtering States
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board" | "canvas">("list");
  const [activeSpace, setActiveSpace] = useState<"user1" | "user2" | "collab">("user1");
  const [subFilter, setSubFilter] = useState<(typeof subFilters)[number]>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Pane toggles
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // Canvas Viewport Panning State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Card dragging state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cardPositionsLocal, setCardPositionsLocal] = useState<Record<string, { x: number; y: number }>>({});
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

  // Collapsible groupings (List view)
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [collapsedPriorities, setCollapsedPriorities] = useState<Record<string, boolean>>({});

  // Selected Task for Details Inspector Dialog
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Inline Quick Add inputs mapped by key (project ID or column)
  const [inlineAddTitles, setInlineAddTitles] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLDivElement>(null);
  const today = todayISO();
  const activeProjects = projects.rows.filter((p) => !p.archived);

  // Sync default assignee tab with active user session
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

  // Group all visible cards (General + Projects) for Canvas
  const allVisibleCards = useMemo(() => {
    const list = [
      { id: "general", name: "General Tasks", color: "#64748b", isPrivate: false, createdBy: "" }
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
    const index = allVisibleCards.findIndex((c) => c.id === cardId);
    const cols = 3;
    const colWidth = 380;
    const rowHeight = 480;
    const c = index >= 0 ? index % cols : 0;
    const r = index >= 0 ? Math.floor(index / cols) : 0;
    return { x: 100 + c * colWidth, y: 100 + r * rowHeight };
  };

  const getSocketCoords = (cardId: string, side: "left" | "right") => {
    const pos = getCardPosition(cardId);
    const h = cardHeights[cardId] || 250;
    return {
      x: side === "left" ? pos.x : pos.x + 320,
      y: pos.y + h / 2
    };
  };

  // DSU groups calculation
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

  // Task filtering (assignee space & active navigation options)
  const filteredTasks = useMemo(() => {
    const target = (targetAssigneeName || "").trim().toLowerCase();

    return (tasks.rows as unknown as TaskItem[]).filter((task) => {
      // 1. Assignee space
      const isAssigneeMatch = (task.assigned_to || "").trim().toLowerCase() === target;
      if (!isAssigneeMatch) return false;

      // 2. Project selection
      if (selectedProjectId !== "all") {
        const isGeneral = selectedProjectId === "general";
        if (isGeneral && task.project_id !== null) return false;
        if (!isGeneral && task.project_id !== selectedProjectId) return false;
      }

      // 3. Date / Status filter
      if (subFilter === "Today") {
        if (task.completed || task.due_date !== today) return false;
      } else if (subFilter === "Upcoming") {
        if (task.completed || !task.due_date || task.due_date <= today) return false;
      } else if (subFilter === "Completed") {
        if (!task.completed) return false;
      } else {
        // "All" tab - show only uncompleted tasks
        if (task.completed) return false;
      }

      // 4. Search queries
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = (task.title || "").toLowerCase().includes(query);
        const matchesNote = (task.note || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesNote) return false;
      }

      return true;
    });
  }, [tasks.rows, targetAssigneeName, selectedProjectId, subFilter, today, searchQuery]);

  // Tasks awaiting approval / requests
  const incomingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || (activeUserName || "").trim().toLowerCase() !== spaceUser.trim().toLowerCase()) return [];
    return tasks.rows.filter(
      (task) =>
        (task.assigned_to || "").trim().toLowerCase() === spaceUser.trim().toLowerCase() &&
        task.approved === false
    ) as unknown as TaskItem[];
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  const pendingRequests = useMemo(() => {
    const spaceUser = activeSpace === "user1" ? user1 : activeSpace === "user2" ? user2 : null;
    if (!spaceUser || (activeUserName || "").trim().toLowerCase() === spaceUser.trim().toLowerCase()) return [];
    return tasks.rows.filter(
      (task) =>
        (task.assigned_to || "").trim().toLowerCase() === spaceUser.trim().toLowerCase() &&
        task.approved === false &&
        (task.created_by || "").trim().toLowerCase() === (activeUserName || "").trim().toLowerCase()
    ) as unknown as TaskItem[];
  }, [tasks.rows, activeSpace, activeUserName, user1, user2]);

  // Project color builder
  const getCardTheme = (colorStr: string) => {
    const rgb = hexToRgb(colorStr);
    return {
      accent: colorStr,
      border: colorStr,
      bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.03)`,
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
    let newX = Math.round(e.clientX - dragStart.x);
    let newY = Math.round(e.clientY - dragStart.y);

    if (snapToGrid) {
      newX = Math.round(newX / 20) * 20;
      newY = Math.round(newY / 20) * 20;
    }

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

  // Auto-align tidy layout
  const handleTidyLayout = async () => {
    const cols = 3;
    const colWidth = 380;
    const rowHeight = 480;

    for (let i = 0; i < allVisibleCards.length; i++) {
      const card = allVisibleCards[i];
      const c = i % cols;
      const r = Math.floor(i / cols);
      const targetX = 100 + c * colWidth;
      const targetY = 100 + r * rowHeight;

      const existing = taskCardPositions.rows.find((p) => p.card_id === card.id);
      if (existing) {
        await taskCardPositions.update(existing.id, { x: targetX, y: targetY });
      } else {
        await taskCardPositions.create({
          card_id: card.id,
          x: targetX,
          y: targetY,
          is_private: false,
          created_by: activeUser || "user1"
        });
      }
    }
    setCardPositionsLocal({});
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

  const handleDisconnect = async (id: string) => {
    await taskCardConnections.remove(id);
  };

  const handleResetPositions = async () => {
    for (const pos of taskCardPositions.rows) {
      await taskCardPositions.remove(pos.id);
    }
    setCardPositionsLocal({});
  };

  const handleDisconnectCard = async (cardId: string) => {
    const cardConns = taskCardConnections.rows.filter(
      (c) => c.source_id === cardId || c.target_id === cardId
    );
    for (const c of cardConns) {
      await taskCardConnections.remove(c.id);
    }
  };

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

  // Task creation
  const handleCreateTask = async (projId: string) => {
    const title = inlineAddTitles[projId] || "";
    if (!title.trim()) return;

    const approved = targetAssigneeName === "Both" || targetAssigneeName === activeUserName;
    const project_id = projId === "general" || projId === "all" ? null : projId;

    await tasks.create({
      title: title.trim(),
      note: "",
      assigned_to: targetAssigneeName || "Both",
      priority: "Medium",
      project_id,
      due_date: todayISO(),
      completed_user1: false,
      completed_user2: false,
      created_by: activeUserName || "Unknown",
      approved,
      is_private: false
    });

    setInlineAddTitles((prev) => ({ ...prev, [projId]: "" }));
  };

  // Task actions
  const handleToggleTaskPrivacy = async (taskId: string, currentPrivate: boolean) => {
    const { data } = await tasks.update(taskId, { is_private: !currentPrivate });
    if (selectedTask && selectedTask.id === taskId && data) {
      setSelectedTask(data as unknown as TaskItem);
    }
  };

  const handleCyclePriority = async (taskId: string, currentPriority: "Low" | "Medium" | "High") => {
    const priorities: ("Low" | "Medium" | "High")[] = ["Low", "Medium", "High"];
    const nextIdx = (priorities.indexOf(currentPriority) + 1) % priorities.length;
    const { data } = await tasks.update(taskId, { priority: priorities[nextIdx] });
    if (selectedTask && selectedTask.id === taskId && data) {
      setSelectedTask(data as unknown as TaskItem);
    }
  };

  const handleToggleTaskCompletion = async (task: TaskItem) => {
    const isBoth = (task.assigned_to || "").trim().toLowerCase() === "both";
    let updatedTask: TaskItem | null = null;

    if (isBoth) {
      if (activeUser === "user1") {
        const nextVal = !task.completed_user1;
        const { data } = await tasks.update(task.id, {
          completed_user1: nextVal,
          completed: nextVal && task.completed_user2
        });
        if (data) updatedTask = data as unknown as TaskItem;
        if (nextVal) {
          sendNotification("user2", "Task Component Done", `${user1} completed their part of: ${task.title}`);
        }
      } else if (activeUser === "user2") {
        const nextVal = !task.completed_user2;
        const { data } = await tasks.update(task.id, {
          completed_user2: nextVal,
          completed: task.completed_user1 && nextVal
        });
        if (data) updatedTask = data as unknown as TaskItem;
        if (nextVal) {
          sendNotification("user1", "Task Component Done", `${user2} completed their part of: ${task.title}`);
        }
      }
    } else {
      const nextVal = !task.completed;
      const { data } = await tasks.update(task.id, { completed: nextVal });
      if (data) updatedTask = data as unknown as TaskItem;
      if (nextVal) {
        const otherUserKey = activeUser === "user1" ? "user2" : "user1";
        sendNotification(otherUserKey, "Task Completed", `${activeUserName} completed: ${task.title}`);
      }
    }

    if (selectedTask && selectedTask.id === task.id && updatedTask) {
      setSelectedTask(updatedTask);
    }
  };

  const handleRecenterCanvas = () => {
    setPan({ x: 0, y: 0 });
  };

  const toggleCollapseProject = (projectId: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const toggleCollapsePriority = (priority: string) => {
    setCollapsedPriorities((prev) => ({ ...prev, [priority]: !prev[priority] }));
  };

  // Details Inspector handlers
  const handleSaveInspectorNotes = async (taskId: string, notesText: string) => {
    await tasks.update(taskId, { note: notesText.trim() });
  };

  const handleUpdateInspectorTitle = async (taskId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const { data } = await tasks.update(taskId, { title: newTitle.trim() });
    if (data) setSelectedTask(data as unknown as TaskItem);
  };

  const handleUpdateInspectorProject = async (taskId: string, projId: string) => {
    const project_id = projId === "general" ? null : projId;
    const { data } = await tasks.update(taskId, { project_id });
    if (data) setSelectedTask(data as unknown as TaskItem);
  };

  const handleUpdateInspectorDueDate = async (taskId: string, dueDateStr: string) => {
    const due_date = dueDateStr || null;
    const { data } = await tasks.update(taskId, { due_date });
    if (data) setSelectedTask(data as unknown as TaskItem);
  };

  const handleUpdateInspectorAssignee = async (taskId: string, assignee: string) => {
    const { data } = await tasks.update(taskId, { assigned_to: assignee });
    if (data) setSelectedTask(data as unknown as TaskItem);
  };

  // Helper to count active tasks in projects/folders
  const getActiveTaskCount = (projId: string | "all" | "general") => {
    const target = (targetAssigneeName || "").trim().toLowerCase();
    return tasks.rows.filter((t) => {
      const isAssignee = (t.assigned_to || "").trim().toLowerCase() === target;
      if (!isAssignee) return false;

      // Project filter
      if (projId === "general") {
        if (t.project_id !== null) return false;
      } else if (projId !== "all") {
        if (t.project_id !== projId) return false;
      }

      return t.approved !== false && !t.completed;
    }).length;
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

  // Selected Project theme specs
  const selectedProjectObj = activeProjects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex w-full h-[calc(100vh-100px)] overflow-hidden rounded-3xl border bg-white/40 dark:bg-zinc-950/20 border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-md">
      {/* ────────────────── PANEL 1: LEFT NAVIGATOR ────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r border-zinc-200/50 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-900/60 transition-all duration-300 ease-in-out h-full overflow-hidden shrink-0",
          leftPanelOpen ? "w-64" : "w-0 border-r-0"
        )}
      >
        {/* Assignee Spaces Tabs */}
        <div className="p-4 flex flex-col gap-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2.5 mb-1.5">
            Assignee Spaces
          </label>
          <button
            onClick={() => setActiveSpace("user1")}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
              activeSpace === "user1"
                ? "bg-zinc-150/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
            )}
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-indigo-505" />
              {user1}&apos;s Workspace
            </span>
            <span className="text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">
              {getActiveTaskCount("all")}
            </span>
          </button>
          <button
            onClick={() => setActiveSpace("user2")}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
              activeSpace === "user2"
                ? "bg-zinc-150/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
            )}
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-emerald-505" />
              {user2}&apos;s Workspace
            </span>
            <span className="text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">
              {getActiveTaskCount("all")}
            </span>
          </button>
          <button
            onClick={() => setActiveSpace("collab")}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
              activeSpace === "collab"
                ? "bg-zinc-150/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
            )}
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-amber-505" />
              Collaborative Space
            </span>
            <span className="text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">
              {getActiveTaskCount("all")}
            </span>
          </button>
        </div>

        {/* Project Lists folders */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 scrollbar-sleek">
          <div className="flex items-center justify-between px-2.5 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Projects & Folders
            </span>
          </div>

          <button
            onClick={() => setSelectedProjectId("all")}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
              selectedProjectId === "all"
                ? "bg-zinc-150/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
            )}
          >
            <span className="flex items-center gap-2">
              <Grid className="h-4 w-4 text-zinc-400" />
              All Projects
            </span>
            <span className="text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">
              {getActiveTaskCount("all")}
            </span>
          </button>

          <button
            onClick={() => setSelectedProjectId("general")}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
              selectedProjectId === "general"
                ? "bg-zinc-150/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
            )}
          >
            <span className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              General Tasks
            </span>
            <span className="text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">
              {getActiveTaskCount("general")}
            </span>
          </button>

          <div className="h-px bg-zinc-200/50 dark:bg-zinc-800/50 my-2" />

          {activeProjects.map((p) => {
            const isSelected = selectedProjectId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-200",
                  isSelected
                    ? "bg-zinc-150/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || "#6366f1" }}
                  />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-zinc-200/60 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">
                  {getActiveTaskCount(p.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────── PANEL 2: CENTER WORKSPACE ────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50/10 dark:bg-zinc-950/10">
        {/* Workspace Toolbar Header */}
        <div className="flex flex-col gap-3 p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/45 backdrop-blur-xs select-none">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* View title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                className="h-8 w-8 text-zinc-500"
              >
                {leftPanelOpen ? <ChevronsLeft className="h-4.5 w-4.5" /> : <ChevronsRight className="h-4.5 w-4.5" />}
              </Button>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                {selectedProjectId === "all" ? (
                  <>
                    <Grid className="h-4.5 w-4.5 text-zinc-400" />
                    All Tasks
                  </>
                ) : selectedProjectId === "general" ? (
                  <>
                    <Tag className="h-4.5 w-4.5 text-slate-500" />
                    General Tasks
                  </>
                ) : (
                  <>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: selectedProjectObj?.color || "#3b82f6" }}
                    />
                    {selectedProjectObj?.name}
                  </>
                )}
              </h2>
            </div>

            {/* View toggle switcher (Notion style) */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/40 dark:border-zinc-700/60 shadow-xs self-start shrink-0">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1 py-1.5 px-3 font-semibold text-[11px] rounded-lg transition-all duration-200",
                  viewMode === "list"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <ListTodo className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("board")}
                className={cn(
                  "flex items-center gap-1 py-1.5 px-3 font-semibold text-[11px] rounded-lg transition-all duration-200",
                  viewMode === "board"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                onClick={() => setViewMode("canvas")}
                className={cn(
                  "flex items-center gap-1 py-1.5 px-3 font-semibold text-[11px] rounded-lg transition-all duration-200",
                  viewMode === "canvas"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Workflow className="h-3.5 w-3.5" />
                Canvas
              </button>
            </div>
          </div>

          {/* Search bar & subFilters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 pl-9 text-xs bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200/50 dark:border-zinc-800/80 shadow-none rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start w-full sm:w-auto">
              {subFilters.map((item) => (
                <Button
                  key={item}
                  variant={subFilter === item ? "default" : "outline"}
                  onClick={() => setSubFilter(item)}
                  className="rounded-xl border-zinc-200/80 dark:border-zinc-800 text-[10px] px-3 h-8 font-bold shadow-none"
                >
                  {item}
                </Button>
              ))}
            </div>

            {/* Canvas Specific Controls */}
            {viewMode === "canvas" && (
              <div className="flex items-center gap-1.5 sm:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  title="Toggle Snap-to-Grid align"
                  className={cn(
                    "h-8 px-2.5 rounded-xl text-[10px] gap-1 shadow-none font-bold",
                    snapToGrid && "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-650"
                  )}
                >
                  <Grid className="h-3.5 w-3.5" />
                  Snap Grid
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTidyLayout}
                  title="Auto-Arrange Layout"
                  className="h-8 px-2.5 rounded-xl text-[10px] gap-1 shadow-none font-bold"
                >
                  Tidy Layout
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRecenterCanvas}
                  title="Recenter Grid"
                  className="h-8 w-8 rounded-xl"
                >
                  <Compass className="h-4 w-4 text-zinc-500" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleResetPositions}
                  title="Reset Coordinates"
                  className="h-8 w-8 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4 text-zinc-500" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Task Requests alerts if any */}
        {incomingRequests.length > 0 && selectedProjectId === "all" && (
          <div className="p-4 border-b border-zinc-200/30 bg-amber-50/20 dark:bg-amber-950/10 animate-in fade-in duration-200">
            <h3 className="text-amber-800 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              Incoming Task Requests ({incomingRequests.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {incomingRequests.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-250/70 dark:border-amber-900/60 bg-white dark:bg-zinc-900 shadow-xs text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-155 truncate">{task.title}</p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Assigned by {task.created_by}</p>
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
          </div>
        )}

        {pendingRequests.length > 0 && selectedProjectId === "all" && (
          <div className="p-4 border-b border-zinc-200/30 bg-zinc-50/20 dark:bg-zinc-900/10 animate-in fade-in duration-200">
            <h3 className="text-zinc-700 dark:text-zinc-400 text-xs font-semibold flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-3.5 w-3.5 text-zinc-505" />
              Sent Tasks Awaiting Approval ({pendingRequests.length})
            </h3>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">{task.title}</span>
                    {task.note && <span className="italic text-zinc-400 ml-2">• Note: {task.note}</span>}
                  </div>
                  <span className="text-zinc-500 italic font-medium shrink-0">Awaiting {activeSpace === "user1" ? user2 : user1}&apos;s approval</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View content area */}
        <div className="flex-1 overflow-y-auto scrollbar-sleek p-4 flex flex-col gap-4">
          {/* ────────────────── 1. LIST VIEW ────────────────── */}
          {viewMode === "list" && (
            <div className="flex flex-col gap-6">
              {/* Case A: Viewing All Projects (Group by Project) */}
              {selectedProjectId === "all" ? (
                allVisibleCards.map((card) => {
                  const isCollapsed = collapsedProjects[card.id];
                  const isGeneral = card.id === "general";
                  const projectColor = card.color;
                  const projectTasks = filteredTasks.filter((t) =>
                    isGeneral ? t.project_id === null : t.project_id === card.id
                  );

                  return (
                    <div
                      key={card.id}
                      className="flex flex-col rounded-2xl border bg-white/50 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/60 overflow-hidden shadow-xs"
                    >
                      {/* Project header bar */}
                      <div className="flex items-center justify-between p-3 border-b border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-100/30 dark:bg-zinc-900/20">
                        <button
                          onClick={() => toggleCollapseProject(card.id)}
                          className="flex items-center gap-2 text-xs font-extrabold text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
                        >
                          {isCollapsed ? <ChevronRight className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
                          {card.name}
                          <span className="text-[10px] text-zinc-400 font-medium font-mono">({projectTasks.length})</span>
                        </button>
                      </div>

                      {/* Tasks rows */}
                      {!isCollapsed && (
                        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/50">
                          {projectTasks.length > 0 ? (
                            projectTasks.map((task) => (
                              <TaskRow
                                key={task.id}
                                task={task}
                                user1={user1}
                                user2={user2}
                                userColors={userColors}
                                activeUser={activeUser}
                                activeUserName={activeUserName}
                                selectedTask={selectedTask}
                                setSelectedTask={setSelectedTask}
                                handleToggleTaskCompletion={handleToggleTaskCompletion}
                                handleCyclePriority={handleCyclePriority}
                                handleToggleTaskPrivacy={handleToggleTaskPrivacy}
                              />
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-zinc-400 italic">No tasks in this folder</div>
                          )}

                          {/* Quick Add block */}
                          <div className="p-2.5 bg-zinc-50/20 dark:bg-zinc-900/10 flex gap-2 items-center">
                            <Input
                              placeholder={`+ Add task to ${card.name}...`}
                              value={inlineAddTitles[card.id] || ""}
                              onChange={(e) => setInlineAddTitles((prev) => ({ ...prev, [card.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handleCreateTask(card.id)}
                              className="h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-zinc-850 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                            />
                            <Button
                              onClick={() => handleCreateTask(card.id)}
                              className="h-8 text-xs rounded-xl shadow-none px-3 font-bold"
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Case B: Viewing a Single Project (Group by Priority) */
                <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                  {["High", "Medium", "Low"].map((prio) => {
                    const isCollapsed = collapsedPriorities[prio];
                    const prioTasks = filteredTasks.filter((t) => t.priority === prio);
                    const groupColor = prio === "High" ? "#ef4444" : prio === "Medium" ? "#f59e0b" : "#71717a";

                    return (
                      <div
                        key={prio}
                        className="flex flex-col rounded-2xl border bg-white/50 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/60 overflow-hidden shadow-xs"
                      >
                        {/* Priority header */}
                        <div className="flex items-center justify-between p-3 border-b border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-100/30 dark:bg-zinc-900/20">
                          <button
                            onClick={() => toggleCollapsePriority(prio)}
                            className="flex items-center gap-2 text-xs font-extrabold text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
                          >
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-zinc-405" /> : <ChevronDown className="h-4 w-4 text-zinc-405" />}
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: groupColor }} />
                            {prio} Priority
                            <span className="text-[10px] text-zinc-450 font-medium font-mono">({prioTasks.length})</span>
                          </button>
                        </div>

                        {/* Priority rows */}
                        {!isCollapsed && (
                          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {prioTasks.length > 0 ? (
                              prioTasks.map((task) => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  user1={user1}
                                  user2={user2}
                                  userColors={userColors}
                                  activeUser={activeUser}
                                  activeUserName={activeUserName}
                                  selectedTask={selectedTask}
                                  setSelectedTask={setSelectedTask}
                                  handleToggleTaskCompletion={handleToggleTaskCompletion}
                                  handleCyclePriority={handleCyclePriority}
                                  handleToggleTaskPrivacy={handleToggleTaskPrivacy}
                                />
                              ))
                            ) : (
                              <div className="p-4 text-center text-xs text-zinc-400 italic">No tasks with {prio.toLowerCase()} priority</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Single Project Bottom Inline Quick Add */}
                  <div className="flex gap-2 items-center p-3 border bg-white/60 dark:bg-zinc-900/50 border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl">
                    <Input
                      placeholder={`+ Add task to ${selectedProjectObj?.name || "General"}...`}
                      value={inlineAddTitles[selectedProjectId] || ""}
                      onChange={(e) => setInlineAddTitles((prev) => ({ ...prev, [selectedProjectId]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTask(selectedProjectId)}
                      className="h-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-850 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                    />
                    <Button
                      onClick={() => handleCreateTask(selectedProjectId)}
                      className="h-8.5 text-xs rounded-xl shadow-none px-4 font-bold"
                    >
                      Quick Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────────────── 2. BOARD VIEW ────────────────── */}
          {viewMode === "board" && (
            <div className="grid gap-4 md:grid-cols-3 items-start h-full pb-12 animate-in fade-in duration-200">
              {[
                {
                  id: "requests",
                  title: "Awaiting Approval",
                  tasksList: incomingRequests.filter((t) =>
                    selectedProjectId === "all"
                      ? true
                      : selectedProjectId === "general"
                      ? t.project_id === null
                      : t.project_id === selectedProjectId
                  ),
                  color: "#f59e0b"
                },
                {
                  id: "todo",
                  title: "To Do",
                  tasksList: filteredTasks.filter((t) => !t.completed),
                  color: "#3b82f6"
                },
                {
                  id: "completed",
                  title: "Completed",
                  tasksList: filteredTasks.filter((t) => t.completed),
                  color: "#10b981"
                }
              ].map((column) => (
                <div
                  key={column.id}
                  className="flex flex-col gap-3 bg-zinc-150/20 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3 min-h-[400px] max-h-[600px] overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-1 px-1">
                    <span className="font-extrabold text-[11px] text-zinc-650 dark:text-zinc-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                      {column.title}
                      <span className="text-[9px] font-bold text-zinc-400 font-mono bg-zinc-200/40 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {column.tasksList.length}
                      </span>
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto scrollbar-sleek pr-0.5 pb-2">
                    {column.tasksList.length > 0 ? (
                      column.tasksList.map((task) => {
                        const project = projects.rows.find((p) => p.id === task.project_id);
                        const isBoth = (task.assigned_to || "").trim().toLowerCase() === "both";
                        const assignedColor = task.assigned_to === user1 ? userColors.user1 : userColors.user2;

                        return (
                          <div
                            key={task.id}
                            className="group/board-card flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-shadow text-[11px]"
                            style={{ borderLeftWidth: 3, borderLeftColor: project?.color || "#71717a" }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                {isBoth ? (
                                  <div className="flex gap-0.5 shrink-0 mt-0.5">
                                    <button
                                      disabled={activeUser !== "user1"}
                                      onClick={() => handleToggleTaskCompletion(task)}
                                      className="h-4 w-4 rounded-full border flex items-center justify-center text-[6px] font-bold"
                                      style={{
                                        borderColor: userColors.user1,
                                        backgroundColor: task.completed_user1 ? userColors.user1 : "transparent",
                                        color: "#ffffff"
                                      }}
                                    >
                                      {task.completed_user1 ? <Check className="h-2 w-2" /> : user1.slice(0, 1)}
                                    </button>
                                    <button
                                      disabled={activeUser !== "user2"}
                                      onClick={() => handleToggleTaskCompletion(task)}
                                      className="h-4 w-4 rounded-full border flex items-center justify-center text-[6px] font-bold"
                                      style={{
                                        borderColor: userColors.user2,
                                        backgroundColor: task.completed_user2 ? userColors.user2 : "transparent",
                                        color: "#ffffff"
                                      }}
                                    >
                                      {task.completed_user2 ? <Check className="h-2 w-2" /> : user2.slice(0, 1)}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    disabled={activeUserName !== task.assigned_to}
                                    onClick={() => handleToggleTaskCompletion(task)}
                                    className="h-4 w-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center"
                                    style={{
                                      borderColor: assignedColor,
                                      backgroundColor: task.completed ? assignedColor : "transparent"
                                    }}
                                  >
                                    {task.completed && <Check className="h-2.5 w-2.5 text-white" />}
                                  </button>
                                )}

                                <div className="min-w-0">
                                  <p
                                    onClick={() => setSelectedTask(task)}
                                    className={cn(
                                      "font-semibold text-zinc-900 dark:text-zinc-150 cursor-pointer hover:underline leading-relaxed",
                                      task.completed && "line-through text-zinc-400 dark:text-zinc-650"
                                    )}
                                  >
                                    {task.title}
                                  </p>
                                  {task.note && (
                                    <p className="text-[10px] text-zinc-400 italic truncate mt-0.5">
                                      {task.note}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => tasks.remove(task.id)}
                                className="p-0.5 hover:bg-red-50 rounded transition-colors text-zinc-400 hover:text-red-500 opacity-0 group-hover/board-card:opacity-100 shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between border-t pt-1.5 border-zinc-100 dark:border-zinc-800">
                              <span className="flex items-center gap-1 font-bold text-[9px] text-zinc-450 dark:text-zinc-400">
                                <Tag className="h-2.5 w-2.5" />
                                {project?.name || "General"}
                              </span>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {task.due_date && (
                                  <span className="text-[8px] font-semibold text-zinc-450 flex items-center gap-0.5">
                                    <Calendar className="h-2.5 w-2.5" />
                                    {task.due_date}
                                  </span>
                                )}

                                <button
                                  onClick={() => handleCyclePriority(task.id, task.priority)}
                                  className={cn(
                                    "text-[7px] px-1 py-0.2 font-bold rounded border",
                                    task.priority === "High"
                                      ? "bg-red-50 text-red-700 border-red-100"
                                      : task.priority === "Medium"
                                      ? "bg-amber-50 text-amber-700 border-amber-100"
                                      : "bg-zinc-50 text-zinc-600 border-zinc-200"
                                  )}
                                >
                                  {task.priority}
                                </button>

                                <button
                                  onClick={() => handleToggleTaskPrivacy(task.id, task.is_private)}
                                  className="p-0.5 text-zinc-400 hover:text-zinc-650"
                                >
                                  {task.is_private ? <Lock className="h-2.5 w-2.5 text-rose-500" /> : <Unlock className="h-2.5 w-2.5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-zinc-400 italic">No tasks in column</div>
                    )}
                  </div>

                  {column.id === "todo" && (
                    <div className="mt-auto pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 flex gap-1.5">
                      <Input
                        placeholder="+ Quick add..."
                        value={inlineAddTitles["todo_col"] || ""}
                        onChange={(e) => setInlineAddTitles((prev) => ({ ...prev, todo_col: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateTask("todo_col")}
                        className="h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200/60 dark:border-zinc-800 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                      />
                      <Button
                        onClick={() => handleCreateTask("todo_col")}
                        className="h-8 text-xs rounded-xl shadow-none px-2.5 font-bold"
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ────────────────── 3. CANVAS VIEW ────────────────── */}
          {viewMode === "canvas" && (
            <div
              ref={canvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              className={cn(
                "relative overflow-hidden w-full h-[620px] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl select-none shadow-inner bg-white/20 dark:bg-zinc-950/20",
                "bg-[radial-gradient(circle,#e4e4e7_1px,transparent_1px)] dark:bg-[radial-gradient(circle,#27272a_1px,transparent_1px)] bg-[size:30px_30px]",
                isPanning ? "cursor-grabbing" : "cursor-grab"
              )}
            >
              {/* SVG connection lines overlay */}
              <svg className="absolute inset-0 pointer-events-none w-full h-full">
                <g transform={`translate(${pan.x}, ${pan.y})`}>
                  {taskCardConnections.rows.map((conn) => {
                    const hasSource = allVisibleCards.some((c) => c.id === conn.source_id);
                    const hasTarget = allVisibleCards.some((c) => c.id === conn.target_id);
                    if (!hasSource || !hasTarget) return null;

                    const posSource = getCardPosition(conn.source_id);
                    const posTarget = getCardPosition(conn.target_id);

                    const leftCardId = posSource.x < posTarget.x ? conn.source_id : conn.target_id;
                    const rightCardId = posSource.x < posTarget.x ? conn.target_id : conn.source_id;

                    const p1 = getSocketCoords(leftCardId, "right");
                    const p2 = getSocketCoords(rightCardId, "left");

                    const dx = Math.max(60, Math.abs(p2.x - p1.x) * 0.4);
                    const pathData = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

                    const mx = (p1.x + p2.x) / 2;
                    const my = (p1.y + p2.y) / 2;

                    return (
                      <g key={conn.id} className="group pointer-events-auto">
                        <path
                          d={pathData}
                          fill="none"
                          stroke={conn.is_private ? "#fb7185" : "#a1a1aa"}
                          strokeWidth={4}
                          className="opacity-10 group-hover:opacity-40 transition-opacity cursor-pointer"
                        />
                        <path
                          d={pathData}
                          fill="none"
                          stroke={conn.is_private ? "#f43f5e" : "#64748b"}
                          strokeWidth={2}
                          strokeDasharray={conn.is_private ? "5,5" : undefined}
                          className="transition-all"
                        />
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

              {/* Viewport content */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
              >
                {allVisibleCards.map((card) => {
                  const pos = getCardPosition(card.id);
                  const isGeneral = card.id === "general";
                  const cardTheme = getCardTheme(card.color);
                  const groupInfo = getCardGroupInfo(card.id);

                  const cardTasks = filteredTasks.filter((t) =>
                    isGeneral ? t.project_id === null : t.project_id === card.id
                  );

                  return (
                    <div
                      key={card.id}
                      id={`card-${card.id}`}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        width: 320,
                        borderColor: cardTheme.border,
                        boxShadow: `0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 0 16px ${cardTheme.glow}`
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
                      {/* Connection sockets */}
                      <button
                        onPointerDown={(e) => handleSocketPointerDown(card.id, "left", e)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2.5 w-5 h-5 bg-zinc-200 hover:bg-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-650 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm z-30 transition-transform active:scale-95 cursor-crosshair"
                      />
                      <button
                        onPointerDown={(e) => handleSocketPointerDown(card.id, "right", e)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2.5 w-5 h-5 bg-zinc-200 hover:bg-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-655 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm z-30 transition-transform active:scale-95 cursor-crosshair"
                      />

                      {/* Header */}
                      <div
                        onPointerDown={(e) => handleCardDragStart(card.id, e)}
                        onPointerMove={(e) => handleCardDragMove(card.id, e)}
                        onPointerUp={(e) => handleCardDragEnd(card.id, e)}
                        style={{ backgroundColor: cardTheme.headerBg }}
                        className="flex items-center justify-between p-3 border-b rounded-t-2xl cursor-grab active:cursor-grabbing border-zinc-200/80 dark:border-zinc-850"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-extrabold text-[12px] text-zinc-900 dark:text-zinc-50 truncate flex items-center gap-1.5">
                            {!isGeneral && card.isPrivate && <Lock className="h-3 w-3 text-red-500 shrink-0" />}
                            {card.name}
                          </span>
                          {groupInfo && (
                            <span className="text-[9px] font-bold text-zinc-500 flex items-center gap-1">
                              <Link2 className="h-3 w-3 shrink-0" />
                              Group {groupInfo.index} ({groupInfo.size} cards)
                              {groupInfo.isPrivate && <Lock className="h-2.5 w-2.5 text-rose-500 shrink-0" />}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                          {!isGeneral && (
                            <button
                              onClick={() => toggleCardPrivacy(card.id, card.isPrivate)}
                              className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-zinc-450 hover:text-zinc-700"
                              title={card.isPrivate ? "Make Public" : "Make Private"}
                            >
                              {card.isPrivate ? <Lock className="h-3.5 w-3.5 text-rose-500" /> : <Unlock className="h-3.5 w-3.5" />}
                            </button>
                          )}

                          {groupInfo && (
                            <button
                              onClick={() => handleToggleGroupPrivacy(card.id, !groupInfo.isPrivate)}
                              className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-zinc-450 hover:text-zinc-700"
                              title={groupInfo.isPrivate ? "Make Group Public" : "Make Group Private"}
                            >
                              {groupInfo.isPrivate ? <EyeOff className="h-3.5 w-3.5 text-rose-500" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          )}

                          {groupInfo && (
                            <button
                              onClick={() => handleDisconnectCard(card.id)}
                              className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-red-500"
                              title="Disconnect Card"
                            >
                              <Link2Off className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tasks list */}
                      <div className="p-3 flex flex-col gap-2 min-h-[120px] max-h-[260px] overflow-y-auto scrollbar-sleek bg-white/40 dark:bg-zinc-900/40">
                        {cardTasks.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {cardTasks.map((task) => {
                              const isBoth = (task.assigned_to || "").trim().toLowerCase() === "both";
                              const assignedColor = task.assigned_to === user1 ? userColors.user1 : userColors.user2;

                              return (
                                <div
                                  key={task.id}
                                  className="group/task flex items-center justify-between gap-2 p-2 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-shadow text-[11px]"
                                >
                                  {isBoth ? (
                                    <div className="flex gap-0.5 shrink-0">
                                      <button
                                        disabled={activeUser !== "user1"}
                                        onClick={() => handleToggleTaskCompletion(task)}
                                        className="h-4 w-4 rounded-full border flex items-center justify-center text-[6px] font-bold"
                                        style={{
                                          borderColor: userColors.user1,
                                          backgroundColor: task.completed_user1 ? userColors.user1 : "transparent",
                                          color: "#ffffff"
                                        }}
                                      >
                                        {task.completed_user1 ? <Check className="h-2 w-2" /> : user1.slice(0, 1)}
                                      </button>
                                      <button
                                        disabled={activeUser !== "user2"}
                                        onClick={() => handleToggleTaskCompletion(task)}
                                        className="h-4 w-4 rounded-full border flex items-center justify-center text-[6px] font-bold"
                                        style={{
                                          borderColor: userColors.user2,
                                          backgroundColor: task.completed_user2 ? userColors.user2 : "transparent",
                                          color: "#ffffff"
                                        }}
                                      >
                                        {task.completed_user2 ? <Check className="h-2 w-2" /> : user2.slice(0, 1)}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      disabled={activeUserName !== task.assigned_to}
                                      onClick={() => handleToggleTaskCompletion(task)}
                                      className="h-4 w-4 rounded-full border shrink-0 flex items-center justify-center"
                                      style={{
                                        borderColor: assignedColor,
                                        backgroundColor: task.completed ? assignedColor : "transparent"
                                      }}
                                    >
                                      {task.completed && <Check className="h-2.5 w-2.5 text-white" />}
                                    </button>
                                  )}

                                  <span
                                    onClick={() => setSelectedTask(task)}
                                    className={cn(
                                      "font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1 hover:underline cursor-pointer",
                                      task.completed && "line-through text-zinc-400 dark:text-zinc-655"
                                    )}
                                  >
                                    {task.title}
                                  </span>

                                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleCyclePriority(task.id, task.priority)}
                                      className="text-[7px] px-1 py-0.2 font-bold rounded border bg-zinc-50"
                                    >
                                      {task.priority.slice(0, 1)}
                                    </button>

                                    <button
                                      onClick={() => handleToggleTaskPrivacy(task.id, task.is_private)}
                                      className="p-0.5 text-zinc-400 hover:text-zinc-600"
                                    >
                                      {task.is_private ? <Lock className="h-3 w-3 text-rose-500" /> : <Unlock className="h-3 w-3" />}
                                    </button>

                                    <button
                                      onClick={() => tasks.remove(task.id)}
                                      className="p-0.5 text-zinc-400 hover:text-red-500"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-[10px] text-zinc-400 italic">
                            No tasks in view
                          </div>
                        )}
                      </div>

                      {/* Footer Input */}
                      <div className="p-2.5 border-t border-zinc-200/80 dark:border-zinc-850 bg-white/60 dark:bg-zinc-900/60 rounded-b-2xl flex gap-1.5">
                        <Input
                          placeholder="Add task..."
                          value={inlineAddTitles[card.id] || ""}
                          onChange={(e) =>
                            setInlineAddTitles((prev) => ({ ...prev, [card.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleCreateTask(card.id)}
                          className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200/80 dark:border-zinc-850 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-400/40"
                        />
                        <Button
                          size="icon"
                          onClick={() => handleCreateTask(card.id)}
                          className="h-8 w-8 shrink-0 rounded-lg shadow-none"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────── PANEL 3: SLIDING DETAILS INSPECTOR ────────────────── */}
      {selectedTask && (
        <div
          className={cn(
            "border-l border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-905/80 backdrop-blur-md h-full flex flex-col overflow-hidden shrink-0 transition-all duration-300 ease-in-out",
            "fixed md:relative top-0 right-0 z-40 md:z-auto w-full sm:w-96 md:w-80 lg:w-96 shadow-2xl md:shadow-none animate-in slide-in-from-right duration-300"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/20 dark:bg-zinc-900/20">
            <span className="font-extrabold text-sm text-zinc-800 dark:text-zinc-250 flex items-center gap-1.5">
              Task Specifications
              {selectedTask.is_private && <Lock className="h-4 w-4 text-rose-500 shrink-0" />}
            </span>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-1.5 hover:bg-zinc-150/70 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scrollbar-sleek">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                Task Title
              </label>
              <Input
                value={selectedTask.title}
                onChange={(e) => handleUpdateInspectorTitle(selectedTask.id, e.target.value)}
                className="text-xs font-semibold bg-zinc-550/5 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-850 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-400"
              />
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Project */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                  Project
                </label>
                <select
                  value={selectedTask.project_id || "general"}
                  onChange={(e) => handleUpdateInspectorProject(selectedTask.id, e.target.value)}
                  className="w-full text-[11px] font-semibold px-2.5 py-1.8 bg-zinc-550/5 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-850 rounded-xl outline-none focus:border-zinc-450 transition-colors"
                >
                  <option value="general">No Project (General)</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                  Assignee
                </label>
                <select
                  value={selectedTask.assigned_to}
                  onChange={(e) => handleUpdateInspectorAssignee(selectedTask.id, e.target.value)}
                  className="w-full text-[11px] font-semibold px-2.5 py-1.8 bg-zinc-550/5 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-850 rounded-xl outline-none focus:border-zinc-450 transition-colors"
                >
                  <option value={user1}>{user1}</option>
                  <option value={user2}>{user2}</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                  Priority
                </label>
                <select
                  value={selectedTask.priority}
                  onChange={async (e) => {
                    const val = e.target.value as "Low" | "Medium" | "High";
                    const { data } = await tasks.update(selectedTask.id, { priority: val });
                    if (data) setSelectedTask(data as unknown as TaskItem);
                  }}
                  className="w-full text-[11px] font-semibold px-2.5 py-1.8 bg-zinc-550/5 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-850 rounded-xl outline-none focus:border-zinc-450 transition-colors"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              {/* Due Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={selectedTask.due_date || ""}
                  onChange={(e) => handleUpdateInspectorDueDate(selectedTask.id, e.target.value)}
                  className="h-8 text-[11px] bg-zinc-550/5 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-850 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                />
              </div>
            </div>

            {/* Note details */}
            <div className="flex flex-col gap-1.5 flex-1 min-h-[160px]">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
                Detailed notes
              </label>
              <textarea
                value={selectedTask.note}
                onChange={(e) => setSelectedTask((prev) => (prev ? { ...prev, note: e.target.value } : null))}
                onBlur={(e) => handleSaveInspectorNotes(selectedTask.id, e.target.value)}
                placeholder="Add specs, descriptions, or link resources..."
                className="w-full flex-1 text-xs p-3 bg-zinc-550/5 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-850 rounded-xl outline-none focus:border-zinc-450 transition-colors resize-none scrollbar-sleek"
              />
              <p className="text-[9px] text-zinc-400 italic">Autosaves on focus loss (blur).</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/20 dark:bg-zinc-900/20 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleTaskPrivacy(selectedTask.id, selectedTask.is_private)}
              className="h-8 rounded-xl text-[10px] gap-1 font-extrabold"
            >
              {selectedTask.is_private ? (
                <>
                  <Lock className="h-3 w-3 text-rose-500" />
                  Private Task
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 text-zinc-400" />
                  Public Task
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await tasks.remove(selectedTask.id);
                  setSelectedTask(null);
                }}
                className="h-8 rounded-xl text-[10px] text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 font-extrabold border-red-100/50"
              >
                Delete
              </Button>
              <Button
                onClick={() => setSelectedTask(null)}
                className="h-8 rounded-xl text-[10px] font-extrabold px-3.5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────── UTILITY COMPONENT: TASKROW ──────────────────
interface TaskRowProps {
  task: TaskItem;
  user1: string;
  user2: string;
  userColors: ReturnType<typeof useUserColors>;
  activeUser: "user1" | "user2" | null;
  activeUserName: string;
  selectedTask: TaskItem | null;
  setSelectedTask: (task: TaskItem | null) => void;
  handleToggleTaskCompletion: (task: TaskItem) => Promise<void>;
  handleCyclePriority: (taskId: string, currentPriority: "Low" | "Medium" | "High") => Promise<void>;
  handleToggleTaskPrivacy: (taskId: string, currentPrivate: boolean) => Promise<void>;
}

function TaskRow({
  task,
  user1,
  user2,
  userColors,
  activeUser,
  activeUserName,
  selectedTask,
  setSelectedTask,
  handleToggleTaskCompletion,
  handleCyclePriority,
  handleToggleTaskPrivacy
}: TaskRowProps) {
  const { tasks } = useData();
  const isBoth = (task.assigned_to || "").trim().toLowerCase() === "both";
  const assignedColor = task.assigned_to === user1 ? userColors.user1 : userColors.user2;
  const isSelected = selectedTask?.id === task.id;

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 p-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors text-xs select-none",
        isSelected && "bg-zinc-150/40 dark:bg-zinc-800/40"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Checkbox button */}
        {isBoth ? (
          <div className="flex gap-0.5 shrink-0">
            <button
              disabled={activeUser !== "user1"}
              onClick={() => handleToggleTaskCompletion(task)}
              className="h-4.5 w-4.5 rounded-full border flex items-center justify-center text-[7px] font-bold"
              style={{
                borderColor: userColors.user1,
                backgroundColor: task.completed_user1 ? userColors.user1 : "transparent",
                color: "#ffffff"
              }}
            >
              {task.completed_user1 ? <Check className="h-2 w-2" /> : user1.slice(0, 1)}
            </button>
            <button
              disabled={activeUser !== "user2"}
              onClick={() => handleToggleTaskCompletion(task)}
              className="h-4.5 w-4.5 rounded-full border flex items-center justify-center text-[7px] font-bold"
              style={{
                borderColor: userColors.user2,
                backgroundColor: task.completed_user2 ? userColors.user2 : "transparent",
                color: "#ffffff"
              }}
            >
              {task.completed_user2 ? <Check className="h-2 w-2" /> : user2.slice(0, 1)}
            </button>
          </div>
        ) : (
          <button
            disabled={activeUserName !== task.assigned_to}
            onClick={() => handleToggleTaskCompletion(task)}
            className="h-4.5 w-4.5 rounded-full border shrink-0 flex items-center justify-center"
            style={{
              borderColor: assignedColor,
              backgroundColor: task.completed ? assignedColor : "transparent"
            }}
          >
            {task.completed && <Check className="h-2.5 w-2.5 text-white" />}
          </button>
        )}

        {/* Title */}
        <span
          onClick={() => setSelectedTask(task)}
          className={cn(
            "font-semibold text-zinc-900 dark:text-zinc-200 truncate cursor-pointer hover:underline",
            task.completed && "line-through text-zinc-400 dark:text-zinc-650"
          )}
        >
          {task.title}
        </span>

        {task.note && (
          <span className="text-[10px] text-zinc-400 italic truncate max-w-[180px]">
            • {task.note}
          </span>
        )}
      </div>

      {/* Badges/Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {task.due_date && (
          <span className="text-[9px] font-semibold text-zinc-450 flex items-center gap-0.5">
            <Calendar className="h-3 w-3" />
            {task.due_date}
          </span>
        )}

        <button
          onClick={() => handleCyclePriority(task.id, task.priority)}
          className={cn(
            "text-[8px] px-1.5 py-0.2 rounded font-bold border",
            task.priority === "High"
              ? "bg-red-50 text-red-700 border-red-100"
              : task.priority === "Medium"
              ? "bg-amber-50 text-amber-700 border-amber-100"
              : "bg-zinc-50 text-zinc-600 border-zinc-200"
          )}
        >
          {task.priority}
        </button>

        <button
          onClick={() => handleToggleTaskPrivacy(task.id, task.is_private)}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-650"
        >
          {task.is_private ? (
            <Lock className="h-3 w-3 text-rose-500" />
          ) : (
            <Unlock className="h-3 w-3" />
          )}
        </button>

        <button
          onClick={() => tasks.remove(task.id)}
          className="p-1 hover:bg-red-50 rounded transition-colors text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
