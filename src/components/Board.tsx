'use client';

import { Stage, Layer, Line, Image as KonvaImage, Rect, Ellipse, Transformer, Path, Arrow, Group, Circle, Text as KonvaText } from 'react-konva';
import { ImageCrop, ImageData, LineData, ShapeData, TextData, useBoardStore } from '../store/useBoardStore';
import { getShapePath } from '../lib/shapeGeometry';
import { fitImageToViewport } from '../lib/imageSizing';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import useImage from 'use-image';

const CanvasImage = ({
  imgData,
  isDraggable,
  onSelect,
  onChange,
  onEdgeDrag,
}: {
  imgData: ImageData,
  isDraggable: boolean,
  onSelect: () => void,
  onChange: (newData: Partial<ImageData>) => void,
  onEdgeDrag: (event: any, node: any) => void,
}) => {
  const [image] = useImage(imgData.src);
  return (
    <Group
      id={imgData.id}
      x={imgData.x}
      y={imgData.y}
      width={imgData.width}
      height={imgData.height}
      rotation={imgData.rotation || 0}
      draggable={isDraggable}
      onPointerDown={() => {
        onSelect();
      }}
      onDragEnd={(e) => {
        onChange({ x: e.currentTarget.x(), y: e.currentTarget.y() });
      }}
      onDragMove={(e) => onEdgeDrag(e, e.currentTarget)}
      onTransformEnd={(e) => {
        const node = e.currentTarget;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(5, imgData.width * scaleX),
          height: Math.max(5, imgData.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      <Rect width={imgData.width} height={imgData.height} fill="white" opacity={0.01} />
      <KonvaImage
        image={image}
        x={0}
        y={0}
        width={imgData.width}
        height={imgData.height}
        crop={imgData.crop}
        listening={false}
      />
    </Group>
  );
};

type TextEditorState = {
  id?: string;
  x: number;
  y: number;
  value: string;
  width: number;
  fontSize: number;
  fontStyle: string;
  fill: string;
};

type AiSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BoardRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function Board() {
  const {
    activeTool, bgColor, lines, setLines, grid, dots, theme,
    stagePos, setStagePos, stageScale, setStageScale, images, shapes, texts,
    strokeColor, strokeWidth, strokeOpacity, strokeDash,
    pendingPlacementImage, setPendingPlacementImage,
    addImage, updateImage, updateShape, addText, updateText, selectedId, setSelectedId, selectedIds, setSelectedIds, cursorPosition, setCursorPosition,
    setAiCapture, uiScale, deleteSelected, deleteElements, undo, redo
  } = useBoardStore();

  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<ImageCrop | null>(null);
  const [cropImageId, setCropImageId] = useState<string | null>(null);
  const [exportPatternBounds, setExportPatternBounds] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [textFormat, setTextFormat] = useState({ fontSize: 28, bold: false, italic: false });
  const [aiSelectionRect, setAiSelectionRect] = useState<AiSelectionRect | null>(null);
  const [selectionRect, setSelectionRect] = useState<BoardRect | null>(null);
  const isDrawing = useRef(false);
  const trRef = useRef<any>(null);
  const cropTrRef = useRef<any>(null);
  const cropRectRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const stagePosRef = useRef(stagePos);
  const stageScaleRef = useRef(stageScale);
  const activeToolRef = useRef(activeTool);
  const touchPointers = useRef(new Map<number, { x: number; y: number }>());
  const touchPan = useRef<{ pointerId: number; startX: number; startY: number; startStagePos: { x: number; y: number } } | null>(null);
  const pinchGesture = useRef<{
    initialDistance: number;
    initialScale: number;
    initialStagePos: { x: number; y: number };
    initialCenter: { x: number; y: number };
  } | null>(null);
  const selectedImage = images.find((img) => img.id === selectedId) || null;
  const isCropping = !!cropImageId && !!cropRect;
  const edgePanState = useRef({ x: 0, y: 0 });
  const drawingLineId = useRef<string | null>(null);
  const rawDrawingPoints = useRef<number[]>([]);
  const smartDrawing = useRef(false);
  const smartDrawingTimer = useRef<number | null>(null);
  const drawingStartPoint = useRef<{ x: number; y: number } | null>(null);
  const lastDrawingPoint = useRef<{ x: number; y: number } | null>(null);
  const drawingStartTime = useRef(0);
  const eraseHistoryRecorded = useRef(false);
  const aiSelectionStart = useRef<{ x: number; y: number } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const multiDragStart = useRef<{
    pointer: { x: number; y: number };
    positions: Record<string, { x: number; y: number }>;
    linePoints: Record<string, number[]>;
  } | null>(null);
  const cropSelectionStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    stagePosRef.current = stagePos;
    edgePanState.current = stagePos;
  }, [stagePos]);

  useEffect(() => {
    stageScaleRef.current = stageScale;
  }, [stageScale]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (smartDrawingTimer.current) window.clearTimeout(smartDrawingTimer.current);
    };
  }, []);

  useEffect(() => {
    const download = (href: string, filename: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      link.click();
    };

    const createSnapshot = (mimeType = 'image/png') => {
      const stage = stageRef.current;
      if (!stage) return null;

      const exportMargin = 90;
      const lineBounds = lines.flatMap((line) => {
        const xs = line.points.filter((_, index) => index % 2 === 0);
        const ys = line.points.filter((_, index) => index % 2 === 1);
        if (!xs.length || !ys.length) return [];
        const padding = (line.strokeWidth || 3) + 10;
        return [{
          minX: Math.min(...xs) - padding,
          minY: Math.min(...ys) - padding,
          maxX: Math.max(...xs) + padding,
          maxY: Math.max(...ys) + padding,
        }];
      });
      const imageBounds = images.map((image) => ({
        minX: image.x,
        minY: image.y,
        maxX: image.x + image.width,
        maxY: image.y + image.height,
      }));
      const shapeBounds = shapes.map((shape) => ({
        minX: shape.x - 12,
        minY: shape.y - 12,
        maxX: shape.x + shape.width + 12,
        maxY: shape.y + shape.height + 12,
      }));
      const textBounds = texts.map((text) => ({
        minX: text.x - 8,
        minY: text.y - 8,
        maxX: text.x + text.width + 8,
        maxY: text.y + text.fontSize * Math.max(1.4, text.text.split('\n').length * 1.25) + 8,
      }));
      const bounds = [...lineBounds, ...imageBounds, ...shapeBounds, ...textBounds];
      const viewBounds = {
        minX: -stagePos.x / stageScale,
        minY: -stagePos.y / stageScale,
        maxX: (-stagePos.x + windowSize.width) / stageScale,
        maxY: (-stagePos.y + windowSize.height) / stageScale,
      };
      const contentBounds = bounds.length ? {
        minX: Math.min(...bounds.map((box) => box.minX)) - exportMargin,
        minY: Math.min(...bounds.map((box) => box.minY)) - exportMargin,
        maxX: Math.max(...bounds.map((box) => box.maxX)) + exportMargin,
        maxY: Math.max(...bounds.map((box) => box.maxY)) + exportMargin,
      } : viewBounds;
      const exportWidth = Math.max(1, Math.ceil(contentBounds.maxX - contentBounds.minX));
      const exportHeight = Math.max(1, Math.ceil(contentBounds.maxY - contentBounds.minY));
      const previousScale = { x: stage.scaleX(), y: stage.scaleY() };
      const previousPosition = { x: stage.x(), y: stage.y() };
      const previousSize = { width: stage.width(), height: stage.height() };
      const backgroundNode = stage.findOne('.board-background');
      const previousBackground = backgroundNode ? {
        x: backgroundNode.x(),
        y: backgroundNode.y(),
        width: backgroundNode.width(),
        height: backgroundNode.height(),
      } : null;
      const temporarilyHiddenNodes = [trRef.current, cropTrRef.current, cropRectRef.current].filter(Boolean);

      flushSync(() => setExportPatternBounds(contentBounds));
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: -contentBounds.minX, y: -contentBounds.minY });
      stage.size({ width: exportWidth, height: exportHeight });
      if (backgroundNode) {
        backgroundNode.position({ x: contentBounds.minX, y: contentBounds.minY });
        backgroundNode.size({ width: exportWidth, height: exportHeight });
      }
      temporarilyHiddenNodes.forEach((node: any) => node.visible(false));
      stage.batchDraw();

      const dataUrl = stage.toDataURL({
        mimeType,
        pixelRatio: 1,
        x: 0,
        y: 0,
        width: exportWidth,
        height: exportHeight,
      });

      flushSync(() => setExportPatternBounds(null));
      temporarilyHiddenNodes.forEach((node: any) => node.visible(true));
      if (backgroundNode && previousBackground) {
        backgroundNode.position({ x: previousBackground.x, y: previousBackground.y });
        backgroundNode.size({ width: previousBackground.width, height: previousBackground.height });
      }
      stage.scale(previousScale);
      stage.position(previousPosition);
      stage.size(previousSize);
      stage.batchDraw();
      return { dataUrl, width: exportWidth, height: exportHeight };
    };

    const handleExportPng = () => {
      const snapshot = createSnapshot('image/png');
      if (snapshot) download(snapshot.dataUrl, 'moja-tablica.png');
    };

    const handleExportPdf = () => {
      const snapshot = createSnapshot('image/jpeg');
      if (!snapshot) return;

      const imageBytes = atob(snapshot.dataUrl.split(',')[1]);
      const width = Math.round(snapshot.width);
      const height = Math.round(snapshot.height);
      const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n${imageBytes}\nendstream\nendobj\n`,
        `5 0 obj\n<< /Length 44 >>\nstream\nq\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\nendstream\nendobj\n`,
      ];
      let body = '%PDF-1.4\n';
      const offsets = [0];
      objects.forEach((object) => {
        offsets.push(body.length);
        body += object;
      });
      const xrefOffset = body.length;
      body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
      offsets.slice(1).forEach((offset) => {
        body += `${String(offset).padStart(10, '0')} 00000 n \n`;
      });
      body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

      const bytes = new Uint8Array(body.length);
      for (let i = 0; i < body.length; i += 1) bytes[i] = body.charCodeAt(i) & 0xff;
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      download(url, 'moja-tablica.pdf');
      URL.revokeObjectURL(url);
    };

    window.addEventListener('board:export-png', handleExportPng);
    window.addEventListener('board:export-pdf', handleExportPdf);
    return () => {
      window.removeEventListener('board:export-png', handleExportPng);
      window.removeEventListener('board:export-pdf', handleExportPdf);
    };
  }, [bgColor, images, lines, shapes, stagePos, stageScale, texts, windowSize]);

  // OBSŁUGA RAMKI (TRANSFORMERA)
  useEffect(() => {
    if (trRef.current) {
      const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
      if (ids.length) {
        const selectedNodes = ids
          .map((id) => trRef.current.getStage().findOne((node: any) => node.id() === id))
          .filter(Boolean);
        if (selectedNodes.length) {
          trRef.current.nodes(selectedNodes);
          trRef.current.getLayer().batchDraw();
        } else {
          trRef.current.nodes([]);
          trRef.current.getLayer().batchDraw();
        }
      } else {
        trRef.current.nodes([]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, selectedIds, shapes, images, texts]);

  useEffect(() => {
    if (cropTrRef.current && cropRectRef.current && cropRect) {
      cropTrRef.current.nodes([cropRectRef.current]);
      cropTrRef.current.getLayer().batchDraw();
    }
  }, [cropRect]);

  useEffect(() => {
    if (!textEditor || !textAreaRef.current) return;
    const focusTextArea = () => {
      const textArea = textAreaRef.current;
      if (!textArea) return;
      textArea.focus({ preventScroll: true });
      const cursorPosition = textArea.value.length;
      textArea.setSelectionRange(cursorPosition, cursorPosition);
    };
    const frame = window.requestAnimationFrame(focusTextArea);
    const timer = window.setTimeout(focusTextArea, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [textEditor?.id, textEditor?.x, textEditor?.y]);

  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedo = ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && event.shiftKey) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y');

      if (isUndo) {
        event.preventDefault();
        undo();
        return;
      }
      if (isRedo) {
        event.preventDefault();
        redo();
        return;
      }
      if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        if (isCropping) cancelCrop();
        else deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [deleteSelected, isCropping, redo, undo]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const targetElement = event.target as HTMLElement | null;
      const isTyping = targetElement?.tagName === 'INPUT' || targetElement?.tagName === 'TEXTAREA' || targetElement?.isContentEditable;
      if (isTyping) return;

      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();
      if (!file) return;

      event.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || '');
        if (!src) return;

        const image = new Image();
        image.onload = () => {
          const target = cursorPosition || {
            x: (-stagePos.x + window.innerWidth / 2) / stageScale,
            y: (-stagePos.y + window.innerHeight / 2) / stageScale,
          };
          const fitted = fitImageToViewport(image.naturalWidth || image.width, image.naturalHeight || image.height, stageScale);
          addImage({
            id: 'paste-' + Date.now().toString(),
            src,
            x: target.x - fitted.width / 2,
            y: target.y - fitted.height / 2,
            width: fitted.width,
            height: fitted.height,
            naturalWidth: image.naturalWidth || image.width,
            naturalHeight: image.naturalHeight || image.height,
          });
        };
        image.src = src;
      };
      reader.readAsDataURL(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addImage, cursorPosition, stagePos.x, stagePos.y, stageScale]);

  useEffect(() => {
    const stage = stageRef.current;
    const container = stage?.container();
    if (!container) return;

    const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const getCenter = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });

    const startPinchIfReady = () => {
      const points = Array.from(touchPointers.current.values());
      if (points.length < 2) return;
      const [first, second] = points;
      pinchGesture.current = {
        initialDistance: Math.max(1, getDistance(first, second)),
        initialScale: stageScaleRef.current,
        initialStagePos: stagePosRef.current,
        initialCenter: getCenter(first, second),
      };
      touchPan.current = null;
      if (isDrawing.current && drawingLineId.current) {
        const lineId = drawingLineId.current;
        setLines((prev: any) => prev.filter((line: any) => line.id !== lineId), { record: false });
        isDrawing.current = false;
        drawingLineId.current = null;
        rawDrawingPoints.current = [];
      }
    };

    const handleNativePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touchPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (touchPointers.current.size >= 2) {
        event.preventDefault();
        startPinchIfReady();
        return;
      }

      if (shouldUseTouchPan(event)) {
        event.preventDefault();
        touchPan.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startStagePos: stagePosRef.current,
        };
      }
    };

    const handleNativePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !touchPointers.current.has(event.pointerId)) return;
      touchPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pinchGesture.current && touchPointers.current.size >= 2) {
        event.preventDefault();
        const points = Array.from(touchPointers.current.values());
        const [first, second] = points;
        const gesture = pinchGesture.current;
        const center = getCenter(first, second);
        const distance = getDistance(first, second);
        const nextScale = Math.max(0.25, Math.min(3, gesture.initialScale * (distance / gesture.initialDistance)));
        const boardCenter = {
          x: (gesture.initialCenter.x - gesture.initialStagePos.x) / gesture.initialScale,
          y: (gesture.initialCenter.y - gesture.initialStagePos.y) / gesture.initialScale,
        };
        const nextPos = {
          x: center.x - boardCenter.x * nextScale,
          y: center.y - boardCenter.y * nextScale,
        };
        stageScaleRef.current = nextScale;
        stagePosRef.current = nextPos;
        edgePanState.current = nextPos;
        setStageScale(nextScale);
        setStagePos(nextPos);
        return;
      }

      if (touchPan.current && touchPan.current.pointerId === event.pointerId) {
        event.preventDefault();
        const nextPos = {
          x: touchPan.current.startStagePos.x + event.clientX - touchPan.current.startX,
          y: touchPan.current.startStagePos.y + event.clientY - touchPan.current.startY,
        };
        stagePosRef.current = nextPos;
        edgePanState.current = nextPos;
        setStagePos(nextPos);
      }
    };

    const handleNativePointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touchPointers.current.delete(event.pointerId);
      if (touchPan.current?.pointerId === event.pointerId) touchPan.current = null;
      if (touchPointers.current.size < 2) pinchGesture.current = null;
    };

    const preventGesture = (event: Event) => event.preventDefault();

    container.addEventListener('pointerdown', handleNativePointerDown, { passive: false });
    container.addEventListener('pointermove', handleNativePointerMove, { passive: false });
    container.addEventListener('pointerup', handleNativePointerEnd, { passive: false });
    container.addEventListener('pointercancel', handleNativePointerEnd, { passive: false });
    window.addEventListener('gesturestart', preventGesture, { passive: false });
    window.addEventListener('gesturechange', preventGesture, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', handleNativePointerDown);
      container.removeEventListener('pointermove', handleNativePointerMove);
      container.removeEventListener('pointerup', handleNativePointerEnd);
      container.removeEventListener('pointercancel', handleNativePointerEnd);
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
    };
  }, [setLines, setStagePos, setStageScale, windowSize.width]);

  const getRelativePointerPosition = (stage: any) => {
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return null;
    return {
      x: (pointerPosition.x - stage.x()) / stageScale,
      y: (pointerPosition.y - stage.y()) / stageScale,
    };
  };

  const getBoardPointFromClient = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const rect = stage?.container().getBoundingClientRect();
    if (!stage || !rect) return null;
    return {
      x: (clientX - rect.left - stage.x()) / stageScaleRef.current,
      y: (clientY - rect.top - stage.y()) / stageScaleRef.current,
    };
  };

  const shouldUseTouchPan = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return false;
    if (windowSize.width < 700) return false;
    return activeToolRef.current === 'draw' || activeToolRef.current === 'highlight' || activeToolRef.current === 'erase';
  };

  const openTextEditor = (text: TextEditorState) => {
    setSelectedId(text.id || null);
    setTextEditor(text);
    setTextFormat({
      fontSize: text.fontSize,
      bold: text.fontStyle.includes('bold'),
      italic: text.fontStyle.includes('italic'),
    });
  };

  const getTextFontStyle = (format = textFormat) => {
    const parts = [];
    if (format.bold) parts.push('bold');
    if (format.italic) parts.push('italic');
    return parts.join(' ') || 'normal';
  };

  const updateLiveText = (nextEditor: TextEditorState) => {
    if (!nextEditor.value.trim()) {
      setTextEditor(nextEditor);
      return;
    }

    if (nextEditor.id) {
      updateText(nextEditor.id, {
        text: nextEditor.value,
        width: Math.max(120, nextEditor.width),
        fontSize: nextEditor.fontSize,
        fontStyle: nextEditor.fontStyle,
        fill: nextEditor.fill,
      }, { record: false });
      setTextEditor(nextEditor);
      return;
    }

    const id = 'text-' + Date.now().toString();
    const createdEditor = { ...nextEditor, id };
    addText({
      id,
      x: nextEditor.x,
      y: nextEditor.y,
      text: nextEditor.value,
      width: Math.max(180, nextEditor.width),
      fontSize: nextEditor.fontSize,
      fontStyle: nextEditor.fontStyle,
      fill: nextEditor.fill,
    }, { record: true, select: true, keepTool: true });
    setTextEditor(createdEditor);
  };

  const updateTextFormat = (changes: Partial<typeof textFormat>) => {
    setTextFormat((current) => {
      const nextFormat = { ...current, ...changes };
      const fontStyle = getTextFontStyle(nextFormat);
      setTextEditor((editor) => {
        if (!editor) return editor;
        const nextEditor = { ...editor, fontSize: nextFormat.fontSize, fontStyle };
        if (nextEditor.id) {
          updateText(nextEditor.id, {
            fontSize: nextEditor.fontSize,
            fontStyle: nextEditor.fontStyle,
          }, { record: false });
        }
        return nextEditor;
      });
      return nextFormat;
    });
  };

  const commitTextEditor = () => {
    if (!textEditor) return;
    const value = textEditor.value.trim();

    if (value) {
      if (textEditor.id) {
        updateText(textEditor.id, {
          text: value,
          width: Math.max(120, textEditor.width),
          fontSize: textEditor.fontSize,
          fontStyle: textEditor.fontStyle,
          fill: textEditor.fill,
        });
      } else {
        addText({
          id: 'text-' + Date.now().toString(),
          x: textEditor.x,
          y: textEditor.y,
          text: value,
          width: Math.max(180, textEditor.width),
          fontSize: textEditor.fontSize,
          fontStyle: textEditor.fontStyle,
          fill: textEditor.fill,
        });
      }
    }

    setTextEditor(null);
  };

  const cancelTextEditor = () => setTextEditor(null);

  const getTextEditorScreenPosition = () => {
    if (!textEditor) return { left: 0, top: 0 };
    return {
      left: stagePos.x + textEditor.x * stageScale,
      top: stagePos.y + textEditor.y * stageScale,
    };
  };

  const getPointDistance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

  const getPointList = (points: number[]) => {
    const list: { x: number; y: number }[] = [];
    for (let index = 0; index < points.length - 1; index += 2) {
      list.push({ x: points[index], y: points[index + 1] });
    }
    return list;
  };

  const getPathLength = (points: number[]) => {
    const pointList = getPointList(points);
    return pointList.reduce((total, point, index) => {
      if (index === 0) return total;
      const previous = pointList[index - 1];
      return total + getPointDistance(previous.x, previous.y, point.x, point.y);
    }, 0);
  };

  const getDrawingBounds = (points: number[]) => {
    const pointList = getPointList(points);
    const xs = pointList.map((point) => point.x);
    const ys = pointList.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  };

  const normalizeRect = (rect: BoardRect): BoardRect => ({
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  });

  const inflateRect = (rect: BoardRect, amount: number): BoardRect => ({
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  });

  const rectsOverlap = (a: BoardRect, b: BoardRect) => (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );

  const getLineBounds = (line: LineData): BoardRect | null => {
    if (line.points.length < 2) return null;
    const bounds = getDrawingBounds(line.points);
    return inflateRect({
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
    }, Math.max(12, (line.strokeWidth || 3) * 2));
  };

  const getTextBounds = (text: TextData): BoardRect => inflateRect({
    x: text.x,
    y: text.y,
    width: text.width,
    height: text.fontSize * Math.max(1.3, text.text.split('\n').length * 1.22),
  }, 10);

  const getShapeBounds = (shape: ShapeData): BoardRect => inflateRect({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  }, 12);

  const getImageBounds = (image: ImageData): BoardRect => ({
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
  });

  const getElementBounds = (id: string): BoardRect | null => {
    const line = lines.find((item) => item.id === id);
    if (line) return getLineBounds(line);
    const text = texts.find((item) => item.id === id);
    if (text) return getTextBounds(text);
    const shape = shapes.find((item) => item.id === id);
    if (shape) return getShapeBounds(shape);
    const image = images.find((item) => item.id === id);
    if (image) return getImageBounds(image);
    return null;
  };

  const getSelectionBounds = (ids = selectedIds): BoardRect | null => {
    const bounds = ids
      .map(getElementBounds)
      .filter(Boolean) as BoardRect[];
    if (!bounds.length) return null;
    const minX = Math.min(...bounds.map((box) => box.x));
    const minY = Math.min(...bounds.map((box) => box.y));
    const maxX = Math.max(...bounds.map((box) => box.x + box.width));
    const maxY = Math.max(...bounds.map((box) => box.y + box.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const getIdsInRect = (rect: BoardRect) => {
    const area = normalizeRect(rect);
    const ids: string[] = [];
    lines.forEach((line) => {
      const bounds = getLineBounds(line);
      if (bounds && rectsOverlap(area, bounds)) ids.push(line.id);
    });
    texts.forEach((text) => {
      if (rectsOverlap(area, getTextBounds(text))) ids.push(text.id);
    });
    shapes.forEach((shape) => {
      if (rectsOverlap(area, getShapeBounds(shape))) ids.push(shape.id);
    });
    images.forEach((image) => {
      if (rectsOverlap(area, getImageBounds(image))) ids.push(image.id);
    });
    return ids;
  };

  const getDistanceToSegment = (
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const lengthSquared = ((end.x - start.x) ** 2) + ((end.y - start.y) ** 2);
    if (!lengthSquared) return getPointDistance(point.x, point.y, start.x, start.y);
    const t = Math.max(0, Math.min(1, (((point.x - start.x) * (end.x - start.x)) + ((point.y - start.y) * (end.y - start.y))) / lengthSquared));
    return getPointDistance(point.x, point.y, start.x + t * (end.x - start.x), start.y + t * (end.y - start.y));
  };

  const isLineHitByPoints = (line: LineData, scribblePoints: { x: number; y: number }[], tolerance = 18) => {
    const linePoints = getPointList(line.points);
    if (linePoints.length < 2 || !scribblePoints.length) return false;
    for (const point of scribblePoints) {
      for (let index = 1; index < linePoints.length; index += 1) {
        if (getDistanceToSegment(point, linePoints[index - 1], linePoints[index]) <= tolerance) return true;
      }
    }
    return false;
  };

  const getElementsHitByScribble = (points: number[]) => {
    if (points.length < 4) return [];
    const scribblePoints = getPointList(points);
    const scribbleBoundsRaw = getDrawingBounds(points);
    const scribbleBounds = inflateRect({
      x: scribbleBoundsRaw.minX,
      y: scribbleBoundsRaw.minY,
      width: scribbleBoundsRaw.width,
      height: scribbleBoundsRaw.height,
    }, 16);
    const hitIds = new Set<string>();
    lines.forEach((line) => {
      if (line.id !== drawingLineId.current && rectsOverlap(scribbleBounds, getLineBounds(line) || scribbleBounds) && isLineHitByPoints(line, scribblePoints)) {
        hitIds.add(line.id);
      }
    });
    texts.forEach((text) => {
      const bounds = getTextBounds(text);
      if (rectsOverlap(scribbleBounds, bounds) && scribblePoints.some((point) => rectsOverlap({ x: point.x, y: point.y, width: 1, height: 1 }, bounds))) {
        hitIds.add(text.id);
      }
    });
    shapes.forEach((shape) => {
      const bounds = getShapeBounds(shape);
      if (rectsOverlap(scribbleBounds, bounds) && scribblePoints.some((point) => rectsOverlap({ x: point.x, y: point.y, width: 1, height: 1 }, bounds))) {
        hitIds.add(shape.id);
      }
    });
    images.forEach((image) => {
      const bounds = getImageBounds(image);
      if (rectsOverlap(scribbleBounds, bounds) && scribblePoints.some((point) => rectsOverlap({ x: point.x, y: point.y, width: 1, height: 1 }, bounds))) {
        hitIds.add(image.id);
      }
    });
    return [...hitIds];
  };

  const moveSelectedElements = (delta: { x: number; y: number }) => {
    const ids = selectedIds;
    if (!ids.length) return;
    const idSet = new Set(ids);
    const start = multiDragStart.current?.positions || {};
    const startLinePoints = multiDragStart.current?.linePoints || {};
    useBoardStore.setState((state) => ({
      lines: state.lines.map((line) => {
        if (!idSet.has(line.id)) return line;
        const originalPoints = startLinePoints[line.id];
        if (!originalPoints) return line;
        return {
          ...line,
          points: originalPoints.map((value, index) => value + (index % 2 === 0 ? delta.x : delta.y)),
        };
      }),
      texts: state.texts.map((text) => {
        const origin = start[text.id];
        return origin ? { ...text, x: origin.x + delta.x, y: origin.y + delta.y } : text;
      }),
      images: state.images.map((image) => {
        const origin = start[image.id];
        return origin ? { ...image, x: origin.x + delta.x, y: origin.y + delta.y } : image;
      }),
      shapes: state.shapes.map((shape) => {
        const origin = start[shape.id];
        return origin ? { ...shape, x: origin.x + delta.x, y: origin.y + delta.y } : shape;
      }),
    }));
  };

  const isClosedDrawing = (points: number[]) => {
    if (points.length < 20) return false;
    const bounds = getDrawingBounds(points);
    const diagonal = Math.hypot(bounds.width, bounds.height);
    if (diagonal < 35) return false;
    const closeDistance = getPointDistance(points[0], points[1], points[points.length - 2], points[points.length - 1]);
    return closeDistance <= Math.max(22, Math.min(80, diagonal * 0.16));
  };

  const getPerpendicularDistance = (
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const length = getPointDistance(start.x, start.y, end.x, end.y);
    if (!length) return getPointDistance(point.x, point.y, start.x, start.y);
    return Math.abs((end.y - start.y) * point.x - (end.x - start.x) * point.y + end.x * start.y - end.y * start.x) / length;
  };

  const simplifyPoints = (points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] => {
    if (points.length <= 2) return points;

    let maxDistance = 0;
    let splitIndex = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let index = 1; index < points.length - 1; index += 1) {
      const distance = getPerpendicularDistance(points[index], first, last);
      if (distance > maxDistance) {
        maxDistance = distance;
        splitIndex = index;
      }
    }

    if (maxDistance <= epsilon) return [first, last];
    const left = simplifyPoints(points.slice(0, splitIndex + 1), epsilon);
    const right = simplifyPoints(points.slice(splitIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  };

  const pointsToLine = (points: { x: number; y: number }[], close = false) => {
    const flattened = points.flatMap((point) => [point.x, point.y]);
    if (close && points.length) flattened.push(points[0].x, points[0].y);
    return flattened;
  };

  const getIdealEllipsePoints = (bounds: ReturnType<typeof getDrawingBounds>) => {
    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;
    const radiusX = Math.max(8, bounds.width / 2);
    const radiusY = Math.max(8, bounds.height / 2);
    const points = Array.from({ length: 48 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 48;
      return { x: centerX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY };
    });
    return pointsToLine(points, true);
  };

  const idealizeDrawing = (points: number[]) => {
    if (points.length < 4) return points;
    const bounds = getDrawingBounds(points);
    const closed = isClosedDrawing(points);
    if (!closed) return [points[0], points[1], points[points.length - 2], points[points.length - 1]];

    const rawPoints = getPointList(points);
    const openPoints = rawPoints.slice(0, -1);
    const epsilon = Math.max(8, Math.min(bounds.width, bounds.height) * 0.09);
    const simplified = simplifyPoints(openPoints, epsilon);
    const uniquePoints = simplified.filter((point, index, list) => {
      if (index === 0) return true;
      const previous = list[index - 1];
      return getPointDistance(point.x, point.y, previous.x, previous.y) > 10;
    });
    if (uniquePoints.length > 3) {
      const first = uniquePoints[0];
      const last = uniquePoints[uniquePoints.length - 1];
      if (getPointDistance(first.x, first.y, last.x, last.y) <= Math.max(14, Math.min(bounds.width, bounds.height) * 0.18)) {
        uniquePoints.pop();
      }
    }

    if (uniquePoints.length >= 3 && uniquePoints.length <= 6) return pointsToLine(uniquePoints, true);
    return getIdealEllipsePoints(bounds);
  };

  const shouldDiscardQuickScribble = (points: number[]) => {
    if (points.length < 4 || activeTool === 'highlight') return false;
    const duration = Date.now() - drawingStartTime.current;
    if (duration > 1100) return false;

    const pathLength = getPathLength(points);
    const directDistance = getPointDistance(points[0], points[1], points[points.length - 2], points[points.length - 1]);
    const bounds = getDrawingBounds(points);
    const diagonal = Math.hypot(bounds.width, bounds.height);
    const pointCount = points.length / 2;
    const straightness = directDistance / Math.max(1, pathLength);
    const density = pathLength / Math.max(1, diagonal);
    const isChaoticScribble = pathLength > 90 && (
      straightness < 0.52 ||
      (duration < 760 && density > 1.9 && pointCount > 12) ||
      (duration < 520 && density > 1.45 && pointCount > 8)
    );

    return isChaoticScribble;
  };

  const scheduleSmartDrawing = () => {
    if (smartDrawing.current) return;
    if (smartDrawingTimer.current) window.clearTimeout(smartDrawingTimer.current);
    smartDrawingTimer.current = window.setTimeout(() => {
      if (!isDrawing.current || !drawingLineId.current || rawDrawingPoints.current.length < 4) return;
      smartDrawing.current = true;
      const lineId = drawingLineId.current;
      const previewPoints = idealizeDrawing(rawDrawingPoints.current);
      setLines((prev: any) => prev.map((line: any) => (
        line.id === lineId ? { ...line, points: previewPoints } : line
      )), { record: false });
    }, 520);
  };

  const getEdgePanDelta = (clientX: number, clientY: number) => {
    const edge = Math.min(90, Math.max(44, Math.min(windowSize.width, windowSize.height) * 0.12));
    const maxSpeed = 24;
    let dx = 0;
    let dy = 0;

    if (clientX < edge) dx = maxSpeed * (1 - clientX / edge);
    else if (clientX > windowSize.width - edge) dx = -maxSpeed * (1 - (windowSize.width - clientX) / edge);

    if (clientY < edge) dy = maxSpeed * (1 - clientY / edge);
    else if (clientY > windowSize.height - edge) dy = -maxSpeed * (1 - (windowSize.height - clientY) / edge);

    return { x: dx, y: dy };
  };

  const panNearViewportEdge = (clientX: number, clientY: number, keepNodeUnderPointer?: (delta: { x: number; y: number }) => void) => {
    if (!windowSize.width || !windowSize.height) return { x: 0, y: 0 };
    const delta = getEdgePanDelta(clientX, clientY);
    if (!delta.x && !delta.y) return delta;

    const currentPos = edgePanState.current;
    const nextPos = { x: currentPos.x + delta.x, y: currentPos.y + delta.y };
    edgePanState.current = nextPos;
    stageRef.current?.position(nextPos);
    stageRef.current?.batchDraw();
    setStagePos(nextPos);
    keepNodeUnderPointer?.(delta);
    return delta;
  };

  const handleNodeEdgeDrag = (event: any, node: any) => {
    const pointerEvent = event.evt;
    if (!pointerEvent) return;
    panNearViewportEdge(pointerEvent.clientX, pointerEvent.clientY, (delta) => {
      node.position({
        x: node.x() - delta.x / stageScale,
        y: node.y() - delta.y / stageScale,
      });
    });
  };

  const getSelectedStartPositions = (ids: string[]) => {
    const idSet = new Set(ids);
    const positions: Record<string, { x: number; y: number }> = {};
    const linePoints: Record<string, number[]> = {};
    lines.forEach((line) => {
      if (idSet.has(line.id)) {
        positions[line.id] = { x: line.points[0] || 0, y: line.points[1] || 0 };
        linePoints[line.id] = [...line.points];
      }
    });
    texts.forEach((text) => {
      if (idSet.has(text.id)) positions[text.id] = { x: text.x, y: text.y };
    });
    images.forEach((image) => {
      if (idSet.has(image.id)) positions[image.id] = { x: image.x, y: image.y };
    });
    shapes.forEach((shape) => {
      if (idSet.has(shape.id)) positions[shape.id] = { x: shape.x, y: shape.y };
    });
    return { positions, linePoints };
  };

  const beginMultiDrag = (point: { x: number; y: number }) => {
    if (selectedIds.length < 2) return;
    setLines((prev: any) => prev);
    const start = getSelectedStartPositions(selectedIds);
    multiDragStart.current = {
      pointer: point,
      positions: start.positions,
      linePoints: start.linePoints,
    };
  };

  const updateMultiDrag = (point: { x: number; y: number }) => {
    if (!multiDragStart.current) return;
    moveSelectedElements({
      x: point.x - multiDragStart.current.pointer.x,
      y: point.y - multiDragStart.current.pointer.y,
    });
  };

  const finishMultiDrag = () => {
    multiDragStart.current = null;
  };

  const handleStagePointerDown = (e: any) => {
    if (e.evt?.pointerType === 'touch' && shouldUseTouchPan(e.evt)) return;
    const stage = e.target.getStage();
    const clickedOn = e.target;
    const pos = getRelativePointerPosition(stage);
    if (pos) setCursorPosition(pos);

    if (pendingPlacementImage && pos) {
      const fitted = fitImageToViewport(pendingPlacementImage.width, pendingPlacementImage.height, stageScale);
      const width = fitted.width;
      const height = fitted.height;
      addImage({
        id: 'clip-' + Date.now().toString(),
        src: pendingPlacementImage.src,
        x: pos.x - width / 2,
        y: pos.y - height / 2,
        width,
        height,
        naturalWidth: pendingPlacementImage.naturalWidth,
        naturalHeight: pendingPlacementImage.naturalHeight,
      });
      setPendingPlacementImage(null);
      window.dispatchEvent(new Event('board:clip-placed'));
      return;
    }

    const clickedOnBoard = clickedOn === stage || clickedOn.name?.() === 'board-background';
    const clickedOnCropRect = isCropping && cropRectRef.current && clickedOn === cropRectRef.current;
    const clickedOnCropAnchor = isCropping && cropTrRef.current && clickedOn.getParent?.() === cropTrRef.current;
    const canDrawFreshCropRect = isCropping && selectedImage && pos && isPointInsideSelectedImage(pos) && !clickedOnCropAnchor && (!clickedOnCropRect || isCropRectFullImage());

    if (canDrawFreshCropRect) {
      startCropSelection(pos);
      return;
    }

    if (clickedOnCropRect) return;

    if (activeTool === 'ai' && pos) {
      setSelectedId(null);
      aiSelectionStart.current = pos;
      setAiSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setAiCapture(null);
      return;
    }

    if (activeTool === 'text' && pos && clickedOn.getClassName?.() !== 'Text') {
      openTextEditor({
        x: pos.x,
        y: pos.y,
        value: '',
        width: 260,
        fontSize: textFormat.fontSize,
        fontStyle: getTextFontStyle(),
        fill: strokeColor,
      });
      return;
    }

    if (activeTool === 'select' && clickedOnBoard && pos) {
      selectionStart.current = pos;
      setSelectedIds([]);
      setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    // Kliknięcie w pustą tablicę odznacza figury
    if (clickedOnBoard) {
      setSelectedId(null);
      if (activeTool !== 'draw' && activeTool !== 'highlight' && activeTool !== 'pan') return;
    }

    if (activeTool === 'erase') {
      eraseHistoryRecorded.current = false;
      if (clickedOn.getClassName() === 'Line' && clickedOn.id() && clickedOn.id().startsWith('line-')) {
        setLines((prev: any) => prev.filter((l: any) => l.id !== clickedOn.id()));
        eraseHistoryRecorded.current = true;
      }
      return;
    }

    if (activeTool === 'draw' || activeTool === 'highlight') {
      isDrawing.current = true;
      if (pos) {
        const newId = 'line-' + Date.now();
        const isHighlight = activeTool === 'highlight';
        const dash = !isHighlight && strokeDash === 'dash' ? [18, 12] : !isHighlight && strokeDash === 'dot' ? [2, 10] : undefined;
        drawingLineId.current = newId;
        rawDrawingPoints.current = [pos.x, pos.y];
        drawingStartPoint.current = pos;
        lastDrawingPoint.current = pos;
        drawingStartTime.current = Date.now();
        smartDrawing.current = false;
        if (!isHighlight) scheduleSmartDrawing();
        setLines((prev: any) => [...prev, {
          id: newId,
          points: [pos.x, pos.y],
          stroke: isHighlight ? '#facc15' : strokeColor,
          strokeWidth: isHighlight ? Math.max(14, strokeWidth * 4) : strokeWidth,
          opacity: isHighlight ? Math.min(0.32, Math.max(0.1, strokeOpacity * 0.32)) : strokeOpacity,
          dash,
        }]);
      }
    }
  };

  const handlePointerMove = (e: any) => {
    if (e.evt?.pointerType === 'touch' && (touchPan.current || pinchGesture.current)) return;
    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);

    if (isCropping && cropSelectionStart.current && selectedImage && pos) {
      updateCropSelection(pos);
      return;
    }

    if (e.evt && (isDrawing.current || e.evt.buttons === 1)) {
      panNearViewportEdge(e.evt.clientX, e.evt.clientY);
    }

    if (pos) setCursorPosition(pos);

    if (multiDragStart.current && pos) {
      updateMultiDrag(pos);
      return;
    }

    if (activeTool === 'ai' && aiSelectionStart.current && pos) {
      const start = aiSelectionStart.current;
      setAiSelectionRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
      return;
    }

    if (activeTool === 'select' && selectionStart.current && pos) {
      const start = selectionStart.current;
      setSelectionRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
      return;
    }

    if (activeTool === 'pan') return;
    if (activeTool === 'erase' && e.evt.buttons === 1) {
      const hoveredOn = e.target;
      if (hoveredOn.getClassName() === 'Line' && hoveredOn.id() && hoveredOn.id().startsWith('line-')) {
        if (!eraseHistoryRecorded.current) {
          setLines((prev: any) => prev);
          eraseHistoryRecorded.current = true;
        }
        setLines((prev: any) => prev.filter((l: any) => l.id !== hoveredOn.id()), { record: false });
      }
      return;
    }
    if (!isDrawing.current || (activeTool !== 'draw' && activeTool !== 'highlight')) return;

    if (!pos) return;

    if (activeTool !== 'highlight' && !smartDrawing.current && lastDrawingPoint.current) {
      const distanceFromLastPoint = getPointDistance(lastDrawingPoint.current.x, lastDrawingPoint.current.y, pos.x, pos.y);
      if (distanceFromLastPoint > 3) {
        lastDrawingPoint.current = pos;
        scheduleSmartDrawing();
      }
    }

    const coalescedEvents = typeof e.evt?.getCoalescedEvents === 'function' ? e.evt.getCoalescedEvents() : [];
    const inputPoints = coalescedEvents.length > 1
      ? coalescedEvents
        .map((event: PointerEvent) => getBoardPointFromClient(event.clientX, event.clientY))
        .filter(Boolean) as { x: number; y: number }[]
      : [pos];

    rawDrawingPoints.current = [
      ...rawDrawingPoints.current,
      ...inputPoints.flatMap((point) => [point.x, point.y]),
    ];

    setLines((prev: any) => {
      const newLines = [...prev];
      const lastLine = { ...newLines[newLines.length - 1] };
      const rawPoints = rawDrawingPoints.current;
      lastLine.points = activeTool !== 'highlight' && smartDrawing.current ? idealizeDrawing(rawPoints) : rawPoints;
      newLines[newLines.length - 1] = lastLine;
      return newLines;
    }, { record: false });
  };

  const handlePointerUp = () => {
    if (multiDragStart.current) {
      finishMultiDrag();
      return;
    }

    if (cropSelectionStart.current) {
      cropSelectionStart.current = null;
      return;
    }

    if (activeTool === 'select' && selectionStart.current) {
      const rect = selectionRect;
      selectionStart.current = null;
      setSelectionRect(null);
      if (rect && rect.width > 8 && rect.height > 8) {
        setSelectedIds(getIdsInRect(rect));
      }
      return;
    }

    if (activeTool === 'ai' && aiSelectionStart.current) {
      const rect = aiSelectionRect;
      aiSelectionStart.current = null;
      flushSync(() => setAiSelectionRect(null));

      if (rect && rect.width > 12 && rect.height > 12 && stageRef.current) {
        const stage = stageRef.current;
        const hiddenNodes = [trRef.current, cropTrRef.current, cropRectRef.current].filter(Boolean);
        const previousScale = { x: stage.scaleX(), y: stage.scaleY() };
        const previousPosition = { x: stage.x(), y: stage.y() };
        const previousSize = { width: stage.width(), height: stage.height() };
        const backgroundNode = stage.findOne('.board-background');
        const previousBackground = backgroundNode ? {
          x: backgroundNode.x(),
          y: backgroundNode.y(),
          width: backgroundNode.width(),
          height: backgroundNode.height(),
        } : null;

        hiddenNodes.forEach((node: any) => node.visible(false));
        stage.scale({ x: 1, y: 1 });
        stage.position({ x: -rect.x, y: -rect.y });
        stage.size({ width: Math.ceil(rect.width), height: Math.ceil(rect.height) });
        if (backgroundNode) {
          backgroundNode.position({ x: rect.x, y: rect.y });
          backgroundNode.size({ width: Math.ceil(rect.width), height: Math.ceil(rect.height) });
        }
        stage.batchDraw();
        const dataUrl = stage.toDataURL({
          mimeType: 'image/png',
          pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
          x: 0,
          y: 0,
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
        });
        hiddenNodes.forEach((node: any) => node.visible(true));
        if (backgroundNode && previousBackground) {
          backgroundNode.position({ x: previousBackground.x, y: previousBackground.y });
          backgroundNode.size({ width: previousBackground.width, height: previousBackground.height });
        }
        stage.scale(previousScale);
        stage.position(previousPosition);
        stage.size(previousSize);
        stage.batchDraw();
        setAiCapture({ dataUrl, width: rect.width, height: rect.height });
      }
      return;
    }

    if (smartDrawingTimer.current) {
      window.clearTimeout(smartDrawingTimer.current);
      smartDrawingTimer.current = null;
    }
    if (isDrawing.current && drawingLineId.current && shouldDiscardQuickScribble(rawDrawingPoints.current)) {
      const lineId = drawingLineId.current;
      const hitIds = getElementsHitByScribble(rawDrawingPoints.current);
      if (hitIds.length) {
        deleteElements([lineId, ...hitIds]);
      }
      isDrawing.current = false;
      drawingLineId.current = null;
      rawDrawingPoints.current = [];
      drawingStartPoint.current = null;
      lastDrawingPoint.current = null;
      drawingStartTime.current = 0;
      smartDrawing.current = false;
      eraseHistoryRecorded.current = false;
      if (hitIds.length) return;
    }
    if (activeTool !== 'highlight' && smartDrawing.current && isDrawing.current && drawingLineId.current && rawDrawingPoints.current.length >= 4) {
      const lineId = drawingLineId.current;
      const finalPoints = idealizeDrawing(rawDrawingPoints.current);
      setLines((prev: any) => prev.map((line: any) => (
        line.id === lineId ? { ...line, points: finalPoints } : line
      )), { record: false });
    }
    isDrawing.current = false;
    drawingLineId.current = null;
    rawDrawingPoints.current = [];
    drawingStartPoint.current = null;
    lastDrawingPoint.current = null;
    drawingStartTime.current = 0;
    smartDrawing.current = false;
    eraseHistoryRecorded.current = false;
  };

  const handleDragStage = (e: any) => {
    if (e.target === e.target.getStage()) {
      const nextPos = { x: e.target.x(), y: e.target.y() };
      edgePanState.current = nextPos;
      setStagePos(nextPos);
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition() || { x: windowSize.width / 2, y: windowSize.height / 2 };
    const isZoomGesture = e.evt.ctrlKey || e.evt.metaKey;

    if (isZoomGesture) {
      const oldScale = stageScale;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleStep = Math.abs(e.evt.deltaY) > 80 ? 0.14 : 0.08;
      const nextScale = Math.max(0.25, Math.min(3, oldScale * (direction > 0 ? 1 + scaleStep : 1 - scaleStep)));
      const pointerBoardPosition = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      };
      const nextPos = {
        x: pointer.x - pointerBoardPosition.x * nextScale,
        y: pointer.y - pointerBoardPosition.y * nextScale,
      };
      edgePanState.current = nextPos;
      setStageScale(nextScale);
      setStagePos(nextPos);
      return;
    }

    const nextPos = {
      x: stagePos.x - e.evt.deltaX,
      y: stagePos.y - e.evt.deltaY,
    };
    edgePanState.current = nextPos;
    setStagePos(nextPos);
  };

  const startCrop = () => {
    if (!selectedImage) return;
    setCropImageId(selectedImage.id);
    setCropRect({
      x: selectedImage.x,
      y: selectedImage.y,
      width: selectedImage.width,
      height: selectedImage.height,
    });
  };

  const cancelCrop = () => {
    setCropImageId(null);
    setCropRect(null);
  };

  const applyCrop = () => {
    if (!cropRect || !selectedImage) return;

    const naturalWidth = selectedImage.naturalWidth || selectedImage.crop?.width || selectedImage.width;
    const naturalHeight = selectedImage.naturalHeight || selectedImage.crop?.height || selectedImage.height;
    const baseCrop = selectedImage.crop || { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
    const visibleCrop = clampCropRect(cropRect);
    const nextCrop = {
      x: baseCrop.x + ((visibleCrop.x - selectedImage.x) / selectedImage.width) * baseCrop.width,
      y: baseCrop.y + ((visibleCrop.y - selectedImage.y) / selectedImage.height) * baseCrop.height,
      width: (visibleCrop.width / selectedImage.width) * baseCrop.width,
      height: (visibleCrop.height / selectedImage.height) * baseCrop.height,
    };

    updateImage(selectedImage.id, {
      x: visibleCrop.x,
      y: visibleCrop.y,
      width: visibleCrop.width,
      height: visibleCrop.height,
      crop: {
        x: Math.max(0, nextCrop.x),
        y: Math.max(0, nextCrop.y),
        width: Math.max(1, Math.min(naturalWidth - Math.max(0, nextCrop.x), nextCrop.width)),
        height: Math.max(1, Math.min(naturalHeight - Math.max(0, nextCrop.y), nextCrop.height)),
      },
    });
    cancelCrop();
  };

  const rotateSelectedImage = () => {
    if (!selectedImage) return;
    updateImage(selectedImage.id, {
      rotation: ((selectedImage.rotation || 0) + 90) % 360,
    });
  };

  const resizeSelectedImage = (factor: number) => {
    if (!selectedImage) return;
    const nextWidth = Math.max(20, selectedImage.width * factor);
    const nextHeight = Math.max(20, selectedImage.height * factor);
    updateImage(selectedImage.id, {
      x: selectedImage.x - (nextWidth - selectedImage.width) / 2,
      y: selectedImage.y - (nextHeight - selectedImage.height) / 2,
      width: nextWidth,
      height: nextHeight,
    });
  };

  const clampCropRect = (rect: ImageCrop) => {
    if (!selectedImage) return rect;
    const minSize = 12;
    const maxWidth = Math.max(minSize, selectedImage.width);
    const maxHeight = Math.max(minSize, selectedImage.height);
    const width = Math.min(Math.max(minSize, rect.width), maxWidth);
    const height = Math.min(Math.max(minSize, rect.height), maxHeight);
    const x = Math.max(selectedImage.x, Math.min(rect.x, selectedImage.x + selectedImage.width - width));
    const y = Math.max(selectedImage.y, Math.min(rect.y, selectedImage.y + selectedImage.height - height));
    return { x, y, width, height };
  };

  const isPointInsideSelectedImage = (point: { x: number; y: number }) => {
    if (!selectedImage) return false;
    return point.x >= selectedImage.x &&
      point.x <= selectedImage.x + selectedImage.width &&
      point.y >= selectedImage.y &&
      point.y <= selectedImage.y + selectedImage.height;
  };

  const isCropRectFullImage = () => {
    if (!selectedImage || !cropRect) return false;
    const tolerance = 2;
    return Math.abs(cropRect.x - selectedImage.x) <= tolerance &&
      Math.abs(cropRect.y - selectedImage.y) <= tolerance &&
      Math.abs(cropRect.width - selectedImage.width) <= tolerance &&
      Math.abs(cropRect.height - selectedImage.height) <= tolerance;
  };

  const clampPointToSelectedImage = (point: { x: number; y: number }) => {
    if (!selectedImage) return point;
    return {
      x: Math.max(selectedImage.x, Math.min(point.x, selectedImage.x + selectedImage.width)),
      y: Math.max(selectedImage.y, Math.min(point.y, selectedImage.y + selectedImage.height)),
    };
  };

  const startCropSelection = (point: { x: number; y: number }) => {
    const start = clampPointToSelectedImage(point);
    cropSelectionStart.current = start;
    setCropRect(clampCropRect({ x: start.x, y: start.y, width: 12, height: 12 }));
  };

  const updateCropSelection = (point: { x: number; y: number }) => {
    if (!cropSelectionStart.current || !selectedImage) return;
    const start = cropSelectionStart.current;
    const end = clampPointToSelectedImage(point);
    setCropRect(clampCropRect({
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    }));
  };

  const syncCropRectFromNode = (node: any, sourceRect: ImageCrop) => {
    const nextRect = clampCropRect({
      x: node.x(),
      y: node.y(),
      width: sourceRect.width * node.scaleX(),
      height: sourceRect.height * node.scaleY(),
    });
    node.scaleX(1);
    node.scaleY(1);
    node.position({ x: nextRect.x, y: nextRect.y });
    node.size({ width: nextRect.width, height: nextRect.height });
    setCropRect(nextRect);
  };

  const getBackgroundStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = { backgroundColor: bgColor, transition: 'background-color 0.3s ease, filter 0.3s ease' };
    const bgImages = []; const bgSizes = [];
    if (grid !== 'brak') {
      const s = grid === 'S' ? 20 : grid === 'M' ? 40 : 60;
      bgImages.push(`linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px)`, `linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`);
      bgSizes.push(`${s * stageScale}px ${s * stageScale}px`, `${s * stageScale}px ${s * stageScale}px`);
    }
    if (dots !== 'brak') {
      const s = dots === 'S' ? 20 : dots === 'M' ? 40 : 60;
      bgImages.push(`radial-gradient(circle, rgba(0,0,0,0.15) 1.5px, transparent 1.5px)`);
      bgSizes.push(`${s * stageScale}px ${s * stageScale}px`);
    }
    if (bgImages.length > 0) {
      styles.backgroundImage = bgImages.join(', ');
      styles.backgroundSize = bgSizes.join(', ');
      styles.backgroundPosition = bgImages.map(() => `${stagePos.x}px ${stagePos.y}px`).join(', ');
    }
    if (theme === 'dark') styles.filter = 'invert(1) hue-rotate(180deg)';
    return styles;
  };

  if (windowSize.width === 0) return null;

  const renderBoardPattern = () => {
    const patternSize = grid !== 'brak'
      ? grid === 'S' ? 20 : grid === 'M' ? 40 : 60
      : dots !== 'brak' ? dots === 'S' ? 20 : dots === 'M' ? 40 : 60 : 0;

    if (!patternSize) return null;

    const viewX = exportPatternBounds ? exportPatternBounds.minX : -stagePos.x / stageScale;
    const viewY = exportPatternBounds ? exportPatternBounds.minY : -stagePos.y / stageScale;
    const viewWidth = exportPatternBounds ? exportPatternBounds.maxX - exportPatternBounds.minX : windowSize.width / stageScale;
    const viewHeight = exportPatternBounds ? exportPatternBounds.maxY - exportPatternBounds.minY : windowSize.height / stageScale;
    const startX = Math.floor(viewX / patternSize) * patternSize;
    const startY = Math.floor(viewY / patternSize) * patternSize;
    const endX = viewX + viewWidth;
    const endY = viewY + viewHeight;
    const elements: ReactNode[] = [];

    if (grid !== 'brak') {
      for (let x = startX; x <= endX; x += patternSize) {
        elements.push(
          <Line
            key={`grid-x-${x}`}
            points={[x, viewY, x, endY]}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={1 / stageScale}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
      for (let y = startY; y <= endY; y += patternSize) {
        elements.push(
          <Line
            key={`grid-y-${y}`}
            points={[viewX, y, endX, y]}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={1 / stageScale}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }

    if (dots !== 'brak') {
      const columns = Math.ceil(viewWidth / patternSize);
      const rows = Math.ceil(viewHeight / patternSize);
      const dotStep = columns * rows > 5000
        ? patternSize * Math.ceil(Math.sqrt((columns * rows) / 5000))
        : patternSize;

      for (let x = startX; x <= endX; x += dotStep) {
        for (let y = startY; y <= endY; y += dotStep) {
          elements.push(
            <Circle
              key={`dot-${x}-${y}`}
              x={x}
              y={y}
              radius={1.8 / stageScale}
              fill="rgba(0,0,0,0.22)"
              listening={false}
            />
          );
        }
      }
    }

    return elements;
  };

  const renderShapeContent = (shape: any, w: number, h: number) => {
    const shapeStroke = shape.stroke || '#1e1e1e';
    const shapeStrokeWidth = shape.strokeWidth || 3;
    const shapeDash = shape.dash;
    const shapeOpacity = shape.opacity ?? 1;
    const strokeProps = { stroke: shapeStroke, strokeWidth: shapeStrokeWidth, dash: shapeDash, opacity: shapeOpacity, lineJoin: "round" as any, lineCap: "round" as any };

    if (shape.type === 'vector') return <Arrow points={[0, 0, w, h]} fill={shapeStroke} pointerLength={15} pointerWidth={15} {...strokeProps} />;
    if (shape.type === 'line_seg') return <Line points={[0, 0, w, h]} {...strokeProps} />;
    if (shape.type === 'coords') return (
      <>
        <Arrow points={[0, h/2, w, h/2]} fill={shapeStroke} pointerLength={12} pointerWidth={12} {...strokeProps} />
        <Arrow points={[w/2, h, w/2, 0]} fill={shapeStroke} pointerLength={12} pointerWidth={12} {...strokeProps} />
      </>
    );

    if (shape.type === 'rect') return <Rect width={w} height={h} {...strokeProps} />;
    if (shape.type === 'ellipse') return <Ellipse x={w/2} y={h/2} radiusX={w/2} radiusY={h/2} {...strokeProps} />;
    
    const d = getShapePath(shape.type, w, h, shape.rows || 3, shape.cols || 3);

    if (d) return <Path data={d} {...strokeProps} />;
    return null;
  };

  // touchAction: 'none' zapobiega przechwytywaniu przeciągania przez przeglądarkę
  return (
    <div className={`absolute inset-0 w-full h-full ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`} style={{ ...getBackgroundStyles(), touchAction: 'none' }}>
      {pendingPlacementImage && (
        <div
          className="pointer-events-none fixed left-1/2 top-4 z-[90] -translate-x-1/2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-xl"
          style={{ transform: `translateX(-50%) scale(${uiScale})`, transformOrigin: 'top center' }}
        >
          Kliknij na tablicy, aby wkleić wycinek PDF
        </div>
      )}
      {activeTool === 'text' && !textEditor && (
        <div
          className="pointer-events-none fixed left-1/2 top-20 z-[90] -translate-x-1/2 rounded-full bg-slate-900/55 px-4 py-2 text-xs font-medium text-white/85 shadow-lg backdrop-blur"
          style={{ transform: `translateX(-50%) scale(${uiScale})`, transformOrigin: 'top center' }}
        >
          Kliknij na tablicę i wpisz tekst. Enter zapisuje, Shift+Enter nowa linia.
        </div>
      )}
      {activeTool === 'ai' && (
        <div
          className="pointer-events-none fixed left-1/2 top-20 z-[90] -translate-x-1/2 rounded-full bg-violet-700/75 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur"
          style={{ transform: `translateX(-50%) scale(${uiScale})`, transformOrigin: 'top center' }}
        >
          Przeciągnij po tablicy, żeby zaznaczyć kontekst dla AI.
        </div>
      )}
      <Stage
        ref={stageRef}
        width={windowSize.width} height={windowSize.height} x={stagePos.x} y={stagePos.y} scaleX={stageScale} scaleY={stageScale}
        draggable={activeTool === 'pan'} onDragMove={handleDragStage} onWheel={handleWheel} onPointerDown={handleStagePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      >
        <Layer>
          <Rect
            name="board-background"
            x={-stagePos.x / stageScale}
            y={-stagePos.y / stageScale}
            width={windowSize.width / stageScale}
            height={windowSize.height / stageScale}
            fill={bgColor}
            listening={true}
          />
          {renderBoardPattern()}
          {images.map((img) => (
            <CanvasImage 
              key={img.id} 
              imgData={img} 
              isDraggable={activeTool === 'select' && !isCropping}
              onSelect={() => {
                if (activeTool === 'select') {
                  setSelectedId(img.id);
                  if (cropImageId && cropImageId !== img.id) cancelCrop();
                }
              }}
              onChange={(newData) => updateImage(img.id, newData)}
              onEdgeDrag={handleNodeEdgeDrag}
            />
          ))}

          {shapes.map((shape) => {
            const w = shape.width || 100;
            const h = shape.height || 100;

            return (
              <Group
                key={shape.id}
                id={shape.id}
                x={shape.x}
                y={shape.y}
                width={w}
                height={h}
                rotation={shape.rotation || 0}
                draggable={activeTool === 'select'}
                onDragMove={(e) => handleNodeEdgeDrag(e, e.currentTarget)}
                onDragEnd={(e) => {
                  updateShape(shape.id, { x: e.currentTarget.x(), y: e.currentTarget.y() });
                }}
                onTransformEnd={(e) => {
                  const node = e.currentTarget;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  
                  // Resetujemy wizualną skalę do 1, a przeliczamy rzeczywiste width i height
                  node.scaleX(1);
                  node.scaleY(1);
                  
                  updateShape(shape.id, {
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, w * scaleX),
                    height: Math.max(5, h * scaleY),
                    rotation: node.rotation(),
                  });
                }}
                onPointerDown={(e) => {
                  if (activeTool === 'select') {
                    // Zaznaczamy figurę bez wymuszania cancelBubble
                    setSelectedId(shape.id);
                  }
                }}
              >
                <Rect width={w} height={h} fill="white" opacity={0.01} />
                {renderShapeContent(shape, w, h)}
              </Group>
            );
          })}

          {texts.map((text) => (
            <KonvaText
              key={text.id}
              id={text.id}
              x={text.x}
              y={text.y}
              text={text.text}
              width={text.width}
              fontSize={text.fontSize}
              fontStyle={text.fontStyle || 'normal'}
              fill={text.fill || strokeColor}
              rotation={text.rotation || 0}
              lineHeight={1.18}
              draggable={activeTool === 'select'}
              onPointerDown={(e) => {
                if (activeTool === 'text') {
                  openTextEditor({
                    id: text.id,
                    x: text.x,
                    y: text.y,
                    value: text.text,
                    width: text.width,
                    fontSize: text.fontSize,
                    fontStyle: text.fontStyle || 'normal',
                    fill: text.fill || strokeColor,
                  });
                  return;
                }
                if (activeTool === 'select') setSelectedId(text.id);
              }}
              onDblClick={() => openTextEditor({
                id: text.id,
                x: text.x,
                y: text.y,
                value: text.text,
                width: text.width,
                fontSize: text.fontSize,
                fontStyle: text.fontStyle || 'normal',
                fill: text.fill || strokeColor,
              })}
              onDblTap={() => openTextEditor({
                id: text.id,
                x: text.x,
                y: text.y,
                value: text.text,
                width: text.width,
                fontSize: text.fontSize,
                fontStyle: text.fontStyle || 'normal',
                fill: text.fill || strokeColor,
              })}
              onDragMove={(e) => handleNodeEdgeDrag(e, e.currentTarget)}
              onDragEnd={(e) => updateText(text.id, { x: e.currentTarget.x(), y: e.currentTarget.y() })}
              onTransformEnd={(e) => {
                const node = e.currentTarget;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();
                node.scaleX(1);
                node.scaleY(1);
                updateText(text.id, {
                  x: node.x(),
                  y: node.y(),
                  width: Math.max(80, text.width * scaleX),
                  fontSize: Math.max(10, text.fontSize * scaleY),
                  rotation: node.rotation(),
                });
              }}
            />
          ))}

          {isCropping && cropRect && (
            <>
              <Rect
                ref={cropRectRef}
                x={cropRect.x}
                y={cropRect.y}
                width={cropRect.width}
                height={cropRect.height}
                draggable={!isCropRectFullImage()}
                stroke="#7c3aed"
                strokeWidth={2}
                dash={[8, 6]}
                fill="rgba(124,58,237,0.08)"
                onPointerDown={(e) => {
                  if (!isCropRectFullImage()) return;
                  const pos = getRelativePointerPosition(e.target.getStage());
                  if (!pos) return;
                  e.cancelBubble = true;
                  startCropSelection(pos);
                }}
                onPointerMove={(e) => {
                  if (!cropSelectionStart.current) return;
                  const pos = getRelativePointerPosition(e.target.getStage());
                  if (!pos) return;
                  e.cancelBubble = true;
                  updateCropSelection(pos);
                }}
                onPointerUp={(e) => {
                  if (!cropSelectionStart.current) return;
                  e.cancelBubble = true;
                  cropSelectionStart.current = null;
                }}
                onDragMove={(e) => {
                  handleNodeEdgeDrag(e, e.currentTarget);
                  const nextRect = clampCropRect({ ...cropRect, x: e.currentTarget.x(), y: e.currentTarget.y() });
                  e.currentTarget.position({ x: nextRect.x, y: nextRect.y });
                  setCropRect(nextRect);
                }}
                onDragEnd={(e) => {
                  const nextRect = clampCropRect({ ...cropRect, x: e.currentTarget.x(), y: e.currentTarget.y() });
                  e.currentTarget.position({ x: nextRect.x, y: nextRect.y });
                  setCropRect(nextRect);
                }}
                onTransformEnd={(e) => {
                  syncCropRectFromNode(e.currentTarget, cropRect);
                }}
              />
              <Transformer
                ref={cropTrRef}
                rotateEnabled={false}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
                anchorSize={22}
                borderStroke="#7c3aed"
                anchorStroke="#7c3aed"
                anchorFill="#ffffff"
                borderStrokeWidth={2}
                boundBoxFunc={(oldBox, newBox) => {
                  if (Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12) return oldBox;
                  return newBox;
                }}
              />
            </>
          )}

          {activeTool === 'ai' && aiSelectionRect && (
            <Rect
              x={aiSelectionRect.x}
              y={aiSelectionRect.y}
              width={aiSelectionRect.width}
              height={aiSelectionRect.height}
              fill="rgba(124,58,237,0.12)"
              stroke="#7c3aed"
              strokeWidth={2}
              dash={[9, 7]}
              listening={false}
            />
          )}

          {activeTool === 'select' && selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(124,58,237,0.10)"
              stroke="#7c3aed"
              strokeWidth={2}
              dash={[9, 7]}
              listening={false}
            />
          )}

          {lines.map((line) => (
            <Line
              key={line.id}
              id={line.id}
              points={line.points}
              stroke={line.stroke || "#1e1e1e"}
              strokeWidth={line.strokeWidth || 3}
              dash={line.dash}
              opacity={line.opacity ?? 1}
              globalCompositeOperation={(line.opacity ?? 1) < 1 ? 'multiply' : 'source-over'}
              tension={0}
              lineCap="round"
              lineJoin="round"
              perfectDrawEnabled={false}
              hitStrokeWidth={10}
            />
          ))}

          {activeTool === 'select' && selectedIds.length > 1 && (() => {
            const bounds = getSelectionBounds();
            if (!bounds) return null;
            return (
              <Rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                fill="rgba(124,58,237,0.04)"
                stroke="#7c3aed"
                strokeWidth={2}
                dash={[10, 7]}
                draggable
                onPointerDown={(e) => {
                  const pos = getRelativePointerPosition(e.target.getStage());
                  if (!pos) return;
                  e.cancelBubble = true;
                  beginMultiDrag(pos);
                }}
                onPointerMove={(e) => {
                  if (!multiDragStart.current) return;
                  const pos = getRelativePointerPosition(e.target.getStage());
                  if (!pos) return;
                  e.cancelBubble = true;
                  updateMultiDrag(pos);
                  e.currentTarget.position({ x: bounds.x, y: bounds.y });
                }}
                onPointerUp={(e) => {
                  e.cancelBubble = true;
                  e.currentTarget.position({ x: bounds.x, y: bounds.y });
                  finishMultiDrag();
                }}
                onDragStart={(e) => {
                  const pos = getRelativePointerPosition(e.target.getStage()) || { x: e.currentTarget.x(), y: e.currentTarget.y() };
                  beginMultiDrag(pos);
                }}
                onDragMove={(e) => {
                  const pos = getRelativePointerPosition(e.target.getStage());
                  if (!pos) return;
                  updateMultiDrag(pos);
                  e.currentTarget.position({ x: bounds.x, y: bounds.y });
                }}
                onDragEnd={(e) => {
                  e.currentTarget.position({ x: bounds.x, y: bounds.y });
                  finishMultiDrag();
                }}
              />
            );
          })()}

          {activeTool === 'select' && selectedIds.length <= 1 && (
            <Transformer
              ref={trRef}
              rotateEnabled={true}
              enabledAnchors={isCropping ? [] : undefined}
              ignoreStroke={true}
              borderStroke="#7c3aed"
              anchorStroke="#7c3aed"
              anchorFill="#ffffff"
              anchorSize={12}
              boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>
      {textEditor && (() => {
        const position = getTextEditorScreenPosition();
        return (
          <>
            <div
              className="fixed z-[141] flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 text-slate-950 shadow-xl"
              style={{
                left: Math.min(Math.max(12, position.left), Math.max(12, windowSize.width - 220)),
                top: Math.max(8, Math.min(position.top - 48, windowSize.height - 104)),
                pointerEvents: 'auto',
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.preventDefault()}
            >
              <button className="h-9 w-9 rounded-lg text-lg font-semibold hover:bg-slate-100" onClick={() => updateTextFormat({ fontSize: Math.max(10, textFormat.fontSize - 2) })}>-</button>
              <button className="h-9 w-9 rounded-lg text-lg font-semibold hover:bg-slate-100" onClick={() => updateTextFormat({ fontSize: Math.min(96, textFormat.fontSize + 2) })}>+</button>
              <button className={`h-9 w-9 rounded-lg text-base font-bold ${textFormat.bold ? 'bg-violet-100 text-violet-700' : 'hover:bg-slate-100'}`} onClick={() => updateTextFormat({ bold: !textFormat.bold })}>B</button>
              <button className={`h-9 w-9 rounded-lg text-base italic ${textFormat.italic ? 'bg-violet-100 text-violet-700' : 'hover:bg-slate-100'}`} onClick={() => updateTextFormat({ italic: !textFormat.italic })}>I</button>
            </div>
            <textarea
              ref={textAreaRef}
              autoFocus
              value={textEditor.value}
              onPointerDownCapture={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDownCapture={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const nextValue = event.target.value;
                updateLiveText({ ...textEditor, value: nextValue });
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  if (document.activeElement !== textAreaRef.current) commitTextEditor();
                }, 120);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelTextEditor();
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  commitTextEditor();
                }
              }}
              className="fixed z-[140] min-h-12 resize both rounded-lg border-2 border-violet-500 bg-white/25 px-3 py-2 leading-tight text-slate-950 shadow-xl outline-none ring-4 ring-violet-200/45 backdrop-blur-[1px]"
              style={{
                left: Math.min(Math.max(12, position.left), Math.max(12, windowSize.width - 220)),
                top: Math.min(Math.max(56, position.top), Math.max(56, windowSize.height - 120)),
                width: Math.min(Math.max(220, textEditor.width * stageScale), Math.max(220, windowSize.width - 24)),
                minWidth: 120,
                fontSize: Math.max(18, textEditor.fontSize * stageScale),
                fontWeight: textEditor.fontStyle.includes('bold') ? 700 : 400,
                fontStyle: textEditor.fontStyle.includes('italic') ? 'italic' : 'normal',
                color: textEditor.fill,
                lineHeight: 1.18,
                pointerEvents: 'auto',
                caretColor: '#7c3aed',
              }}
              placeholder="Wpisz tekst..."
            />
          </>
        );
      })()}
      {selectedImage && (
        <div
          className="absolute left-1/2 top-4 z-[95] flex -translate-x-1/2 gap-2 bg-white border border-slate-200 rounded-2xl shadow-lg p-2"
          style={{ transform: `translateX(-50%) scale(${uiScale})`, transformOrigin: 'top center' }}
        >
          {isCropping ? (
            <>
              <button onClick={applyCrop} className="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold">Zastosuj przycięcie</button>
              <button onClick={cancelCrop} className="px-4 py-2 rounded-xl hover:bg-slate-100 font-semibold">Anuluj</button>
            </>
          ) : (
            <>
              <button onClick={() => resizeSelectedImage(0.9)} className="px-3 py-2 rounded-xl hover:bg-violet-50 text-violet-700 font-semibold">-</button>
              <button onClick={() => resizeSelectedImage(1.1)} className="px-3 py-2 rounded-xl hover:bg-violet-50 text-violet-700 font-semibold">+</button>
              <button onClick={startCrop} className="px-4 py-2 rounded-xl hover:bg-violet-50 text-violet-700 font-semibold">Przytnij zdjęcie</button>
              <button onClick={rotateSelectedImage} className="px-4 py-2 rounded-xl hover:bg-violet-50 text-violet-700 font-semibold">Obróć 90°</button>
              <button onClick={deleteSelected} className="px-4 py-2 rounded-xl hover:bg-red-50 text-red-600 font-semibold">Usuń</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
