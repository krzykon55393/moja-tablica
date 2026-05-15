'use client';

import { useBoardStore, Tool } from '../store/useBoardStore';
import { useRef } from 'react';
import { 
  MousePointer2, Hand, Shapes, 
  Type, Image as ImageIcon, Eraser, FileText, Minus, Plus, Undo2, Redo2, Wand2, Highlighter, Bot
} from 'lucide-react';

export default function Toolbar() {
  const {
    activeTool, setActiveTool, setShapesPanelOpen,
    addImage, stagePos, stageScale, setStageScale, cursorPosition,
    isPdfPanelOpen, setIsPdfPanelOpen, uiScale,
    canUndo, canRedo, undo, redo
  } = useBoardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToolClick = (toolId: Tool) => {
    if (toolId === 'image') {
      setShapesPanelOpen(false);
      setIsPdfPanelOpen(false);
      fileInputRef.current?.click();
      return;
    }
    
    setActiveTool(toolId);
    if (toolId === 'shape') {
      setShapesPanelOpen(true);
      return;
    }

    setShapesPanelOpen(false);
    setIsPdfPanelOpen(false);
  };

  const addImageFromSource = (src: string, width: number, height: number, offset = 0) => {
    const target = cursorPosition || {
      x: (-stagePos.x + window.innerWidth / 2) / stageScale,
      y: (-stagePos.y + window.innerHeight / 2) / stageScale,
    };
    const displayWidth = width;
    const displayHeight = height;

    addImage({
      id: 'img-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000),
      src,
      x: target.x - displayWidth / 2 + offset,
      y: target.y - displayHeight / 2 + offset,
      width: displayWidth,
      height: displayHeight,
      naturalWidth: width,
      naturalHeight: height,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        window.dispatchEvent(new CustomEvent('board:import-pdf', { detail: file }));
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          addImageFromSource(src, img.width, img.height);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const tools: { id: Tool; icon: any; name: string }[] = [
    { id: 'select', icon: MousePointer2, name: 'Wybierz' },
    { id: 'pan', icon: Hand, name: 'Rączka' },
    { id: 'draw', icon: Wand2, name: 'Wskaźnik / rysuj' },
    { id: 'highlight', icon: Highlighter, name: 'Zakreślacz' },
    { id: 'ai', icon: Bot, name: 'AI: zaznacz i wyjaśnij' },
    { id: 'shape', icon: Shapes, name: 'Figury' },
    { id: 'text', icon: Type, name: 'Tekst' },
    { id: 'image', icon: ImageIcon, name: 'Obraz' },
    { id: 'erase', icon: Eraser, name: 'Gumka' },
  ];

  return (
    <>
      <div
        className="flex items-center gap-3"
        style={{ transform: `scale(${uiScale})`, transformOrigin: 'bottom center' }}
      >
        <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-2xl shadow-sm border border-gray-200">
          <button onClick={() => setStageScale(Math.max(0.25, stageScale - 0.1))} className="p-2.5 rounded-xl hover:bg-gray-100" title="Oddal">
            <Minus size={20} />
          </button>
          <span className="w-16 text-center font-medium">{Math.round(stageScale * 100)}%</span>
          <button onClick={() => setStageScale(Math.min(3, stageScale + 0.1))} className="p-2.5 rounded-xl hover:bg-gray-100" title="Przybliż">
            <Plus size={20} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-2xl shadow-sm border border-gray-200">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-2.5 rounded-xl ${canUndo ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'}`}
            title="Cofnij"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-2.5 rounded-xl ${canRedo ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'}`}
            title="Ponów"
          >
            <Redo2 size={20} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-2xl shadow-sm border border-gray-200">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleToolClick(t.id)}
                className={`p-2.5 rounded-xl transition-all ${isActive ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-400' : 'text-gray-900 hover:bg-gray-100'}`}
                title={t.name}
              >
                <Icon size={22} />
              </button>
            );
          })}
          <button
            onClick={() => {
              setActiveTool('select');
              setIsPdfPanelOpen(!isPdfPanelOpen);
            }}
            className={`p-2.5 rounded-xl transition-all ${isPdfPanelOpen ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-400' : 'text-gray-900 hover:bg-gray-100'}`}
            title="Panel PDF / dokumentu"
          >
            <FileText size={22} />
          </button>
        </div>
      </div>
    </>
  );
}
