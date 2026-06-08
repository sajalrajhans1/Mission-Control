"use client";

import { useMemo, useState, useEffect } from "react";
import { TrendingUp, WalletCards, ListTodo, Pin, StickyNote, Trash2 } from "lucide-react";
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

const NOTE_COLORS = {
  Yellow: "bg-[#fff8c7]",
  Blue: "bg-[#dff2ff]",
  Green: "bg-[#e4f8df]",
  Pink: "bg-[#ffe6ef]"
} as const;

export default function HomePage() {
  const { tasks, moneyEntries, stickyNotes, settings } = useData();
  const { activeUserName } = useActiveUser();
  const { user1, user2 } = useUserNames();
  const userColors = useUserColors();
  const month = currentMonthRange();

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
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [stickyNotes.rows]
  );

  // --- Calculations ---
  const monthEntries = moneyEntries.rows.filter(
    (entry) => entry.entry_date >= month.start && entry.entry_date <= month.end
  );
  const income = monthEntries
    .filter((entry) => entry.type === "Income")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expenses = monthEntries
    .filter((entry) => entry.type === "Expense")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const progress = useMemo(() => {
    return [user1, user2].map((person) => {
      const owned = tasks.rows.filter(
        (task) => task.assigned_to === person || task.assigned_to === "Both"
      );
      const done = owned.filter((task) => task.completed).length;
      return { person, done, total: owned.length, percent: owned.length ? (done / owned.length) * 100 : 0 };
    });
  }, [tasks.rows, user1, user2]);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col justify-between gap-5 rounded-xl border bg-white p-6 shadow-soft md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Kya haal hai bhai, {activeUserName}?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user1} &amp; {user2} — building momentum together.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side: Progress & Money */}
        <div className="lg:col-span-7 grid gap-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-900">
                <TrendingUp className="h-4 w-4" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {progress.map((item) => (
                <div key={item.person} className="grid gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-zinc-800 flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.person === user1 ? userColors.user1 : userColors.user2 }}
                      />
                      {item.person}
                    </span>
                    <span className="text-muted-foreground">
                      {item.done} / {item.total} tasks
                    </span>
                  </div>
                  <Progress value={item.percent} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Money Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-900">
                <WalletCards className="h-4 w-4" />
                Money Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="font-semibold text-zinc-900">{formatMoney(income)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="font-semibold text-zinc-900">{formatMoney(expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-semibold text-zinc-900">{formatMoney(income - expenses)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Shared Priority List */}
        <Card className="lg:col-span-5 flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-zinc-900">
              <ListTodo className="h-4 w-4 text-primary" />
              Shared Priority List
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <Textarea
              className="flex-1 min-h-[150px] lg:min-h-[180px] resize-none rounded-xl border p-3 text-sm focus-visible:ring-1"
              placeholder="Write down the shared priorities here..."
              value={localText}
              onChange={(e) => {
                setLocalText(e.target.value);
                setIsEditing(true);
              }}
              onBlur={handleBlur}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {isSaving ? "Saving..." : parsedPriority.updatedBy ? `Last edited by ${parsedPriority.updatedBy} on ${parsedPriority.updatedAt}` : "Not edited yet"}
              </span>
              <Button size="sm" variant="default" className="rounded-xl px-4" onClick={handleSave} disabled={isSaving}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Sticky Notes */}
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Sticky Notes
          </h2>
        </div>

        {/* Sticky Notes Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {notes.map((item) => {
            const isCreator = item.author === activeUserName;
            return (
              <div key={item.id} className={cn("relative min-h-48 rounded-xl border p-4 shadow-soft", NOTE_COLORS[item.color as keyof typeof NOTE_COLORS] ?? "bg-white")}>
                {item.pinned && (
                  <div className="absolute -top-2 right-3 text-base" title="Pinned">📌</div>
                )}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <Input
                    className="border-transparent bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0 w-full"
                    value={item.title}
                    onChange={(e) => {
                      const updatedVal = e.target.value;
                      stickyNotes.update(item.id, { title: updatedVal });
                    }}
                    readOnly={!isCreator}
                  />
                  {isCreator && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title={item.pinned ? "Unpin" : "Pin"}
                        onClick={() => stickyNotes.update(item.id, { pinned: !item.pinned })}
                      >
                        <Pin className={cn("h-4 w-4", item.pinned ? "fill-current" : "")} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => setDeletingNote(item)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <AutosaveTextarea
                  value={item.body}
                  onSave={(body) => {
                    stickyNotes.update(item.id, { body });
                  }}
                  minHeight={110}
                  readOnly={!isCreator}
                />
                <div className="mt-3 flex items-center justify-between text-xs text-black/60">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.author === user1 ? userColors.user1 : userColors.user2 }}
                    />
                    {item.author}
                  </span>
                  <button
                    onClick={() => stickyNotes.update(item.id, { read: !item.read })}
                    className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-black/10", item.read ? "opacity-50" : "font-medium")}
                  >
                    {item.read ? "Read" : "Unread"}
                  </button>
                </div>
              </div>
            );
          })}
          {!notes.length ? (
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
              <Card className="py-12 border-dashed flex flex-col items-center justify-center text-muted-foreground">
                <StickyNote className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No sticky notes created yet.</p>
              </Card>
            </div>
          ) : null}
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
