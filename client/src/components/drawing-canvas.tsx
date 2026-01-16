import { useRef, useEffect, useCallback, useState } from "react";
import type { Stroke, Point, DrawingTool, Shape } from "@shared/schema";

interface TextInputState {
  isActive: boolean;
  position: Point;
  screenPosition: { x: number; y: number };
  text: string;
}

interface DrawingCanvasProps {
  strokes: Stroke[];
  shapes: Shape[];
  currentTool: DrawingTool;
  currentColor: string;
  strokeWidth: number;
  userId: string;
  onStrokeStart: (stroke: Stroke) => void;
  onStrokePoint: (strokeId: string, point: Point) => void;
  onStrokeEnd: (strokeId: string) => void;
  onShapeAdd: (shape: Shape) => void;
  onCursorMove: (position: Point | null, isDrawing: boolean) => void;
  onLocalStrokeStart: (stroke: Stroke) => void;
  onLocalStrokePoint: (strokeId: string, point: Point) => void;
  onLocalShapeAdd: (shape: Shape) => void;
  zoom: number;
  pan: Point;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: Point) => void;
}

function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateShapeId(): string {
  return `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function DrawingCanvas({
  strokes,
  shapes,
  currentTool,
  currentColor,
  strokeWidth,
  userId,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
  onShapeAdd,
  onCursorMove,
  onLocalStrokeStart,
  onLocalStrokePoint,
  onLocalShapeAdd,
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
  
  // Shape drawing state
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [previewShape, setPreviewShape] = useState<Shape | null>(null);
  
  // Inline text input state
  const [textInput, setTextInput] = useState<TextInputState>({
    isActive: false,
    position: { x: 0, y: 0 },
    screenPosition: { x: 0, y: 0 },
    text: "",
  });
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point | null>(null);
  const panOffsetRef = useRef<Point>({ x: 0, y: 0 });

  // Transform screen coordinates to canvas coordinates (accounting for zoom and pan)
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    };
  }, [zoom, pan]);

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

    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    
    return screenToCanvas(screenX, screenY);
  }, [screenToCanvas]);

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

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.beginPath();
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const { startPoint, endPoint, type } = shape;

    switch (type) {
      case "rectangle":
        ctx.strokeRect(
          startPoint.x,
          startPoint.y,
          endPoint.x - startPoint.x,
          endPoint.y - startPoint.y
        );
        break;
      case "circle": {
        const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
        const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
        const centerX = startPoint.x + (endPoint.x - startPoint.x) / 2;
        const centerY = startPoint.y + (endPoint.y - startPoint.y) / 2;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "line":
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();
        break;
      case "text":
        if (shape.text) {
          ctx.font = `${shape.width * 4}px sans-serif`;
          ctx.fillStyle = shape.color;
          ctx.fillText(shape.text, startPoint.x, startPoint.y);
        }
        break;
    }
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and fill with white background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transformation
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, pan.x * dpr, pan.y * dpr);

    // Draw all strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });

    // Draw all shapes
    shapes.forEach((shape) => {
      drawShape(ctx, shape);
    });

    // Draw preview shape if dragging
    if (previewShape) {
      ctx.globalAlpha = 0.6;
      drawShape(ctx, previewShape);
      ctx.globalAlpha = 1;
    }
  }, [strokes, shapes, drawStroke, drawShape, previewShape, zoom, pan]);

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

      redrawCanvas();
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [redrawCanvas]);

  // Handle mouse wheel for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom speed factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
      
      // Zoom towards mouse position
      const zoomChange = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * zoomChange;
      const newPanY = mouseY - (mouseY - pan.y) * zoomChange;
      
      onZoomChange(newZoom);
      onPanChange({ x: newPanX, y: newPanY });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoom, pan, onZoomChange, onPanChange]);

  const isShapeTool = currentTool === "rectangle" || currentTool === "circle" || currentTool === "line" || currentTool === "text";

  // Commit text from inline editor to canvas
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

    const newShape: Shape = {
      id: generateShapeId(),
      type: "text",
      startPoint: textInput.position,
      endPoint: textInput.position,
      color: currentColor,
      width: strokeWidth,
      userId,
      timestamp: Date.now(),
      text: textInput.text.trim(),
    };

    onLocalShapeAdd(newShape);
    onShapeAdd(newShape);

    setTextInput({
      isActive: false,
      position: { x: 0, y: 0 },
      screenPosition: { x: 0, y: 0 },
      text: "",
    });
  }, [textInput, currentColor, strokeWidth, userId, onLocalShapeAdd, onShapeAdd]);

  // Focus text input when it becomes active
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

      // If text input is active, commit it first
      if (textInput.isActive) {
        commitText();
        return;
      }

      canvas.setPointerCapture(e.pointerId);

      // Middle mouse button or space+click for panning
      if (e.button === 1) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panOffsetRef.current = { ...pan };
        return;
      }

      const point = getCanvasPoint(e);
      if (!point) return;

      // Handle text tool - show inline text editor on click
      if (currentTool === "text") {
        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        setTextInput({
          isActive: true,
          position: point,
          screenPosition: { x: screenX, y: screenY },
          text: "",
        });
        setIsDrawing(false);
        return;
      }

      if (isShapeTool) {
        // Start shape drawing (rectangle, circle, line)
        setShapeStart(point);
        setIsDrawing(true);
        onCursorMove(point, true);
      } else {
        // Start stroke drawing
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
          tool: currentTool as "brush" | "eraser",
          timestamp: Date.now(),
        };

        onLocalStrokeStart(newStroke);
        onStrokeStart(newStroke);
        onCursorMove(point, true);
      }
    },
    [currentColor, strokeWidth, userId, currentTool, onStrokeStart, onCursorMove, onLocalStrokeStart, getCanvasPoint, isShapeTool, pan, textInput.isActive, commitText]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Handle panning
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

      onCursorMove(point, isDrawing);

      if (!isDrawing) return;

      if (isShapeTool && shapeStart) {
        // Update preview shape
        setPreviewShape({
          id: "preview",
          type: currentTool as "rectangle" | "circle" | "line" | "text",
          startPoint: shapeStart,
          endPoint: point,
          color: currentColor,
          width: strokeWidth,
          userId,
          timestamp: Date.now(),
        });
      } else if (currentStrokeRef.current) {
        // Add stroke point
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
      }
    },
    [isDrawing, onStrokePoint, onCursorMove, onLocalStrokePoint, getCanvasPoint, isShapeTool, shapeStart, currentTool, currentColor, strokeWidth, userId, isPanning, onPanChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      // End panning
      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        return;
      }

      if (isShapeTool && shapeStart && currentTool !== "text") {
        const point = getCanvasPoint(e);
        if (point) {
          const newShape: Shape = {
            id: generateShapeId(),
            type: currentTool as "rectangle" | "circle" | "line",
            startPoint: shapeStart,
            endPoint: point,
            color: currentColor,
            width: strokeWidth,
            userId,
            timestamp: Date.now(),
          };
          onLocalShapeAdd(newShape);
          onShapeAdd(newShape);
        }
        setShapeStart(null);
        setPreviewShape(null);
      } else if (currentStrokeRef.current) {
        onStrokeEnd(currentStrokeRef.current);
      }

      setIsDrawing(false);
      currentStrokeRef.current = null;
      lastPointRef.current = null;
      onCursorMove(null, false);
    },
    [onStrokeEnd, onCursorMove, isShapeTool, shapeStart, currentTool, currentColor, strokeWidth, userId, onShapeAdd, onLocalShapeAdd, getCanvasPoint, isPanning]
  );

  const handlePointerLeave = useCallback(() => {
    onCursorMove(null, false);
  }, [onCursorMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-lg overflow-hidden shadow-sm border border-border/30"
      data-testid="canvas-container"
      style={{
        background: `
          radial-gradient(circle, #e5e7eb 1px, transparent 1px),
          linear-gradient(to bottom, #fafafa, #ffffff)
        `,
        backgroundSize: '20px 20px, 100% 100%',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ 
          cursor: isPanning 
            ? "grabbing"
            : isShapeTool 
              ? "crosshair"
              : currentTool === "eraser" 
                ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='8'/%3E%3C/svg%3E") 12 12, crosshair`
                : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'%3E%3Cpath d='M12 19l7-7 3 3-7 7-3-3z'/%3E%3Cpath d='M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z'/%3E%3Cpath d='M2 2l7.586 7.586'/%3E%3C/svg%3E") 2 22, crosshair`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        data-testid="drawing-canvas"
      />
      
      {/* Inline text input overlay */}
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
              setTextInput({
                isActive: false,
                position: { x: 0, y: 0 },
                screenPosition: { x: 0, y: 0 },
                text: "",
              });
            }
          }}
          onBlur={commitText}
          placeholder="Type here..."
          data-testid="text-input-overlay"
        />
      )}
      
      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground" data-testid="zoom-indicator">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
