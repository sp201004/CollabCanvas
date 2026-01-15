import { useRef, useEffect, useCallback, useState } from "react";
import type { Stroke, Point, DrawingTool } from "@shared/schema";

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
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<string | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const getCanvasPoint = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Convert screen coordinates to canvas-local coordinates.
    // We use getBoundingClientRect() to get the canvas position on screen,
    // then subtract to get coordinates relative to the canvas top-left.
    // No DPR scaling here since ctx.scale(dpr) already handles rendering.
    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length - 1; i++) {
      const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
    }

    if (stroke.points.length > 1) {
      const lastPoint = stroke.points[stroke.points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
    }

    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });
  }, [strokes, drawStroke]);

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
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        redrawCanvas();
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.setPointerCapture(e.pointerId);

      const point = getCanvasPoint(e.nativeEvent as MouseEvent);
      if (!point) return;

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
        tool: currentTool,
        timestamp: Date.now(),
      };

      onLocalStrokeStart(newStroke);
      onStrokeStart(newStroke);
      onCursorMove(point, true);
    },
    [currentColor, strokeWidth, userId, currentTool, onStrokeStart, onCursorMove, onLocalStrokeStart, getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const point = getCanvasPoint(e.nativeEvent as MouseEvent);
      if (!point) return;

      onCursorMove(point, isDrawing);

      if (!isDrawing || !currentStrokeRef.current) return;

      const lastPoint = lastPointRef.current;
      if (lastPoint) {
        const dx = point.x - lastPoint.x;
        const dy = point.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 2) return;
      }

      lastPointRef.current = point;
      onLocalStrokePoint(currentStrokeRef.current, point);
      onStrokePoint(currentStrokeRef.current, point);
    },
    [isDrawing, onStrokePoint, onCursorMove, onLocalStrokePoint, getCanvasPoint]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (currentStrokeRef.current) {
        onStrokeEnd(currentStrokeRef.current);
      }

      setIsDrawing(false);
      currentStrokeRef.current = null;
      lastPointRef.current = null;
      onCursorMove(null, false);
    },
    [onStrokeEnd, onCursorMove]
  );

  const handlePointerLeave = useCallback(() => {
    onCursorMove(null, false);
  }, [onCursorMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white rounded-md overflow-hidden shadow-inner"
      data-testid="canvas-container"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ 
          cursor: currentTool === "eraser" 
            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='8'/%3E%3C/svg%3E") 12 12, crosshair`
            : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'%3E%3Cpath d='M12 19l7-7 3 3-7 7-3-3z'/%3E%3Cpath d='M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z'/%3E%3Cpath d='M2 2l7.586 7.586'/%3E%3C/svg%3E") 2 22, crosshair`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        data-testid="drawing-canvas"
      />
    </div>
  );
}
