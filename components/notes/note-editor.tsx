"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteNote, saveNote } from "@/app/notes/actions";
import type { NoteDiagram } from "@/lib/diagrams/types";
import { NoteDiagramEditor } from "./note-diagram-editor";
import styles from "./note-editor.module.css";

interface NoteEditorProps {
  id: string;
  initialTitle: string;
  initialBody: JSONContent;
  initialDiagram: NoteDiagram;
}

export function NoteEditor({ id, initialTitle, initialBody, initialDiagram }: NoteEditorProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"notes" | "diagram">("notes");
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
    editorProps: { attributes: { class: styles.prose } },
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
      } catch (error) {
        const digest = (error as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setDeleteError(true);
      }
    });
  }

  return (
    <article className={styles.editor}>
      <div className={styles.titleRow}>
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
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className={`ink-action ${styles.disabled}`}
        >
          {saveError ? "Save failed" : isSaving ? "Saving…" : dirty ? "Save note" : "Saved"}
        </button>
      </div>

      <div className={styles.controls}>
        {mode === "notes" ? (
          <div className={styles.toolbar}>
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className="ink-action">Bold</button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className="ink-action">Italic</button>
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="ink-action">Heading</button>
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className="ink-action">List</button>
          </div>
        ) : null}
        <div className={styles.modeSwitch}>
          <span>Notes</span>
          <button
            type="button"
            role="switch"
            aria-label="Switch between notes and diagram"
            aria-checked={mode === "diagram"}
            className={styles.switch}
            data-active={mode === "diagram"}
            onClick={() => setMode((current) => (current === "notes" ? "diagram" : "notes"))}
          >
            <span className={styles.switchThumb} />
          </button>
          <span>Diagram</span>
        </div>
      </div>

      {mode === "notes" ? (
        <EditorContent editor={editor} className={styles.content} />
      ) : (
        <NoteDiagramEditor noteId={id} diagram={initialDiagram} />
      )}

      <footer className={styles.footer}>
        <p className={styles.hint}>This note keeps its writing and diagram together.</p>
        <span className={styles.deleteGroup}>
          {deleteError ? <span className={styles.deleteError}>Delete failed</span> : null}
          <button type="button" onClick={handleDelete} disabled={isDeleting} className={styles.deleteButton}>
            {isDeleting ? "Deleting…" : "Delete note"}
          </button>
        </span>
      </footer>
    </article>
  );
}
