"use client";

import { CaretRight, FilePlus, Folder, FolderOpen, FolderPlus, Note } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createFolder, createNote, deleteFolder, moveNoteToFolder, renameFolder } from "@/app/notes/actions";
import styles from "./folder-sidebar.module.css";

export interface NoteFolder { id: string; name: string; count: number }
export interface ExplorerNote { id: string; title: string; folderId: string | null }

function NoteRows({ values }: { values: ExplorerNote[] }) {
  return <div className={styles.children}>{values.map((note) =>
    <Link key={note.id} href={`/notes/${note.id}`} draggable onDragStart={(event) => {
      event.dataTransfer.setData("application/x-bradley-note", note.id); event.dataTransfer.effectAllowed = "move";
    }} className={styles.noteRow}><Note size={14} /><span>{note.title}</span></Link>)}</div>;
}

export function FolderSidebar({ folders, notes, selected, totalCount }: {
  folders: NoteFolder[];
  notes: ExplorerNote[];
  selected: string;
  totalCount: number;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(() => new Set(["unfiled", ...folders.map((folder) => folder.id)]));
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  function addFolder() {
    if (!folderName.trim()) return;
    startTransition(async () => {
      try {
        const folder = await createFolder(folderName);
        setFolderName(""); setCreatingFolder(false); setError("");
        setExpanded((current) => new Set([...current, folder.id]));
        router.push(`/notes?folder=${folder.id}`); router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create folder"); }
    });
  }

  function editFolder(folder: NoteFolder) {
    const nextName = window.prompt("Rename folder", folder.name);
    if (nextName === null || nextName.trim() === folder.name) return;
    startTransition(async () => {
      try { await renameFolder(folder.id, nextName); setError(""); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not rename folder"); }
    });
  }

  function removeFolder(folder: NoteFolder) {
    const label = `${folder.count} ${folder.count === 1 ? "note" : "notes"}`;
    if (!window.confirm(`Delete “${folder.name}” and its ${label}? This cannot be undone.`)) return;
    startTransition(async () => {
      try { await deleteFolder(folder.id); setError(""); if (selected === folder.id) router.push("/notes"); router.refresh(); }
      catch { setError("Could not delete folder"); }
    });
  }

  function dropNote(event: React.DragEvent, targetFolderId: string | null) {
    event.preventDefault(); setDropTarget(null);
    const noteId = event.dataTransfer.getData("application/x-bradley-note");
    if (!noteId) return;
    startTransition(async () => {
      try { await moveNoteToFolder(noteId, targetFolderId); setError(""); router.refresh(); }
      catch { setError("Could not move note"); }
    });
  }

  const unfiled = notes.filter((note) => !note.folderId);
  const selectedFolderId = folders.some((folder) => folder.id === selected) ? selected : "";

  return <aside className={styles.sidebar} aria-label="Notes explorer">
    <div className={styles.explorerHeader}>
      <span>Explorer</span>
      <div className={styles.tools}>
        <form action={createNote} title="New note">
          {selectedFolderId ? <input type="hidden" name="folderId" value={selectedFolderId} /> : null}
          <button type="submit" aria-label="Create note"><FilePlus size={17} /></button>
        </form>
        <button type="button" title="New folder" aria-label="Create folder" onClick={() => setCreatingFolder(true)}><FolderPlus size={17} /></button>
      </div>
    </div>
    <Link href="/notes" className={`${styles.allNotes}${selected === "all" ? ` ${styles.active}` : ""}`}><span>All Notes</span><span>{totalCount}</span></Link>

    <div className={`${styles.treeTarget}${dropTarget === "unfiled" ? ` ${styles.dropTarget}` : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDropTarget("unfiled"); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropNote(event, null)}>
      <div className={styles.treeRow}>
        <button type="button" className={styles.chevron} onClick={() => toggle("unfiled")} aria-label="Toggle Unfiled"><CaretRight size={13} weight="bold" data-expanded={expanded.has("unfiled")} /></button>
        <Link href="/notes?folder=unfiled" className={`${styles.treeLink}${selected === "unfiled" ? ` ${styles.active}` : ""}`}>
          {expanded.has("unfiled") ? <FolderOpen size={16} /> : <Folder size={16} />}<span>Unfiled</span><small>{unfiled.length}</small>
        </Link>
      </div>
      {expanded.has("unfiled") ? <NoteRows values={unfiled} /> : null}
    </div>

    {folders.map((folder) => {
      const folderNotes = notes.filter((note) => note.folderId === folder.id);
      return <div key={folder.id} className={`${styles.treeTarget}${dropTarget === folder.id ? ` ${styles.dropTarget}` : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDropTarget(folder.id); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropNote(event, folder.id)}>
        <div className={styles.treeRow}>
          <button type="button" className={styles.chevron} onClick={() => toggle(folder.id)} aria-label={`Toggle ${folder.name}`}><CaretRight size={13} weight="bold" data-expanded={expanded.has(folder.id)} /></button>
          <Link href={`/notes?folder=${folder.id}`} className={`${styles.treeLink}${selected === folder.id ? ` ${styles.active}` : ""}`}>
            {expanded.has(folder.id) ? <FolderOpen size={16} /> : <Folder size={16} />}<span>{folder.name}</span><small>{folder.count}</small>
          </Link>
          <button className={styles.rowAction} type="button" onClick={() => editFolder(folder)} aria-label={`Rename ${folder.name}`}>✎</button>
          <button className={styles.rowAction} type="button" onClick={() => removeFolder(folder)} aria-label={`Delete ${folder.name}`}>×</button>
        </div>
        {expanded.has(folder.id) ? <NoteRows values={folderNotes} /> : null}
      </div>;
    })}

    {creatingFolder ? <form className={styles.inlineCreate} onSubmit={(event) => { event.preventDefault(); addFolder(); }}>
      <Folder size={16} /><input autoFocus value={folderName} maxLength={80} onChange={(event) => setFolderName(event.target.value)} onBlur={() => { if (!folderName) setCreatingFolder(false); }} onKeyDown={(event) => { if (event.key === "Escape") setCreatingFolder(false); }} placeholder="folder name" aria-label="Folder name" disabled={pending} />
    </form> : null}
    {error ? <p className={styles.error}>{error}</p> : null}
  </aside>;
}
