"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./editor-toolbar";

export type TipTapEditorHandle = {
  getSelectedText: () => string;
  getSelectionRange: () => { from: number; to: number } | null;
  replaceRange: (from: number, to: number, text: string) => void;
};

type Props = {
  content?: string; // HTML string
  editable?: boolean;
  onChange?: (html: string) => void;
  onChangeText?: (text: string) => void;
  onSelectionUpdate?: (hasSelection: boolean) => void;
  className?: string;
  placeholder?: string;
  showToolbar?: boolean;
};

export const TipTapEditor = forwardRef<TipTapEditorHandle, Props>(function TipTapEditor(
  {
    content,
    editable = true,
    onChange,
    onChangeText,
    onSelectionUpdate,
    className,
    placeholder = "Start writing…",
    showToolbar = true,
  },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: content ?? "",
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none outline-none min-h-[400px]",
          "prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
          "prose-p:leading-relaxed prose-li:my-0.5",
          className ?? "",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
      onChangeText?.(editor.getText());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      onSelectionUpdate?.(from !== to);
    },
  });

  useImperativeHandle(ref, () => ({
    getSelectedText() {
      if (!editor) return "";
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, " ");
    },
    getSelectionRange() {
      if (!editor) return null;
      const { from, to } = editor.state.selection;
      if (from === to) return null;
      return { from, to };
    },
    replaceRange(from: number, to: number, text: string) {
      if (!editor) return;
      editor.chain().focus().insertContentAt({ from, to }, text).run();
    },
  }));

  // Re-set content when it changes externally (e.g., restore version, streaming complete)
  useEffect(() => {
    if (!editor || content === undefined) return;
    const currentHTML = editor.getHTML();
    if (currentHTML !== content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const showBar = editable && showToolbar;

  return (
    <div>
      {showBar && <EditorToolbar editor={editor} />}
      <div
        className={cn(
          "border border-border bg-card px-6 py-5 cursor-text",
          showBar ? "rounded-b-lg" : "rounded-lg",
          !editable && "cursor-default",
        )}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
