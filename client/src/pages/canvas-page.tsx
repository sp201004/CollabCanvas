import { useState, useEffect, useRef, useCallback } from "react";
import { Users } from "lucide-react";
import { DrawingCanvas } from "@/components/drawing-canvas";
import { ToolPanel } from "@/components/tool-panel";
import { ColorPicker } from "@/components/color-picker";
import { StrokeWidthSelector } from "@/components/stroke-width-selector";
import { UserPresence } from "@/components/user-presence";
import { CursorOverlay } from "@/components/cursor-overlay";
import { RoomHeader } from "@/components/room-header";
import { UsernameDialog } from "@/components/username-dialog";
import { useSocket } from "@/hooks/use-socket";
import type { DrawingTool, Point, Stroke, User, CursorUpdate } from "@shared/schema";

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

const emptySocketReturn = {
  isConnected: false,
  currentUser: null,
  users: [] as User[],
  strokes: [] as Stroke[],
  cursors: new Map<string, CursorUpdate>(),
  sendCursorMove: () => {},
  startStroke: () => {},
  addStrokePoint: () => {},
  endStroke: () => {},
  clearCanvas: () => {},
  undo: () => {},
  redo: () => {},
  addLocalStroke: () => {},
  updateLocalStroke: () => {},
};

export default function CanvasPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>(() => {
    return getRoomIdFromUrl() || generateRoomId();
  });
  const [currentTool, setCurrentTool] = useState<DrawingTool>("brush");
  const [currentColor, setCurrentColor] = useState("#1F2937");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  // Mobile: toggle for users panel visibility
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const socketData = useSocket({
    roomId,
    username: username || "",
    enabled: !!username,
  });

  const {
    isConnected,
    currentUser,
    users,
    strokes,
    cursors,
    sendCursorMove,
    startStroke,
    addStrokePoint,
    endStroke,
    clearCanvas,
    undo,
    redo,
    addLocalStroke,
    updateLocalStroke,
  } = username ? socketData : emptySocketReturn;

  useEffect(() => {
    if (!getRoomIdFromUrl()) {
      const url = new URL(window.location.href);
      url.searchParams.set("room", roomId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [roomId]);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const handleUsernameSubmit = useCallback((name: string) => {
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

  const handleCursorMove = useCallback(
    (position: Point | null, isDrawing: boolean) => {
      sendCursorMove(position, isDrawing);
    },
    [sendCursorMove]
  );

  if (!username) {
    return <UsernameDialog open={true} onSubmit={handleUsernameSubmit} />;
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="canvas-page">
      <RoomHeader roomId={roomId} isConnected={isConnected} />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar: Canva-inspired spacious width for comfortable controls */}
        <aside className="w-[88px] p-3 flex flex-col gap-3 bg-sidebar border-r border-sidebar-border overflow-y-auto shrink-0">
          <ToolPanel
            currentTool={currentTool}
            onToolChange={setCurrentTool}
            onUndo={undo}
            onRedo={redo}
            onClear={clearCanvas}
            canUndo={strokes.length > 0}
            canRedo={true}
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
        </aside>

        {/* Main canvas area: Canva-inspired spacious whiteboard with clean margins */}
        <main className="flex-1 p-3 md:p-5 lg:p-6 overflow-hidden bg-muted/30" ref={canvasContainerRef}>
          <div className="relative w-full h-full">
            <DrawingCanvas
              strokes={strokes}
              currentTool={currentTool}
              currentColor={currentColor}
              strokeWidth={strokeWidth}
              userId={currentUser?.id || ""}
              onStrokeStart={handleStrokeStart}
              onStrokePoint={handleStrokePoint}
              onStrokeEnd={handleStrokeEnd}
              onCursorMove={handleCursorMove}
              onLocalStrokeStart={addLocalStroke}
              onLocalStrokePoint={updateLocalStroke}
            />
            <CursorOverlay
              cursors={cursors}
              users={users}
              currentUserId={currentUser?.id || null}
              canvasRect={canvasRect}
            />
          </div>
        </main>

        {/* Right sidebar: hidden on mobile, toggle button shown instead */}
        <aside className="hidden md:flex w-48 lg:w-64 p-3 flex-col gap-3 bg-sidebar border-l border-sidebar-border shrink-0">
          <UserPresence
            users={users}
            currentUserId={currentUser?.id || null}
          />
        </aside>

        {/* Mobile: floating users button */}
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

        {/* Mobile: slide-in users panel */}
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
