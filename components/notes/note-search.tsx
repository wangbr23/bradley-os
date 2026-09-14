"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import styles from "./note-search.module.css";

interface SearchResult {
  id: string;
  title: string;
  folderName: string | null;
}

export function NoteSearch({ initialTerm }: { initialTerm: string }) {
  const router = useRouter();
  const listboxId = useId();
  const [term, setTerm] = useState(initialTerm);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeTermRef = useRef(term);

  useEffect(() => {
    activeTermRef.current = term;
    const trimmed = term.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/notes/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { notes: SearchResult[] };
        if (activeTermRef.current !== trimmed) return;
        setSuggestions(data.notes);
        setOpen(data.notes.length > 0);
        setActiveIndex(-1);
      } catch {
        // stale or aborted request — the latest term owns the UI
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  function choose(note: SearchResult) {
    router.push(`/notes/${note.id}`);
  }

  const showDropdown = open && term.trim().length > 0;

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.container}>
      <form action="/notes" method="get" role="search" className={styles.form}>
        <input
          type="search"
          name="q"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search notes…"
          aria-label="Search notes"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          className={styles.input}
        />
      </form>
      {showDropdown ? (
        <ul className={styles.suggestions} id={listboxId} role="listbox" aria-label="Note suggestions">
          {suggestions.map((note, index) => (
            <li key={note.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`${styles.suggestion}${index === activeIndex ? ` ${styles.active}` : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(note);
                }}
              >
                <span className={styles.suggestionTitle}>{note.title}</span>
                <span className={styles.suggestionFolder}>{note.folderName ?? "Unfiled"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}