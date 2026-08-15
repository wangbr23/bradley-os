import { forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";

import { createNote } from "@/app/notes/actions";
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
}

interface NotesPanelProps extends HTMLAttributes<HTMLDivElement> {
  notes: RecentNote[];
  totalCount: number;
  now: Date;
}

export const NotesPanel = forwardRef<HTMLDivElement, NotesPanelProps>(
  function NotesPanel({ notes, totalCount, now, ...rest }, ref) {
    return (
      <PanelShell
        ref={ref}
        {...rest}
        glyph="–"
        eyebrow="Recently edited"
        title="Notes –"
        statValue={String(totalCount)}
        statLabel={totalCount === 1 ? "note" : "notes"}
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
          </>
        }
        rows={
          notes.length === 0 ? (
            <p className="panel-empty">Nothing written down.</p>
          ) : (
            notes.map((note) => (
              <div className="panel-row" key={note.id}>
                <p className="row-main">
                  <span className="glyph">–</span>
                  {note.title}
                </p>
                <p className="row-time">{formatRelativeTime(note.updatedAt, now)}</p>
              </div>
            ))
          )
        }
      />
    );
  },
);
