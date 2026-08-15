"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteNote, saveNote } from "@/app/notes/actions";
import styles from "./note-editor.module.css";

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
        class: styles.prose,
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
    <article className={styles.editor}>
      <input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
        aria-label="Note title"
        placeholder="Untitled note"
        className={styles.title}
      />

      <div className={styles.toolbar}>
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
        <span className={styles.status}>
          {saveError
            ? "Save failed"
            : isSaving
              ? "Saving…"
              : dirty
                ? "Unsaved"
                : "Saved"}
        </span>
      </div>

      <EditorContent editor={editor} className={styles.content} />

      <footer className={styles.footer}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className={`ink-action ${styles.disabled}`}
        >
          Save note
        </button>
        <span className={styles.deleteGroup}>
          {deleteError ? (
            <span className={styles.deleteError}>
              Delete failed
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className={styles.deleteButton}
          >
            {isDeleting ? "Deleting…" : "Delete note"}
          </button>
        </span>
      </footer>
    </article>
  );
}
