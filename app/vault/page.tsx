"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ExternalLink, Lightbulb, Link as LinkIcon,
  Pencil, Pin, Plus, StickyNote, Trash2, WandSparkles, Check, Copy, Lock, Unlock,
  Briefcase, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AutosaveTextarea } from "@/components/autosize-textarea";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useData, useUserNames, useActiveUser, useUserColors } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/database.types";

const PROMPT_CATEGORIES = ["Thumbnail", "AI Image", "Coding", "Outreach", "Copywriting", "Misc"];

const NOTE_COLORS = {
  Yellow: "bg-[#fff8c7]/75 backdrop-blur-md dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200",
  Blue: "bg-[#dff2ff]/75 backdrop-blur-md dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-200",
  Green: "bg-[#e4f8df]/75 backdrop-blur-md dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-200",
  Pink: "bg-[#ffe6ef]/75 backdrop-blur-md dark:bg-pink-950/30 dark:border-pink-900/50 dark:text-pink-200"
} as const;

const DEFAULT_VAULT_ICONS: Record<string, React.ReactNode> = {
  WandSparkles: <WandSparkles className="h-4 w-4" />,
  Lightbulb: <Lightbulb className="h-4 w-4" />,
  Link: <LinkIcon className="h-4 w-4" />,
  StickyNote: <StickyNote className="h-4 w-4" />,
  Briefcase: <Briefcase className="h-4 w-4" />
};

// ─── Sub-panels for each default vault ───────────────────────────────────────

