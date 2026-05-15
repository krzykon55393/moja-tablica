import { create } from 'zustand';

export type Tool = 'select' | 'pan' | 'draw' | 'highlight' | 'ai' | 'erase' | 'shape' | 'text' | 'image';
export type LineData = { id: string; points: number[]; stroke?: string; strokeWidth?: number; dash?: number[]; opacity?: number };
export type TextData = { id: string; x: number; y: number; text: string; fontSize: number; width: number; rotation?: number; fill?: string };
export type ImageCrop = { x: number; y: number; width: number; height: number };
export type ImageData = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
  rotation?: number;
  crop?: ImageCrop;
};
export type PdfPageData = {
  pageNumber: number;
  src: string;
  width: number;
  height: number;
  selected: boolean;
  text: string;
};
export type PdfDocumentData = {
  id: string;
  name: string;
  className?: string;
  folderName?: string;
  pages: PdfPageData[];
};
export type PendingPlacementImage = {
  src: string;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
};
export type AiCapture = {
  dataUrl: string;
  width: number;
  height: number;
};

// Pełna lista figur dokładnie z Twojego oryginału (obraz_15.png)
export type ShapeType = 
  | 'vector' | 'coords' | 'line_seg' 
  | 'rect' | 'rhombus' | 'ellipse' | 'triangle' | 'rtriangle' | 'trapezoid' | 'rtrapezoid' | 'hexagon' | 'pentagon' | 'table'
  | 'cube' | 'prism3' | 'prism6'
  | 'pyr4' | 'pyr3' | 'pyr6'
  | 'cone' | 'cylinder' | 'sphere';

export type ShapeData = { id: string; type: ShapeType; x: number; y: number; width: number; height: number; rotation?: number; rows?: number; cols?: number };
type HistorySnapshot = {
  lines: LineData[];
  texts: TextData[];
  images: ImageData[];
  shapes: ShapeData[];
};
type HistoryOptions = { record?: boolean };
export type BoardSaveData = {
  lines: LineData[];
  texts: TextData[];
  images: ImageData[];
  shapes: ShapeData[];
  pdfDocuments: PdfDocumentData[];
  bgColor: string;
  grid: 'brak' | 'S' | 'M' | 'L';
  dots: 'brak' | 'S' | 'M' | 'L';
  theme: 'light' | 'dark';
};

interface BoardState {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  stagePos: { x: number; y: number };
  setStagePos: (pos: { x: number; y: number }) => void;
  stageScale: number;
  setStageScale: (scale: number) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
  cursorPosition: { x: number; y: number } | null;
  setCursorPosition: (pos: { x: number; y: number } | null) => void;
  aiCapture: AiCapture | null;
  setAiCapture: (capture: AiCapture | null) => void;
  pendingPlacementImage: PendingPlacementImage | null;
  setPendingPlacementImage: (image: PendingPlacementImage | null) => void;
  isPdfPanelOpen: boolean;
  setIsPdfPanelOpen: (open: boolean) => void;
  pdfDocuments: PdfDocumentData[];
  setPdfDocuments: (documents: PdfDocumentData[]) => void;
  addPdfDocument: (document: PdfDocumentData) => void;
  removePdfDocument: (id: string) => void;
  activePdfId: string | null;
  setActivePdfId: (id: string | null) => void;
  isShapesPanelOpen: boolean;
  setShapesPanelOpen: (open: boolean) => void;
  toggleShapesPanel: () => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  grid: 'brak' | 'S' | 'M' | 'L';
  setGrid: (size: any) => void;
  dots: 'brak' | 'S' | 'M' | 'L';
  setDots: (size: any) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: any) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  strokeOpacity: number;
  setStrokeOpacity: (opacity: number) => void;
  strokeDash: 'solid' | 'dash' | 'dot';
  setStrokeDash: (dash: 'solid' | 'dash' | 'dot') => void;
  
  lines: LineData[];
  setLines: (updater: any, options?: HistoryOptions) => void;
  texts: TextData[];
  addText: (text: TextData) => void;
  updateText: (id: string, newData: Partial<TextData>) => void;
  images: ImageData[];
  addImage: (image: ImageData) => void;
  updateImage: (id: string, newData: Partial<ImageData>) => void;
  
  shapes: ShapeData[];
  addShape: (shape: ShapeData) => void;
  updateShape: (id: string, newData: Partial<ShapeData>) => void;
  
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  deleteSelected: () => void;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  exportBoard: () => BoardSaveData;
  loadBoard: (data: Partial<BoardSaveData>) => void;
  
  clearBoard: () => void;
}

const snapshotBoard = (state: Pick<BoardState, 'lines' | 'texts' | 'images' | 'shapes'>): HistorySnapshot => ({
  lines: state.lines,
  texts: state.texts,
  images: state.images,
  shapes: state.shapes,
});

const withHistory = (state: BoardState) => ({
  past: [...state.past.slice(-49), snapshotBoard(state)],
  future: [],
  canUndo: true,
  canRedo: false,
});

