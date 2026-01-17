import { useRef, useEffect, useCallback, useState } from "react";
import { nanoid } from "nanoid";
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
  onZoomChange: (zoom: number) => void;
}

function generateStrokeId(): string {
  return `stroke_${nanoid()}`;
}

// Ignore non-primary touches to prevent conflicts with pinch-zoom
function isNonPrimaryTouch(e: React.PointerEvent): boolean {
  return e.pointerType === 'touch' && !e.isPrimary;
}

function isNotActivelyDrawing(
  isDrawing: boolean,
  strokeRef: string | null,
  lastPoint: Point | null
): boolean {
  return !isDrawing || !strokeRef || !lastPoint;
}

function exceedsMinimumDistance(distance: number, minDistance: number): boolean {
  return distance >= minDistance;
}

function requiresInterpolation(distance: number, maxDistance: number): boolean {
  return distance > maxDistance;
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
  onZoomChange,
}: DrawingCanvasProps) {
  // Two canvases: static for completed strokes, dynamic for active drawing (60fps)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<string | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Shape preview during drag
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [previewPoints, setPreviewPoints] = useState<Point[] | null>(null);
  
  const [textInput, setTextInput] = useState<TextInputState>({
    isActive: false,
    position: { x: 0, y: 0 },
    screenPosition: { x: 0, y: 0 },
    text: "",
  });
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
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

    // Coordinate transformation accounting for:
    // 1. Device pixel ratio (high-DPI displays)
    // 2. Zoom level (canvas scaling)
    // 3. Canvas bounding rect offset
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr / (zoom * dpr);
    const y = (clientY - rect.top) * dpr / (zoom * dpr);

    return { x, y };
  }, [zoom]);

  const renderRectangle = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    ctx.beginPath();
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.stroke();
  }, []);

  const renderCircle = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  const renderLine = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }, []);

  const renderText = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.text) return;
    
    ctx.globalCompositeOperation = "source-over";
    const point = stroke.points[0];
    const fontSize = stroke.width * 4;
    const lineHeight = fontSize * 1.2;
    
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = stroke.color;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    
    // Handle multiline text - split by newlines and render each line
    const lines = stroke.text.split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, point.x, point.y + (index * lineHeight));
    });
  }, []);

  const renderFreehand = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const points = stroke.points;
    
    // Single point: render as circle
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    
    // Two points: render as straight line
    if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    // Multi-point: Bézier curve smoothing
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Use midpoints for smooth curves
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;

      if (i === 1) {
        // First segment: simple line to first midpoint
        ctx.lineTo(midX, midY);
      } else {
        // Subsequent segments: quadratic curve through previous point to midpoint
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
    }

    // Final segment to last point
    const lastPoint = points[points.length - 1];
    ctx.quadraticCurveTo(
      points[points.length - 2].x + (lastPoint.x - points[points.length - 2].x) * 0.5,
      points[points.length - 2].y + (lastPoint.y - points[points.length - 2].y) * 0.5,
      lastPoint.x,
      lastPoint.y
    );
    ctx.stroke();
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    // Setup common canvas properties
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;

    // Eraser uses destination-out to remove pixels
    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }

    // Lookup tool-specific renderer
    const toolRenderers: Record<DrawingTool, ((ctx: CanvasRenderingContext2D, stroke: Stroke) => void) | undefined> = {
      rectangle: stroke.points.length >= 2 ? renderRectangle : undefined,
      circle: stroke.points.length >= 2 ? renderCircle : undefined,
      line: stroke.points.length >= 2 ? renderLine : undefined,
      text: stroke.text && stroke.points.length >= 1 ? renderText : undefined,
      brush: renderFreehand,
      eraser: renderFreehand,
    };

    const renderer = toolRenderers[stroke.tool];
    if (renderer) {
      renderer(ctx, stroke);
    }

    ctx.globalCompositeOperation = "source-over";
  }, [renderRectangle, renderCircle, renderLine, renderText, renderFreehand]);

  // Redraw static canvas (all completed strokes) 
  const redrawStaticCanvas = useCallback(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Always reset transform and clear canvas first
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    
    // Apply zoom transform (no pan)
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0);

    // Sort and draw all strokes in timestamp order
    const sortedStrokes = [...strokes].sort((a, b) => a.timestamp - b.timestamp);
    sortedStrokes.forEach(stroke => {
      ctx.save(); // Save state before each stroke
      drawStroke(ctx, stroke);
      ctx.restore(); // Restore state after each stroke
    });
  }, [strokes, drawStroke, zoom]);

  // Redraw dynamic canvas (active drawing, previews, selection boxes)
  const redrawDynamicCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the dynamic canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0);

    // Render shape preview during drag operation
    if (previewPoints && previewPoints.length >= 2 && isShapeTool) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const start = previewPoints[0];
      const end = previewPoints[previewPoints.length - 1];

      // Preview renderer lookup
      const previewRenderers: Record<string, (ctx: CanvasRenderingContext2D, start: Point, end: Point) => void> = {
        rectangle: (ctx, start, end) => {
          ctx.beginPath();
          ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
          ctx.stroke();
        },
        circle: (ctx, start, end) => {
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          const radiusX = Math.abs(end.x - start.x) / 2;
          const radiusY = Math.abs(end.y - start.y) / 2;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
        },
        line: (ctx, start, end) => {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        },
      };

      const renderer = previewRenderers[currentTool];
      if (renderer) {
        renderer(ctx, start, end);
      }

      ctx.globalAlpha = 1;
    }
  }, [zoom, currentTool, previewPoints, isShapeTool, currentColor, strokeWidth]);

  // Redraw static canvas only when strokes or zoom change
  useEffect(() => {
    redrawStaticCanvas();
  }, [redrawStaticCanvas]);

  // Redraw dynamic canvas when UI overlays need updating
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      redrawDynamicCanvas();
    });
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [redrawDynamicCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !staticCanvas || !container) return;

    let resizeTimer: NodeJS.Timeout | null = null;

    const resizeCanvas = () => {
      // Clear any pending resize
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      // Debounce resize to avoid excessive redraws
      resizeTimer = setTimeout(() => {
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        
        // Update canvas dimensions
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        staticCanvas.width = rect.width * dpr;
        staticCanvas.height = rect.height * dpr;
        staticCanvas.style.width = `${rect.width}px`;
        staticCanvas.style.height = `${rect.height}px`;
        
        // Use requestAnimationFrame to ensure canvas is ready before redrawing
        requestAnimationFrame(() => {
          redrawStaticCanvas();
          requestAnimationFrame(() => {
            redrawDynamicCanvas();
          });
        });
      }, 16); // ~60fps debounce
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [redrawStaticCanvas, redrawDynamicCanvas]);

  // Handle wheel event with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, zoom * delta));

      onZoomChange(newZoom);
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelNative);
  }, [zoom, onZoomChange]);

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

  // Auto-resize textarea to fit content (MS Paint/Figma style)
  useEffect(() => {
    const textarea = textInputRef.current;
    if (!textarea || !textInput.isActive) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    textarea.style.width = "auto";

    // Calculate required dimensions based on content
    const lines = textarea.value.split("\n");
    const lineCount = Math.max(1, lines.length);
    
    // Set height based on number of lines
    const fontSize = strokeWidth * 4 * zoom;
    const lineHeight = fontSize * 1.2;
    const padding = 4; // 2px top + 2px bottom
    const newHeight = lineCount * lineHeight + padding;
    textarea.style.height = `${newHeight}px`;

    // Set width based on longest line
    // Use scrollWidth which gives us the actual content width
    const scrollWidth = textarea.scrollWidth;
    const minWidth = 150;
    const newWidth = Math.max(minWidth, scrollWidth + 8); // +8 for padding
    textarea.style.width = `${newWidth}px`;
  }, [textInput.isActive, textInput.text, strokeWidth, zoom]);

  const activateTextInput = useCallback(
    (point: Point, zoom: number) => {
      const screenX = point.x * zoom;
      const screenY = point.y * zoom;
      
      setTextInput({
        isActive: true,
        position: point,
        screenPosition: { x: screenX, y: screenY },
        text: "",
      });
      onCursorMove(point, false);
    },
    [onCursorMove]
  );

  const initializeShapePreview = useCallback(
    (point: Point) => {
      setShapeStart(point);
      setPreviewPoints([point, point]);
      onCursorMove(point, true);
    },
    [onCursorMove]
  );

  const startBrushStroke = useCallback(
    (point: Point) => {
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
    [currentColor, strokeWidth, userId, currentTool, onStrokeStart, onCursorMove, onLocalStrokeStart]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Mobile touch support: only handle primary touch/mouse
      if (isNonPrimaryTouch(e)) {
        return; // Ignore multi-touch
      }

      const rect = container.getBoundingClientRect();
      setCursorScreenPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (textInput.isActive) {
        commitText();
        return;
      }

      canvas.setPointerCapture(e.pointerId);

      const point = getCanvasPoint(e);
      if (!point) return;

      // Route to appropriate tool handler based on current tool
      if (currentTool === "text") {
        activateTextInput(point, zoom);
        return;
      }

      if (isShapeTool) {
        initializeShapePreview(point);
        return;
      }

      startBrushStroke(point);
    },
    [textInput.isActive, commitText, getCanvasPoint, currentTool, zoom, isShapeTool, activateTextInput, initializeShapePreview, startBrushStroke]
  );

  /**
   * Add point to active stroke with adaptive batching and interpolation
   * Handles both smooth slow strokes and fast strokes requiring interpolation
   */
  const addPointToStroke = useCallback(
    (point: Point, strokeId: string, lastPoint: Point) => {
      // Calculate Euclidean distance from last point
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Adaptive point batching thresholds
      const minDistance = 1;  // Skip redundant points closer than 1px
      const maxDistance = 8;  // Interpolate if gap exceeds 8px (prevents jagged fast strokes)

      if (!exceedsMinimumDistance(distance, minDistance)) {
        return lastPoint; // Point too close, skip to save bandwidth/memory
      }

      // Fast stroke handling: interpolate points for smooth continuous lines
      if (requiresInterpolation(distance, maxDistance)) {
        const steps = Math.ceil(distance / maxDistance);
        // Linear interpolation between last point and current point
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;  // Interpolation parameter [0, 1]
          const interpPoint = {
            x: lastPoint.x + dx * t,
            y: lastPoint.y + dy * t,
          };
          onLocalStrokePoint(strokeId, interpPoint);
          onStrokePoint(strokeId, interpPoint);
        }
      } else {
        // Normal stroke: add point directly
        onLocalStrokePoint(strokeId, point);
        onStrokePoint(strokeId, point);
      }

      return point; // Return new last point
    },
    [onLocalStrokePoint, onStrokePoint]
  );

  /**
   * Update shape preview during drag operation
   * Shows live preview of shape being drawn
   */
  const updateShapePreview = useCallback(
    (point: Point, start: Point) => {
      setPreviewPoints([start, point]);
      onCursorMove(point, true);
    },
    [onCursorMove]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setCursorScreenPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      const point = getCanvasPoint(e);
      if (!point) return;

      // Shape tool: Update preview during drag
      if (isShapeTool && shapeStart) {
        updateShapePreview(point, shapeStart);
        return;
      }

      // Not drawing: Just update cursor position
      if (isNotActivelyDrawing(isDrawing, currentStrokeRef.current, lastPointRef.current)) {
        onCursorMove(point, false);
        return;
      }

      // Active drawing: Add point with adaptive batching/interpolation
      const newLastPoint = addPointToStroke(point, currentStrokeRef.current!, lastPointRef.current!);
      if (newLastPoint !== lastPointRef.current) {
        lastPointRef.current = newLastPoint;
      }

      onCursorMove(point, true);
    },
    [isDrawing, onCursorMove, getCanvasPoint, isShapeTool, shapeStart, addPointToStroke, updateShapePreview]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (isShapeTool && shapeStart && previewPoints && previewPoints.length >= 2) {
        const newStroke: Stroke = {
          id: generateStrokeId(),
          points: [previewPoints[0], previewPoints[previewPoints.length - 1]],
          color: currentColor,
          width: strokeWidth,
          userId,
          tool: currentTool,
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
    [onStrokeEnd, getCanvasPoint, onCursorMove, isShapeTool, shapeStart, previewPoints, currentColor, strokeWidth, userId, currentTool, onLocalStrokeStart, onStrokeStart, strokes]
  );

  const handlePointerLeave = useCallback(() => {
    setCursorScreenPos(null);
    onCursorMove(null, false);
  }, [onCursorMove]);

  const cursorSize = strokeWidth * zoom;
  const minCursorSize = 4;
  const displayCursorSize = Math.max(cursorSize, minCursorSize);
  
  // Update cursor based on what's being hovered
  let canvasCursor = "crosshair";
  if (isBrushOrEraser) {
    canvasCursor = "none";
  } else if (currentTool === "text") {
    canvasCursor = "text";
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full rounded-lg shadow-lg overflow-hidden bg-white relative"
      data-testid="canvas-container"
    >
      {/* Static canvas - background layer with all completed strokes */}
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 touch-none pointer-events-none"
        data-testid="static-canvas"
      />
      {/* Dynamic canvas - top layer for active drawing and UI overlays */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ 
          cursor: canvasCursor,
          touchAction: 'none', // Prevent default touch behaviors (zoom, scroll)
          WebkitTouchCallout: 'none', // Disable iOS callout
          WebkitUserSelect: 'none', // Disable text selection on touch
        } as React.CSSProperties}
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
          id="canvas-text-input"
          name="canvasText"
          className="absolute border-2 border-primary bg-transparent outline-none resize-none overflow-hidden"
          style={{
            left: textInput.screenPosition.x,
            top: textInput.screenPosition.y,
            width: textInput.text ? "auto" : "150px",
            minWidth: "150px",
            height: "auto",
            fontSize: `${strokeWidth * 4 * zoom}px`,
            fontFamily: "sans-serif",
            color: currentColor,
            lineHeight: 1.2,
            padding: "2px 4px",
            zIndex: 100,
            whiteSpace: "pre",
            overflowWrap: "normal",
            wordBreak: "normal",
          }}
          value={textInput.text}
          onChange={(e) => setTextInput((prev) => ({ ...prev, text: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              commitText();
            }
          }}
          onBlur={commitText}
          placeholder="Type here..."
          data-testid="text-input-overlay"
          rows={1}
        />
      )}
      
      <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground" data-testid="zoom-indicator">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
