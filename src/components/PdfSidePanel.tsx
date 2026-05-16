'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Cloud, FileImage, FileText, Folder, LogOut, Trash2, UserCircle, X } from 'lucide-react';
import { PdfPageData, useBoardStore } from '../store/useBoardStore';
import { fitImageToViewport } from '../lib/imageSizing';

type SelectionState = {
  pageNumber: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfTextItem = { str: string };
type PdfPageProxy = {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};
type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
};
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentProxy> };
};
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};
type DriveFolder = {
  id: string;
  name: string;
};
type DriveUser = {
  name?: string;
  email?: string;
  picture?: string;
};
type PickerDocument = {
  id: string;
  name: string;
  mimeType: string;
};
type PickerResponse = {
  action?: string;
  docs?: PickerDocument[];
};
type PickerDocsView = {
  setIncludeFolders: (includeFolders: boolean) => PickerDocsView;
  setSelectFolderEnabled: (selectFolderEnabled: boolean) => PickerDocsView;
  setMimeTypes: (mimeTypes: string) => PickerDocsView;
};
type PickerBuilder = {
  addView: (view: PickerDocsView) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setCallback: (callback: (data: PickerResponse) => void) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  setLocale: (locale: string) => PickerBuilder;
  setDeveloperKey: (developerKey: string) => PickerBuilder;
  setAppId: (appId: string) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};
type GooglePicker = {
  Action: { PICKED: string };
  DocsView: new () => PickerDocsView;
  PickerBuilder: new () => PickerBuilder;
};
type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; error?: string }) => void;
      }) => GoogleTokenClient;
    };
  };
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || '';
const DEFAULT_BOARD_API_URL = process.env.NEXT_PUBLIC_BOARD_API_URL || 'https://core-czki.pl/uczen/board_api.php';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.readonly';
const LOCAL_PDF_LIMIT = 5;

