'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { 
  Menu, SlidersHorizontal, CircleHelp, 
  Download, EyeOff, Trash2, Sun, Moon, Minus, Plus
} from 'lucide-react';

type ActiveTab = 'menu' | 'settings' | null;

export default function MenuPanel() {
  // Pobieramy WSZYSTKIE opcje z naszego globalnego Store'a
  const { 
    bgColor, setBgColor, clearBoard, 
    grid, setGrid, dots, setDots, theme, setTheme,
    strokeColor, setStrokeColor, strokeWidth, setStrokeWidth, strokeDash, setStrokeDash,
    uiScale, setUiScale,
  } = useBoardStore();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');
  const colors = ['#ffffff', '#f8f9fa', '#f1f3f5', '#fff9db', '#fff0f6', '#e0e7ff'];
  const strokeColors = ['#1f1f1f', '#8c949f', '#c7cdd6', '#ffffff', '#ef2f32', '#ff6468', '#f59100', '#ffb000', '#ffc022', '#91df22', '#2ca247', '#4bc75f', '#0e7f8f', '#2bb4c6', '#3898e8', '#2382d5', '#4c66ed', '#a435bf', '#c655df', '#ec5b94'];
  const emitExport = (type: 'png' | 'pdf') => window.dispatchEvent(new Event(`board:export-${type}`));
  const toggleActiveTab = (tab: Exclude<ActiveTab, null>) => {
    setActiveTab((current) => current === tab ? null : tab);
  };
  const changeUiScale = useCallback((direction: -1 | 1) => {
    const nextScale = Math.round((uiScale + direction * 0.1) * 10) / 10;
    setUiScale(Math.min(1.4, Math.max(0.65, nextScale)));
  }, [setUiScale, uiScale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        changeUiScale(1);
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        changeUiScale(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeUiScale]);

  const renderToggle = (label: string, state: string, setState: (val: any) => void) => (
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
        {['brak', 'S', 'M', 'L'].map((size) => (
          <button
            key={size}
            onClick={() => setState(size)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              state === size 
                ? 'bg-indigo-500 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="absolute top-4 left-4 z-50 flex flex-col gap-2"
      style={{ transform: `scale(${uiScale})`, transformOrigin: 'top left' }}
    >
      <div className="flex gap-2">
        <button 
          onClick={() => toggleActiveTab('menu')}
          className={`p-2.5 rounded-xl transition-all ${activeTab === 'menu' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50'}`}
        >
          <Menu size={20} />
        </button>
        <button 
          onClick={() => toggleActiveTab('settings')}
          className={`p-2.5 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50'}`}
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {activeTab === 'menu' && (
        <div className="bg-white w-64 rounded-xl shadow-lg border border-gray-100 p-4 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs text-gray-400 font-medium mb-3 px-2">Dostosuj</p>
          
          <div className="flex flex-col gap-1 mb-4">
            <button className="flex items-center gap-3 w-full p-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm">
              <CircleHelp size={18} /> Potrzebujesz pomocy?
            </button>
            <button onClick={() => emitExport('png')} className="flex items-center gap-3 w-full p-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm">
              <Download size={18} /> Zapisz jako zdjęcie PNG
            </button>
            <button onClick={() => emitExport('pdf')} className="flex items-center gap-3 w-full p-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm">
              <Download size={18} /> Zapisz jako PDF
            </button>
            <button className="flex items-center gap-3 w-full p-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm">
              <EyeOff size={18} /> Ukryj ramkę widoku
            </button>
            <button 
              onClick={clearBoard}
              className="flex items-center gap-3 w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
            >
              <Trash2 size={18} /> Wyczyść Dokument
            </button>
          </div>

          <hr className="border-gray-100 mb-4" />

          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Ikony</span>
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => changeUiScale(-1)}
                className="rounded-md p-1.5 text-gray-600 transition-all hover:bg-gray-200 disabled:opacity-40"
                disabled={uiScale <= 0.65}
                title="Zmniejsz interfejs"
              >
                <Minus size={16} />
              </button>
              <span className="w-12 text-center text-xs font-bold text-gray-700">{Math.round(uiScale * 100)}%</span>
              <button
                onClick={() => changeUiScale(1)}
                className="rounded-md p-1.5 text-gray-600 transition-all hover:bg-gray-200 disabled:opacity-40"
                disabled={uiScale >= 1.4}
                title="Powiększ interfejs"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Podpięte siatki i kropki */}
          {renderToggle('Siatka', grid, setGrid)}
          {renderToggle('Kropki', dots, setDots)}

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">Motyw</span>
            <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
              <button onClick={() => setTheme('light')} className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                <Sun size={16} />
              </button>
              <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                <Moon size={16} />
              </button>
            </div>
          </div>

          <hr className="border-gray-100 mb-4" />

          <span className="text-sm text-gray-600 block mb-2">Kolor dokumentu</span>
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`w-6 h-6 rounded border transition-all ${
                  bgColor === c 
                    ? 'border-indigo-500 ring-2 ring-indigo-200 scale-110' 
                    : 'border-gray-200 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white w-[360px] rounded-xl shadow-lg border border-gray-100 p-5 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs text-gray-500 font-bold tracking-wider mb-4">KRESKA</p>
          <div className="flex gap-3 mb-7">
            {[1, 3, 5, 8].map((width) => (
              <button
                key={width}
                onClick={() => setStrokeWidth(width)}
                className={`w-[72px] h-[72px] rounded-2xl border-2 flex items-center justify-center ${strokeWidth === width ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}
                title={`Grubość ${width}`}
              >
                <span className="rounded-full bg-slate-900" style={{ width, height: width }} />
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 font-bold tracking-wider mb-4">STYL</p>
          <div className="flex gap-3 mb-7">
            {[
              { id: 'solid', dash: 'none' },
              { id: 'dash', dash: '12px 10px' },
              { id: 'dot', dash: '3px 8px' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setStrokeDash(item.id as 'solid' | 'dash' | 'dot')}
                className={`w-[92px] h-[56px] rounded-2xl border-2 flex items-center justify-center ${strokeDash === item.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="w-12 border-t-[3px] border-slate-950" style={{ borderStyle: item.dash === 'none' ? 'solid' : 'dashed' }} />
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 font-bold tracking-wider mb-4">KOLOR</p>
          <div className="grid grid-cols-5 gap-3">
            {strokeColors.map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={`w-12 h-12 rounded-2xl border-2 ${strokeColor === color ? 'border-violet-500 ring-4 ring-violet-200' : 'border-slate-200'}`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