function PromptsPanel({ search }: { search: string }) {
  const data = useData();
  const q = search.toLowerCase();
  
  const [editingPrompt, setEditingPrompt] = useState<Row<"prompts"> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: "", category: "Misc", content: "" });
  const [deletingPrompt, setDeletingPrompt] = useState<Row<"prompts"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<Row<"prompts"> | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text || "");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const prompts = useMemo(
    () => data.prompts.rows.filter((i) => `${i.title} ${i.category} ${i.content}`.toLowerCase().includes(q)),
    [data.prompts.rows, q]
  );

  const handleCreate = async () => {
    if (!newPrompt.title.trim()) return;
    const { error } = await data.prompts.create(newPrompt);
    if (error) {
      alert(`Failed to create preset: ${error.message}`);
      return;
    }
    setNewPrompt({ title: "", category: "Misc", content: "" });
    setShowCreate(false);
  };

  return (
    <div className="grid gap-6">
      {/* Top action row */}
      <div className="flex justify-start">
        <Button onClick={() => setShowCreate(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1.5" /> New Preset
        </Button>
      </div>

      {/* Presets Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prompts.map((item) => (
          <Card
            key={item.id}
            className="flex flex-col min-h-[200px] relative overflow-hidden group bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-white/40 transition-all duration-300 rounded-2xl"
            onClick={() => setViewingPrompt(item)}
          >
            <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
              <span className="text-xs font-semibold bg-zinc-100 dark:bg-dark-hover text-zinc-800 dark:text-dark-text-secondary px-2 py-0.5 rounded-full">
                {item.category}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0 border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 dark:text-dark-text-secondary"
                onClick={(e) => { e.stopPropagation(); handleCopy(item.id, item.content); }}
                title="Copy Preset Content"
              >
                {copiedId === item.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-zinc-600 dark:text-dark-text-secondary" />}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-1">
              <div className="min-w-0">
                <h3 className="font-bold text-zinc-800 dark:text-dark-text line-clamp-1 mb-1 text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {item.content || "No content."}
                </p>
              </div>
              
              <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-zinc-100 dark:border-dark-muted opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-800 dark:hover:text-dark-text"
                  onClick={(e) => { e.stopPropagation(); setEditingPrompt(item); }}
                  title="Edit Preset"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeletingPrompt(item); }}
                  title="Delete Preset"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {prompts.length === 0 && (
        <EmptyState title="No presets found." />
      )}

      {/* ── Create Preset Dialog ────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>New Preset Prompt</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Field label="Preset Title">
              <Input
                placeholder="Thumbnail outreach email, AI midjourney prompt..."
                value={newPrompt.title}
                onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <Field label="Category">
              <Select value={newPrompt.category} onValueChange={(category) => setNewPrompt({ ...newPrompt, category })}>
                <SelectTrigger className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROMPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preset Template Content">
              <Textarea
                placeholder="Paste the template content or instructions here..."
                value={newPrompt.content}
                onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })}
                rows={6}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text leading-relaxed text-sm"
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={handleCreate} disabled={!newPrompt.title.trim()}>Create Preset</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Preset Dialog ──────────────────────────────────────────── */}
      <Dialog open={Boolean(editingPrompt)} onOpenChange={(open) => !open && setEditingPrompt(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>Edit Preset Prompt</DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <div className="grid gap-3.5 pt-2">
              <Field label="Preset Title">
                <Input
                  value={editingPrompt.title}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="Category">
                <Select value={editingPrompt.category} onValueChange={(category) => setEditingPrompt({ ...editingPrompt, category })}>
                  <SelectTrigger className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROMPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Preset Template Content">
                <AutosaveTextarea
                  value={editingPrompt.content}
                  onSave={(content) => data.prompts.update(editingPrompt.id, { content })}
                  minHeight={160}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setEditingPrompt(null)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
                <Button
                  onClick={async () => {
                    await data.prompts.update(editingPrompt.id, {
                      title: editingPrompt.title,
                      category: editingPrompt.category,
                      content: editingPrompt.content
                    });
                    setEditingPrompt(null);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Preset Dialog ────────────────────────────────────────── */}
      <Dialog open={Boolean(viewingPrompt)} onOpenChange={(open) => !open && setViewingPrompt(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white dark:bg-dark-base max-h-[85vh] flex flex-col p-6 border border-zinc-200 dark:border-dark-border">
          <DialogHeader className="border-b border-zinc-100 dark:border-dark-muted pb-3 flex flex-row items-center justify-between space-y-0 pr-6">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-dark-text truncate">{viewingPrompt?.title}</DialogTitle>
              {viewingPrompt?.category && (
                <div>
                  <span className="text-xs font-semibold bg-zinc-100 dark:bg-dark-hover text-zinc-800 dark:text-dark-text-secondary px-2 py-0.5 rounded-full">
                    {viewingPrompt.category}
                  </span>
                </div>
              )}
            </div>
            {viewingPrompt && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex items-center gap-1.5 shrink-0 border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 ml-2 text-xs font-semibold px-3 h-9 dark:text-dark-text-secondary dark:hover:bg-dark-hover"
                onClick={() => handleCopy(viewingPrompt.id, viewingPrompt.content)}
              >
                {copiedId === viewingPrompt.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-600 dark:text-dark-text-secondary" />
                    <span>Copy Content</span>
                  </>
                )}
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-1 leading-relaxed text-sm text-zinc-700 dark:text-dark-text-secondary whitespace-pre-wrap bg-zinc-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-zinc-200/50 dark:border-dark-border/50 select-text">
            {viewingPrompt?.content || "No content."}
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-zinc-100 dark:border-dark-muted">
            <Button onClick={() => setViewingPrompt(null)} className="rounded-xl">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Preset Confirmation ──────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingPrompt)}
        onOpenChange={(open) => !open && setDeletingPrompt(null)}
        title="Delete Preset Prompt?"
        description={`Are you sure you want to delete preset "${deletingPrompt?.title}"?`}
        onConfirm={async () => {
          if (deletingPrompt) {
            const { error } = await data.prompts.remove(deletingPrompt.id);
            if (error) alert(`Failed to delete preset: ${error.message}`);
          }
        }}
      />
    </div>
  );
}

function IdeasPanel({ search }: { search: string }) {
  const data = useData();
  const q = search.toLowerCase();
  
  const [showCreate, setShowCreate] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Row<"ideas"> | null>(null);
  const [newIdea, setNewIdea] = useState({ title: "", description: "" });
  const [deletingIdea, setDeletingIdea] = useState<Row<"ideas"> | null>(null);
  const [viewingIdea, setViewingIdea] = useState<Row<"ideas"> | null>(null);

  const ideas = useMemo(
    () => data.ideas.rows.filter((i) => `${i.title} ${i.description}`.toLowerCase().includes(q)),
    [data.ideas.rows, q]
  );

  const handleCreate = async () => {
    if (!newIdea.title.trim()) return;
    const { error } = await data.ideas.create(newIdea);
    if (error) {
      alert(`Failed to create startup idea: ${error.message}`);
      return;
    }
    setNewIdea({ title: "", description: "" });
    setShowCreate(false);
  };

  return (
    <div className="grid gap-6">
      {/* Top action row */}
      <div className="flex justify-start">
        <Button onClick={() => setShowCreate(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1.5" /> New Idea
        </Button>
      </div>

      {/* Ideas Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ideas.map((item) => (
          <Card
            key={item.id}
            className="bg-white/35 dark:bg-black/35 backdrop-blur-xl flex flex-col justify-between group cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-white/40 transition-all duration-300 border border-white/20 dark:border-white/10 rounded-2xl"
            onClick={() => setViewingIdea(item)}
          >
            <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
              <CardTitle className="text-base font-bold text-zinc-800 dark:text-dark-text">{item.title}</CardTitle>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-800 dark:hover:text-dark-text"
                  onClick={(e) => { e.stopPropagation(); setEditingIdea(item); }}
                  title="Edit Idea"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={(e) => { e.stopPropagation(); setDeletingIdea(item); }}
                  title="Delete Idea"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed line-clamp-4">{item.description}</p>
              <p className="mt-3 text-[10px] text-zinc-400 dark:text-dark-text0 font-medium">{new Date(item.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {ideas.length === 0 && (
        <EmptyState title="No ideas captured yet." />
      )}

      {/* ── View Idea Dialog ─────────────────────────────────────────── */}
      <Dialog open={Boolean(viewingIdea)} onOpenChange={(open) => !open && setViewingIdea(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white dark:bg-dark-base max-h-[85vh] flex flex-col p-6 border border-zinc-200 dark:border-dark-border">
          <DialogHeader className="border-b border-zinc-100 dark:border-dark-muted pb-3 flex flex-col gap-1 min-w-0 pr-6">
            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-dark-text truncate">{viewingIdea?.title}</DialogTitle>
            <div className="text-[10px] text-zinc-400 dark:text-dark-text0 font-medium">
              Ideas • {viewingIdea && new Date(viewingIdea.created_at).toLocaleDateString()}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-1 leading-relaxed text-sm text-zinc-700 dark:text-dark-text-secondary whitespace-pre-wrap bg-zinc-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-zinc-200/50 dark:border-dark-border/50 select-text">
            {viewingIdea?.description || <span className="italic text-zinc-400 dark:text-zinc-550">No details.</span>}
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-zinc-100 dark:border-dark-muted">
            <Button onClick={() => setViewingIdea(null)} className="rounded-xl">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Idea Dialog ────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>New Startup Idea</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Field label="Idea Title">
              <Input
                placeholder="What is the concept?"
                value={newIdea.title}
                onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <Field label="Description">
              <Textarea
                placeholder="Write description or details..."
                value={newIdea.description}
                onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                rows={5}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text leading-relaxed text-sm"
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={handleCreate} disabled={!newIdea.title.trim()}>Create Idea</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Idea Dialog ──────────────────────────────────────────── */}
      <Dialog open={Boolean(editingIdea)} onOpenChange={(open) => !open && setEditingIdea(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>Edit Idea</DialogTitle>
          </DialogHeader>
          {editingIdea && (
            <div className="grid gap-3.5 pt-2">
              <Field label="Idea Title">
                <Input
                  value={editingIdea.title}
                  onChange={(e) => setEditingIdea({ ...editingIdea, title: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={editingIdea.description}
                  onChange={(e) => setEditingIdea({ ...editingIdea, description: e.target.value })}
                  rows={6}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text leading-relaxed text-sm"
                />
              </Field>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setEditingIdea(null)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
                <Button
                  onClick={async () => {
                    await data.ideas.update(editingIdea.id, {
                      title: editingIdea.title,
                      description: editingIdea.description
                    });
                    setEditingIdea(null);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Idea Confirmation ──────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingIdea)}
        onOpenChange={(open) => !open && setDeletingIdea(null)}
        title="Delete Idea?"
        description={`Are you sure you want to delete idea "${deletingIdea?.title}"?`}
        onConfirm={async () => {
          if (deletingIdea) {
            const { error } = await data.ideas.remove(deletingIdea.id);
            if (error) alert(`Failed to delete idea: ${error.message}`);
          }
        }}
      />
    </div>
  );
}

function ResourcesPanel({ search }: { search: string }) {
  const data = useData();
  const q = search.toLowerCase();
  
  const [showCreate, setShowCreate] = useState(false);
  const [editingResource, setEditingResource] = useState<Row<"resources"> | null>(null);
  const [newResource, setNewResource] = useState({ title: "", url: "", category: "Misc" });
  const [deletingResource, setDeletingResource] = useState<Row<"resources"> | null>(null);

  const resources = useMemo(
    () => data.resources.rows.filter((i) => `${i.title} ${i.url} ${i.category}`.toLowerCase().includes(q)),
    [data.resources.rows, q]
  );

  const handleCreate = async () => {
    if (!newResource.title.trim() || !newResource.url.trim()) return;
    const { error } = await data.resources.create(newResource);
    if (error) {
      alert(`Failed to create resource: ${error.message}`);
      return;
    }
    setNewResource({ title: "", url: "", category: "Misc" });
    setShowCreate(false);
  };

  return (
    <div className="grid gap-6">
      {/* Top action row */}
      <div className="flex justify-start">
        <Button onClick={() => setShowCreate(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1.5" /> New Resource
        </Button>
      </div>

      {/* Resources Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((item) => (
          <div key={item.id} className="group relative rounded-2xl border border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/35 backdrop-blur-xl p-4 hover:bg-white/45 dark:hover:bg-white/5 transition-all duration-300 flex flex-col justify-between min-h-[110px] hover:scale-[1.02] hover:shadow-xl hover:border-white/40">
            <a href={item.url} target="_blank" rel="noreferrer" className="block min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="font-semibold text-zinc-800 dark:text-dark-text text-sm truncate pr-4">{item.title}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.category}</p>
            </a>
            
            <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-zinc-100 dark:border-dark-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-800 dark:hover:text-dark-text"
                onClick={(e) => { e.preventDefault(); setEditingResource(item); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={(e) => { e.preventDefault(); setDeletingResource(item); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {resources.length === 0 && (
        <EmptyState title="No resources yet." />
      )}

      {/* ── Create Resource Dialog ────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>New Shared Resource</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Field label="Title">
              <Input
                placeholder="Google Drive, Figma board..."
                value={newResource.title}
                onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <Field label="URL Link">
              <Input
                placeholder="https://..."
                value={newResource.url}
                onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <Field label="Category">
              <Input
                placeholder="Design, Tech, Reference..."
                value={newResource.category}
                onChange={(e) => setNewResource({ ...newResource, category: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={handleCreate} disabled={!newResource.title.trim() || !newResource.url.trim()}>Create Resource</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Resource Dialog ──────────────────────────────────────── */}
      <Dialog open={Boolean(editingResource)} onOpenChange={(open) => !open && setEditingResource(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
          </DialogHeader>
          {editingResource && (
            <div className="grid gap-3.5 pt-2">
              <Field label="Title">
                <Input
                  value={editingResource.title}
                  onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="URL Link">
                <Input
                  value={editingResource.url}
                  onChange={(e) => setEditingResource({ ...editingResource, url: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="Category">
                <Input
                  value={editingResource.category}
                  onChange={(e) => setEditingResource({ ...editingResource, category: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setEditingResource(null)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
                <Button
                  onClick={async () => {
                    await data.resources.update(editingResource.id, {
                      title: editingResource.title,
                      url: editingResource.url,
                      category: editingResource.category
                    });
                    setEditingResource(null);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Resource Confirmation ──────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingResource)}
        onOpenChange={(open) => !open && setDeletingResource(null)}
        title="Delete Resource?"
        description={`Are you sure you want to delete resource "${deletingResource?.title}"?`}
        onConfirm={async () => {
          if (deletingResource) {
            const { error } = await data.resources.remove(deletingResource.id);
            if (error) alert(`Failed to delete resource: ${error.message}`);
          }
        }}
      />
    </div>
  );
}

function StickyNotesPanel({ search }: { search: string }) {
  const data = useData();
  const { user1 } = useUserNames();
  const { activeUserName, activeUser } = useActiveUser();
  const userColors = useUserColors();
  const q = search.toLowerCase();
  
  const [showCreate, setShowCreate] = useState(false);
  const [newNote, setNewNote] = useState({
    title: "", body: "", color: "Yellow" as keyof typeof NOTE_COLORS, author: activeUserName || user1 || "Sajal", is_private: false
  });
  const [deletingNote, setDeletingNote] = useState<Row<"sticky_notes"> | null>(null);

  // Sync author with activeUserName when it loads
  useEffect(() => {
    if (activeUserName) {
      setNewNote((prev) => ({ ...prev, author: activeUserName }));
    }
  }, [activeUserName]);

  const notes = useMemo(
    () => data.stickyNotes.rows
      .filter((i) => {
        const matchesSearch = `${i.title} ${i.body} ${i.author}`.toLowerCase().includes(q);
        const isVisible = !i.is_private || i.author === activeUserName;
        return matchesSearch && isVisible;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [data.stickyNotes.rows, q, activeUserName]
  );

  const handleCreate = async () => {
    if (!newNote.title.trim()) return;
    const { error } = await data.stickyNotes.create({ ...newNote, pinned: false, read: false });
    if (error) {
      alert(`Failed to create sticky note: ${error.message}`);
      return;
    }
    if (!newNote.is_private) {
      const otherUserKey = activeUser === "user1" ? "user2" : "user1";
      data.sendNotification(
        otherUserKey,
        "New Sticky Note",
        `${activeUserName} posted: ${newNote.title.trim()}`
      );
    }
    setNewNote({ title: "", body: "", color: "Yellow", author: activeUserName || user1 || "Sajal", is_private: false });
    setShowCreate(false);
  };

  return (
    <div className="grid gap-6">
      {/* Top action row */}
      <div className="flex justify-start">
        <Button onClick={() => setShowCreate(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1.5" /> New Sticky Note
        </Button>
      </div>

      {/* Notes Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {notes.map((item) => {
          const isCreator = item.author === activeUserName;
          return (
            <div key={item.id} className={cn("relative min-h-48 rounded-xl border border-zinc-200 dark:border-dark-border/80 p-4 shadow-soft", NOTE_COLORS[item.color as keyof typeof NOTE_COLORS] ?? "bg-white dark:bg-dark-card/60")}>
              {item.pinned && (
                <div className="absolute -top-2 right-3 text-base" title="Pinned">📌</div>
              )}
              <div className="mb-3 flex items-start justify-between gap-2">
                <Input
                  className="border-transparent dark:border-transparent bg-transparent dark:bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0 w-full text-inherit dark:text-inherit"
                  value={item.title}
                  onChange={(e) => data.stickyNotes.update(item.id, { title: e.target.value })}
                  readOnly={!isCreator}
                />
                {isCreator && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-800 dark:hover:text-dark-text"
                      title={item.is_private ? "Make Public" : "Make Private"}
                      onClick={() => data.stickyNotes.update(item.id, { is_private: !item.is_private })}
                    >
                      {item.is_private ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 hover:bg-black/5 dark:hover:bg-white/5"
                      title={item.pinned ? "Unpin" : "Pin"}
                      onClick={() => data.stickyNotes.update(item.id, { pinned: !item.pinned })}
                    >
                      <Pin className={cn("h-4 w-4", item.pinned ? "fill-current" : "")} />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => setDeletingNote(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <AutosaveTextarea
                value={item.body}
                onSave={(body) => data.stickyNotes.update(item.id, { body })}
                minHeight={110}
                readOnly={!isCreator}
                className="border-transparent dark:border-transparent bg-transparent dark:bg-transparent p-0 shadow-none focus-visible:ring-0 text-inherit dark:text-inherit resize-none w-full"
              />
              <div className="mt-3 flex items-center justify-between text-xs text-black/60 dark:text-dark-text-secondary">
                <span className="flex items-center gap-1.5 font-medium min-w-0 flex-1 truncate">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.author === user1 ? userColors.user1 : userColors.user2 }}
                  />
                  <span className="truncate">{item.author}</span>
                </span>
                {item.is_private && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded font-semibold border border-amber-200/40 dark:border-amber-800/40 shrink-0 mx-1.5">
                    <Lock className="h-2.5 w-2.5" />
                    Private
                  </span>
                )}
                <button
                  onClick={() => data.stickyNotes.update(item.id, { read: !item.read })}
                  className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10 shrink-0", item.read ? "opacity-50" : "font-medium")}
                >
                  {item.read ? "Read" : "Unread"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {notes.length === 0 && (
        <EmptyState title="No sticky notes created yet." />
      )}

      {/* ── Create Sticky Note Dialog ─────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>New Sticky Note</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Field label="Title">
              <Input
                placeholder="Brief title..."
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <Field label="Body">
              <Textarea
                placeholder="Write note contents..."
                value={newNote.body}
                onChange={(e) => setNewNote({ ...newNote, body: e.target.value })}
                rows={4}
                className="border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 text-zinc-900 dark:text-dark-text leading-relaxed text-sm"
              />
            </Field>
            <Field label="Color">
              <Select value={newNote.color} onValueChange={(c) => setNewNote({ ...newNote, color: c as keyof typeof NOTE_COLORS })}>
                <SelectTrigger className="border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 text-zinc-900 dark:text-dark-text"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(NOTE_COLORS).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="create-note-is-private"
                checked={newNote.is_private}
                onChange={(e) => setNewNote({ ...newNote, is_private: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <label htmlFor="create-note-is-private" className="text-sm font-medium text-zinc-700 dark:text-dark-text-secondary">
                Keep this sticky note private (only visible to you)
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={handleCreate} disabled={!newNote.title.trim()}>Create Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Sticky Note Confirmation ───────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingNote)}
        onOpenChange={(open) => !open && setDeletingNote(null)}
        title="Delete Sticky Note?"
        description="Are you sure you want to delete this sticky note?"
        onConfirm={async () => {
          if (deletingNote) {
            const { error } = await data.stickyNotes.remove(deletingNote.id);
            if (error) alert(`Failed to delete sticky note: ${error.message}`);
          }
        }}
      />
    </div>
  );
}

function DeliverablesPanel({ search }: { search: string }) {
  const data = useData();
  const { activeUser } = useActiveUser();
  const q = search.toLowerCase();

  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<Row<"work_deliverables"> | null>(null);
  const [deletingItem, setDeletingItem] = useState<Row<"work_deliverables"> | null>(null);

  const [newDeliverable, setNewDeliverable] = useState({
    title: "",
    description: "",
    delivery_date: new Date().toISOString().split("T")[0],
    client_name: "",
    amount: 0,
    status: "delivered"
  });

  const deliverables = useMemo(() => {
    if (!data.workDeliverables?.rows) return [];
    return data.workDeliverables.rows
      .filter((i) =>
        `${i.title} ${i.description} ${i.client_name}`.toLowerCase().includes(q)
      )
      .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date));
  }, [data.workDeliverables?.rows, q]);

  const stats = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    deliverables.forEach((item) => {
      totalCount++;
      totalAmount += Number(item.amount) || 0;
      if (item.status === "paid") {
        paidAmount += Number(item.amount) || 0;
      } else {
        unpaidAmount += Number(item.amount) || 0;
      }
    });

    return { totalCount, totalAmount, paidAmount, unpaidAmount };
  }, [deliverables]);

  const handleCreate = async () => {
    if (!newDeliverable.title.trim()) return;
    if (!activeUser) return;

    const { error } = await data.workDeliverables.create({
      ...newDeliverable,
      user_key: activeUser
    });

    if (error) {
      alert(`Failed to log deliverable: ${error.message}`);
      return;
    }

    setNewDeliverable({
      title: "",
      description: "",
      delivery_date: new Date().toISOString().split("T")[0],
      client_name: "",
      amount: 0,
      status: "delivered"
    });
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!editingItem || !editingItem.title.trim()) return;

    const { error } = await data.workDeliverables.update(editingItem.id, {
      title: editingItem.title,
      description: editingItem.description,
      delivery_date: editingItem.delivery_date,
      client_name: editingItem.client_name,
      amount: Number(editingItem.amount) || 0,
      status: editingItem.status
    });

    if (error) {
      alert(`Failed to update deliverable: ${error.message}`);
      return;
    }

    setEditingItem(null);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    const { error } = await data.workDeliverables.remove(deletingItem.id);
    if (error) {
      alert(`Failed to delete deliverable: ${error.message}`);
      return;
    }

    setDeletingItem(null);
  };

  return (
    <div className="grid gap-6">
      {data.workDeliverables?.error && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-900 dark:text-amber-100 text-sm">Database Schema Migration Required</div>
            <p className="mt-1 leading-relaxed text-amber-700 dark:text-amber-300">
              The <code>work_deliverables</code> table was not found in your Supabase database. Please copy the SQL from 
              <code className="bg-amber-100/50 dark:bg-amber-900/30 px-1 py-0.5 rounded ml-1 font-mono">supabase/migrations/015_work_deliverables.sql</code> and execute it in your Supabase SQL Editor to activate the deliverables log.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Deliverables</span>
            <span className="text-2xl font-extrabold text-zinc-800 dark:text-white mt-1">{stats.totalCount}</span>
            <span className="text-[10px] text-zinc-400 mt-1">Items successfully delivered</span>
          </CardContent>
        </Card>

        <Card className="bg-white/35 dark:bg-black/35 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Earnings Logged</span>
            <span className="text-2xl font-extrabold text-zinc-800 dark:text-white mt-1">₹{stats.totalAmount.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-400 mt-1">Claimable value of all items</span>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 dark:bg-emerald-950/20 backdrop-blur-xl border border-emerald-500/20 dark:border-emerald-900/30 shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400 uppercase tracking-wider">Paid amount</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">₹{stats.paidAmount.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-555/80 dark:text-emerald-400/80 mt-1">Cleared by client HR / CEO</span>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 dark:bg-amber-950/20 backdrop-blur-xl border border-amber-500/20 dark:border-amber-900/30 shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400 uppercase tracking-wider">Pending invoice</span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">₹{stats.unpaidAmount.toLocaleString()}</span>
            <span className="text-[10px] text-amber-555/80 dark:text-amber-400/80 mt-1">Claimable for monthly settlement</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center gap-4">
        <Button onClick={() => setShowCreate(true)} className="rounded-xl bg-zinc-950 dark:bg-dark-text hover:bg-zinc-850 dark:hover:bg-zinc-205 text-white dark:text-dark-base">
          <Plus className="h-4 w-4 mr-1.5" /> Log Deliverable
        </Button>
      </div>

      <div className="border border-white/20 dark:border-white/10 bg-white/30 dark:bg-black/35 backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg">
        {deliverables.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState title="No deliverables logged yet." />
            <p className="text-xs text-muted-foreground mt-2">Log your design drafts, code revisions, and pull requests to track your earnings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-white/40 dark:bg-white/10 border-b border-white/20 dark:border-white/10 text-slate-700 dark:text-dark-text-secondary font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Deliverable Title</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Delivery Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-dark-border/50">
                {deliverables.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/30 dark:hover:bg-dark-hover/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-zinc-800 dark:text-dark-text">{item.title}</div>
                      {item.description && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-zinc-600 dark:text-zinc-350">{item.client_name || "N/A"}</td>
                    <td className="p-4 text-zinc-500 dark:text-dark-text-secondary">{item.delivery_date}</td>
                    <td className="p-4 font-bold text-zinc-700 dark:text-zinc-250">₹{item.amount.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        item.status === "paid" && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
                        item.status === "delivered" && "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
                        item.status === "pending" && "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 dark:text-zinc-450 hover:text-zinc-950 dark:hover:text-dark-text"
                          onClick={() => setEditingItem(item)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-destructive"
                          onClick={() => setDeletingItem(item)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border border-zinc-200 dark:border-dark-border">
          <DialogHeader><DialogTitle>Log Work Deliverable</DialogTitle></DialogHeader>
          <div className="grid gap-3.5 pt-2 text-xs">
            <Field label="Deliverable Title">
              <Input
                placeholder="e.g. Auth flow login page, Homepage banner design..."
                value={newDeliverable.title}
                onChange={(e) => setNewDeliverable({ ...newDeliverable, title: e.target.value })}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Client Name">
                <Input
                  placeholder="e.g. Acme Corp, Germany Client..."
                  value={newDeliverable.client_name}
                  onChange={(e) => setNewDeliverable({ ...newDeliverable, client_name: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="Delivery Date">
                <Input
                  type="date"
                  value={newDeliverable.delivery_date}
                  onChange={(e) => setNewDeliverable({ ...newDeliverable, delivery_date: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Value / Amount (₹)">
                <Input
                  type="number"
                  placeholder="e.g. 5000, 15000..."
                  value={newDeliverable.amount === 0 ? "" : newDeliverable.amount}
                  onChange={(e) => setNewDeliverable({ ...newDeliverable, amount: Number(e.target.value) || 0 })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="Payment Status">
                <Select
                  value={newDeliverable.status}
                  onValueChange={(val) => setNewDeliverable({ ...newDeliverable, status: val })}
                >
                  <SelectTrigger className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-dark-base dark:border-dark-border">
                    <SelectItem value="delivered">Delivered / Invoice Sent</SelectItem>
                    <SelectItem value="pending">Review Pending</SelectItem>
                    <SelectItem value="paid">Paid & Cleared</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Description / Notes">
              <Textarea
                placeholder="Include PR links, Figma links, or tech stack details..."
                value={newDeliverable.description}
                onChange={(e) => setNewDeliverable({ ...newDeliverable, description: e.target.value })}
                rows={3}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text resize-none"
              />
            </Field>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl border-zinc-250 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={handleCreate} className="rounded-xl bg-zinc-950 dark:bg-dark-text hover:bg-zinc-850 dark:hover:bg-zinc-200 text-white dark:text-dark-base">Log Deliverable</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        {editingItem && (
          <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border border-zinc-200 dark:border-dark-border">
            <DialogHeader><DialogTitle>Edit Logged Deliverable</DialogTitle></DialogHeader>
            <div className="grid gap-3.5 pt-2 text-xs">
              <Field label="Deliverable Title">
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Client Name">
                  <Input
                    value={editingItem.client_name}
                    onChange={(e) => setEditingItem({ ...editingItem, client_name: e.target.value })}
                    className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                  />
                </Field>
                <Field label="Delivery Date">
                  <Input
                    type="date"
                    value={editingItem.delivery_date}
                    onChange={(e) => setEditingItem({ ...editingItem, delivery_date: e.target.value })}
                    className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Value / Amount (₹)">
                  <Input
                    type="number"
                    value={editingItem.amount}
                    onChange={(e) => setEditingItem({ ...editingItem, amount: Number(e.target.value) || 0 })}
                    className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                  />
                </Field>
                <Field label="Payment Status">
                  <Select
                    value={editingItem.status}
                    onValueChange={(val) => setEditingItem({ ...editingItem, status: val })}
                  >
                    <SelectTrigger className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-dark-base dark:border-dark-border">
                      <SelectItem value="delivered">Delivered / Invoice Sent</SelectItem>
                      <SelectItem value="pending">Review Pending</SelectItem>
                      <SelectItem value="paid">Paid & Cleared</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Description / Notes">
                <Textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  rows={3}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text resize-none"
                />
              </Field>

              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setEditingItem(null)} className="rounded-xl border-zinc-250 dark:border-dark-muted dark:hover:bg-dark-card">Cancel</Button>
                <Button onClick={handleUpdate} className="rounded-xl bg-zinc-950 dark:bg-dark-text hover:bg-zinc-850 dark:hover:bg-zinc-200 text-white dark:text-dark-base">Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Delete Deliverable Log?"
        description="Are you sure you want to permanently delete this logged deliverable? This action will remove it from your earnings sheet."
        confirmText="Delete log"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CustomVaultPanel({ vault, search }: { vault: Row<"vaults">; search: string }) {
  const data = useData();
  const q = search.toLowerCase();
  
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Row<"vault_items"> | null>(null);
  const [newEntry, setNewEntry] = useState({ title: "", body: "" });
  const [deletingItem, setDeletingItem] = useState<Row<"vault_items"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<Row<"vault_items"> | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text || "");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const items = useMemo(
    () => data.vaultItems.rows
      .filter((i) => i.vault_id === vault.id)
      .filter((i) => `${i.title} ${i.body}`.toLowerCase().includes(q)),
    [data.vaultItems.rows, vault.id, q]
  );

  const handleCreate = async () => {
    if (!newEntry.title.trim()) return;
    const { error } = await data.vaultItems.create({ vault_id: vault.id, title: newEntry.title, body: newEntry.body });
    if (error) {
      alert(`Failed to create vault entry: ${error.message}`);
      return;
    }
    setNewEntry({ title: "", body: "" });
    setShowCreate(false);
  };

  return (
    <div className="grid gap-6">
      {/* Top action row */}
      <div className="flex justify-start">
        <Button onClick={() => setShowCreate(true)} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1.5" /> New Entry
        </Button>
      </div>

      {/* Custom Entries Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group bg-white dark:bg-dark-card/50 p-4 rounded-xl border border-zinc-200 dark:border-dark-border flex flex-col justify-between min-h-[160px] relative hover:shadow-soft transition-shadow cursor-pointer"
            onClick={() => setViewingItem(item)}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-bold text-zinc-900 dark:text-dark-text text-sm truncate flex-1">{item.title}</div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg shrink-0 border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 dark:text-dark-text-secondary dark:hover:bg-dark-hover"
                  onClick={(e) => { e.stopPropagation(); handleCopy(item.id, item.body); }}
                  title="Copy Content"
                >
                  {copiedId === item.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-zinc-600 dark:text-dark-text-secondary" />}
                </Button>
              </div>
              {item.body ? (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {item.body}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No content.</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-2 border-t border-zinc-100 dark:border-dark-muted">
              <p className="text-[10px] text-zinc-400 dark:text-dark-text0 font-medium">{new Date(item.created_at).toLocaleDateString()}</p>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 dark:text-dark-text-secondary hover:text-zinc-800 dark:hover:text-dark-text"
                  onClick={(e) => { e.stopPropagation(); setEditing(item); }}
                  title="Edit Entry"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={(e) => { e.stopPropagation(); setDeletingItem(item); }}
                  title="Delete Entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <EmptyState title="No entries yet." />
      )}

      {/* ── View Custom Entry Dialog ──────────────────────────────────── */}
      <Dialog open={Boolean(viewingItem)} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white dark:bg-dark-base max-h-[85vh] flex flex-col p-6 border border-zinc-200 dark:border-dark-border">
          <DialogHeader className="border-b border-zinc-100 dark:border-dark-muted pb-3 flex flex-row items-center justify-between space-y-0 pr-6">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-dark-text truncate">{viewingItem?.title}</DialogTitle>
              <div className="text-[10px] text-zinc-400 dark:text-dark-text0 font-medium">
                {vault.name} • {viewingItem && new Date(viewingItem.created_at).toLocaleDateString()}
              </div>
            </div>
            {viewingItem && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex items-center gap-1.5 shrink-0 border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 ml-2 text-xs font-semibold px-3 h-9 dark:text-dark-text-secondary dark:hover:bg-dark-hover"
                onClick={() => handleCopy(viewingItem.id, viewingItem.body)}
              >
                {copiedId === viewingItem.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-600 dark:text-dark-text-secondary" />
                    <span>Copy Content</span>
                  </>
                )}
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-1 leading-relaxed text-sm text-zinc-700 dark:text-dark-text-secondary whitespace-pre-wrap bg-zinc-50/50 dark:bg-dark-card/30 p-4 rounded-xl border border-zinc-200/50 dark:border-dark-border/50 select-text">
            {viewingItem?.body || <span className="italic text-zinc-400 dark:text-zinc-550">No content.</span>}
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-zinc-100 dark:border-dark-muted">
            <Button onClick={() => setViewingItem(null)} className="rounded-xl">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Custom Entry Dialog ────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-dark-base border border-zinc-200 dark:border-dark-border">
          <DialogHeader>
            <DialogTitle>New Entry — {vault.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Field label="Title">
              <Input
                placeholder="Enter title..."
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
              />
            </Field>
            <Field label="Body (Optional)">
              <Textarea
                placeholder="Write contents or details..."
                value={newEntry.body}
                onChange={(e) => setNewEntry({ ...newEntry, body: e.target.value })}
                rows={5}
                className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text leading-relaxed text-sm"
              />
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={handleCreate} disabled={!newEntry.title.trim()}>Create Entry</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Custom Entry Dialog ──────────────────────────────────── */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-dark-base rounded-2xl border border-zinc-200 dark:border-dark-border">
          <DialogHeader><DialogTitle>Edit entry</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3.5 pt-2">
              <Field label="Title">
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <Field label="Body">
                <Textarea
                  value={editing.body || ""}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={6}
                  className="bg-white dark:bg-dark-card/50 border-zinc-200 dark:border-dark-border text-zinc-900 dark:text-dark-text"
                />
              </Field>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
                <Button onClick={async () => {
                  await data.vaultItems.update(editing.id, { title: editing.title, body: editing.body });
                  setEditing(null);
                }}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Custom Entry Confirmation ──────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Delete Entry?"
        description={`Are you sure you want to delete "${deletingItem?.title}"?`}
        onConfirm={async () => {
          if (deletingItem) {
            const { error } = await data.vaultItems.remove(deletingItem.id);
            if (error) alert(`Failed to delete vault entry: ${error.message}`);
          }
        }}
      />
    </div>
  );
}

// ─── Main Vault Page ──────────────────────────────────────────────────────────

export default function VaultPage() {
  const data = useData();
  const { activeUserName } = useActiveUser();
  const [search, setSearch] = useState("");
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);

  // Create vault dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");

  // Rename vault dialog
  const [renaming, setRenaming] = useState<Row<"vaults"> | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Deleting vault
  const [deletingVault, setDeletingVault] = useState<Row<"vaults"> | null>(null);

  const vaults = data.vaults.rows; // sorted by order_index

  // Auto-select first vault
  const activeVaultId = selectedVaultId ?? vaults[0]?.id ?? null;
  const activeVault = vaults.find((v) => v.id === activeVaultId) ?? null;

  const createVault = async () => {
    if (!newVaultName.trim()) return;
    const { error } = await data.vaults.create({
      name: newVaultName.trim(),
      order_index: vaults.length,
      is_default: false,
      created_by: activeUserName || "Sajal"
    });
    if (error) {
      alert(`Failed to create vault: ${error.message}\n\nPlease make sure you have applied the migration "006_vaults_created_by.sql" in your Supabase SQL Editor.`);
      return;
    }
    setNewVaultName("");
    setShowCreate(false);
  };

  const confirmRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    await data.vaults.update(renaming.id, { name: renameValue.trim() });
    setRenaming(null);
  };

  const confirmDeleteVault = async () => {
    if (!deletingVault) return;
    if (!deletingVault.is_default) {
      // vault_items cascade delete via FK
      const { error } = await data.vaults.remove(deletingVault.id);
      if (error) {
        alert(`Failed to delete vault: ${error.message}`);
        return;
      }
    }
    if (activeVaultId === deletingVault.id) setSelectedVaultId(null);
    setDeletingVault(null);
  };


  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white text-wallpaper-safe">Vault</h1>
      </div>

      <Input 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
        placeholder="Search vault…" 
        className="bg-white/40 dark:bg-black/30 border-white/25 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-450 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl max-w-md" 
      />

      {/* ── Top Navbar Tabs ────────────────────────────────────────────── */}
      <div className="flex p-1 bg-white/20 dark:bg-black/25 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/10 w-fit gap-1 flex-wrap">
        {vaults.map((vault) => (
          <button
            key={vault.id}
            onClick={() => setSelectedVaultId(vault.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 border border-transparent",
              activeVaultId === vault.id
                ? "bg-white/40 dark:bg-white/15 border-white/40 dark:border-white/20 text-zinc-900 dark:text-white shadow-sm"
                : "text-slate-650 dark:text-dark-text-secondary hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            <span className="shrink-0">
              {vault.icon && DEFAULT_VAULT_ICONS[vault.icon]
                ? DEFAULT_VAULT_ICONS[vault.icon]
                : <Brain className="h-3.5 w-3.5" />}
            </span>
            <span>{vault.name}</span>
          </button>
        ))}
        <Button
          variant="ghost"
          onClick={() => setShowCreate(true)}
          className="rounded-xl border border-dashed border-white/30 dark:border-white/15 text-slate-650 dark:text-dark-text-secondary hover:text-zinc-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5 bg-transparent py-2 h-auto text-xs font-bold transition-all duration-200"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Vault
        </Button>
      </div>

      {/* ── Active Vault Header & Controls ────────────────────────────── */}
      {activeVault && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/25 dark:bg-black/20 backdrop-blur-xl p-4 rounded-2xl border border-white/25 dark:border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-zinc-800 dark:text-white font-extrabold text-base">{activeVault.name}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-dark-text-secondary hover:text-zinc-950 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/5 rounded-lg"
                onClick={() => { setRenaming(activeVault); setRenameValue(activeVault.name); }}
                title="Rename Vault"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!activeVault.is_default && (!activeVault.created_by || activeVault.created_by === activeUserName) && (
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-500/10 dark:hover:bg-red-950/20 hover:text-destructive rounded-lg"
                  onClick={() => setDeletingVault(activeVault)}
                  title="Delete Vault"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Content panel ────────────────────────────────────────────── */}
      <div className="pt-2">
        {!activeVault ? (
          <EmptyState title="Select a vault to get started." />
        ) : activeVault.name === "Prompts" && activeVault.is_default ? (
          <PromptsPanel search={search} />
        ) : activeVault.name === "Ideas" && activeVault.is_default ? (
          <IdeasPanel search={search} />
        ) : activeVault.name === "Resources" && activeVault.is_default ? (
          <ResourcesPanel search={search} />
        ) : activeVault.name === "Sticky Notes" && activeVault.is_default ? (
          <StickyNotesPanel search={search} />
        ) : activeVault.name === "Work Deliverables" && activeVault.is_default ? (
          <DeliverablesPanel search={search} />
        ) : (
          <CustomVaultPanel vault={activeVault} search={search} />
        )}
      </div>

      {/* ── Create vault dialog ────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setNewVaultName(""); } }}>
        <DialogContent className="bg-white dark:bg-dark-base rounded-2xl max-w-sm border border-zinc-200 dark:border-dark-border">
          <DialogHeader><DialogTitle>New Vault</DialogTitle></DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Input
              placeholder="Vault name"
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createVault()}
              autoFocus
              className="border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 text-zinc-900 dark:text-dark-text"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={createVault} disabled={!newVaultName.trim()}>Create Vault</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename vault dialog ───────────────────────────────────────── */}
      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="bg-white dark:bg-dark-base rounded-2xl max-w-sm border border-zinc-200 dark:border-dark-border">
          <DialogHeader><DialogTitle>Rename vault</DialogTitle></DialogHeader>
          <div className="grid gap-3.5 pt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmRename()}
              autoFocus
              className="border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card/50 text-zinc-900 dark:text-dark-text"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRenaming(null)} className="border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
              <Button onClick={confirmRename} disabled={!renameValue.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete vault dialog ───────────────────────────────────────── */}
      <Dialog open={Boolean(deletingVault)} onOpenChange={(open) => !open && setDeletingVault(null)}>
        <DialogContent className="bg-white dark:bg-dark-base rounded-2xl max-w-sm border border-zinc-200 dark:border-dark-border">
          <DialogHeader><DialogTitle>Delete &ldquo;{deletingVault?.name}&rdquo;?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This will permanently delete this vault and all its entries. This cannot be undone.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeletingVault(null)} className="flex-1 border-zinc-200 dark:border-dark-border dark:hover:bg-dark-card">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteVault} className="flex-1">Delete vault</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Need a Brain icon for custom vaults fallback
function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0-5Z" />
    </svg>
  );
}
