"use client";
 
import { useState, useEffect } from "react";
import { Lightbulb, NotebookPen, Plus, StickyNote, WalletCards, WandSparkles, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { useData, useUserNames, useActiveUser } from "@/components/data-provider";
import { todayISO, buildSharingSuffix } from "@/lib/utils";
 
type Kind = "Task" | "Idea" | "Prompt" | "Sticky Note" | "Money Entry" | "Vault Entry";
 
const kinds: { label: Kind; icon: typeof Plus }[] = [
  { label: "Task", icon: NotebookPen },
  { label: "Idea", icon: Lightbulb },
  { label: "Prompt", icon: WandSparkles },
  { label: "Sticky Note", icon: StickyNote },
  { label: "Money Entry", icon: WalletCards },
  { label: "Vault Entry", icon: Archive }
];
 
export function QuickAdd({ inline = false }: { inline?: boolean }) {
  const data = useData();
  const names = useUserNames();
  const { activeUser } = useActiveUser();
  const [open, setOpen] = useState(false);
  const [sharingTarget, setSharingTarget] = useState(() => activeUser === "user1" ? "both" : "user1");
  const [kind, setKind] = useState<Kind>("Task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("0");
  const [type, setType] = useState<"Income" | "Expense">("Income");
  const [vaultId, setVaultId] = useState("");
 
  const customVaults = data.vaults.rows.filter((v) => !v.is_default);

  useEffect(() => {
    setSharingTarget(activeUser === "user1" ? "both" : "user1");
  }, [activeUser]);
 
  const reset = () => {
    setTitle("");
    setBody("");
    setAmount("0");
    setType("Income");
    setVaultId("");
    setOpen(false);
    setKind("Task");
    setSharingTarget(activeUser === "user1" ? "both" : "user1");
  };
 
  const submit = async () => {
    if (!title.trim()) return;
    if (kind === "Task") {
      const activeName = activeUser === "user2" ? names.user2 : names.user1;
      await data.tasks.create({
        title,
        due_date: todayISO(),
        completed_user1: false,
        completed_user2: false,
        created_by: activeName,
        assigned_to: activeName,
        note: body.trim(),
        approved: true
      });
    }
    if (kind === "Idea") {
      const suffix = buildSharingSuffix(activeUser || "user1", sharingTarget);
      await data.ideas.create({ title: title.trim() + suffix, description: body });
    }
    if (kind === "Prompt") {
      const suffix = buildSharingSuffix(activeUser || "user1", sharingTarget);
      await data.prompts.create({ title: title.trim() + suffix, content: body, category: "Misc" });
    }
    if (kind === "Sticky Note") {
      const isNotePrivate = sharingTarget === "private";
      let finalBody = body;
      if (activeUser === "user1" && (sharingTarget === "user2" || sharingTarget === "sharingTarget")) {
        finalBody = body.trim() + ` [share:${sharingTarget}]`;
      } else if (activeUser === "user1" && (sharingTarget === "user2" || sharingTarget === "user3")) {
        finalBody = body.trim() + ` [share:${sharingTarget}]`;
      }
      await data.stickyNotes.create({
        title,
        body: finalBody,
        color: "Yellow",
        author: activeUser === "user2" ? names.user2 : (activeUser === "user3" ? names.user3 : names.user1),
        is_private: isNotePrivate
      });
    }
    if (kind === "Money Entry") {
      await data.moneyEntries.create({
        description: title,
        amount: Number(amount || 0),
        type,
        added_by: activeUser || "user1",
        category: "Misc",
        is_request: false,
        entry_date: todayISO()
      });
    }
    if (kind === "Vault Entry" && vaultId) {
      const suffix = buildSharingSuffix(activeUser || "user1", sharingTarget);
      await data.vaultItems.create({ vault_id: vaultId, title: title.trim() + suffix, body });
    }
    reset();
  };
 
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
 
  if (inline) {
    return (
      <div className="flex flex-wrap gap-2">
        {kinds.map((item) => (
          <Button
            key={item.label}
            variant="outline"
            onClick={() => { setKind(item.label); setOpen(true); }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
        <QuickAddDialog
          open={open}
          kind={kind}
          setKind={setKind}
          title={title}
          setTitle={setTitle}
          body={body}
          setBody={setBody}
          amount={amount}
          setAmount={setAmount}
          type={type}
          setType={setType}
          vaultId={vaultId}
          setVaultId={setVaultId}
          customVaults={customVaults}
          onClose={reset}
          onSubmit={submit}
          handleKeyDown={handleKeyDown}
          showTypePicker={false}
          sharingTarget={sharingTarget}
          setSharingTarget={setSharingTarget}
        />
      </div>
    );
  }
 
  return (
    <>
      <Button
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-soft"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Quick add"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <QuickAddDialog
        open={open}
        kind={kind}
        setKind={setKind}
        title={title}
        setTitle={setTitle}
        body={body}
        setBody={setBody}
        amount={amount}
        setAmount={setAmount}
        type={type}
        setType={setType}
        vaultId={vaultId}
        setVaultId={setVaultId}
        customVaults={customVaults}
        onClose={reset}
        onSubmit={submit}
        handleKeyDown={handleKeyDown}
        showTypePicker
        sharingTarget={sharingTarget}
        setSharingTarget={setSharingTarget}
      />
    </>
  );
}

type VaultRow = { id: string; name: string; is_default: boolean };

function QuickAddDialog({
  open, kind, setKind, title, setTitle, body, setBody,
  amount, setAmount, type, setType, vaultId, setVaultId,
  customVaults, onClose, onSubmit, handleKeyDown, showTypePicker,
  sharingTarget, setSharingTarget
}: {
  open: boolean;
  kind: Kind;
  setKind: (k: Kind) => void;
  title: string;
  setTitle: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  type: "Income" | "Expense";
  setType: (v: "Income" | "Expense") => void;
  vaultId: string;
  setVaultId: (v: string) => void;
  customVaults: VaultRow[];
  onClose: () => void;
  onSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  showTypePicker: boolean;
  sharingTarget: string;
  setSharingTarget: (v: string) => void;
}) {
  const { activeUser } = useActiveUser();
  const names = useUserNames();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add — {kind}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {showTypePicker && (
            <div className="grid grid-cols-3 gap-2">
              {kinds.map((item) => (
                <Button
                  key={item.label}
                  variant={kind === item.label ? "default" : "outline"}
                  className="h-auto flex-col gap-1 py-2 text-xs"
                  onClick={() => setKind(item.label)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          )}

          <Field label={kind === "Money Entry" ? "Description" : "Title"}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={kind !== "Idea" && kind !== "Prompt" && kind !== "Sticky Note" ? handleKeyDown : undefined}
              autoFocus
            />
          </Field>

          {(kind === "Idea" || kind === "Prompt" || kind === "Sticky Note" || kind === "Vault Entry") && (
            <Field label="Visibility">
              <Select value={sharingTarget} onValueChange={setSharingTarget}>
                <SelectTrigger className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-white text-xs rounded-xl">
                  {activeUser === "user1" ? (
                    <>
                      <SelectItem value="private">Only Me</SelectItem>
                      <SelectItem value="user2">Me & {names.user2 || "Samarth"}</SelectItem>
                      <SelectItem value="user3">Me & {names.user3 || "Mr. Bill"}</SelectItem>
                      <SelectItem value="both">Me, {names.user2 || "Samarth"} & {names.user3 || "Mr. Bill"} (Everyone)</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="user1">Share with {names.user1 || "Sajal"}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </Field>
          )}

          {(kind === "Task" || kind === "Idea" || kind === "Prompt" || kind === "Sticky Note" || kind === "Vault Entry") && (
            <Field label={kind === "Task" ? "Note" : "Content"}>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={kind === "Task" ? "Any important details..." : ""} />
            </Field>
          )}

          {kind === "Money Entry" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount">
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={handleKeyDown} />
              </Field>
              <Field label="Type">
                <Select value={type} onValueChange={(v) => setType(v as "Income" | "Expense")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {kind === "Vault Entry" && (
            <Field label="Vault">
              <Select value={vaultId} onValueChange={setVaultId}>
                <SelectTrigger><SelectValue placeholder="Choose a vault…" /></SelectTrigger>
                <SelectContent>
                  {customVaults.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                  {customVaults.length === 0 && (
                    <SelectItem value="none" disabled>No custom vaults yet</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Button onClick={onSubmit}>Create {kind}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
