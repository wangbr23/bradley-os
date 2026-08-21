"use client";

import { forwardRef, type HTMLAttributes, useEffect, useState, useTransition } from "react";
import Link from "next/link";

import { createNote, deleteNoteFromBoard } from "@/app/notes/actions";
import { PanelShell } from "./panel-shell";
import styles from "./board.module.css";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function formatRelativeTime(date: Date, now: Date) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(minutes) < 60) return relativeTimeFormatter.format(minutes, "minute");
  if (Math.abs(hours) < 24) return relativeTimeFormatter.format(hours, "hour");
  return relativeTimeFormatter.format(days, "day");
}

export interface RecentNote {
  id: string;
  title: string;
  updatedAt: Date;
  folderName: string | null;
}

interface NotesPanelProps extends HTMLAttributes<HTMLDivElement> {
  notes: RecentNote[];
  totalCount: number;
  now: Date;
}

export const NotesPanel = forwardRef<HTMLDivElement, NotesPanelProps>(
  function NotesPanel({ notes, totalCount, now, className, ...rest }, ref) {
    const [items, setItems] = useState(notes);
    const [count, setCount] = useState(totalCount);
    const [deleteError, setDeleteError] = useState(false);
    const [isDeleting, startDeleting] = useTransition();

    useEffect(() => setItems(notes), [notes]);
    useEffect(() => setCount(totalCount), [totalCount]);

    function handleDelete(note: RecentNote) {
      if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;

      const previousIndex = items.findIndex((item) => item.id === note.id);
      setDeleteError(false);
      setItems((current) => current.filter((item) => item.id !== note.id));
      setCount((current) => Math.max(0, current - 1));

      startDeleting(async () => {
        try {
          await deleteNoteFromBoard(note.id);
        } catch {
          setItems((current) => {
            if (current.some((item) => item.id === note.id)) return current;
            const restored = [...current];
            restored.splice(previousIndex, 0, note);
            return restored;
          });
          setCount((current) => current + 1);
          setDeleteError(true);
        }
      });
    }

    return (
      <PanelShell
        ref={ref}
        {...rest}
        className={`${styles.notesPanel}${className ? ` ${className}` : ""}`}
        glyph="–"
        eyebrow="Recently edited"
        title="Notes –"
        statValue={String(count)}
        statLabel={count === 1 ? "note" : "notes"}
        footer={
          <>
            <Link href="/notes" className="ink-action">
              View all
            </Link>
            &nbsp;&nbsp;
            <form action={createNote} className={styles.inlineForm}>
              <button type="submit" className="ink-action">
                New note
              </button>
            </form>
            {deleteError ? <span className={styles.actionError}>Delete failed — restored</span> : null}
            {isDeleting ? <span className={styles.actionStatus}>Deleting…</span> : null}
          </>
        }
        rows={
          items.length === 0 ? (
            <p className="panel-empty">Nothing written down.</p>
          ) : (
            items.map((note) => (
              <div className="panel-row" key={note.id}>
                <Link href={`/notes/${note.id}`} className="row-main panel-row-link">
                  <span className="glyph">–</span>
                  {note.title}
                </Link>
                <p className="row-time">{note.folderName ?? "Unfiled"} · {formatRelativeTime(note.updatedAt, now)}</p>
                <button
                  type="button"
                  className={styles.deleteButton}
                  aria-label={`Delete ${note.title}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => handleDelete(note)}
                >
                  ✕
                </button>
              </div>
            ))
          )
        }
      />
    );
  },
);
