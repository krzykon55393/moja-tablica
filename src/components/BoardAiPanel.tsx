'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Grip, Loader2, Minus, Move, Sparkles, X } from 'lucide-react';
import { BoardSaveData, useBoardStore } from '../store/useBoardStore';

const getBoardAiUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const api = params.get('api') || process.env.NEXT_PUBLIC_BOARD_API_URL || 'https://core-czki.pl/uczen/board_api.php';
  const normalizedApi = window.location.protocol === 'https:' && api.startsWith('http://') ? api.replace(/^http:\/\//, 'https://') : api;
  const url = new URL(normalizedApi, window.location.href);
  url.searchParams.set('action', 'ai_solve');
  return url.toString();
};

const summarizeBoard = (board: BoardSaveData) => {
  const textParts = [
    ...board.texts.map((text) => text.text).filter(Boolean),
    ...board.pdfDocuments.flatMap((document) => document.pages.map((page) => page.text).filter(Boolean)),
  ];
  return textParts.join('\n\n').slice(0, 10000);
};

const renderInline = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\$[^$]+\$|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      return <span key={index} className="rounded bg-violet-50 px-1 font-semibold text-violet-900">{part.slice(1, -1)}</span>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-slate-100 px-1 font-semibold text-slate-900">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
};

const renderAiAnswer = (text: string) => {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/```(?:[a-zA-Z]+)?\n?/g, '')
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim();

  if (!normalized) return null;

  const blocks = normalized.split(/\n{2,}/).filter((block) => block.trim() !== '');
  return (
    <div className="space-y-3 text-[13px] leading-relaxed">
      {blocks.map((block, blockIndex) => {
        const trimmed = block.trim();
        const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
        const isMathLine = (line: string) => /[=^_\\]|sqrt|frac|\|.*\||\d+\s*[+\-*/]/.test(line);
        const isMathBlock = lines.length > 1 && lines.every((line) => isMathLine(line) || /^[{}()[\],.;:a-zA-Z0-9\s+\-*/]+$/.test(line));

        if (trimmed.startsWith('#')) {
          return (
            <h3 key={blockIndex} className="text-sm font-black text-slate-950">
              {renderInline(trimmed.replace(/^#+\s*/, ''))}
            </h3>
          );
        }

        if (isMathBlock || trimmed.startsWith('$$')) {
          return (
            <div key={blockIndex} className="overflow-x-auto rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 font-mono text-[12px] font-semibold leading-6 text-slate-950">
              {lines.map((line, lineIndex) => (
                <div key={lineIndex} className="whitespace-pre-wrap break-words">{line.replace(/\$\$/g, '')}</div>
              ))}
            </div>
          );
        }

        if (/^(\d+\.|[-•])\s/.test(trimmed)) {
          return (
            <div key={blockIndex} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800">
              {lines.map((line, lineIndex) => (
                <div key={lineIndex} className="whitespace-pre-wrap break-words">{renderInline(line)}</div>
              ))}
            </div>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap break-words text-slate-800">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
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
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState({ width: 350, height: 430 });
  const [pos, setPos] = useState({ x: 20, y: 96 });
  const lastAutoCaptureRef = useRef('');

  const boardContext = useMemo(() => isOpen ? summarizeBoard(exportBoard()) : '', [exportBoard, isOpen]);

  const askAi = useCallback(async (promptOverride?: string) => {
    const promptToSend = promptOverride ?? prompt;
    setIsLoading(true);
    try {
      const response = await fetch(getBoardAiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          context: boardContext,
          image: aiCapture?.dataUrl || '',
        }),
      });
      const data = await response.json();
      setAnswer(data.status === 'success' ? data.answer : (data.message || 'Nie udało się uzyskać odpowiedzi AI.'));
    } catch {
      setAnswer('Nie udało się połączyć z AI. Sprawdź, czy na serwerze jest aktualny plik /uczen/board_api.php z akcją ai_solve.');
    } finally {
      setIsLoading(false);
    }
  }, [aiCapture, boardContext, prompt]);

  useEffect(() => {
    if (!isOpen || !aiCapture?.dataUrl) return;
    if (lastAutoCaptureRef.current === aiCapture.dataUrl) return;
    lastAutoCaptureRef.current = aiCapture.dataUrl;
    setAnswer('');
    void askAi('');
  }, [aiCapture?.dataUrl, askAi, isOpen]);

  if (!isOpen) return null;

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
      <div className="flex h-full min-h-0 flex-col">
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

        <div className="min-h-0 flex-1 overflow-auto p-3 pb-16">
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

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Krótki prompt, np. policz, wyjaśnij dla 5 klasy, pokaż najkrótszy sposób..."
            className="mb-3 min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />

          <button
            onClick={() => void askAi()}
            disabled={isLoading || (!aiCapture && prompt.trim() === '')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Rozwiąż z AI
          </button>

          <div className="mt-3 min-h-32 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-inner">
            {isLoading ? (
              <div className="flex items-center gap-2 font-bold text-violet-700">
                <Loader2 size={16} className="animate-spin" />
                AI pracuje...
              </div>
            ) : renderAiAnswer(answer)}
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
