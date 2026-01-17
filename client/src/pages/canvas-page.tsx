import { useState, useEffect, useRef, useCallback } from "react";
import { Users } from "lucide-react";
import { DrawingCanvas } from "@/components/drawing-canvas";
import { ToolPanel } from "@/components/tool-panel";
import { UserPresence } from "@/components/user-presence";
import { CursorOverlay } from "@/components/cursor-overlay";
import { RoomHeader } from "@/components/room-header";
import { UsernameDialog } from "@/components/username-dialog";
import { ToolSettingsBar } from "@/components/tool-settings-bar";
import { useSocket } from "@/hooks/use-socket";
import { exportCanvasToJSON, importCanvasFromJSON } from "@/lib/persistence";
import { useToast } from "@/hooks/use-toast";
import type { DrawingTool, Point, Stroke, User, CursorUpdate } from "@shared/schema";

function getRoomIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "";
}

// Room codes are exactly 6 uppercase alphanumeric characters
// This prevents injection attacks and keeps URLs clean and shareable
// Example valid codes: ABC123, X9Y2Z1, ROOM01
const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;

function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code.toUpperCase());
}

function getStoredUsername(): string | null {
  return sessionStorage.getItem("canvas_username");
}

// Fallback object when socket is not initialized yet
// Prevents null pointer errors during initial render
// All functions are no-ops until real socket connection established
const emptySocketReturn = {
  isConnected: false,
  isLoading: false,
  isReconnecting: false,
  currentUser: null,
  users: [] as User[],
  strokes: [] as Stroke[],
  cursors: new Map<string, CursorUpdate>(),
  socket: null,
  canUndo: false,
  canRedo: false,
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
  const { toast } = useToast();
  const [username, setUsername] = useState<string | null>(() => getStoredUsername());
  const [roomId, setRoomId] = useState<string>(() => getRoomIdFromUrl());
  const [currentTool, setCurrentTool] = useState<DrawingTool>("brush");
  const [currentColor, setCurrentColor] = useState("#1F2937");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  
  const [zoom, setZoom] = useState(1);
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const isRoomValid = isValidRoomCode(roomId);

  const socketData = useSocket({
    roomId: roomId.toUpperCase(),
    username: username || "",
    enabled: !!username && isRoomValid,
  });

  const {
    isConnected,
    isLoading,
    isReconnecting,
    currentUser,
    users,
    strokes,
    cursors,
    socket,
    canUndo,
    canRedo,
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

  // Keyboard shortcuts for tool selection
  const toolKeyMap: Record<string, DrawingTool> = {
    'b': 'brush', 'B': 'brush',
    'e': 'eraser', 'E': 'eraser',
    'r': 'rectangle', 'R': 'rectangle',
    'c': 'circle', 'C': 'circle',
    'l': 'line', 'L': 'line',
    't': 'text', 'T': 'text',
  };

  const isUndoShortcut = (e: KeyboardEvent): boolean => {
    return (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
  };

  const isRedoShortcut = (e: KeyboardEvent): boolean => {
    const key = e.key.toLowerCase();
    return (e.ctrlKey || e.metaKey) && (key === 'y' || (e.shiftKey && key === 'z'));
  };

  const handleZoomShortcut = (key: string): void => {
    if (key === '+' || key === '=') {
      setZoom(z => Math.min(5, z * 1.1));
    } else if (key === '-') {
      setZoom(z => Math.max(0.1, z * 0.9));
    } else if (key === '0') {
      setZoom(1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Tool selection shortcuts (B, E, R, C, L, T)
      if (e.key in toolKeyMap) {
        setCurrentTool(toolKeyMap[e.key]);
        return;
      }

      // Undo shortcut (Ctrl/Cmd + Z)
      if (isUndoShortcut(e)) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo shortcut (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z)
      if (isRedoShortcut(e)) {
        e.preventDefault();
        redo();
        return;
      }

      // Zoom shortcuts (+, -, 0)
      handleZoomShortcut(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, setCurrentTool, setZoom]);

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
  }, []);

  const handleToolChange = useCallback((tool: DrawingTool) => {
    setCurrentTool(tool);
  }, []);

  const handleExportCanvas = useCallback(() => {
    try {
      const json = exportCanvasToJSON(roomId, strokes);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-${roomId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Canvas Exported",
        description: "Your drawing has been saved as a JSON file.",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export canvas. Please try again.",
        variant: "destructive",
      });
    }
  }, [roomId, strokes, toast]);

  const handleImportCanvas = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const imported = importCanvasFromJSON(json);

        if (!imported) {
          throw new Error("Invalid canvas file");
        }

        // Clear existing canvas and wait for it to complete
        clearCanvas();

        // Use requestAnimationFrame to ensure canvas is cleared before adding strokes
        requestAnimationFrame(() => {
          // Add all imported strokes
          for (const stroke of imported.strokes) {
            addLocalStroke(stroke);
            startStroke(stroke);
            endStroke(stroke.id);
          }

          toast({
            title: "Canvas Imported",
            description: `Loaded ${imported.strokes.length} drawing${imported.strokes.length !== 1 ? 's' : ''}.`,
          });
        });
      } catch (error) {
        console.error("Import failed:", error);
        toast({
          title: "Import Failed",
          description: "Invalid canvas file format. Please select a valid JSON export.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);

    if (e.target) e.target.value = '';
  }, [clearCanvas, addLocalStroke, startStroke, endStroke, toast]);

  if (!username) {
    return <UsernameDialog open={true} onSubmit={handleUsernameSubmit} />;
  }

  // Show loading state while joining room and fetching canvas state
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <RoomHeader roomId={roomId} isConnected={isConnected} isReconnecting={isReconnecting} socket={socket} strokeCount={strokes.length} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-lg font-medium text-foreground">Loading canvas...</p>
              <p className="text-sm text-muted-foreground">Syncing with room {roomId}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="canvas-page">
      {/* Room header with integrated performance metrics (FPS, latency, stroke count) */}
      <RoomHeader roomId={roomId} isConnected={isConnected} isReconnecting={isReconnecting} socket={socket} strokeCount={strokes.length} />
      <ToolSettingsBar
        currentTool={currentTool}
        strokeWidth={strokeWidth}
        currentColor={currentColor}
        zoom={zoom}
        onStrokeWidthChange={setStrokeWidth}
        onColorChange={setCurrentColor}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleResetView}
        onZoomChange={setZoom}
        onExport={handleExportCanvas}
        onImport={() => importInputRef.current?.click()}
      />
      
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportCanvas}
        className="hidden"
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-[88px] p-3 flex flex-col gap-3 bg-sidebar border-r border-sidebar-border overflow-y-auto shrink-0">
          <ToolPanel
            currentTool={currentTool}
            onToolChange={handleToolChange}
            onUndo={undo}
            onRedo={redo}
            onClear={clearCanvas}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </aside>

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
              zoom={zoom}
              onZoomChange={setZoom}
            />
            <CursorOverlay
              cursors={cursors}
              users={users}
              currentUserId={currentUser?.id || null}
              canvasRect={canvasRect}
              zoom={zoom}
            />
          </div>
        </main>

        <aside className="hidden md:flex w-48 lg:w-64 p-3 flex-col gap-3 bg-sidebar border-l border-sidebar-border shrink-0">
          <UserPresence
            users={users}
            currentUserId={currentUser?.id || null}
          />
        </aside>

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
