"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Highlighter,
  List,
  ListOrdered,
  Eraser,
  Heading,
  Type,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  initialValue: string;
  onSave: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const COLORS = [
  { name: "Default", value: "#18181b" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Orange", value: "#f97316" },
  { name: "Purple", value: "#a855f7" }
];

export function RichTextEditor({
  initialValue,
  onSave,
  placeholder = "Write details here...",
  className
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const isEditingRef = useRef(false);

  // Load initial content once
  useEffect(() => {
    if (editorRef.current && !isEditingRef.current) {
      editorRef.current.innerHTML = initialValue || "";
    }
  }, [initialValue]);

  const executeCommand = (command: string, value: string = "") => {
    if (typeof document === "undefined") return;
    
    // Focus the editor first to ensure selection is active
    editorRef.current?.focus();
    
    document.execCommand(command, false, value);
    
    // Trigger change after command
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // If editor was cleared, clear the innerHTML
      if (html === "<br>" || html === "") {
        editorRef.current.innerHTML = "";
      }
    }
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    if (editorRef.current) {
      let html = editorRef.current.innerHTML;
      if (html === "<br>" || html === "") {
        html = "";
      }
      onSave(html);
    }
  };

  const handleFocus = () => {
    isEditingRef.current = true;
  };

  return (
    <div className={cn("flex flex-col border rounded-xl overflow-hidden bg-white dark:bg-zinc-950 dark:border-zinc-800 shadow-sm transition-all focus-within:ring-1 focus-within:ring-zinc-900 focus-within:border-zinc-900", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-zinc-50/50 dark:bg-zinc-900/50 dark:border-zinc-800 shrink-0 select-none">
        {/* Bold */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          onClick={() => executeCommand("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>

        {/* Highlight */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          onClick={() => executeCommand("backColor", "#fef08a")}
          title="Highlight Yellow"
        >
          <Highlighter className="h-4 w-4 text-amber-500" />
        </Button>

        {/* Headings Dropdown */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            onClick={() => {
              setShowHeadingMenu(!showHeadingMenu);
              setShowColorMenu(false);
            }}
            title="Text Style"
          >
            <Heading className="h-4 w-4" />
          </Button>
          {showHeadingMenu && (
            <div className="absolute left-0 mt-1 z-50 min-w-[120px] rounded-lg border bg-white dark:bg-zinc-900 p-1 shadow-md dark:border-zinc-800 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  executeCommand("formatBlock", "<p>");
                  setShowHeadingMenu(false);
                }}
                className="w-full px-2 py-1.5 text-left text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => {
                  executeCommand("formatBlock", "<h1>");
                  setShowHeadingMenu(false);
                }}
                className="w-full px-2 py-1.5 text-left text-xs font-bold rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-850 dark:text-zinc-105"
              >
                Heading 1
              </button>
              <button
                type="button"
                onClick={() => {
                  executeCommand("formatBlock", "<h2>");
                  setShowHeadingMenu(false);
                }}
                className="w-full px-2 py-1.5 text-left text-xs font-semibold rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              >
                Heading 2
              </button>
              <button
                type="button"
                onClick={() => {
                  executeCommand("formatBlock", "<h3>");
                  setShowHeadingMenu(false);
                }}
                className="w-full px-2 py-1.5 text-left text-xs font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Heading 3
              </button>
            </div>
          )}
        </div>

        {/* Text Color Dropdown */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            onClick={() => {
              setShowColorMenu(!showColorMenu);
              setShowHeadingMenu(false);
            }}
            title="Text Color"
          >
            <Palette className="h-4 w-4" />
          </Button>
          {showColorMenu && (
            <div className="absolute left-0 mt-1 z-50 min-w-[140px] rounded-lg border bg-white dark:bg-zinc-900 p-2 shadow-md dark:border-zinc-800 grid grid-cols-3 gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    executeCommand("foreColor", c.value);
                    setShowColorMenu(false);
                  }}
                  className="h-7 w-7 rounded-md border flex items-center justify-center hover:scale-105 transition-transform"
                  style={{ backgroundColor: c.value === "#18181b" ? undefined : c.value }}
                  title={c.name}
                >
                  {c.value === "#18181b" && <Type className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

        {/* Bullet List */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          onClick={() => executeCommand("insertUnorderedList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>

        {/* Numbered List */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          onClick={() => executeCommand("insertOrderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

        {/* Clear Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 text-destructive hover:bg-destructive/10"
          onClick={() => {
            // Remove highlighting manually since removeFormat doesn't clean backColor in some browsers
            executeCommand("backColor", "rgba(0,0,0,0)");
            executeCommand("removeFormat");
          }}
          title="Clear Formatting"
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onBlur={handleBlur}
        onFocus={handleFocus}
        data-placeholder={placeholder}
        className="flex-1 p-4 outline-none h-[420px] overflow-y-auto leading-7 text-sm font-sans rich-editor-content dark:bg-zinc-950/20 text-zinc-800 dark:text-zinc-200"
      />
    </div>
  );
}
