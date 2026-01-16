import { useState, useEffect, useRef, useCallback } from "react";
import { Users, ZoomIn, ZoomOut, Move } from "lucide-react";
import { DrawingCanvas } from "@/components/drawing-canvas";
import { ToolPanel } from "@/components/tool-panel";
import { ColorPicker } from "@/components/color-picker";
import { StrokeWidthSelector } from "@/components/stroke-width-selector";
import { UserPresence } from "@/components/user-presence";
import { CursorOverlay } from "@/components/cursor-overlay";
import { RoomHeader } from "@/components/room-header";
import { UsernameDialog } from "@/components/username-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSocket } from "@/hooks/use-socket";
import type { DrawingTool, Point, Stroke, User, CursorUpdate, Shape } from "@shared/schema";

function getRoomIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "";
}

const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;

function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code.toUpperCase());
}

function getStoredUsername(): string | null {
  return sessionStorage.getItem("canvas_username");
}

const emptySocketReturn = {
  isConnected: false,
  currentUser: null,
  users: [] as User[],
  strokes: [] as Stroke[],
  shapes: [] as Shape[],
  cursors: new Map<string, CursorUpdate>(),
  socket: null,
  canUndo: false,
  canRedo: false,
  sendCursorMove: () => {},
  startStroke: () => {},
  addStrokePoint: () => {},
  endStroke: () => {},
  addShape: () => {},
  clearCanvas: () => {},
  undo: () => {},
  redo: () => {},
  addLocalStroke: () => {},
  updateLocalStroke: () => {},
  addLocalShape: () => {},
};