const getBoardApiUrl = () => {
  if (typeof window === 'undefined') return DEFAULT_BOARD_API_URL;
  const params = new URLSearchParams(window.location.search);
  const rawApiUrl = params.get('api') || DEFAULT_BOARD_API_URL;
  return window.location.protocol === 'https:' && rawApiUrl.startsWith('http://')
    ? rawApiUrl.replace(/^http:\/\//, 'https://')
    : rawApiUrl;
};

const getBoardRoom = () => {
  if (typeof window === 'undefined') return 'default';
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') || 'default').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
};

export default function PdfSidePanel() {
  const {
    addImage,
    addPdfDocument,
    activePdfId,
    cursorPosition,
    isPdfPanelOpen,
    pdfDocuments,
    removePdfDocument,
    setActivePdfId,
    setIsPdfPanelOpen,
    setPdfDocuments,
    setPendingPlacementImage,
    stagePos,
    stageScale,
    uiScale,
  } = useBoardStore();

  const [isLoading, setIsLoading] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [driveUser, setDriveUser] = useState<DriveUser | null>(null);
  const [driveItems, setDriveItems] = useState<DriveFile[]>([]);
  const [driveFolderStack, setDriveFolderStack] = useState<DriveFolder[]>([{ id: 'root', name: 'Mój dysk' }]);
  const [driveError, setDriveError] = useState('');
  const [panelWidth, setPanelWidth] = useState(430);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [removeWhiteBackground, setRemoveWhiteBackground] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [floatingClip, setFloatingClip] = useState<{ src: string; x: number; y: number } | null>(null);
  const panelFileInputRef = useRef<HTMLInputElement>(null);
  const driveTokenClientRef = useRef<GoogleTokenClient | null>(null);

  const normalizedDocuments = useMemo(
    () => pdfDocuments.map((document) => ({
      ...document,
      className: document.className || 'Ogólne',
      folderName: document.folderName || 'Materiały',
    })),
    [pdfDocuments]
  );
  const visibleDocuments = normalizedDocuments;
  const activeDocument = useMemo(
    () => visibleDocuments.find((document) => document.id === activePdfId) || visibleDocuments[0] || null,
    [activePdfId, visibleDocuments]
  );
  const quickDocuments = useMemo(
    () => visibleDocuments.slice(-3).reverse(),
    [visibleDocuments]
  );
  const localPdfRemaining = Math.max(0, LOCAL_PDF_LIMIT - pdfDocuments.length);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setFloatingClip((clip) => clip ? { ...clip, x: event.clientX + 18, y: event.clientY + 18 } : clip);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const clearFloatingClip = () => setFloatingClip(null);
    window.addEventListener('board:clip-placed', clearFloatingClip);
    return () => window.removeEventListener('board:clip-placed', clearFloatingClip);
  }, []);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = Math.max(340, Math.min(820, window.innerWidth - event.clientX));
      setPanelWidth(nextWidth);
    };
    const handlePointerUp = () => setIsResizingPanel(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingPanel]);

  const loadPdfJs = useCallback(() => new Promise<PdfJs>((resolve, reject) => {
    const existing = (window as Window & { pdfjsLib?: PdfJs }).pdfjsLib;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as Window & { pdfjsLib?: PdfJs }).pdfjsLib;
      if (!pdfjsLib) {
        reject(new Error('PDF.js nie został załadowany.'));
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Nie udało się pobrać PDF.js.'));
    document.head.appendChild(script);
  }), []);

  const loadGoogleIdentity = useCallback(() => new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = (window as Window & { google?: GoogleIdentity }).google;
    if (existing?.accounts?.oauth2) {
      resolve(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as Window & { google?: GoogleIdentity }).google;
      if (!google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services nie zostało załadowane.'));
        return;
      }
      resolve(google);
    };
    script.onerror = () => reject(new Error('Nie udało się załadować Google Identity Services.'));
    document.head.appendChild(script);
  }), []);

  const loadGooglePicker = useCallback(() => new Promise<GooglePicker>((resolve, reject) => {
    const existing = (window as Window & { google?: GoogleIdentity & { picker?: GooglePicker } }).google?.picker;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      const gapi = (window as Window & { gapi?: { load: (name: string, callback: () => void) => void } }).gapi;
      if (!gapi) {
        reject(new Error('Google API nie zostało załadowane.'));
        return;
      }
      gapi.load('picker', () => {
        const picker = (window as Window & { google?: GoogleIdentity & { picker?: GooglePicker } }).google?.picker;
        if (!picker) {
          reject(new Error('Google Picker nie został załadowany.'));
          return;
        }
        resolve(picker);
      });
    };
    script.onerror = () => reject(new Error('Nie udało się załadować Google Picker.'));
    document.head.appendChild(script);
  }), []);

  const loadDriveUser = useCallback(async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const user = await response.json() as DriveUser;
      setDriveUser(user);
    } catch {
      setDriveUser(null);
    }
  }, []);

  const listDriveFolder = useCallback(async (folderId: string, token = driveAccessToken) => {
    if (!token) return;
    setIsLoading(true);
    setDriveError('');

    try {
      const query = `'${folderId}' in parents and trashed = false and (mimeType = '${DRIVE_FOLDER_MIME}' or mimeType = 'application/pdf' or mimeType contains 'image/')`;
      const params = new URLSearchParams({
        q: query,
        fields: 'files(id,name,mimeType)',
        orderBy: 'folder,name',
        pageSize: '100',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Nie udało się pobrać folderu Drive.');
      const data = await response.json() as { files?: DriveFile[] };
      setDriveItems(data.files || []);
    } catch {
      setDriveError('Nie udało się pobrać plików z Google Drive.');
    } finally {
      setIsLoading(false);
    }
  }, [driveAccessToken]);

  const connectDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setDriveError('Google Drive nie jest jeszcze skonfigurowany. Dodaj NEXT_PUBLIC_GOOGLE_CLIENT_ID w .env.local.');
      return;
    }

    try {
      const google = await loadGoogleIdentity();
      driveTokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (!response.access_token) {
            setDriveError('Nie udało się połączyć z Google Drive.');
            return;
          }
          setDriveAccessToken(response.access_token);
          setDriveFolderStack([{ id: 'root', name: 'Mój dysk' }]);
          void loadDriveUser(response.access_token);
          void listDriveFolder('root', response.access_token);
        },
      });
      driveTokenClientRef.current.requestAccessToken(driveAccessToken ? undefined : { prompt: 'consent' });
    } catch {
      setDriveError('Nie udało się uruchomić logowania Google.');
    }
  }, [driveAccessToken, listDriveFolder, loadDriveUser, loadGoogleIdentity]);

  const disconnectDrive = () => {
    setDriveAccessToken(null);
    setDriveUser(null);
    setDriveItems([]);
    setDriveFolderStack([{ id: 'root', name: 'Mój dysk' }]);
  };

  const openDriveFolder = useCallback((folder: DriveFolder) => {
    const nextStack = [...driveFolderStack, folder];
    setDriveFolderStack(nextStack);
    void listDriveFolder(folder.id);
  }, [driveFolderStack, listDriveFolder]);

  const jumpToDriveFolder = (index: number) => {
    const nextStack = driveFolderStack.slice(0, index + 1);
    setDriveFolderStack(nextStack);
    void listDriveFolder(nextStack[nextStack.length - 1].id);
  };

  const fetchDriveBlob = useCallback(async (file: DriveFile) => {
    if (!driveAccessToken) throw new Error('Brak połączenia z Drive.');
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${driveAccessToken}` },
    });
    if (!response.ok) throw new Error('Nie udało się pobrać pliku z Drive.');
    return response.blob();
  }, [driveAccessToken]);

  const transparentizeWhiteCanvas = useCallback((canvas: HTMLCanvasElement) => {
    if (!removeWhiteBackground) return canvas.toDataURL('image/png');
    const context = canvas.getContext('2d');
    if (!context) return canvas.toDataURL('image/png');

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (red > 245 && green > 245 && blue > 245) {
        pixels[index + 3] = 0;
      }
    }
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }, [removeWhiteBackground]);

  const prepareImageSrc = useCallback((src: string) => new Promise<string>((resolve) => {
    if (!removeWhiteBackground) {
      resolve(src);
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(src);
        return;
      }
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      context.drawImage(image, 0, 0);
      resolve(transparentizeWhiteCanvas(canvas));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  }), [removeWhiteBackground, transparentizeWhiteCanvas]);

  const uploadMaterialToServer = useCallback(async (file: File) => {
    const url = new URL(getBoardApiUrl());
    url.searchParams.set('action', 'upload_material');

    const formData = new FormData();
    formData.append('room', getBoardRoom());
    formData.append('file', file);

    const response = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || data.status !== 'success' || !data.url) {
      throw new Error(data.message || 'Nie udało się wgrać pliku na serwer.');
    }
    return String(data.url);
  }, []);

  const importPdf = useCallback(async (file: File) => {
    if (!driveAccessToken && pdfDocuments.length >= LOCAL_PDF_LIMIT) {
      alert(`Bez połączenia z Google Drive możesz mieć maksymalnie ${LOCAL_PDF_LIMIT} PDF-ów na koncie.`);
      return;
    }

    setIsPdfPanelOpen(true);
    setIsLoading(true);

    try {
      const serverUrl = driveAccessToken ? '' : await uploadMaterialToServer(file);

      if (file.type.startsWith('image/')) {
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('image-load'));
          img.src = src;
        });

        addPdfDocument({
          id: 'img-doc-' + Date.now().toString(),
          name: file.name,
          className: driveAccessToken ? 'Google Drive' : 'Serwer',
          folderName: driveFolderStack[driveFolderStack.length - 1]?.name || 'Materiały',
          sourceUrl: serverUrl || undefined,
          sourceType: driveAccessToken ? 'drive' : 'server',
          pages: [{
            pageNumber: 1,
            src,
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height,
            selected: true,
            text: file.name,
          }],
        });
        return;
      }

      const pdfjsLib = await loadPdfJs();
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const pages: PdfPageData[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(' ');
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        pages.push({
          pageNumber,
          src: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
          selected: pageNumber === 1,
          text,
        });
      }

      addPdfDocument({
        id: 'pdf-' + Date.now().toString(),
        name: file.name,
        className: driveAccessToken ? 'Google Drive' : 'Serwer',
        folderName: driveFolderStack[driveFolderStack.length - 1]?.name || 'Materiały',
        sourceUrl: serverUrl || undefined,
        sourceType: driveAccessToken ? 'drive' : 'server',
        pages,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd importu.';
      alert(`Nie udało się zaimportować pliku: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addPdfDocument, driveAccessToken, driveFolderStack, loadPdfJs, pdfDocuments.length, setIsPdfPanelOpen, uploadMaterialToServer]);

  useEffect(() => {
    const handlePdfImport = (event: Event) => {
      const file = (event as CustomEvent<File>).detail;
      if (file) void importPdf(file);
    };
    window.addEventListener('board:import-pdf', handlePdfImport);
    return () => window.removeEventListener('board:import-pdf', handlePdfImport);
  }, [importPdf]);

  useEffect(() => {
    if (!floatingClip) return;

    const moveFloatingClip = (event: PointerEvent) => {
      setFloatingClip((current) => current ? { ...current, x: event.clientX + 18, y: event.clientY + 18 } : current);
    };
    const clearFloatingClip = () => setFloatingClip(null);

    window.addEventListener('pointermove', moveFloatingClip);
    window.addEventListener('board:clip-placed', clearFloatingClip);
    return () => {
      window.removeEventListener('pointermove', moveFloatingClip);
      window.removeEventListener('board:clip-placed', clearFloatingClip);
    };
  }, [floatingClip]);

  const addImageFromPage = async (page: PdfPageData, index: number) => {
    const fitted = fitImageToViewport(page.width, page.height, stageScale);
    const width = fitted.width;
    const height = fitted.height;
    const target = cursorPosition || {
      x: (-stagePos.x + window.innerWidth / 2) / stageScale,
      y: (-stagePos.y + window.innerHeight / 2) / stageScale,
    };
    const src = await prepareImageSrc(page.src);

    addImage({
      id: 'pdf-page-' + Date.now().toString() + '-' + page.pageNumber,
      src,
      x: target.x - width / 2,
      y: target.y - height / 2 + index * (height + 28),
      width,
      height,
      naturalWidth: page.width,
      naturalHeight: page.height,
    });
  };

  const insertDriveImage = useCallback(async (file: DriveFile) => {
    setIsLoading(true);
    try {
      const blob = await fetchDriveBlob(file);
      if (!blob.type.startsWith('image/')) throw new Error('To nie jest obraz.');
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Nie udało się odczytać obrazu.'));
        reader.readAsDataURL(blob);
      });
      const image = new Image();
      image.onload = async () => {
        const target = cursorPosition || {
          x: (-stagePos.x + window.innerWidth / 2) / stageScale,
          y: (-stagePos.y + window.innerHeight / 2) / stageScale,
        };
        const preparedSrc = await prepareImageSrc(src);
        const fitted = fitImageToViewport(image.width, image.height, stageScale);
        addImage({
          id: 'drive-image-' + file.id + '-' + Date.now().toString(),
          src: preparedSrc,
          x: target.x - fitted.width / 2,
          y: target.y - fitted.height / 2,
          width: fitted.width,
          height: fitted.height,
          naturalWidth: image.width,
          naturalHeight: image.height,
        });
        setIsLoading(false);
      };
      image.onerror = () => {
        setIsLoading(false);
        alert('Nie udało się wczytać obrazu z Drive.');
      };
      image.src = src;
    } catch {
      setIsLoading(false);
      alert('Nie udało się pobrać obrazu z Google Drive.');
    }
  }, [addImage, cursorPosition, fetchDriveBlob, prepareImageSrc, stagePos.x, stagePos.y, stageScale]);

  const importDrivePdf = useCallback(async (file: DriveFile) => {
    setIsLoading(true);
    try {
      const blob = await fetchDriveBlob(file);
      const pdfFile = new File([blob], file.name, { type: 'application/pdf' });
      await importPdf(pdfFile);
    } catch {
      setIsLoading(false);
      alert('Nie udało się pobrać PDF z Google Drive.');
    }
  }, [fetchDriveBlob, importPdf]);

  const handleDriveItemClick = useCallback((item: DriveFile) => {
    if (item.mimeType === DRIVE_FOLDER_MIME) {
      openDriveFolder({ id: item.id, name: item.name });
      return;
    }
    if (item.mimeType === 'application/pdf') {
      void importDrivePdf(item);
      return;
    }
    if (item.mimeType.startsWith('image/')) {
      void insertDriveImage(item);
    }
  }, [importDrivePdf, insertDriveImage, openDriveFolder]);

  const openGooglePicker = useCallback(async () => {
    if (!driveAccessToken) {
      await connectDrive();
      return;
    }
    if (!GOOGLE_API_KEY) {
      setDriveError('Google Picker wymaga NEXT_PUBLIC_GOOGLE_API_KEY w .env.local. Lista folderów Drive nadal działa.');
      return;
    }

    try {
      const picker = await loadGooglePicker();
      const view = new picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/pdf,image/png,image/jpeg,image/webp');
      let builder = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(driveAccessToken)
        .setCallback((data) => {
          if (data.action !== picker.Action.PICKED) return;
          data.docs?.forEach((document) => {
            if (document.mimeType === DRIVE_FOLDER_MIME) {
              openDriveFolder({ id: document.id, name: document.name });
              return;
            }
            handleDriveItemClick(document);
          });
        })
        .setTitle('Wybierz materiał z Google Drive')
        .setLocale('pl');

      builder = builder.setDeveloperKey(GOOGLE_API_KEY);
      if (GOOGLE_APP_ID) builder = builder.setAppId(GOOGLE_APP_ID);

      builder.build().setVisible(true);
    } catch {
      setDriveError('Nie udało się otworzyć okna wyboru Google Drive.');
    }
  }, [connectDrive, driveAccessToken, handleDriveItemClick, loadGooglePicker, openDriveFolder]);

  const deleteActiveDocument = () => {
    if (!activeDocument) return;
    removePdfDocument(activeDocument.id);
    setSelection(null);
  };

  const visiblePages = activeDocument?.pages || [];

  const updatePages = (updater: (pages: PdfPageData[]) => PdfPageData[]) => {
    if (!activeDocument) return;
    setPdfDocuments(pdfDocuments.map((document) => (
      document.id === activeDocument.id ? { ...document, pages: updater(document.pages) } : document
    )));
  };

  const getSelectionRect = (item: SelectionState) => ({
    x: Math.min(item.startX, item.x),
    y: Math.min(item.startY, item.y),
    width: Math.abs(item.x - item.startX),
    height: Math.abs(item.y - item.startY),
  });

  const startSelection = (event: React.PointerEvent<HTMLDivElement>, page: PdfPageData) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = page.width / rect.width;
    const scaleY = page.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ pageNumber: page.pageNumber, startX: x, startY: y, x, y, width: page.width, height: page.height });
  };

  const moveSelection = (event: React.PointerEvent<HTMLDivElement>, page: PdfPageData) => {
    if (!selection || selection.pageNumber !== page.pageNumber) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = page.width / rect.width;
    const scaleY = page.height / rect.height;
    setSelection((current) => current ? {
      ...current,
      x: Math.max(0, Math.min(page.width, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(page.height, (event.clientY - rect.top) * scaleY)),
    } : current);
  };

  const finishSelection = (page: PdfPageData, clientX: number, clientY: number) => {
    if (!selection || selection.pageNumber !== page.pageNumber) return;
    const rect = getSelectionRect(selection);
    setSelection(null);
    if (rect.width < 8 || rect.height < 8) return;

    const source = new Image();
    source.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      const src = transparentizeWhiteCanvas(canvas);
      const fitted = fitImageToViewport(canvas.width, canvas.height, stageScale);
      setPendingPlacementImage({
        src,
        width: fitted.width,
        height: fitted.height,
        naturalWidth: canvas.width,
        naturalHeight: canvas.height,
      });
      setFloatingClip({ src, x: clientX + 18, y: clientY + 18 });
    };
    source.src = page.src;
  };

  if (!isPdfPanelOpen) return null;

  return (
    <aside
      className="fixed right-0 top-0 z-[70] flex max-w-[calc(100vw-24px)] flex-col border-l border-slate-200 bg-white shadow-2xl"
      style={{ width: panelWidth, height: `calc(100dvh / ${uiScale})`, transform: `scale(${uiScale})`, transformOrigin: 'top right' }}
    >
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          setIsResizingPanel(true);
        }}
        className="absolute left-0 top-0 z-[2] h-full w-2 -translate-x-1 cursor-col-resize rounded-l-full bg-transparent hover:bg-violet-500/30"
        title="Zmień szerokość panelu"
        aria-label="Zmień szerokość panelu PDF"
      />
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Materiały nauczyciela</h2>
            <p className="text-sm font-medium text-slate-500">
              {driveUser?.email || activeDocument?.name || 'Połącz konto Google Drive'}
            </p>
          </div>
          <button onClick={() => setIsPdfPanelOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <X size={22} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Cloud size={18} className={driveAccessToken ? 'text-violet-600' : 'text-slate-400'} />
              Google Drive nauczyciela
            </div>
            {driveAccessToken ? (
              <button onClick={disconnectDrive} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-white" title="Rozłącz Drive">
                <LogOut size={16} />
              </button>
            ) : (
              <button onClick={connectDrive} className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                Połącz
              </button>
            )}
          </div>

          {driveError && <p className="mb-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">{driveError}</p>}
          {driveAccessToken && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              {driveUser?.picture ? (
                <img src={driveUser.picture} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <UserCircle size={32} className="text-slate-400" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800">{driveUser?.name || 'Konto Google'}</div>
                <div className="truncate text-xs font-semibold text-slate-500">{driveUser?.email || 'Drive jest połączony'}</div>
              </div>
            </div>
          )}
          <button
            onClick={driveAccessToken ? openGooglePicker : connectDrive}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
          >
            <Cloud size={18} />
            {driveAccessToken ? 'Wybierz z Google Drive' : 'Połącz konto Google'}
          </button>
          {!driveAccessToken && (
            <div className="rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-slate-500">
              Bez Drive możesz mieć lokalnie maksymalnie {LOCAL_PDF_LIMIT} PDF-ów. Po połączeniu materiały zostają na Dysku nauczyciela.
            </div>
          )}

          {driveAccessToken && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                {driveFolderStack.map((folder, index) => (
                  <button key={folder.id + index} onClick={() => jumpToDriveFolder(index)} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white">
                    {index > 0 && <ChevronRight size={12} />}
                    {folder.name}
                  </button>
                ))}
              </div>
              <div className="max-h-44 overflow-auto rounded-xl bg-white">
                {driveItems.length === 0 && <div className="px-3 py-4 text-center text-xs font-semibold text-slate-400">Ten folder jest pusty.</div>}
                {driveItems.map((item) => {
                  const isFolder = item.mimeType === DRIVE_FOLDER_MIME;
                  const isImage = item.mimeType.startsWith('image/');
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleDriveItemClick(item)}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-violet-50"
                    >
                      {isFolder ? <Folder size={18} className="text-amber-500" /> : isImage ? <FileImage size={18} className="text-sky-500" /> : <FileText size={18} className="text-red-500" />}
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {visibleDocuments.length > 1 ? (
            <select value={activeDocument?.id || ''} onChange={(event) => setActivePdfId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold">
              {visibleDocuments.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
            </select>
          ) : quickDocuments.length > 0 ? (
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {quickDocuments.map((document) => (
                <button
                  key={document.id}
                  onClick={() => setActivePdfId(document.id)}
                  className={`max-w-[150px] shrink-0 truncate rounded-xl border px-3 py-2.5 text-xs font-bold ${
                    activePdfId === document.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  title={document.name}
                >
                  {document.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="min-w-0 flex-1 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-400">
              Brak plików
            </div>
          )}
          <button
            onClick={() => panelFileInputRef.current?.click()}
            disabled={!!driveAccessToken ? false : localPdfRemaining === 0}
            className="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            title={driveAccessToken ? 'Wgraj plik z komputera' : `Pozostało lokalnie: ${localPdfRemaining}`}
          >
            Wgraj plik{driveAccessToken ? '' : ` ${localPdfRemaining}/${LOCAL_PDF_LIMIT}`}
          </button>
          {activeDocument && (
            <button
              onClick={deleteActiveDocument}
              className="shrink-0 rounded-xl border border-red-100 px-3 py-2.5 text-red-600 hover:bg-red-50"
              title="Usuń aktywny PDF"
            >
              <Trash2 size={18} />
            </button>
          )}
          <input
            ref={panelFileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPdf(file);
              event.target.value = '';
            }}
          />
        </div>

        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
          <span>Usuń białe tło</span>
          <input
            type="checkbox"
            checked={removeWhiteBackground}
            onChange={(event) => setRemoveWhiteBackground(event.target.checked)}
            className="h-5 w-5 accent-violet-600"
          />
        </label>

      </div>

      <div className="flex-1 overflow-auto bg-slate-50 p-4">
        {isLoading && <div className="rounded-2xl bg-white p-6 text-center font-semibold text-slate-500">Ładuję PDF...</div>}
        {!isLoading && !activeDocument && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
            <FileText className="mx-auto mb-3" size={42} />
            Połącz Drive i wybierz PDF albo obraz z materiałów nauczyciela.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {visiblePages.map((page) => {
            const selectionRect = selection?.pageNumber === page.pageNumber ? getSelectionRect(selection) : null;
            return (
              <div key={page.pageNumber} className={`rounded-2xl border-4 bg-white p-2 shadow-sm ${page.selected ? 'border-blue-500' : 'border-transparent'}`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <button onClick={() => updatePages((pages) => pages.map((item) => item.pageNumber === page.pageNumber ? { ...item, selected: !item.selected } : item))} className="text-sm font-bold text-slate-700">
                    Strona {page.pageNumber}
                  </button>
                  <button onClick={() => void addImageFromPage(page, 0)} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Dodaj</button>
                </div>
                <div
                  className="relative cursor-crosshair select-none overflow-hidden rounded-xl touch-none"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(event) => startSelection(event, page)}
                  onPointerMove={(event) => moveSelection(event, page)}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    finishSelection(page, event.clientX, event.clientY);
                  }}
                  onPointerCancel={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelection(null);
                  }}
                >
                  <img src={page.src} alt={`Strona ${page.pageNumber}`} className="block w-full" draggable={false} />
                  {selectionRect && (
                    <div
                      className="absolute border-2 border-violet-600 bg-violet-500/15"
                      style={{
                        left: `${(selectionRect.x / page.width) * 100}%`,
                        top: `${(selectionRect.y / page.height) * 100}%`,
                        width: `${(selectionRect.width / page.width) * 100}%`,
                        height: `${(selectionRect.height / page.height) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {floatingClip && (
        <img
          src={floatingClip.src}
          alt=""
          className="pointer-events-none fixed z-[100] max-h-40 max-w-56 rounded-lg border-2 border-violet-500 bg-white shadow-2xl"
          style={{ left: floatingClip.x, top: floatingClip.y }}
        />
      )}
    </aside>
  );
}
