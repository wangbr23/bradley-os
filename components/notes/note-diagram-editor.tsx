"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { saveNoteDiagram } from "@/app/notes/actions";
import type { DiagramScene, NoteDiagram } from "@/lib/diagrams/types";
import styles from "./note-diagram-editor.module.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((module) => module.Excalidraw),
  { ssr: false, loading: () => <p className={styles.loading}>Loading note canvas…</p> },
);

interface NoteDiagramEditorProps {
  noteId: string;
  diagram: NoteDiagram;
}

export function NoteDiagramEditor({ noteId, diagram }: NoteDiagramEditorProps) {
  const [scene] = useState<DiagramScene>(() => ({
    ...diagram.scene,
    appState: { ...diagram.scene.appState, viewBackgroundColor: "#ffffff" },
  }));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScene = useRef<DiagramScene | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pendingScene.current) {
        void saveNoteDiagram(diagram.id, noteId, pendingScene.current);
      }
    };
  }, [diagram.id, noteId]);

  function scheduleSave(nextScene: DiagramScene) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingScene.current = nextScene;
    setStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await saveNoteDiagram(diagram.id, noteId, nextScene);
        pendingScene.current = null;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 700);
  }

  return (
    <section className={styles.section} aria-label="Note canvas">
      <div className={styles.canvas}>
        <Excalidraw
          initialData={{
            elements: scene.elements as never[],
            appState: scene.appState,
            files: scene.files as never,
          }}
          onChange={(elements, appState, files) => {
            scheduleSave({
              elements: JSON.parse(JSON.stringify(elements)) as unknown[],
              appState: {
                viewBackgroundColor: "#ffffff",
                gridSize: appState.gridSize ?? undefined,
              },
              files: JSON.parse(JSON.stringify(files)) as Record<string, unknown>,
            });
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              changeViewBackgroundColor: false,
            },
          }}
        />
      </div>
      <p className={status === "error" ? styles.error : styles.status} aria-live="polite">
        {status === "saving"
          ? "Saving note…"
          : status === "error"
            ? "Note save failed"
            : "Note canvas saved"}
      </p>
    </section>
  );
}
