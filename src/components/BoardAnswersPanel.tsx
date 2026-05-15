'use client';

import { useCallback, useEffect, useState } from 'react';
import { Grip, KeyRound, Loader2, Minus, Move, RefreshCw, X } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';

const getBoardAiUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const api = params.get('api') || process.env.NEXT_PUBLIC_BOARD_API_URL || 'https://core-czki.pl/uczen/board_api.php';
  const normalizedApi = window.location.protocol === 'https:' && api.includes('koreporeczki.cba.pl')
    ? 'https://core-czki.pl/uczen/board_api.php'
    : window.location.protocol === 'https:' && api.startsWith('http://') ? api.replace(/^http:\/\//, 'https://') : api;
  return normalizedApi.replace(/board_api\.php(?:$|\?)/, 'board_ai.php');
};

const getRoom = () => {
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') || 'default').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
};

export default function BoardAnswersPanel() {
  const isOpen = useBoardStore((state) => state.isAnswersPanelOpen);
  const setIsOpen = useBoardStore((state) => state.setIsAnswersPanelOpen);
  const uiScale = useBoardStore((state) => state.uiScale);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ width: 360, height: 430 });
  const [pos, setPos] = useState({ x: 20, y: 540 });

  const loadAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(getBoardAiUrl());
      url.searchParams.set('action', 'test_answers');
      url.searchParams.set('room', getRoom());
      const response = await fetch(url.toString());
      const data = await response.json();
      setAnswer(data.status === 'success' ? (data.answers || 'Brak wygenerowanych odpowiedzi do zadania domowego/testu.') : (data.message || 'Nie udało się wczytać odpowiedzi.'));
    } catch {
      setAnswer('Nie udało się połączyć z odpowiedziami. Wgraj aktualny board_ai.php do folderu /uczen i upewnij się, że API działa po HTTPS.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(loadAnswers);
  }, [isOpen, loadAnswers]);

  if (!isOpen) return null;

  return (
    <aside
      className="fixed z-[104] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl"
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
          className="flex cursor-move items-center justify-between border-b border-amber-100 bg-amber-50 px-3 py-2"
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
          <div className="flex items-center gap-2 text-sm font-black text-amber-900">
            <Move size={16} className="text-amber-500" />
            <KeyRound size={18} />
            Odpowiedzi do zadania
          </div>
          <div className="flex items-center gap-1">
            <button className="rounded-lg p-1.5 hover:bg-amber-100" onClick={loadAnswers} title="Odśwież odpowiedzi">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            </button>
            <button className="rounded-lg p-1.5 hover:bg-amber-100" onClick={() => setIsOpen(false)} title="Zamknij odpowiedzi">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div className="min-h-full whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-sm leading-relaxed text-white">
            {loading ? 'Wczytuję odpowiedzi...' : answer}
          </div>
        </div>

        <div
          className="flex cursor-nwse-resize items-center justify-end border-t border-amber-100 bg-amber-50 px-3 py-2 text-amber-500"
          onPointerDown={(event) => {
            const startX = event.clientX;
            const startY = event.clientY;
            const start = { ...size };
            const move = (moveEvent: PointerEvent) => {
              setSize({
                width: Math.min(680, Math.max(270, start.width + (moveEvent.clientX - startX))),
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
          <Grip size={15} />
          <Minus size={16} className="-rotate-45" />
        </div>
      </div>
    </aside>
  );
}