export const useBoardStore = create<BoardState>((set, get) => ({
  activeTool: 'draw',
  setActiveTool: (tool) => set({ activeTool: tool, selectedId: null }),
  stagePos: { x: 0, y: 0 },
  setStagePos: (pos) => set({ stagePos: pos }),
  stageScale: 1,
  setStageScale: (scale) => set({ stageScale: scale }),
  uiScale: 1,
  setUiScale: (scale) => set({ uiScale: scale }),
  cursorPosition: null,
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),
  aiCapture: null,
  setAiCapture: (aiCapture) => set({ aiCapture }),
  pendingPlacementImage: null,
  setPendingPlacementImage: (pendingPlacementImage) => set({ pendingPlacementImage }),
  isPdfPanelOpen: false,
  setIsPdfPanelOpen: (isPdfPanelOpen) => set(isPdfPanelOpen ? { isPdfPanelOpen, isShapesPanelOpen: false } : { isPdfPanelOpen }),
  pdfDocuments: [],
  setPdfDocuments: (pdfDocuments) => set({ pdfDocuments, activePdfId: pdfDocuments[0]?.id || null }),
  addPdfDocument: (document) => set((state) => ({
    pdfDocuments: [...state.pdfDocuments.filter((item) => item.id !== document.id), document],
    activePdfId: document.id,
    isPdfPanelOpen: true,
    isShapesPanelOpen: false,
  })),
  removePdfDocument: (id) => set((state) => {
    const pdfDocuments = state.pdfDocuments.filter((document) => document.id !== id);
    const activePdfId = state.activePdfId === id ? pdfDocuments[pdfDocuments.length - 1]?.id || null : state.activePdfId;
    return { pdfDocuments, activePdfId, isPdfPanelOpen: state.isPdfPanelOpen };
  }),
  activePdfId: null,
  setActivePdfId: (activePdfId) => set({ activePdfId, isPdfPanelOpen: !!activePdfId, isShapesPanelOpen: false }),
  isShapesPanelOpen: false,
  setShapesPanelOpen: (isShapesPanelOpen) => set(isShapesPanelOpen ? { isShapesPanelOpen, isPdfPanelOpen: false } : { isShapesPanelOpen }),
  toggleShapesPanel: () => set((state) => (
    state.isShapesPanelOpen
      ? { isShapesPanelOpen: false }
      : { isShapesPanelOpen: true, isPdfPanelOpen: false }
  )),
  bgColor: '#ffffff',
  setBgColor: (color) => set({ bgColor: color }),
  grid: 'brak',
  setGrid: (grid) => set(grid === 'brak' ? { grid } : { grid, dots: 'brak' }),
  dots: 'brak',
  setDots: (dots) => set(dots === 'brak' ? { dots } : { dots, grid: 'brak' }),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  strokeColor: '#1e1e1e',
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  strokeWidth: 3,
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  strokeOpacity: 1,
  setStrokeOpacity: (strokeOpacity) => set({ strokeOpacity }),
  strokeDash: 'solid',
  setStrokeDash: (strokeDash) => set({ strokeDash }),
  lines: [],
  setLines: (updater, options = { record: true }) => set((state) => ({
    ...(options.record === false ? {} : withHistory(state)),
    lines: typeof updater === 'function' ? updater(state.lines) : updater
  })),
  texts: [],
  addText: (text) => set((state) => ({ ...withHistory(state), texts: [...state.texts, text], selectedId: text.id, activeTool: 'select' })),
  updateText: (id, newData) => set((state) => ({
    ...withHistory(state),
    texts: state.texts.map((text) => text.id === id ? { ...text, ...newData } : text)
  })),
  images: [],
  addImage: (img) => set((state) => ({ ...withHistory(state), images: [...state.images, img], selectedId: img.id, activeTool: 'select' })),
  updateImage: (id, newData) => set((state) => ({
    ...withHistory(state),
    images: state.images.map((img) => img.id === id ? { ...img, ...newData } : img)
  })),
  shapes: [],
  addShape: (shape) => set((state) => ({ ...withHistory(state), shapes: [...state.shapes, shape], selectedId: shape.id })),
  updateShape: (id, newData) => set((state) => ({
    ...withHistory(state),
    shapes: state.shapes.map((s) => s.id === id ? { ...s, ...newData } : s)
  })),
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  deleteSelected: () => set((state) => {
    if (!state.selectedId) return state;
    return {
      ...withHistory(state),
      lines: state.lines.filter((line) => line.id !== state.selectedId),
      texts: state.texts.filter((text) => text.id !== state.selectedId),
      images: state.images.filter((img) => img.id !== state.selectedId),
      shapes: state.shapes.filter((shape) => shape.id !== state.selectedId),
      selectedId: null,
    };
  }),
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  undo: () => set((state) => {
    const previous = state.past[state.past.length - 1];
    if (!previous) return state;
    const future = [snapshotBoard(state), ...state.future].slice(0, 50);
    const past = state.past.slice(0, -1);
    return {
      ...previous,
      past,
      future,
      canUndo: past.length > 0,
      canRedo: true,
      selectedId: null,
    };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    const past = [...state.past, snapshotBoard(state)].slice(-50);
    const future = state.future.slice(1);
    return {
      ...next,
      past,
      future,
      canUndo: true,
      canRedo: future.length > 0,
      selectedId: null,
    };
  }),
  exportBoard: () => {
    const state = get();
    return {
      lines: state.lines,
      texts: state.texts,
      images: state.images,
      shapes: state.shapes,
      pdfDocuments: state.pdfDocuments,
      bgColor: state.bgColor,
      grid: state.grid,
      dots: state.dots,
      theme: state.theme,
    };
  },
  loadBoard: (data) => set({
    lines: data.lines || [],
    texts: data.texts || [],
    images: data.images || [],
    shapes: data.shapes || [],
    pdfDocuments: data.pdfDocuments || [],
    activePdfId: data.pdfDocuments?.[0]?.id || null,
    bgColor: data.bgColor || '#ffffff',
    grid: data.grid || 'brak',
    dots: data.dots || 'brak',
    theme: data.theme || 'light',
    selectedId: null,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  }),
  clearBoard: () => set((state) => ({ ...withHistory(state), lines: [], texts: [], images: [], shapes: [], selectedId: null })),
}));
