"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { deleteNote, moveNoteToFolder, saveNote } from "@/app/notes/actions";
import type { NoteDiagram } from "@/lib/diagrams/types";
import { NoteDiagramEditor } from "./note-diagram-editor";
import styles from "./note-editor.module.css";

interface NoteEditorProps {
  id: string;
  initialTitle: string;
  initialBody: JSONContent;
  initialFolderId: string | null;
  folders: { id: string; name: string }[];
  initialDiagram: NoteDiagram;
}

export function NoteEditor({ id, initialTitle, initialBody, initialFolderId, folders, initialDiagram }: NoteEditorProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"notes" | "diagram">("notes");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState<JSONContent>(initialBody);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [deleteError, setDeleteError] = useState(false);
  const [folderId, setFolderId] = useState(initialFolderId ?? "");
  const [folderError, setFolderError] = useState(false);
  const [isDeleting, startDeleting] = useTransition();
  const [isMoving, startMoving] = useTransition();
  const revisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  function markDirty() {
    revisionRef.current += 1;
    setDirty(true);
    setSaveStatus("unsaved");
  }
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialBody,
    immediatelyRender: false,
    editorProps: { attributes: { class: styles.prose } },
    onUpdate({ editor: currentEditor }) {
      setBody(currentEditor.getJSON());
      markDirty();
    },
  });

  useEffect(() => {
    if (!dirty) return;
    const revision = revisionRef.current;
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      const request = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveNote(id, title, body));
      saveQueueRef.current = request;
      void request.then(
        () => {
          if (revisionRef.current !== revision) return;
          setDirty(false);
          setSaveStatus("saved");
        },
        () => {
          if (revisionRef.current === revision) setSaveStatus("error");
        },
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [body, dirty, id, title]);

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
            markDirty();
          }}
          aria-label="Note title"
          placeholder="Untitled note"
          className={styles.title}
        />
        <span className={styles.saveStatus} data-error={saveStatus === "error"} aria-live="polite">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed — keep editing to retry" : saveStatus === "unsaved" ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      <div className={styles.controls}>
        <label className={styles.folderControl}>Folder
          <select value={folderId} disabled={isMoving} onChange={(event) => {
            const previous = folderId; const next = event.target.value; setFolderId(next);
            startMoving(async () => { try { await moveNoteToFolder(id, next || null); setFolderError(false); router.refresh(); } catch { setFolderId(previous); setFolderError(true); } });
          }}>
            <option value="">Unfiled</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          {folderError ? <span>Move failed</span> : null}
        </label>
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