export default function CanvasPage() {
  const [username, setUsername] = useState<string | null>(() => getStoredUsername());
  const [roomId, setRoomId] = useState<string>(() => getRoomIdFromUrl());
  const [currentTool, setCurrentTool] = useState<DrawingTool>("brush");
  const [currentColor, setCurrentColor] = useState("#1F2937");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const isRoomValid = isValidRoomCode(roomId);

  const socketData = useSocket({
    roomId: roomId.toUpperCase(),
    username: username || "",
    enabled: !!username && isRoomValid,
  });

  const {
    isConnected,
    currentUser,
    users,
    strokes,
    shapes,
    cursors,
    socket,
    canUndo,
    canRedo,
    sendCursorMove,
    startStroke,
    addStrokePoint,
    endStroke,
    addShape,
    clearCanvas,
    undo,
    redo,
    addLocalStroke,
    updateLocalStroke,
    addLocalShape,
  } = username ? socketData : emptySocketReturn;

  // Redirect if invalid room
  useEffect(() => {
    if (!roomId || !isRoomValid) {
      window.location.href = "/";
    }
  }, [roomId, isRoomValid]);

  useEffect(() => {
    const updateRect = () => {
      if (canvasContainerRef.current) {
        setCanvasRect(canvasContainerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "b" || e.key === "B") {
        setCurrentTool("brush");
      } else if (e.key === "e" || e.key === "E") {
        setCurrentTool("eraser");
      } else if (e.key === "r" || e.key === "R") {
        setCurrentTool("rectangle");
      } else if (e.key === "c" || e.key === "C") {
        setCurrentTool("circle");
      } else if (e.key === "l" || e.key === "L") {
        setCurrentTool("line");
      } else if (e.key === "t" || e.key === "T") {
        setCurrentTool("text");
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        redo();
      } else if (e.key === "+" || e.key === "=") {
        setZoom(z => Math.min(5, z * 1.1));
      } else if (e.key === "-") {
        setZoom(z => Math.max(0.1, z * 0.9));
      } else if (e.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const handleUsernameSubmit = useCallback((name: string) => {
    sessionStorage.setItem("canvas_username", name);
    setUsername(name);
  }, []);

  const handleStrokeStart = useCallback(
    (stroke: Stroke) => {
      startStroke(stroke);
    },
    [startStroke]
  );

  const handleStrokePoint = useCallback(
    (strokeId: string, point: Point) => {
      addStrokePoint(strokeId, point);
    },
    [addStrokePoint]
  );

  const handleStrokeEnd = useCallback(
    (strokeId: string) => {
      endStroke(strokeId);
    },
    [endStroke]
  );

  const handleShapeAdd = useCallback(
    (shape: Shape) => {
      addShape(shape);
    },
    [addShape]
  );

  const handleCursorMove = useCallback(
    (position: Point | null, isDrawing: boolean) => {
      sendCursorMove(position, isDrawing);
    },
    [sendCursorMove]
  );

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(5, z * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(0.1, z * 0.8));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!username) {
    return <UsernameDialog open={true} onSubmit={handleUsernameSubmit} />;
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="canvas-page">
      <RoomHeader roomId={roomId} isConnected={isConnected} socket={socket} />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar */}
        <aside className="w-[88px] p-3 flex flex-col gap-3 bg-sidebar border-r border-sidebar-border overflow-y-auto shrink-0">
          <ToolPanel
            currentTool={currentTool}
            onToolChange={setCurrentTool}
            onUndo={undo}
            onRedo={redo}
            onClear={clearCanvas}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <ColorPicker
            currentColor={currentColor}
            onColorChange={setCurrentColor}
          />
          <StrokeWidthSelector
            currentWidth={strokeWidth}
            onWidthChange={setStrokeWidth}
            currentColor={currentColor}
          />
          
          {/* Zoom controls */}
          <div className="flex flex-col gap-2 p-2.5 bg-card border border-card-border rounded-lg">
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">View</span>
            <div className="flex justify-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={handleZoomIn} className="h-8 w-8" data-testid="button-zoom-in">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Zoom In (+)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={handleZoomOut} className="h-8 w-8" data-testid="button-zoom-out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Zoom Out (-)</p></TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={handleResetView} className="text-xs h-7" data-testid="button-reset-view">
                  <Move className="h-3 w-3 mr-1" /> Reset (0)
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Reset View</p></TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Main canvas area */}
        <main className="flex-1 p-3 md:p-5 lg:p-6 overflow-hidden bg-muted/30" ref={canvasContainerRef}>
          <div className="relative w-full h-full">
            <DrawingCanvas
              strokes={strokes}
              shapes={shapes}
              currentTool={currentTool}
              currentColor={currentColor}
              strokeWidth={strokeWidth}
              userId={currentUser?.id || ""}
              onStrokeStart={handleStrokeStart}
              onStrokePoint={handleStrokePoint}
              onStrokeEnd={handleStrokeEnd}
              onShapeAdd={handleShapeAdd}
              onCursorMove={handleCursorMove}
              onLocalStrokeStart={addLocalStroke}
              onLocalStrokePoint={updateLocalStroke}
              onLocalShapeAdd={addLocalShape}
              zoom={zoom}
              pan={pan}
              onZoomChange={setZoom}
              onPanChange={setPan}
            />
            <CursorOverlay
              cursors={cursors}
              users={users}
              currentUserId={currentUser?.id || null}
              canvasRect={canvasRect}
              zoom={zoom}
              pan={pan}
            />
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="hidden md:flex w-48 lg:w-64 p-3 flex-col gap-3 bg-sidebar border-l border-sidebar-border shrink-0">
          <UserPresence
            users={users}
            currentUserId={currentUser?.id || null}
          />
        </aside>

        {/* Mobile floating users button */}
        <button
          onClick={() => setShowUsersPanel(!showUsersPanel)}
          className="md:hidden fixed bottom-4 right-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg"
          aria-label="Toggle users panel"
          data-testid="button-toggle-users"
        >
          <Users className="w-5 h-5" />
          {users.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-xs rounded-full flex items-center justify-center">
              {users.length}
            </span>
          )}
        </button>

        {/* Mobile slide-in users panel */}
        {showUsersPanel && (
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setShowUsersPanel(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <aside 
              className="absolute right-0 top-0 bottom-0 w-64 p-3 bg-sidebar border-l border-sidebar-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <UserPresence
                users={users}
                currentUserId={currentUser?.id || null}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
