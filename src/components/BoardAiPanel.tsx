'use client';

import { useMemo, useState } from 'react';
import { Bot, Grip, Loader2, Minus, Move, Sparkles, X } from 'lucide-react';
import { BoardSaveData, useBoardStore } from '../store/useBoardStore';

const getBoardAiUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const api = params.get('api') || process.env.NEXT_PUBLIC_BOARD_API_URL || 'https://core-czki.pl/uczen/board_api.php';
  const normalizedApi = window.location.protocol === 'https:' && api.includes('koreporeczki.cba.pl')
    ? 'https://core-czki.pl/uczen/board_api.php'
    : window.location.protocol === 'https:' && api.startsWith('http://') ? api.replace(/^http:\/\//, 'https://') : api;
  return normalizedApi.replace(/board_api\.php(?:$|\?)/, 'board_ai.php');
};

const summarizeBoard = (board: BoardSaveData) => {
  const textParts = [
    ...board.texts.map((text) => text.text).filter(Boolean),
    ...board.pdfDocuments.flatMap((document) => document.pages.map((page) => page.text).filter(Boolean)),
  ];
  return textParts.join('\n\n').slice(0, 10000);
};

export default function BoardAiPanel() {
  const activeTool = useBoardStore((state) => state.activeTool);
  const setActiveTool = useBoardStore((state) => state.setActiveTool);
  const isOpen = useBoardStore((state) => state.isAiPanelOpen);
  const setIsOpen = useBoardStore((state) => state.setIsAiPanelOpen);
  const exportBoard = useBoardStore((state) => state.exportBoard);
  const uiScale = useBoardStore((state) => state.uiScale);
  const aiCapture = useBoardStore((state) => state.aiCapture);
  const setAiCapture = useBoardStore((state) => state.setAiCapture);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState({ width: 350, height: 430 });
  const [pos, setPos] = useState({ x: 20, y: 96 });

  const boardContext = useMemo(() => isOpen ? summarizeBoard(exportBoard()) : '', [exportBoard, isOpen]);

  if (!isOpen) return null;

  const askAi = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(getBoardAiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'solve',
          context: boardContext,
          image: aiCapture?.dataUrl || '',
        }),
      });
      const data = await response.json();
      setAnswer(data.status === 'success' ? data.answer : (data.message || 'Nie udało się uzyskać odpowiedzi AI.'));
    } catch {
      setAnswer('Nie udało się połączyć z AI. Sprawdź, czy na serwerze jest aktualny plik /uczen/board_ai.php oraz czy w Vercel NEXT_PUBLIC_BOARD_API_URL wskazuje https://core-czki.pl/uczen/board_api.php.');
    } finally {
      setIsLoading(false);
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
            AI
          </div>
          <button
            className="rounded-lg p-1.5 hover:bg-slate-200"
            onClick={() => {
              setIsOpen(false);
              if (activeTool === 'ai') setActiveTool('select');
            }}
            title="Zamknij AI"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <button
            type="button"
            onClick={() => {
              setAiCapture(null);
              setAnswer('');
              setActiveTool('ai');
            }}
            className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-violet-200 bg-violet-50 text-sm font-bold text-violet-700"
            title="Kliknij i zaznacz nowy kontekst na tablicy"
          >
            {aiCapture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={aiCapture.dataUrl} alt="Kontekst AI" className="h-full w-full object-contain" />
            ) : (
              'Zaznacz kontekst'
            )}
          </button>

          <button
            onClick={askAi}
            disabled={isLoading || !aiCapture}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Rozwiąż z AI
          </button>

          <div className="mt-3 min-h-32 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-sm leading-relaxed text-white">
            {isLoading ? 'AI pracuje...' : answer}
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
                width: Math.min(620, Math.max(270, start.width + (moveEvent.clientX - startX))),
                height: Math.min(720, Math.max(300, start.height + (moveEvent.clientY - startY))),
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
          <Grip size={15} />
          <Minus size={16} className="-rotate-45" />
        </div>
      </div>
    </aside>
  );
}
