"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, Check, Sparkles, Trash2, X, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useData, useUserNames, useActiveUser } from "@/components/data-provider";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn, todayISO } from "@/lib/utils";
import type { Row } from "@/lib/database.types";

const CATEGORIES = ["Food", "Tea", "Travel", "Utilities", "Subscriptions", "Business", "Savings", "Misc"];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f87171",          // red-400
  Tea: "#fb923c",           // orange-400
  Travel: "#fbbf24",        // amber-400
  Utilities: "#34d399",     // emerald-400
  Subscriptions: "#60a5fa",  // blue-400
  Business: "#a78bfa",      // purple-400
  Savings: "#10b981",       // emerald-500
  Misc: "#9ca3af"           // gray-400
};

export default function MoneyPage() {
  const { moneyEntries, settings, savingsGoals } = useData();
  const { activeUser } = useActiveUser();
  const names = useUserNames();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState("Misc");
  const [splitMode, setSplitMode] = useState<"none" | "split" | "request">("none");
  const [entryDate, setEntryDate] = useState(todayISO());

  const [deletingEntry, setDeletingEntry] = useState<Row<"money_entries"> | null>(null);
  const [converting, setConverting] = useState(false);

  // ── Savings Goals State & Logic ───────────────────────────────────────────
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");

  const [adjustingGoal, setAdjustingGoal] = useState<Row<"savings_goals"> | null>(null);
  const [adjustMode, setAdjustMode] = useState<"deposit" | "withdraw">("deposit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [deletingGoal, setDeletingGoal] = useState<Row<"savings_goals"> | null>(null);

  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim() || Number(newGoalTarget) <= 0) return;
    await savingsGoals.create({
      title: newGoalTitle.trim(),
      target_amount: Number(newGoalTarget),
      current_amount: 0,
      created_by: myKey
    });
    setNewGoalTitle("");
    setNewGoalTarget("");
    setShowCreateGoal(false);
  };

  const handleAdjustGoal = async () => {
    if (!adjustingGoal || Number(adjustAmount) <= 0) return;
    const amt = Number(adjustAmount);
    if (adjustMode === "withdraw" && amt > adjustingGoal.current_amount) {
      alert("Cannot withdraw more than the current savings balance.");
      return;
    }

    const nextAmount = adjustMode === "deposit"
      ? adjustingGoal.current_amount + amt
      : adjustingGoal.current_amount - amt;

    await savingsGoals.update(adjustingGoal.id, { current_amount: nextAmount });

    await moneyEntries.create({
      description: adjustMode === "deposit" ? `Deposit to: ${adjustingGoal.title}` : `Withdrawal from: ${adjustingGoal.title}`,
      amount: amt,
      type: adjustMode === "deposit" ? "Expense" : "Income",
      added_by: myKey,
      category: "Savings",
      is_request: false,
      savings_goal_id: adjustingGoal.id,
      entry_date: todayISO()
    });

    setAdjustAmount("");
    setAdjustingGoal(null);
  };

  const handleDeleteGoal = async () => {
    if (!deletingGoal) return;
    
    if (deletingGoal.current_amount > 0) {
      // Create refund entry
      await moneyEntries.create({
        description: `Refund from: ${deletingGoal.title} (Goal Deleted)`,
        amount: deletingGoal.current_amount,
        type: "Income",
        added_by: myKey,
        category: "Savings",
        is_request: false,
        entry_date: todayISO()
      });
    }

    await savingsGoals.remove(deletingGoal.id);
    setDeletingGoal(null);
  };

  // ── Currency Preference ───────────────────────────────────────────────────
  const currencyRow = settings.rows.find((r) => r.key === "currency_preference");
  const currency = currencyRow && typeof currencyRow.value === "string" ? currencyRow.value : "INR";
  const currencySymbol = currency === "USD" ? "$" : "₹";

  const toggleCurrency = async () => {
    if (converting) return;
    setConverting(true);
    try {
      const nextVal = currency === "INR" ? "USD" : "INR";
      const EXCHANGE_RATE = 83.0;
      const multiplier = nextVal === "INR" ? EXCHANGE_RATE : 1 / EXCHANGE_RATE;

      // Update all money entries
      if (isSupabaseConfigured) {
        await Promise.all(
          moneyEntries.rows.map((entry) => {
            const newAmount = Number((Number(entry.amount) * multiplier).toFixed(2));
            return moneyEntries.update(entry.id, { amount: newAmount });
          })
        );
      } else {
        for (const entry of moneyEntries.rows) {
          const newAmount = Number((Number(entry.amount) * multiplier).toFixed(2));
          await moneyEntries.update(entry.id, { amount: newAmount });
        }
      }

      // Update setting row
      if (currencyRow) {
        await settings.update(currencyRow.id, { value: nextVal });
      } else {
        await settings.create({ key: "currency_preference", value: nextVal });
      }
    } catch (err) {
      console.error("Currency conversion failed:", err);
    } finally {
      setConverting(false);
    }
  };

  // Helper to format money with selected symbol
  const formatVal = (val: number) => {
    return `${currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ── Database Queries & Calculations ─────────────────────────────────────────
  const allEntries = moneyEntries.rows;

  // Active user details
  const myKey = activeUser || "user1";
  const otherKey = myKey === "user1" ? "user2" : "user1";

  // Calculate wallet totals
  const getWalletTotal = (userKey: string) => {
    const otherUserKey = userKey === "user1" ? "user2" : "user1";

    const userIncome = allEntries
      .filter((e) => e.added_by === userKey && e.type === "Income" && !e.is_request)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const userExpenses = allEntries
      .filter((e) => e.added_by === userKey && e.type === "Expense" && !e.is_request)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // Deduct split requests sent by the other user that this user has approved/settled
    const approvedRequestsFromOther = allEntries
      .filter((e) => e.added_by === otherUserKey && e.request_to === userKey && e.is_request && (e.request_status === "approved" || e.request_status === "settled"))
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // Add split requests sent by this user that the other user has settled (cash paid IRL)
    const settledRequestsToOther = allEntries
      .filter((e) => e.added_by === userKey && e.request_to === otherUserKey && e.is_request && e.request_status === "settled")
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return userIncome - userExpenses - approvedRequestsFromOther + settledRequestsToOther;
  };

  const myWalletTotal = getWalletTotal(myKey);

  // Filter lists
  const myTransactions = useMemo(() => {
    return allEntries.filter((e) => e.added_by === myKey && !e.is_request);
  }, [allEntries, myKey]);

  // Request Split lists
  const pendingRequestsToMe = useMemo(() => {
    return allEntries.filter((e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && e.request_status === "pending");
  }, [allEntries, otherKey, myKey]);

  const sentPendingRequests = useMemo(() => {
    return allEntries.filter((e) => e.added_by === myKey && e.request_to === otherKey && e.is_request && e.request_status === "pending");
  }, [allEntries, myKey, otherKey]);

  const approvedUnpaidDebts = useMemo(() => {
    // Splits approved by otherKey (meaning they owe me money, waiting for them to pay me cash IRL)
    return allEntries.filter((e) => e.added_by === myKey && e.request_to === otherKey && e.is_request && e.request_status === "approved");
  }, [allEntries, myKey, otherKey]);

  const approvedMyDebts = useMemo(() => {
    // Splits approved by me (meaning I owe otherKey money, showing checkbox for me to mark as settled once I pay them IRL)
    return allEntries.filter((e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && e.request_status === "approved");
  }, [allEntries, otherKey, myKey]);

  const createEntry = async () => {
    if (!description.trim() || Number(amount) <= 0) return;
    const numAmount = Number(amount);

    if (type === "Expense" && splitMode === "split") {
      const splitAmount = Number((numAmount / 2).toFixed(2));

      // 1. Create half-share expense entry for current user
      await moneyEntries.create({
        description: `${description} (My Share)`,
        amount: splitAmount,
        type: "Expense",
        added_by: myKey,
        category,
        is_request: false,
        entry_date: entryDate
      });

      // 2. Create split request entry for the other partner
      await moneyEntries.create({
        description: `${description} (Split)`,
        amount: splitAmount,
        type: "Expense",
        added_by: myKey,
        category,
        is_request: true,
        request_to: otherKey,
        request_status: "pending",
        entry_date: entryDate
      });
    } else if (type === "Expense" && splitMode === "request") {
      // Create request entry for the whole specific amount from partner
      await moneyEntries.create({
        description: `${description} (Request)`,
        amount: numAmount,
        type: "Expense",
        added_by: myKey,
        category,
        is_request: true,
        request_to: otherKey,
        request_status: "pending",
        entry_date: entryDate
      });
    } else {
      await moneyEntries.create({
        description,
        amount: numAmount,
        type,
        added_by: myKey,
        category,
        is_request: false,
        entry_date: entryDate
      });
    }

    setDescription("");
    setAmount("0");
    setSplitMode("none");
  };

  // ── Pie Chart Data ────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const expenses = allEntries.filter(
      (e) => e.added_by === myKey && e.type === "Expense" && !e.is_request
    );
    const approvedSplits = allEntries.filter(
      (e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && (e.request_status === "approved" || e.request_status === "settled")
    );

    const totals: Record<string, number> = {};
    CATEGORIES.forEach((c) => { totals[c] = 0; });

    expenses.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount); });
    approvedSplits.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount); });

    const data = Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);

    const sum = data.reduce((s, item) => s + item.value, 0);

    return { data, sum };
  }, [allEntries, myKey, otherKey]);

  // SVG circular segments calculation
  const svgCircles = useMemo(() => {
    let accumulated = 0;
    return pieData.data.map((item) => {
      const percentage = (item.value / pieData.sum) * 100;
      const strokeDashoffset = 100 - accumulated;
      accumulated += percentage;
      return {
        ...item,
        percentage,
        strokeDasharray: `${percentage} ${100 - percentage}`,
        strokeDashoffset
      };
    });
  }, [pieData]);

  // ── Weekly spending insights ───────────────────────────────────────────────
  const weeklyInsights = useMemo(() => {
    const now = new Date();
    // Monday of current week
    const currentMonday = new Date(now);
    const day = currentMonday.getDay();
    const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
    currentMonday.setDate(diff);
    currentMonday.setHours(0, 0, 0, 0);

    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);

    const getWeekExpenses = (start: Date, end: Date) => {
      const startISO = start.toISOString().split("T")[0];
      const endISO = end.toISOString().split("T")[0];

      const expenses = allEntries.filter(
        (e) => e.added_by === myKey && e.type === "Expense" && !e.is_request && e.entry_date >= startISO && e.entry_date <= endISO
      );
      const splits = allEntries.filter(
        (e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && (e.request_status === "approved" || e.request_status === "settled") && e.entry_date >= startISO && e.entry_date <= endISO
      );

      const combined = [...expenses, ...splits];
      const total = combined.reduce((s, e) => s + Number(e.amount), 0);

      const byCat: Record<string, number> = {};
      combined.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });

      return { total, byCat };
    };

    const currentWeek = getWeekExpenses(currentMonday, now);
    const prevWeek = getWeekExpenses(prevMonday, new Date(currentMonday.getTime() - 1));

    const topCategory = Object.entries(currentWeek.byCat).sort((a, b) => b[1] - a[1])[0];

    return {
      currentTotal: currentWeek.total,
      prevTotal: prevWeek.total,
      topCategoryName: topCategory ? topCategory[0] : null,
      topCategoryValue: topCategory ? topCategory[1] : 0
    };
  }, [allEntries, myKey, otherKey]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Money</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private wallets &amp; split expense tracking.</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl border dark:border-zinc-800"
          onClick={toggleCurrency}
          disabled={converting}
        >
          {converting ? "Converting..." : `Currency: ${currency} (${currencySymbol})`}
        </Button>
      </div>

      {/* ── Two Columns: Wallets ────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User 1 Wallet */}
        <Card className="relative overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-zinc-50">
              {names.user1}&apos;s Wallet {myKey === "user1" && <span className="text-xs font-normal text-green-600">(You)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {myKey === "user1" ? (
              <>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatVal(myWalletTotal)}
                </div>
                <div className="max-h-[300px] overflow-y-auto grid gap-2 pr-1">
                  {myTransactions.map((e) => (
                    <div key={e.id} className="flex justify-between items-center p-2 rounded-lg border bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-zinc-800 dark:text-zinc-200">{e.description}</p>
                        <p className="text-xs text-muted-foreground">{e.category} • {e.entry_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("font-bold", e.type === "Income" ? "text-green-600" : "text-zinc-900 dark:text-zinc-50")}>
                          {e.type === "Income" ? "+" : "-"}{formatVal(Number(e.amount))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeletingEntry(e)}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {myTransactions.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No transactions recorded yet.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-dashed dark:border-zinc-800">
                <div className="text-2xl text-muted-foreground">🔒</div>
                <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Balance &amp; History Private</p>
                <p className="text-xs text-muted-foreground mt-0.5">Visible only to {names.user1}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User 2 Wallet */}
        <Card className="relative overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-zinc-50">
              {names.user2}&apos;s Wallet {myKey === "user2" && <span className="text-xs font-normal text-green-600">(You)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {myKey === "user2" ? (
              <>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatVal(myWalletTotal)}
                </div>
                <div className="max-h-[300px] overflow-y-auto grid gap-2 pr-1">
                  {myTransactions.map((e) => (
                    <div key={e.id} className="flex justify-between items-center p-2 rounded-lg border bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-zinc-800 dark:text-zinc-200">{e.description}</p>
                        <p className="text-xs text-muted-foreground">{e.category} • {e.entry_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("font-bold", e.type === "Income" ? "text-green-600" : "text-zinc-900 dark:text-zinc-50")}>
                          {e.type === "Income" ? "+" : "-"}{formatVal(Number(e.amount))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeletingEntry(e)}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {myTransactions.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No transactions recorded yet.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-dashed dark:border-zinc-800">
                <div className="text-2xl text-muted-foreground">🔒</div>
                <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Balance &amp; History Private</p>
                <p className="text-xs text-muted-foreground mt-0.5">Visible only to {names.user2}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Savings Goals ─────────────────────────────────────────────────── */}
      <Card className="dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-900 dark:text-zinc-50">Savings Goals</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Put money aside for long-term targets.</p>
          </div>
          <Button onClick={() => setShowCreateGoal(true)} className="rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Create Goal
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savingsGoals.rows.filter((g) => g.created_by === myKey).map((goal) => {
              const percent = Math.min(100, Math.max(0, goal.target_amount ? (goal.current_amount / goal.target_amount) * 100 : 0));
              return (
                <Card key={goal.id} className="relative overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50 border dark:border-zinc-800">
                  <CardContent className="pt-6 grid gap-4">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">{goal.title}</h4>
                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded font-medium shrink-0">
                          by {goal.created_by === "user1" ? names.user1 : names.user2}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mt-2 text-xs">
                        <span className="text-zinc-500">Progress</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-50">
                          {formatVal(goal.current_amount)} / {formatVal(goal.target_amount)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Progress value={percent} className="h-2" />
                      <div className="text-[10px] text-right text-muted-foreground font-medium">{percent.toFixed(0)}% Complete</div>
                    </div>
                    
                    <div className="flex gap-2 justify-end mt-1 pt-3 border-t dark:border-zinc-800">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => { setAdjustingGoal(goal); setAdjustMode("deposit"); }}
                      >
                        Deposit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => { setAdjustingGoal(goal); setAdjustMode("withdraw"); }}
                        disabled={goal.current_amount <= 0}
                      >
                        Withdraw
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={() => setDeletingGoal(goal)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {savingsGoals.rows.filter((g) => g.created_by === myKey).length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3 py-8 text-center text-xs text-muted-foreground italic">
                No savings goals created yet. Set a goal to start saving!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Split Requests Dashboard ────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Money Requests Panel */}
        <Card className="dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-zinc-50">Split Approvals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Needs My Approval */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Needs Your Approval</h3>
              <div className="grid gap-2">
                {pendingRequestsToMe.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-3 rounded-xl border bg-amber-50/20 border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/40 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{e.description}</p>
                      <p className="text-xs text-muted-foreground">Requested by {myKey === "user1" ? names.user2 : names.user1}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-lg h-8 px-3"
                        onClick={() => moneyEntries.update(e.id, { request_status: "approved" })}
                      >
                        Approve ({formatVal(Number(e.amount))})
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 w-8 p-0 text-destructive"
                        onClick={() => moneyEntries.remove(e.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingRequestsToMe.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic">No requests waiting for your approval.</p>
                )}
              </div>
            </div>

            {/* Waiting for Partner */}
            <div className="mt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Pending Partner Approval</h3>
              <div className="grid gap-1">
                {sentPendingRequests.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-2 rounded-lg border bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 text-sm">
                    <span className="truncate text-zinc-700 dark:text-zinc-300">{e.description}</span>
                    <span className="font-semibold text-muted-foreground shrink-0">{formatVal(Number(e.amount))}</span>
                  </div>
                ))}
                {sentPendingRequests.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic">No pending requests sent.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debts & Settling Panel */}
        <Card className="dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-zinc-50">Cash Settlements</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Approved Debts I owe them (Mark as Settled when I pay) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">You Owe (Check when paid cash)</h3>
              <div className="grid gap-2">
                {approvedMyDebts.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-3 rounded-xl border bg-red-50/20 border-red-200 dark:bg-red-950/10 dark:border-red-900/40 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{e.description}</p>
                      <p className="text-xs text-muted-foreground">Owed to {myKey === "user1" ? names.user2 : names.user1}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/20 flex gap-1.5"
                      onClick={() => moneyEntries.update(e.id, { request_status: "settled" })}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Paid {formatVal(Number(e.amount))}
                    </Button>
                  </div>
                ))}
                {approvedMyDebts.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic">No debts to settle. All clear! 🎉</p>
                )}
              </div>
            </div>

            {/* Approved Debts they owe me */}
            <div className="mt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">They Owe You (Waiting for payment)</h3>
              <div className="grid gap-2">
                {approvedUnpaidDebts.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-2 rounded-lg border bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate text-zinc-700 dark:text-zinc-300">{e.description}</p>
                      <p className="text-xs text-muted-foreground">Waiting for {myKey === "user1" ? names.user2 : names.user1}</p>
                    </div>
                    <span className="font-bold text-green-600 shrink-0">{formatVal(Number(e.amount))}</span>
                  </div>
                ))}
                {approvedUnpaidDebts.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic">Nobody owes you currently.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Add Entry & Spending Charts ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* New Transaction Form */}
        <Card className="dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-zinc-50">New Entry</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Description">
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rent, Groceries, Fiverr..." />
              </Field>
              <Field label="Amount">
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type">
                <Select value={type} onValueChange={(t) => { setType(t as "Income" | "Expense"); if (t === "Income") setSplitMode("none"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </Field>
            </div>
            {type === "Expense" && (
              <div className="grid gap-2 pt-1">
                <span className="text-xs font-semibold text-zinc-700">Split / Request Options</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setSplitMode("none")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all h-14",
                      splitMode === "none"
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <span>None</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-normal">Personal expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("split")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all h-14",
                      splitMode === "split"
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <span>Split 50/50</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-normal">Request half</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("request")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all h-14",
                      splitMode === "request"
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <span>Request Full</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-normal">Request whole amt</span>
                  </button>
                </div>
              </div>
            )}
            <Button className="mt-2" onClick={createEntry}>Create Entry</Button>
          </CardContent>
        </Card>

        {/* Charts & Spending Pie Chart */}
        <Card className="dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-zinc-50">Spending Insights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
            {pieData.sum > 0 ? (
              <div className="relative h-[160px] w-[160px] mx-auto">
                <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
                  {svgCircles.map((circle) => (
                    <circle
                      key={circle.name}
                      cx="21"
                      cy="21"
                      r="15.9154943"
                      fill="transparent"
                      stroke={CATEGORY_COLORS[circle.name] || "#9ca3af"}
                      strokeWidth="5.2"
                      strokeDasharray={circle.strokeDasharray}
                      strokeDashoffset={circle.strokeDashoffset}
                      className="transition-all duration-300"
                      style={{ transformOrigin: "center" }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-muted-foreground">Total Spend</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{formatVal(pieData.sum)}</span>
                </div>
              </div>
            ) : (
              <div className="h-[160px] w-[160px] mx-auto rounded-full border-4 border-dashed dark:border-zinc-800 flex items-center justify-center text-xs text-muted-foreground text-center p-3">
                No spending data this month
              </div>
            )}
            <div className="grid gap-2">
              {pieData.sum > 0 ? (
                svgCircles.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[c.name] }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground">{c.percentage.toFixed(0)}% ({formatVal(c.value)})</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">Add expenses to populate categories.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Weekly Insights Card ────────────────────────────────────────────── */}
      <Card className="dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Weekly Wallet Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-700 dark:text-zinc-300 grid gap-3">
          <p>
            This week you spent <strong className="text-zinc-900 dark:text-zinc-50">{formatVal(weeklyInsights.currentTotal)}</strong>
            {weeklyInsights.prevTotal > 0 ? (
              <span>
                , which is{" "}
                <strong className={cn(weeklyInsights.currentTotal <= weeklyInsights.prevTotal ? "text-green-600" : "text-red-500")}>
                  {Math.abs(((weeklyInsights.currentTotal - weeklyInsights.prevTotal) / weeklyInsights.prevTotal) * 100).toFixed(0)}%{" "}
                  {weeklyInsights.currentTotal <= weeklyInsights.prevTotal ? "less" : "more"}
                </strong>{" "}
                than last week ({formatVal(weeklyInsights.prevTotal)}).
              </span>
            ) : (
              <span>. (No data recorded for previous week to compare).</span>
            )}
          </p>
          {weeklyInsights.topCategoryName ? (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border dark:border-zinc-800 flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Top category spend: {weeklyInsights.topCategoryName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You spent {formatVal(weeklyInsights.topCategoryValue)} on {weeklyInsights.topCategoryName} this week.
                  {weeklyInsights.topCategoryName === "Tea" && " That’s a lot of cups! Try setting a small daily tea budget to lock-in."}
                  {weeklyInsights.topCategoryName === "Food" && " Consider cooking together or meal prepping to reduce food costs."}
                  {weeklyInsights.topCategoryName === "Travel" && " Check if you can combine trips or carpool to optimize travel."}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Add entries this week to generate detailed spending recommendations.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        title="Delete Transaction?"
        description={`Are you sure you want to delete "${deletingEntry?.description}"?`}
        onConfirm={() => {
          if (deletingEntry) moneyEntries.remove(deletingEntry.id);
        }}
      />

      {/* ── Create Goal Dialog ────────────────────────────────────────── */}
      <Dialog open={showCreateGoal} onOpenChange={(open) => !open && setShowCreateGoal(false)}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>New Savings Goal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <Field label="Goal Title">
              <Input
                placeholder="Trip to Tokyo, New Mac Studio, emergency fund..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
              />
            </Field>
            <Field label={`Target Amount (${currencySymbol})`}>
              <Input
                type="number"
                placeholder="50000"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setShowCreateGoal(false)}>Cancel</Button>
              <Button onClick={handleCreateGoal} disabled={!newGoalTitle.trim() || Number(newGoalTarget) <= 0}>
                Create Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Deposit/Withdraw Dialog ────────────────────────────────────── */}
      <Dialog open={Boolean(adjustingGoal)} onOpenChange={(open) => !open && setAdjustingGoal(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>
              {adjustMode === "deposit" ? "Deposit to" : "Withdraw from"} {adjustingGoal?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="text-xs text-muted-foreground">
              Current Balance: <span className="font-bold text-zinc-900 dark:text-zinc-50">{adjustingGoal ? formatVal(adjustingGoal.current_amount) : ""}</span>
            </div>
            <Field label={`Amount to ${adjustMode === "deposit" ? "deposit" : "withdraw"} (${currencySymbol})`}>
              <Input
                type="number"
                placeholder="1000"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setAdjustingGoal(null)}>Cancel</Button>
              <Button onClick={handleAdjustGoal} disabled={Number(adjustAmount) <= 0}>
                Confirm {adjustMode === "deposit" ? "Deposit" : "Withdrawal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Goal Dialog ─────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingGoal)}
        onOpenChange={(open) => !open && setDeletingGoal(null)}
        title="Delete Savings Goal?"
        description={
          deletingGoal?.current_amount && deletingGoal.current_amount > 0
            ? `Are you sure you want to delete "${deletingGoal?.title}"? The remaining balance of ${formatVal(deletingGoal.current_amount)} will be refunded back to your wallet.`
            : `Are you sure you want to delete "${deletingGoal?.title}"?`
        }
        onConfirm={handleDeleteGoal}
      />
    </div>
  );
}
