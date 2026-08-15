export interface DiagramScene {
  elements: unknown[];
  appState: {
    viewBackgroundColor?: string;
    gridSize?: number;
  };
  files: Record<string, unknown>;
}

export interface NoteDiagram {
  id: string;
  scene: DiagramScene;
}
