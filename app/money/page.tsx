"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, Check, Sparkles, Trash2, X, Plus, Clock, ArrowRight, CircleDollarSign, CheckCheck, Send, Lock
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
  const { moneyEntries, savingsGoals, sendNotification } = useData();
  const { activeUser, activeUserName } = useActiveUser();
  const names = useUserNames();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState("Misc");
  const [splitMode, setSplitMode] = useState<"none" | "split" | "request">("none");
  const [entryDate, setEntryDate] = useState(todayISO());

  const [deletingEntry, setDeletingEntry] = useState<Row<"money_entries"> | null>(null);

  // Settlement workflow state
  const [payingEntry, setPayingEntry] = useState<Row<"money_entries"> | null>(null);
  const [payAmount, setPayAmount] = useState("");

  // Send money state
  const [sendDesc, setSendDesc] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendCategory, setSendCategory] = useState("Misc");

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

  const currencySymbol = "₹";

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

    // Only count fully settled & confirmed payments against wallet
    const settledRequestsFromOther = allEntries
      .filter((e) => e.added_by === otherUserKey && e.request_to === userKey && e.is_request && e.request_status === "settled" && e.payment_confirmed)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const settledRequestsToOther = allEntries
      .filter((e) => e.added_by === userKey && e.request_to === otherUserKey && e.is_request && e.request_status === "settled" && e.payment_confirmed)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return userIncome - userExpenses - settledRequestsFromOther + settledRequestsToOther;
  };

  const myWalletTotal = getWalletTotal(myKey);

  // Filter lists
  const myTransactions = useMemo(() => {
    return allEntries.filter((e) => e.added_by === myKey && !e.is_request);
  }, [allEntries, myKey]);

  // ── Split Approval Lists ──────────────────────────────────────────────────
  // Pending requests that need my approval
  const pendingRequestsToMe = useMemo(() => {
    return allEntries.filter((e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && e.request_status === "pending");
  }, [allEntries, otherKey, myKey]);

  // My sent requests waiting for partner to approve
  const sentPendingRequests = useMemo(() => {
    return allEntries.filter((e) => e.added_by === myKey && e.request_to === otherKey && e.is_request && e.request_status === "pending");
  }, [allEntries, myKey, otherKey]);

  // ── Cash Settlement Lists ─────────────────────────────────────────────────
  // Approved debts I owe (I need to pay them)
  const debtsIOwe = useMemo(() => {
    return allEntries.filter((e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && e.request_status === "approved");
  }, [allEntries, otherKey, myKey]);

  // I paid, waiting for partner to confirm receipt
  const waitingConfirmation = useMemo(() => {
    return allEntries.filter((e) => e.is_request && e.request_status === "confirming" && e.paid_by === myKey);
  }, [allEntries, myKey]);




  // Correctly: partner paid me, I confirm
  const confirmReceipts = useMemo(() => {
    return allEntries.filter((e) => e.is_request && e.request_status === "confirming" && e.paid_by === otherKey &&
      // I am the one who originally requested the money (added_by === myKey means I requested from otherKey)
      // OR otherKey requested from me, otherKey approved, now otherKey paid → but that doesn't make sense
      // Simplify: the person who should confirm is the one who originally requested the money (added_by)
      e.added_by === myKey
    );
  }, [allEntries, myKey, otherKey]);

  // They owe me money (approved, waiting for them to pay)
  const debtsTheyOwe = useMemo(() => {
    return allEntries.filter((e) => e.added_by === myKey && e.request_to === otherKey && e.is_request && e.request_status === "approved");
  }, [allEntries, myKey, otherKey]);

  // Handle payment submission
  const handlePay = async (entry: Row<"money_entries">, amount: number) => {
    if (amount <= 0) return;
    const newPaidAmount = (entry.paid_amount || 0) + amount;
    await moneyEntries.update(entry.id, {
      request_status: "confirming",
      paid_amount: newPaidAmount,
      paid_by: myKey,
    });
    sendNotification(
      otherKey,
      "Payment Received",
      `${activeUserName} paid ${formatVal(amount)} for: ${entry.description} (waiting confirmation)`
    );
    setPayingEntry(null);
    setPayAmount("");
  };

  // Handle receipt confirmation
  const handleConfirmReceipt = async (entry: Row<"money_entries">) => {
    const paidSoFar = entry.paid_amount || 0;
    if (paidSoFar >= Number(entry.amount)) {
      // Fully paid — mark as settled
      await moneyEntries.update(entry.id, {
        request_status: "settled",
        payment_confirmed: true,
      });
      sendNotification(
        otherKey,
        "Payment Confirmed",
        `${activeUserName} confirmed receipt of ${formatVal(paidSoFar)} for: ${entry.description}`
      );
    } else {
      // Partial payment confirmed — go back to approved for remaining
      await moneyEntries.update(entry.id, {
        request_status: "approved",
        payment_confirmed: false,
        paid_by: null,
      });
      sendNotification(
        otherKey,
        "Partial Payment Confirmed",
        `${activeUserName} confirmed receipt of partial payment ${formatVal(paidSoFar)} for: ${entry.description}`
      );
    }
  };

  // Handle dispute (reject the payment claim)
  const handleDispute = async (entry: Row<"money_entries">) => {
    const oldPaidAmount = entry.paid_amount || 0;
    // Reset paid amount for this round and go back to approved
    await moneyEntries.update(entry.id, {
      request_status: "approved",
      paid_by: null,
      paid_amount: 0, // Reset to 0 for dispute
      payment_confirmed: false,
    });
    sendNotification(
      otherKey,
      "Payment Claim Disputed",
      `${activeUserName} disputed your payment of ${formatVal(oldPaidAmount)} for: ${entry.description}`
    );
  };

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

      sendNotification(
        otherKey,
        "Money Request",
        `${activeUserName} requested ${formatVal(splitAmount)} for: ${description}`
      );
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

      sendNotification(
        otherKey,
        "Money Request",
        `${activeUserName} requested ${formatVal(numAmount)} for: ${description}`
      );
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
      (e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && e.request_status === "settled" && e.payment_confirmed
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
        (e) => e.added_by === otherKey && e.request_to === myKey && e.is_request && e.request_status === "settled" && e.payment_confirmed && e.entry_date >= startISO && e.entry_date <= endISO
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
          <h1 className="text-3xl font-bold tracking-tight text-white text-wallpaper-safe">Money</h1>
          <p className="mt-1 text-sm text-white/90 text-wallpaper-safe">Private wallets &amp; split expense tracking.</p>
        </div>
      </div>

      {/* ── Two Columns: Wallets ────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User 1 Wallet */}
        <Card className="relative overflow-hidden bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-dark-text font-bold">
              {names.user1}&apos;s Wallet {myKey === "user1" && <span className="text-xs font-normal text-green-600">(You)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {myKey === "user1" ? (
              <>
                <div className="text-3xl font-extrabold text-zinc-900 dark:text-dark-text">
                  {formatVal(myWalletTotal)}
                </div>
                <div className="max-h-[300px] overflow-y-auto grid gap-2 pr-1 scrollbar-sleek">
                  {myTransactions.map((e) => (
                    <div key={e.id} className="flex justify-between items-center p-2.5 rounded-2xl border border-white/10 bg-white/15 dark:bg-black/15 backdrop-blur-sm text-sm shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-zinc-800 dark:text-white">{e.description}</p>
                        <p className="text-xs text-slate-500 dark:text-dark-text-secondary">{e.category} • {e.entry_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("font-bold", e.type === "Income" ? "text-green-600" : "text-zinc-900 dark:text-white")}>
                          {e.type === "Income" ? "+" : "-"}{formatVal(Number(e.amount))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-red-500/10 dark:hover:bg-red-950/20 rounded-lg"
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
              <div className="flex flex-col items-center justify-center py-10 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-dashed border-white/20 dark:border-white/10">
                <div className="p-3 bg-slate-100 dark:bg-[#2b2d31] rounded-full border border-white/10 shadow-sm">
                  <Lock className="h-5 w-5 text-slate-500 dark:text-dark-text-secondary" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-800 dark:text-white">Balance &amp; History Private</p>
                <p className="text-xs text-slate-500 dark:text-dark-text-secondary mt-0.5">Visible only to {names.user1}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User 2 Wallet */}
        <Card className="relative overflow-hidden bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-dark-text font-bold">
              {names.user2}&apos;s Wallet {myKey === "user2" && <span className="text-xs font-normal text-green-600">(You)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {myKey === "user2" ? (
              <>
                <div className="text-3xl font-extrabold text-zinc-900 dark:text-dark-text">
                  {formatVal(myWalletTotal)}
                </div>
                <div className="max-h-[300px] overflow-y-auto grid gap-2 pr-1 scrollbar-sleek">
                  {myTransactions.map((e) => (
                    <div key={e.id} className="flex justify-between items-center p-2.5 rounded-2xl border border-white/10 bg-white/15 dark:bg-black/15 backdrop-blur-sm text-sm shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-zinc-800 dark:text-white">{e.description}</p>
                        <p className="text-xs text-slate-500 dark:text-dark-text-secondary">{e.category} • {e.entry_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("font-bold", e.type === "Income" ? "text-green-600" : "text-zinc-900 dark:text-white")}>
                          {e.type === "Income" ? "+" : "-"}{formatVal(Number(e.amount))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-red-500/10 dark:hover:bg-red-950/20 rounded-lg"
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
              <div className="flex flex-col items-center justify-center py-10 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-dashed border-white/20 dark:border-white/10">
                <div className="p-3 bg-slate-100 dark:bg-[#2b2d31] rounded-full border border-white/10 shadow-sm">
                  <Lock className="h-5 w-5 text-slate-500 dark:text-dark-text-secondary" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-800 dark:text-white">Balance &amp; History Private</p>
                <p className="text-xs text-slate-500 dark:text-dark-text-secondary mt-0.5">Visible only to {names.user2}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Savings Goals ─────────────────────────────────────────────────── */}
      <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-900 dark:text-dark-text font-bold">Savings Goals</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Put money aside for long-term targets.</p>
          </div>
          <Button onClick={() => setShowCreateGoal(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all active:scale-[0.98]">
            <Plus className="h-4 w-4 mr-1.5" /> Create Goal
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savingsGoals.rows.filter((g) => g.created_by === myKey).map((goal) => {
              const percent = Math.min(100, Math.max(0, goal.target_amount ? (goal.current_amount / goal.target_amount) * 100 : 0));
              return (
                <Card key={goal.id} className="relative overflow-hidden bg-white/25 dark:bg-black/25 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl shadow-md">
                  <CardContent className="pt-6 grid gap-4">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-bold text-sm text-zinc-800 dark:text-white truncate">{goal.title}</h4>
                        <span className="text-[10px] bg-white/20 dark:bg-black/20 text-slate-700 dark:text-dark-text-secondary px-1.5 py-0.5 rounded font-medium shrink-0 border border-white/10">
                          by {goal.created_by === "user1" ? names.user1 : names.user2}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mt-2 text-xs">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {formatVal(goal.current_amount)} / {formatVal(goal.target_amount)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Progress value={percent} className="h-2" />
                      <div className="text-[10px] text-right text-muted-foreground font-medium">{percent.toFixed(0)}% Complete</div>
                    </div>
                    
                    <div className="flex gap-2 justify-end mt-1 pt-3 border-t border-white/10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-white/20 dark:border-white/10 text-slate-700 dark:text-dark-text hover:bg-white/20"
                        onClick={() => { setAdjustingGoal(goal); setAdjustMode("deposit"); }}
                      >
                        Deposit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-white/20 dark:border-white/10 text-slate-700 dark:text-dark-text hover:bg-white/20"
                        onClick={() => { setAdjustingGoal(goal); setAdjustMode("withdraw"); }}
                        disabled={goal.current_amount <= 0}
                      >
                        Withdraw
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-red-500/10 dark:hover:bg-red-950/20 rounded-lg"
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
        {/* Split Approvals Panel */}
        <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-dark-text font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Split Approvals
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Approve or reject incoming money requests.</p>
          </CardHeader>
          <CardContent className="grid gap-5">
            {/* Needs My Approval */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Needs Your Approval
              </h3>
              <div className="grid gap-2">
                {pendingRequestsToMe.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 dark:bg-amber-950/20 backdrop-blur-md text-sm transition-all hover:shadow-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-800 dark:text-white truncate">{e.description}</p>
                      <p className="text-xs text-slate-500 dark:text-dark-text-secondary">
                        Requested by {e.added_by === "user1" ? names.user1 : names.user2} • {e.entry_date}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-3">
                      <Button
                        size="sm"
                        className="rounded-lg h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={async () => {
                          await moneyEntries.update(e.id, { request_status: "approved" });
                          sendNotification(
                            otherKey,
                            "Money Request Approved",
                            `${activeUserName} approved your request for ${formatVal(Number(e.amount))}: ${e.description}`
                          );
                        }}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Approve {formatVal(Number(e.amount))}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-red-500/10 dark:hover:bg-red-950/25"
                        onClick={() => moneyEntries.remove(e.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingRequestsToMe.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 italic text-center">No requests waiting for your approval.</p>
                )}
              </div>
            </div>

            {/* Waiting for Partner */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-zinc-400" />
                Pending Partner Approval
              </h3>
              <div className="grid gap-1.5">
                {sentPendingRequests.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-2.5 rounded-xl border border-white/10 bg-white/15 dark:bg-black/15 backdrop-blur-sm text-sm">
                    <span className="truncate text-zinc-700 dark:text-white min-w-0 flex-1">{e.description}</span>
                    <span className="font-semibold text-slate-500 dark:text-dark-text-secondary shrink-0 ml-3">{formatVal(Number(e.amount))}</span>
                  </div>
                ))}
                {sentPendingRequests.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic text-center">No pending requests sent.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Settlements Panel */}
        <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base text-zinc-900 dark:text-dark-text font-bold flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
              Cash Settlements
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Track payments and confirm receipts.</p>
          </CardHeader>
          <CardContent className="grid gap-5">

            {/* ── 1. Confirm Receipt (partner paid, I need to confirm) ─────── */}
            {confirmReceipts.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Confirm Receipt
                </h3>
                <div className="grid gap-2">
                  {confirmReceipts.map((e) => {
                    const paidAmt = e.paid_amount || 0;
                    const totalAmt = Number(e.amount);
                    return (
                      <div key={e.id} className="p-3.5 rounded-2xl border border-blue-500/35 bg-blue-500/10 dark:bg-blue-950/20 backdrop-blur-md text-sm transition-all shadow-md">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-800 dark:text-white truncate">{e.description}</p>
                            <p className="text-xs text-slate-500 dark:text-dark-text-secondary mt-0.5">
                              {e.paid_by === "user1" ? names.user1 : names.user2} claims to have paid
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-blue-750 dark:text-blue-400">{formatVal(paidAmt)}</p>
                            <p className="text-[10px] text-muted-foreground">of {formatVal(totalAmt)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-8 border-red-500/20 text-red-650 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-950/25 text-xs font-bold"
                            onClick={() => handleDispute(e)}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Dispute
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-lg h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                            onClick={() => handleConfirmReceipt(e)}
                          >
                            <CheckCheck className="h-3.5 w-3.5 mr-1" />
                            {paidAmt >= totalAmt ? "Confirm & Settle" : "Confirm Partial"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 2. You Owe (approved debts I need to pay) ──────────────── */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                You Owe
              </h3>
              <div className="grid gap-2">
                {debtsIOwe.map((e) => {
                  const totalAmt = Number(e.amount);
                  const paidSoFar = e.paid_amount || 0;
                  const remaining = totalAmt - paidSoFar;
                  const isPayingThis = payingEntry?.id === e.id;

                  return (
                    <div key={e.id} className="rounded-2xl border border-red-500/25 bg-red-500/10 dark:bg-red-950/20 backdrop-blur-md text-sm transition-all shadow-sm">
                      <div className="flex justify-between items-start p-3 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-800 dark:text-white truncate">{e.description}</p>
                          <p className="text-xs text-slate-500 dark:text-dark-text-secondary mt-0.5">
                            Owed to {e.added_by === "user1" ? names.user1 : names.user2} • {e.entry_date}
                          </p>
                          {paidSoFar > 0 && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1">
                              Previously paid: {formatVal(paidSoFar)} • Remaining: {formatVal(remaining)}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-extrabold text-red-600 dark:text-red-400">{formatVal(remaining)}</p>
                        </div>
                      </div>
                      
                      {!isPayingThis ? (
                        <div className="px-3 pb-3 flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-8 border-red-500/20 text-red-650 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-950/25 text-xs font-bold"
                            onClick={() => { setPayingEntry(e); setPayAmount(remaining.toString()); }}
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Pay Now
                          </Button>
                        </div>
                      ) : (
                        <div className="px-3 pb-3 border-t border-red-500/20 pt-3 mt-1">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-1 block">Payment Amount</label>
                              <Input
                                type="number"
                                value={payAmount}
                                onChange={(ev) => setPayAmount(ev.target.value)}
                                placeholder="Enter amount..."
                                className="h-9 text-sm bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"
                                autoFocus
                              />
                            </div>
                            <Button
                              size="sm"
                              className="rounded-lg h-9 bg-red-600 hover:bg-red-700 text-white text-xs shrink-0 font-bold"
                              disabled={Number(payAmount) <= 0 || Number(payAmount) > remaining}
                              onClick={() => handlePay(e, Number(payAmount))}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 shrink-0 text-zinc-400 hover:text-zinc-700"
                              onClick={() => { setPayingEntry(null); setPayAmount(""); }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              type="button"
                              className="text-[10px] font-bold text-red-600 dark:text-red-450 hover:underline px-2 py-1 rounded-md"
                              onClick={() => setPayAmount(remaining.toString())}
                            >
                              Pay Full ({formatVal(remaining)})
                            </button>
                            {remaining > 100 && (
                              <button
                                type="button"
                                className="text-[10px] font-bold text-slate-500 dark:text-dark-text-secondary hover:underline px-2 py-1 rounded-md"
                                onClick={() => setPayAmount(Math.round(remaining / 2).toString())}
                              >
                                Pay Half ({formatVal(Math.round(remaining / 2))})
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {debtsIOwe.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic text-center flex items-center justify-center gap-1.5">
                    <CheckCheck className="h-4 w-4 text-green-500 shrink-0" />
                    No debts to settle. All clear!
                  </p>
                )}
              </div>
            </div>

            {/* ── 3. Waiting Confirmation (I paid, waiting for partner) ──── */}
            {waitingConfirmation.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-amber-400 animate-pulse" />
                  Waiting Confirmation
                </h3>
                <div className="grid gap-2">
                  {waitingConfirmation.map((e) => (
                    <div key={e.id} className="flex justify-between items-center p-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 dark:bg-amber-950/20 backdrop-blur-md text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-800 dark:text-white truncate">{e.description}</p>
                        <p className="text-xs text-amber-605 dark:text-amber-400 font-bold mt-0.5">
                          Paid {formatVal(e.paid_amount || 0)} — waiting for {e.added_by === "user1" ? names.user1 : names.user2} to confirm
                        </p>
                      </div>
                      <div className="shrink-0 ml-3 flex items-center gap-1.5 text-amber-600">
                        <Clock className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-bold">Pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 4. They Owe You (waiting for them to pay) ────────────── */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-text-secondary mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                They Owe You
              </h3>
              <div className="grid gap-2">
                {debtsTheyOwe.map((e) => {
                  const totalAmt = Number(e.amount);
                  const paidSoFar = e.paid_amount || 0;
                  return (
                    <div key={e.id} className="flex justify-between items-center p-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 dark:bg-emerald-950/20 backdrop-blur-md text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-zinc-700 dark:text-white">{e.description}</p>
                        <p className="text-xs text-slate-500 dark:text-dark-text-secondary mt-0.5">
                          Waiting for {e.request_to === "user1" ? names.user1 : names.user2} to pay
                        </p>
                        {paidSoFar > 0 && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            Partially paid: {formatVal(paidSoFar)} / {formatVal(totalAmt)}
                          </p>
                        )}
                      </div>
                      <span className="font-extrabold text-emerald-650 dark:text-emerald-450 shrink-0 ml-3 text-base">{formatVal(totalAmt - paidSoFar)}</span>
                    </div>
                  );
                })}
                {debtsTheyOwe.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic text-center">Nobody owes you currently.</p>
                )}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* ── Send Money ────────────────────────────────────────────────────── */}
      <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base text-zinc-900 dark:text-dark-text font-bold flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-500" />
            Send Money to {otherKey === "user1" ? names.user1 : names.user2}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Proactively pay your partner — for split bills, dues, or anything they forgot to request.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                value={sendDesc}
                onChange={(ev) => setSendDesc(ev.target.value)}
                placeholder="What's this for? e.g. Your half of dinner"
                className="h-10 bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"
              />
            </div>
            <div className="w-full sm:w-[140px]">
              <Input
                type="number"
                value={sendAmount}
                onChange={(ev) => setSendAmount(ev.target.value)}
                placeholder="Amount"
                className="h-10 bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"
              />
            </div>
            <div className="w-full sm:w-[130px]">
              <Select value={sendCategory} onValueChange={setSendCategory}>
                <SelectTrigger className="h-10 bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0 font-bold transition-all active:scale-[0.98]"
              disabled={!sendDesc.trim() || Number(sendAmount) <= 0}
              onClick={async () => {
                const amt = Number(sendAmount);
                if (!sendDesc.trim() || amt <= 0) return;
                // Create as if the partner requested it, but skip to confirming
                await moneyEntries.create({
                  description: `${sendDesc.trim()} (Sent)`,
                  amount: amt,
                  type: "Expense",
                  added_by: otherKey,
                  category: sendCategory,
                  is_request: true,
                  request_to: myKey,
                  request_status: "confirming",
                  paid_amount: amt,
                  paid_by: myKey,
                  entry_date: todayISO(),
                });
                sendNotification(
                  otherKey,
                  "Money Received",
                  `${activeUserName} sent you ${formatVal(amt)} for: ${sendDesc.trim()} (waiting confirmation)`
                );
                setSendDesc("");
                setSendAmount("");
                setSendCategory("Misc");
              }}
            >
              <Send className="h-4 w-4 mr-1.5" />
              Send {Number(sendAmount) > 0 ? formatVal(Number(sendAmount)) : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Add Entry & Spending Charts ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* New Transaction Form */}
        <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-dark-text font-bold">New Entry</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Description">
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rent, Groceries, Fiverr..." className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl" />
              </Field>
              <Field label="Amount">
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type">
                <Select value={type} onValueChange={(t) => { setType(t as "Income" | "Expense"); if (t === "Income") setSplitMode("none"); }}>
                  <SelectTrigger className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl" />
              </Field>
            </div>
            {type === "Expense" && (
              <div className="grid gap-2 pt-1">
                <span className="text-xs font-bold text-slate-500 dark:text-dark-text-secondary">Split / Request Options</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setSplitMode("none")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all h-14 border",
                      splitMode === "none"
                        ? "bg-white/40 dark:bg-white/15 text-indigo-650 dark:text-indigo-400 border-white/25 dark:border-white/10 shadow-sm"
                        : "bg-transparent text-slate-500 dark:text-dark-text-secondary border-white/10 dark:border-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <span>None</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-normal">Personal expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("split")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all h-14 border",
                      splitMode === "split"
                        ? "bg-white/40 dark:bg-white/15 text-indigo-650 dark:text-indigo-400 border-white/25 dark:border-white/10 shadow-sm"
                        : "bg-transparent text-slate-500 dark:text-dark-text-secondary border-white/10 dark:border-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <span>Split 50/50</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-normal">Request half</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("request")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold transition-all h-14 border",
                      splitMode === "request"
                        ? "bg-white/40 dark:bg-white/15 text-indigo-650 dark:text-indigo-400 border-white/25 dark:border-white/10 shadow-sm"
                        : "bg-transparent text-slate-500 dark:text-dark-text-secondary border-white/10 dark:border-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <span>Request Full</span>
                    <span className="text-[10px] opacity-80 mt-0.5 font-normal">Request whole amt</span>
                  </button>
                </div>
              </div>
            )}
            <Button className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl" onClick={createEntry}>Create Entry</Button>
          </CardContent>
        </Card>

        {/* Charts & Spending Pie Chart */}
        <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-dark-text font-bold">Spending Insights</CardTitle>
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
                  <span className="text-xs text-muted-foreground font-semibold">Total Spend</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatVal(pieData.sum)}</span>
                </div>
              </div>
            ) : (
              <div className="h-[160px] w-[160px] mx-auto rounded-full border-4 border-dashed border-white/20 dark:border-white/10 flex items-center justify-center text-xs text-muted-foreground text-center p-3">
                No spending data this month
              </div>
            )}
            <div className="grid gap-2">
              {pieData.sum > 0 ? (
                svgCircles.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-white">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[c.name] }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-slate-500 dark:text-dark-text-secondary">{c.percentage.toFixed(0)}% ({formatVal(c.value)})</span>
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
      <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-dark-text font-bold">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Weekly Wallet Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-700 dark:text-dark-text-secondary grid gap-3">
          <p>
            This week you spent <strong className="text-zinc-900 dark:text-white">{formatVal(weeklyInsights.currentTotal)}</strong>
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
            <div className="p-3.5 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-white/15 dark:border-white/5 flex gap-3 items-start shadow-sm">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Top category spend: {weeklyInsights.topCategoryName}</p>
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
        <DialogContent className="max-w-md bg-white/80 dark:bg-black/85 backdrop-blur-2xl border border-white/25 dark:border-white/10 rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle>New Savings Goal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <Field label="Goal Title">
              <Input
                placeholder="Trip to Tokyo, New Mac Studio, emergency fund..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"
              />
            </Field>
            <Field label={`Target Amount (${currencySymbol})`}>
              <Input
                type="number"
                placeholder="50000"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" className="border-white/25 dark:border-white/10 text-slate-700 dark:text-dark-text hover:bg-white/20 rounded-xl" onClick={() => setShowCreateGoal(false)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl" onClick={handleCreateGoal} disabled={!newGoalTitle.trim() || Number(newGoalTarget) <= 0}>
                Create Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Deposit/Withdraw Dialog ────────────────────────────────────── */}
      <Dialog open={Boolean(adjustingGoal)} onOpenChange={(open) => !open && setAdjustingGoal(null)}>
        <DialogContent className="max-w-md bg-white/80 dark:bg-black/85 backdrop-blur-2xl border border-white/25 dark:border-white/10 rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle>
              {adjustMode === "deposit" ? "Deposit to" : "Withdraw from"} {adjustingGoal?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="text-xs text-muted-foreground font-semibold">
              Current Balance: <span className="font-bold text-zinc-900 dark:text-white">{adjustingGoal ? formatVal(adjustingGoal.current_amount) : ""}</span>
            </div>
            <Field label={`Amount to ${adjustMode === "deposit" ? "deposit" : "withdraw"} (${currencySymbol})`}>
              <Input
                type="number"
                placeholder="1000"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="bg-white/20 dark:bg-black/20 border-white/25 dark:border-white/10 rounded-xl"
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" className="border-white/25 dark:border-white/10 text-slate-700 dark:text-dark-text hover:bg-white/20 rounded-xl" onClick={() => setAdjustingGoal(null)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl" onClick={handleAdjustGoal} disabled={Number(adjustAmount) <= 0}>
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
