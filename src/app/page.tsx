'use client';

import { useEffect, useMemo, useRef } from 'react';
import Board from '../components/Board';
import MenuPanel from '../components/MenuPanel';
import PdfSidePanel from '../components/PdfSidePanel';
import ShapesPanel from '../components/ShapesPanel';
import Toolbar from '../components/Toolbar';
import BoardAiPanel from '../components/BoardAiPanel';
import BoardAnswersPanel from '../components/BoardAnswersPanel';
import { BoardSaveData, useBoardStore } from '../store/useBoardStore';

type BoardRoute = {
  room: string;
  lesson: string;
  apiUrl: string;
  storageKey: string;
};

const cleanRoom = (value: string | null) => (value || 'default').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
const cleanLesson = (value: string | null) => value || new Date().toISOString().slice(0, 10);

const getBoardRoute = (): BoardRoute => {
  const params = new URLSearchParams(window.location.search);
  const room = cleanRoom(params.get('room'));
  const lesson = cleanLesson(params.get('lesson'));
  const rawApiUrl = params.get('api') || process.env.NEXT_PUBLIC_BOARD_API_URL || 'https://core-czki.pl/uczen/board_api.php';
  const apiUrl = window.location.protocol === 'https:' && rawApiUrl.includes('koreporeczki.cba.pl')
    ? 'https://core-czki.pl/uczen/board_api.php'
    : window.location.protocol === 'https:' && rawApiUrl.startsWith('http://') ? rawApiUrl.replace(/^http:\/\//, 'https://') : rawApiUrl;
  return {
    room,
    lesson,
    apiUrl,
    storageKey: `moja-tablica:board:${room}:${lesson}`,
  };
};

const boardTextForSearch = (board: BoardSaveData) => {
  const parts = [
    ...board.texts.map((text) => text.text).filter(Boolean),
    ...board.pdfDocuments.flatMap((document) => [
      `PDF: ${document.name}`,
      ...document.pages.map((page) => page.text),
    ]),
    ...board.shapes.map((shape) => `Figura: ${shape.type}`),
  ];
  return parts.join('\n\n').trim();
};

function BoardPersistence() {
  const loadBoard = useBoardStore((state) => state.loadBoard);
  const exportBoard = useBoardStore((state) => state.exportBoard);
  const lines = useBoardStore((state) => state.lines);
  const texts = useBoardStore((state) => state.texts);
  const images = useBoardStore((state) => state.images);
  const shapes = useBoardStore((state) => state.shapes);
  const pdfDocuments = useBoardStore((state) => state.pdfDocuments);
  const bgColor = useBoardStore((state) => state.bgColor);
  const grid = useBoardStore((state) => state.grid);
  const dots = useBoardStore((state) => state.dots);
  const theme = useBoardStore((state) => state.theme);
  const loadedRef = useRef(false);

  const route = useMemo<BoardRoute | null>(() => {
    if (typeof window === 'undefined') return null;
    return getBoardRoute();
  }, []);

  useEffect(() => {
    if (!route) return;

    const load = async () => {
      let loadedFromServer = false;
      try {
        const url = new URL(route.apiUrl);
        url.searchParams.set('action', 'load');
        url.searchParams.set('room', route.room);
        url.searchParams.set('lesson', route.lesson);
        const response = await fetch(url.toString(), { credentials: 'include' });
        const data = await response.json();
        if (data.status === 'success' && data.board) {
          loadBoard(data.board);
          window.localStorage.setItem(route.storageKey, JSON.stringify(data.board));
          loadedFromServer = true;
        }
      } catch (error) {
        console.warn('Nie udało się wczytać tablicy z serwera, używam kopii lokalnej.', error);
      } finally {
        if (!loadedFromServer) {
          try {
            const saved = window.localStorage.getItem(route.storageKey);
            if (saved) loadBoard(JSON.parse(saved));
          } catch (error) {
            console.warn('Nie udało się wczytać lokalnej kopii tablicy.', error);
          }
        }
        loadedRef.current = true;
      }
    };

    load();
  }, [loadBoard, route]);

  useEffect(() => {
    if (!loadedRef.current || !route) return;
    const timeout = window.setTimeout(() => {
      try {
        const board = exportBoard();
        window.localStorage.setItem(route.storageKey, JSON.stringify(board));
        window.localStorage.setItem(`moja-tablica:last-board:${route.room}`, route.lesson);

        const url = new URL(route.apiUrl);
        url.searchParams.set('action', 'save');
        fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            room: route.room,
            lesson: route.lesson,
            board,
            board_text: boardTextForSearch(board),
          }),
        }).catch((error) => {
          console.warn('Nie udało się zapisać tablicy na serwerze. Lokalna kopia została zachowana.', error);
        });
      } catch (error) {
        console.warn('Nie udało się zapisać tablicy.', error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [bgColor, dots, exportBoard, grid, images, lines, pdfDocuments, route, shapes, texts, theme]);

  return null;
}

export default function Home() {
  return (
    <main className="board-shell">
      <BoardPersistence />
      <Board />
      <MenuPanel />
      <ShapesPanel />
      <PdfSidePanel />
      <BoardAiPanel />
      <BoardAnswersPanel />
      <div className="toolbar-dock">
        <Toolbar />
      </div>
    </main>
  );
}
