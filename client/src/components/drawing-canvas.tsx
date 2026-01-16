import { useRef, useEffect, useCallback, useState } from "react";
import type { Stroke, Point, DrawingTool } from "@shared/schema";

interface TextInputState {
  isActive: boolean;
  position: Point;
  screenPosition: { x: number; y: number };
  text: string;
}

interface DrawingCanvasProps {
  strokes: Stroke[];
  currentTool: DrawingTool;
  currentColor: string;
  strokeWidth: number;
  userId: string;
  onStrokeStart: (stroke: Stroke) => void;
  onStrokePoint: (strokeId: string, point: Point) => void;
  onStrokeEnd: (strokeId: string) => void;
  onCursorMove: (position: Point | null, isDrawing: boolean) => void;
  onLocalStrokeStart: (stroke: Stroke) => void;
  onLocalStrokePoint: (strokeId: string, point: Point) => void;
  zoom: number;
  pan: Point;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: Point) => void;
}

function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function DrawingCanvas({
  strokes,
  currentTool,
  currentColor,
  strokeWidth,
  userId,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
  onCursorMove,
  onLocalStrokeStart,
  onLocalStrokePoint,
  zoom,
  pan,
  onZoomChange,
  onPanChange,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<string | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [previewPoints, setPreviewPoints] = useState<Point[] | null>(null);
  
  const [textInput, setTextInput] = useState<TextInputState>({
    isActive: false,
    position: { x: 0, y: 0 },
    screenPosition: { x: 0, y: 0 },
    text: "",
  });
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point | null>(null);
  const panOffsetRef = useRef<Point>({ x: 0, y: 0 });
  
  const [cursorScreenPos, setCursorScreenPos] = useState<{ x: number; y: number } | null>(null);

  const isShapeTool = currentTool === "rectangle" || currentTool === "circle" || currentTool === "line";
  const isBrushOrEraser = currentTool === "brush" || currentTool === "eraser";
  const showCustomCursor = isBrushOrEraser && cursorScreenPos !== null;

  const getCanvasPoint = useCallback((e: MouseEvent | TouchEvent | React.PointerEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }

    const dpr = window.devicePixelRatio || 1;
    const x = ((clientX - rect.left) * dpr - pan.x * dpr) / (zoom * dpr);
    const y = ((clientY - rect.top) * dpr - pan.y * dpr) / (zoom * dpr);

    return { x, y };
  }, [zoom, pan]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }

    if (stroke.tool === "rectangle" && stroke.points.length >= 2) {
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      ctx.beginPath();
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke();
    } else if (stroke.tool === "circle" && stroke.points.length >= 2) {
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.tool === "line" && stroke.points.length >= 2) {
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (stroke.tool === "text" && stroke.text && stroke.points.length >= 1) {
      ctx.globalCompositeOperation = "source-over";
      const point = stroke.points[0];
      ctx.font = `${stroke.width * 4}px sans-serif`;
      ctx.fillStyle = stroke.color;
      ctx.fillText(stroke.text, point.x, point.y);
    } else {
      const points = stroke.points;
      
      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      
      if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;

        if (i === 1) {
          ctx.lineTo(midX, midY);
        } else {
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
      }

      const lastPoint = points[points.length - 1];
      ctx.quadraticCurveTo(
        points[points.length - 2].x + (lastPoint.x - points[points.length - 2].x) * 0.5,
        points[points.length - 2].y + (lastPoint.y - points[points.length - 2].y) * 0.5,
        lastPoint.x,
        lastPoint.y
      );
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, pan.x * dpr, pan.y * dpr);

    const sortedStrokes = [...strokes].sort((a, b) => a.timestamp - b.timestamp);
    sortedStrokes.forEach(stroke => drawStroke(ctx, stroke));

    if (previewPoints && previewPoints.length >= 2 && isShapeTool) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const start = previewPoints[0];
      const end = previewPoints[previewPoints.length - 1];

      if (currentTool === "rectangle") {
        ctx.beginPath();
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.stroke();
      } else if (currentTool === "circle") {
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        const radiusX = Math.abs(end.x - start.x) / 2;
        const radiusY = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (currentTool === "line") {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }
  }, [strokes, drawStroke, previewPoints, zoom, pan, currentTool, currentColor, strokeWidth, isShapeTool]);

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(redrawCanvas);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      redrawCanvas();
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    return () => observer.disconnect();
  }, [redrawCanvas]);

  const commitText = useCallback(() => {
    if (!textInput.isActive || !textInput.text.trim()) {
      setTextInput({
        isActive: false,
        position: { x: 0, y: 0 },
        screenPosition: { x: 0, y: 0 },
        text: "",
      });
      return;
    }

    const newStroke: Stroke = {
      id: generateStrokeId(),
      points: [textInput.position],
      color: currentColor,
      width: strokeWidth,
      userId,
      tool: "text",
      timestamp: Date.now(),
      text: textInput.text.trim(),
    };

    onLocalStrokeStart(newStroke);
    onStrokeStart(newStroke);
    onStrokeEnd(newStroke.id);

    setTextInput({
      isActive: false,
      position: { x: 0, y: 0 },
      screenPosition: { x: 0, y: 0 },
      text: "",
    });
  }, [textInput, currentColor, strokeWidth, userId, onLocalStrokeStart, onStrokeStart, onStrokeEnd]);

  useEffect(() => {
    if (textInput.isActive && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput.isActive]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      setCursorScreenPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (textInput.isActive) {
        commitText();
        return;
      }

      canvas.setPointerCapture(e.pointerId);

      if (e.button === 1) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panOffsetRef.current = { ...pan };
        return;
      }

      const point = getCanvasPoint(e);
      if (!point) return;

      if (currentTool === "text") {
        const rect = container.getBoundingClientRect();
        setTextInput({
          isActive: true,
          position: point,
          screenPosition: {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          },
          text: "",
        });
        onCursorMove(point, false);
        return;
      }

      if (isShapeTool) {
        setShapeStart(point);
        setPreviewPoints([point, point]);
        onCursorMove(point, true);
        return;
      }

      const strokeId = generateStrokeId();
      currentStrokeRef.current = strokeId;
      lastPointRef.current = point;
      setIsDrawing(true);

      const newStroke: Stroke = {
        id: strokeId,
        points: [point],
        color: currentColor,
        width: strokeWidth,
        userId,
        tool: currentTool === "eraser" ? "eraser" : "brush",
        timestamp: Date.now(),
      };

      onLocalStrokeStart(newStroke);
      onStrokeStart(newStroke);
      onCursorMove(point, true);
    },
    [currentColor, strokeWidth, userId, currentTool, onStrokeStart, onCursorMove, onLocalStrokeStart, getCanvasPoint, isShapeTool, pan, textInput.isActive, commitText]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setCursorScreenPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        onPanChange({
          x: panOffsetRef.current.x + dx,
          y: panOffsetRef.current.y + dy,
        });
        return;
      }

      const point = getCanvasPoint(e);
      if (!point) return;

      if (isShapeTool && shapeStart) {
        setPreviewPoints([shapeStart, point]);
        onCursorMove(point, true);
        return;
      }

      if (!isDrawing || !currentStrokeRef.current || !lastPointRef.current) {
        onCursorMove(point, false);
        return;
      }

      const dx = point.x - lastPointRef.current.x;
      const dy = point.y - lastPointRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const minDistance = 1;
      const maxDistance = 8;

      if (distance >= minDistance) {
        if (distance > maxDistance) {
          const steps = Math.ceil(distance / maxDistance);
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const interpPoint = {
              x: lastPointRef.current.x + dx * t,
              y: lastPointRef.current.y + dy * t,
            };
            onLocalStrokePoint(currentStrokeRef.current, interpPoint);
            onStrokePoint(currentStrokeRef.current, interpPoint);
          }
        } else {
          onLocalStrokePoint(currentStrokeRef.current, point);
          onStrokePoint(currentStrokeRef.current, point);
        }
        lastPointRef.current = point;
      }

      onCursorMove(point, true);
    },
    [isDrawing, onStrokePoint, onCursorMove, onLocalStrokePoint, getCanvasPoint, isPanning, onPanChange, isShapeTool, shapeStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        return;
      }

      if (isShapeTool && shapeStart && previewPoints && previewPoints.length >= 2) {
        const newStroke: Stroke = {
          id: generateStrokeId(),
          points: [previewPoints[0], previewPoints[previewPoints.length - 1]],
          color: currentColor,
          width: strokeWidth,
          userId,
          tool: currentTool as "rectangle" | "circle" | "line",
          timestamp: Date.now(),
        };

        onLocalStrokeStart(newStroke);
        onStrokeStart(newStroke);
        onStrokeEnd(newStroke.id);

        setShapeStart(null);
        setPreviewPoints(null);
        return;
      }

      if (currentStrokeRef.current) {
        onStrokeEnd(currentStrokeRef.current);
        currentStrokeRef.current = null;
      }

      setIsDrawing(false);
      lastPointRef.current = null;

      const point = getCanvasPoint(e);
      if (point) {
        onCursorMove(point, false);
      }
    },
    [onStrokeEnd, getCanvasPoint, onCursorMove, isPanning, isShapeTool, shapeStart, previewPoints, currentColor, strokeWidth, userId, currentTool, onLocalStrokeStart, onStrokeStart]
  );

  const handlePointerLeave = useCallback(() => {
    setCursorScreenPos(null);
    onCursorMove(null, false);
  }, [onCursorMove]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      onZoomChange(newZoom);
      onPanChange({ x: newPanX, y: newPanY });
    },
    [zoom, pan, onZoomChange, onPanChange]
  );

  const cursorSize = strokeWidth * zoom;
  const minCursorSize = 4;
  const displayCursorSize = Math.max(cursorSize, minCursorSize);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full rounded-lg shadow-lg overflow-hidden bg-white relative"
      data-testid="canvas-container"
    >
      <canvas
        ref={canvasRef}
        className="touch-none"
        style={{ cursor: isBrushOrEraser ? "none" : currentTool === "text" ? "text" : "crosshair" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        data-testid="drawing-canvas"
      />
      
      {showCustomCursor && cursorScreenPos && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: cursorScreenPos.x - displayCursorSize / 2,
            top: cursorScreenPos.y - displayCursorSize / 2,
            width: displayCursorSize,
            height: displayCursorSize,
            ...(currentTool === "brush"
              ? {
                  backgroundColor: currentColor,
                  opacity: 0.5,
                }
              : {
                  backgroundColor: "transparent",
                  border: "2px dashed rgba(100, 100, 100, 0.8)",
                }),
          }}
          data-testid="custom-cursor"
        />
      )}
      
      {textInput.isActive && (
        <textarea
          ref={textInputRef}
          className="absolute border-2 border-primary bg-transparent outline-none resize-none overflow-hidden"
          style={{
            left: textInput.screenPosition.x,
            top: textInput.screenPosition.y,
            minWidth: "100px",
            minHeight: "30px",
            fontSize: `${strokeWidth * 4 * zoom}px`,
            fontFamily: "sans-serif",
            color: currentColor,
            lineHeight: 1.2,
            padding: "2px 4px",
            zIndex: 100,
          }}
          value={textInput.text}
          onChange={(e) => setTextInput((prev) => ({ ...prev, text: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              commitText();
            }
          }}
          onBlur={commitText}
          placeholder="Type here..."
          data-testid="text-input-overlay"
        />
      )}
      
      <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground" data-testid="zoom-indicator">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
