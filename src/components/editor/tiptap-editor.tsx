"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type Props = {
  content?: string; // HTML string
  editable?: boolean;
  onChange?: (markdown: string) => void;
  className?: string;
  placeholder?: string;
};

export function TipTapEditor({
  content,
  editable = true,
  onChange,
  className,
  placeholder = "Start writing…",
}: Props) {
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
      onChange?.(editor.getText());
    },
  });

  // Re-set content when it changes externally (e.g., streaming complete)
  useEffect(() => {
    if (!editor || content === undefined) return;
    const currentHTML = editor.getHTML();
    if (currentHTML !== content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-6 py-5 cursor-text",
        !editable && "cursor-default",
      )}
      onClick={() => editor?.commands.focus()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
