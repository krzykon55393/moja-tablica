'use client';

import { useMemo, useState } from 'react';
import { Bot, Grip, Loader2, Minus, Move, X } from 'lucide-react';
import { BoardSaveData, useBoardStore } from '../store/useBoardStore';

const getBoardAiUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const api = params.get('api') || process.env.NEXT_PUBLIC_BOARD_API_URL || 'http://localhost/GUWNO/koreczki/moja-tablica/koreporeczki.cba.pl/uczen/board_api.php';
  return api.replace(/board_api\.php(?:$|\?)/, 'board_ai.php');
};

const summarizeBoard = (board: BoardSaveData, selectedId: string | null) => {
  const selectedText = board.texts.find((item) => item.id === selectedId);
  if (selectedText) return `Zaznaczony tekst:\n${selectedText.text}`;

  const selectedShape = board.shapes.find((item) => item.id === selectedId);
  if (selectedShape) return `Zaznaczona figura: ${selectedShape.type}, szerokość ${Math.round(selectedShape.width)}, wysokość ${Math.round(selectedShape.height)}.`;

  const selectedImage = board.images.find((item) => item.id === selectedId);
  if (selectedImage) return `Zaznaczony obraz. Rozmiar na tablicy: ${Math.round(selectedImage.width)} x ${Math.round(selectedImage.height)}. Jeśli użytkownik pyta o treść obrazu, poproś o zaznaczenie tekstu albo wklejenie treści.`;

  const textParts = [
    ...board.texts.map((text) => text.text).filter(Boolean),
    ...board.pdfDocuments.flatMap((document) => document.pages.map((page) => page.text).filter(Boolean)),
  ];
  const drawingSummary = `Na tablicy jest ${board.lines.length} linii/zakreśleń, ${board.shapes.length} figur, ${board.images.length} obrazów i ${board.pdfDocuments.length} dokumentów PDF.`;
  return [drawingSummary, ...textParts].join('\n\n').slice(0, 14000);
};

export default function BoardAiPanel() {
  const activeTool = useBoardStore((state) => state.activeTool);
  const setActiveTool = useBoardStore((state) => state.setActiveTool);
  const selectedId = useBoardStore((state) => state.selectedId);
  const exportBoard = useBoardStore((state) => state.exportBoard);
  const uiScale = useBoardStore((state) => state.uiScale);
  const [prompt, setPrompt] = useState('Policz i wytłumacz krok po kroku zaznaczony fragment.');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ width: 360, height: 430 });
  const [pos, setPos] = useState({ x: 20, y: 96 });

  const visible = activeTool === 'ai';
  const contextPreview = useMemo(() => {
    if (!visible) return '';
    return summarizeBoard(exportBoard(), selectedId).slice(0, 360);
  }, [exportBoard, selectedId, visible]);

  if (!visible) return null;

  const askAi = async (mode: 'solve' | 'explain' = 'solve') => {
    setLoading(true);
    try {
      const context = summarizeBoard(exportBoard(), selectedId);
      const response = await fetch(getBoardAiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode, prompt, context }),
      });
      const data = await response.json();
      setAnswer(data.status === 'success' ? data.answer : (data.message || 'Nie udało się uzyskać odpowiedzi AI.'));
    } catch {
      setAnswer('Nie udało się połączyć z AI. Sprawdź, czy plik board_ai.php jest wgrany na serwer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      className="fixed z-[105] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      style={{
        right: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        transform: `scale(${uiScale})`,
        transformOrigin: 'top right',
      }}
    >
      <div className="flex h-full flex-col">
        <div
          className="flex cursor-move items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2"
          onPointerDown={(event) => {
            const startX = event.clientX;
            const startY = event.clientY;
            const start = { ...pos };
            const move = (moveEvent: PointerEvent) => {
              setPos({
                x: Math.max(8, start.x - (moveEvent.clientX - startX)),
                y: Math.max(8, start.y + (moveEvent.clientY - startY)),
              });
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        >
          <div className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Move size={16} className="text-slate-400" />
            <Bot size={18} className="text-violet-600" />
            AI tablicy
          </div>
          <button className="rounded-lg p-1.5 hover:bg-slate-200" onClick={() => setActiveTool('select')} title="Zamknij AI">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-3">
          <div className="rounded-xl bg-violet-50 p-3 text-xs font-semibold leading-relaxed text-violet-900">
            {selectedId ? 'AI użyje zaznaczonego elementu.' : 'AI użyje tekstów/PDF-ów z tablicy. Zaznacz element strzałką, żeby zawęzić kontekst.'}
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-400 focus:bg-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => askAi('solve')} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
              Policz
            </button>
            <button onClick={() => askAi('explain')} disabled={loading} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              Wytłumacz
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <Grip size={13} /> Kontekst
            </div>
            <p className="max-h-20 overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{contextPreview || 'Brak tekstowego kontekstu.'}</p>
          </div>
          <div className="min-h-28 whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-sm leading-relaxed text-white">
            {loading ? 'AI pracuje...' : answer || 'Odpowiedź pojawi się tutaj.'}
          </div>
        </div>

        <div
          className="flex cursor-nwse-resize items-center justify-end border-t border-slate-100 bg-slate-50 px-3 py-2 text-slate-400"
          onPointerDown={(event) => {
            const startX = event.clientX;
            const startY = event.clientY;
            const start = { ...size };
            const move = (moveEvent: PointerEvent) => {
              setSize({
                width: Math.min(720, Math.max(280, start.width + (moveEvent.clientX - startX))),
                height: Math.min(760, Math.max(260, start.height + (moveEvent.clientY - startY))),
              });
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        >
          <Minus size={16} className="-rotate-45" />
        </div>
      </div>
    </aside>
  );
}
