"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteNote, saveNote } from "@/app/notes/actions";

interface NoteEditorProps {
  id: string;
  initialTitle: string;
  initialBody: JSONContent;
}

export function NoteEditor({ id, initialTitle, initialBody }: NoteEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState<JSONContent>(initialBody);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialBody,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-note min-h-[24rem] focus:outline-none",
      },
    },
    onUpdate({ editor: currentEditor }) {
      setBody(currentEditor.getJSON());
      setDirty(true);
    },
  });

  function handleSave() {
    startSaving(async () => {
      try {
        await saveNote(id, title, body);
        setDirty(false);
        setSaveError(false);
        router.refresh();
      } catch {
        setSaveError(true);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    startDeleting(async () => {
      try {
        await deleteNote(id);
        setDeleteError(false);
      } catch (error) {
        // deleteNote redirects on success, which Next.js implements by
        // throwing a special error — let that one through, it's not a failure.
        const digest = (error as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw error;
        }
        setDeleteError(true);
      }
    });
  }

  return (
    <article className="mx-auto max-w-2xl py-10">
      <input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
        aria-label="Note title"
        placeholder="Untitled note"
        className="w-full border-0 bg-transparent font-serif text-4xl font-semibold tracking-tight outline-none placeholder:text-[color:var(--muted)]"
      />

      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-[color:var(--border)] py-3">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-pressed={editor?.isActive("bold") ?? false}
          className="ink-action"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-pressed={editor?.isActive("italic") ?? false}
          className="ink-action"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false}
          className="ink-action"
        >
          Heading
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          aria-pressed={editor?.isActive("bulletList") ?? false}
          className="ink-action"
        >
          List
        </button>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-wide text-[color:var(--muted)]">
          {saveError
            ? "Save failed"
            : isSaving
              ? "Saving…"
              : dirty
                ? "Unsaved"
                : "Saved"}
        </span>
      </div>

      <EditorContent editor={editor} className="py-8" />

      <footer className="mt-10 flex items-center justify-between border-t border-[color:var(--border)] pt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="ink-action disabled:cursor-default disabled:opacity-40"
        >
          Save note
        </button>
        <span className="flex items-center gap-3">
          {deleteError ? (
            <span className="font-mono text-[11px] uppercase tracking-wide text-red-700">
              Delete failed
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="font-mono text-[11px] uppercase tracking-wide text-[color:var(--muted)] hover:text-red-700 disabled:opacity-40"
          >
            {isDeleting ? "Deleting…" : "Delete note"}
          </button>
        </span>
      </footer>
    </article>
  );
}
