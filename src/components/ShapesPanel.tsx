'use client';

import { useBoardStore, ShapeType } from '../store/useBoardStore';
import { useState } from 'react';
import { 
  Square, Circle, Triangle, Hexagon, Pentagon, 
  ArrowRight, Move, Minus, X, Database, TableProperties,
  Box, Cone, Cylinder, Globe
} from 'lucide-react';
import { getShapePath } from '../lib/shapeGeometry';

export default function ShapesPanel() {
  // DODANE: wyciągamy setActiveTool ze store'a
  const {
    isShapesPanelOpen, setShapesPanelOpen, addShape, stagePos, stageScale, setActiveTool, uiScale,
    strokeColor, strokeWidth, strokeOpacity, strokeDash,
  } = useBoardStore();
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  if (!isShapesPanelOpen) return null;

  const handleShapeClick = (shapeId: string) => {
    if (shapeId === 'table') {
      setIsTableModalOpen(true);
      return;
    }

    const centerX = (-stagePos.x + window.innerWidth / 2) / stageScale;
    const centerY = (-stagePos.y + window.innerHeight / 2) / stageScale;

    // Domyslne wymiary figur
    let width = 100;
    let height = 100;
    if (shapeId === 'coords') {
        width = 360;
        height = 260;
    } else if (['cube', 'prism3', 'prism6', 'pyr4', 'pyr3', 'pyr6', 'cone', 'cylinder'].includes(shapeId)) {
        height = 140; // Bryły robimy wyższe na start
    }

    // DODANE: Zmiana aktywnego narzędzia na kursor (select), aby od razu móc edytować wstawioną figurę
    setActiveTool('select');

    addShape({
      id: 'shape-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000), // Bez kropek!
      type: shapeId as ShapeType,
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height,
      stroke: strokeColor,
      strokeWidth,
      opacity: strokeOpacity,
      dash: strokeDash === 'dash' ? [18, 12] : strokeDash === 'dot' ? [2, 10] : undefined,
    });
  };

  const insertTable = () => {
    const width = Math.max(120, cols * 72);
    const height = Math.max(90, rows * 44);
    const centerX = (-stagePos.x + window.innerWidth / 2) / stageScale;
    const centerY = (-stagePos.y + window.innerHeight / 2) / stageScale;

    setActiveTool('select');
    addShape({
      id: 'shape-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000),
      type: 'table',
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      rows: Math.min(20, Math.max(1, rows)),
      cols: Math.min(20, Math.max(1, cols)),
      stroke: strokeColor,
      strokeWidth,
      opacity: strokeOpacity,
      dash: strokeDash === 'dash' ? [18, 12] : strokeDash === 'dot' ? [2, 10] : undefined,
    });
    setIsTableModalOpen(false);
  };

  const sections = [
    {
      title: "Rysunki pomocnicze",
      items: [
        { id: 'vector', icon: ArrowRight, label: 'Wektor' },
        { id: 'coords', icon: Move, label: 'Układ współrzędnych' },
        { id: 'line_seg', icon: Minus, label: 'Linia' },
      ]
    },
    {
      title: "Figury płaskie",
      items: [
        { id: 'rect', icon: Square, label: 'Prostokąt' },
        { id: 'rhombus', icon: Square, label: 'Romb', rotate: 45 },
        { id: 'ellipse', icon: Circle, label: 'Elipsa' },
        { id: 'triangle', icon: Triangle, label: 'Trójkąt' },
        { id: 'rtriangle', icon: Triangle, label: 'Trójkąt prostokątny' }, 
        { id: 'trapezoid', icon: Database, label: 'Trapez' },
        { id: 'rtrapezoid', icon: Database, label: 'Trapez prostokątny' },
        { id: 'hexagon', icon: Hexagon, label: 'Sześciokąt' },
        { id: 'pentagon', icon: Pentagon, label: 'Pięciokąt foremny' },
        { id: 'table', icon: TableProperties, label: 'Tabela' },
      ]
    },
    {
      title: "Graniastosłupy",
      items: [
        { id: 'cube', icon: Box, label: 'Graniastosłup czworokątny' },
        { id: 'prism3', icon: Box, label: 'Graniastosłup trójkątny' },
        { id: 'prism6', icon: Box, label: 'Graniastosłup sześciokątny' },
      ]
    },
    {
      title: "Ostrosłupy",
      items: [
        { id: 'pyr4', icon: Triangle, label: 'Ostrosłup czworokątny' },
        { id: 'pyr3', icon: Triangle, label: 'Ostrosłup trójkątny' },
        { id: 'pyr6', icon: Triangle, label: 'Ostrosłup sześciokątny' },
      ]
    },
    {
      title: "Bryły obrotowe",
      items: [
        { id: 'cone', icon: Cone, label: 'Stożek' },
        { id: 'cylinder', icon: Cylinder, label: 'Walec' },
        { id: 'sphere', icon: Globe, label: 'Kula' },
      ]
    }
  ];

  const ShapePreview = ({ type, rotate }: { type: string; rotate?: number }) => {
    const commonProps = {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 5,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    };

    if (type === 'vector') {
      return (
        <svg viewBox="0 0 64 64" className="h-8 w-8" style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}>
          <path d="M12 44 L48 16" {...commonProps} />
          <path d="M39 15 L49 15 L49 25" {...commonProps} />
        </svg>
      );
    }
    if (type === 'coords') {
      return (
        <svg viewBox="0 0 64 64" className="h-8 w-8">
          <path d="M10 42 H54 M48 36 L54 42 L48 48 M30 54 V10 M24 16 L30 10 L36 16" {...commonProps} />
        </svg>
      );
    }
    if (type === 'line_seg') {
      return (
        <svg viewBox="0 0 64 64" className="h-8 w-8">
          <path d="M12 32 H52" {...commonProps} />
        </svg>
      );
    }
    if (type === 'rect') {
      return (
        <svg viewBox="0 0 64 64" className="h-8 w-8">
          <rect x="12" y="16" width="40" height="32" rx="2" {...commonProps} />
        </svg>
      );
    }
    if (type === 'ellipse') {
      return (
        <svg viewBox="0 0 64 64" className="h-8 w-8">
          <ellipse cx="32" cy="32" rx="22" ry="16" {...commonProps} />
        </svg>
      );
    }

    const path = getShapePath(type as ShapeType, 56, 48, 3, 3);
    if (path) {
      return (
        <svg viewBox="-2 -2 60 52" className="h-8 w-8" style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}>
          <path d={path} {...commonProps} />
        </svg>
      );
    }

    const fallbackMap: Record<string, any> = { Square, Circle, Triangle, Hexagon, Pentagon, Database, TableProperties, Box, Cone, Cylinder, Globe };
    const Icon = fallbackMap[type] || Square;
    return <Icon size={30} strokeWidth={1.8} style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined} />;
  };

  return (
    <>
    <div
      className="absolute right-0 top-0 h-full w-[340px] bg-white shadow-2xl border-l border-gray-100 z-50 flex flex-col animate-in slide-in-from-right duration-300"
      style={{ transform: `scale(${uiScale})`, transformOrigin: 'top right' }}
    >
      <div className="p-4 flex justify-between items-center border-b border-gray-50">
        <h2 className="font-bold text-gray-800 text-lg">Biblioteka figur</h2>
        <button onClick={() => setShapesPanelOpen(false)} className="p-1 hover:bg-gray-100 rounded-md text-gray-400">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-8">
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b-2 border-sky-400 pb-1 inline-block pr-8">
              {section.title}
            </h3>
            <div className="grid grid-cols-3 gap-y-6 gap-x-2">
              {section.items.map((item) => {
                return (
                  <button 
                    key={item.id} 
                    onClick={() => handleShapeClick(item.id)} 
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 flex items-center justify-center rounded-xl border-2 border-transparent group-hover:border-sky-100 group-hover:bg-sky-50 transition-all text-gray-800">
                      <ShapePreview type={item.id} rotate={item.rotate} />
                    </div>
                    <span className="text-[11px] text-center text-gray-600 group-hover:text-gray-900 leading-tight px-1">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
    {isTableModalOpen && (
      <div className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="w-[680px] bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ transform: `scale(${uiScale})` }}>
          <div className="p-8 border-b border-slate-200 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-950">Wstaw tabelę</h2>
              <p className="text-slate-500 text-xl mt-3">Podaj liczbę wierszy i kolumn, aby utworzyć siatkę na tablicy.</p>
            </div>
            <button onClick={() => setIsTableModalOpen(false)} className="text-slate-500 hover:text-slate-900 text-4xl leading-none">×</button>
          </div>
          <div className="p-8 grid grid-cols-2 gap-8">
            <label>
              <span className="block text-sm font-bold text-slate-500 tracking-wider mb-3">WIERSZE</span>
              <input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="w-full rounded-2xl border border-slate-200 px-6 py-4 text-2xl outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900" />
              <span className="block text-slate-400 mt-3">Maksymalny rozmiar: 20 × 20.</span>
            </label>
            <label>
              <span className="block text-sm font-bold text-slate-500 tracking-wider mb-3">KOLUMNY</span>
              <input type="number" min={1} max={20} value={cols} onChange={(e) => setCols(Number(e.target.value))} className="w-full rounded-2xl border border-slate-200 px-6 py-4 text-2xl outline-none focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900" />
            </label>
          </div>
          <div className="px-8 pb-8 flex justify-end gap-5">
            <button onClick={() => setIsTableModalOpen(false)} className="px-8 py-4 rounded-2xl border border-slate-200 font-bold text-slate-800">Anuluj</button>
            <button onClick={insertTable} className="px-8 py-4 rounded-2xl bg-sky-500 text-white font-bold shadow-lg">Wstaw tabelę</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
