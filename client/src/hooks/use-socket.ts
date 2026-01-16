import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Stroke, Point, User, CursorUpdate, DrawingTool, Shape } from "@shared/schema";

interface UseSocketOptions {
  roomId: string;
  username: string;
  enabled?: boolean;
}

interface UseSocketReturn {
  isConnected: boolean;
  currentUser: User | null;
  users: User[];
  strokes: Stroke[];
  shapes: Shape[];
  cursors: Map<string, CursorUpdate>;
  socket: ReturnType<typeof getSocket> | null;
  canUndo: boolean;
  canRedo: boolean;
  sendCursorMove: (position: Point | null, isDrawing: boolean) => void;
  startStroke: (stroke: Stroke) => void;
  addStrokePoint: (strokeId: string, point: Point) => void;
  endStroke: (strokeId: string) => void;
  addShape: (shape: Shape) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  addLocalStroke: (stroke: Stroke) => void;
  updateLocalStroke: (strokeId: string, point: Point) => void;
  addLocalShape: (shape: Shape) => void;
}

// Cursor debounce interval in ms (reduces socket traffic)
const CURSOR_DEBOUNCE_MS = 35;

export function useSocket({ roomId, username, enabled = true }: UseSocketOptions): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorUpdate>>(new Map());
  const [operationCount, setOperationCount] = useState(0);
  const [undoneCount, setUndoneCount] = useState(0);
  const strokesRef = useRef<Map<string, Stroke>>(new Map());
  const shapesRef = useRef<Map<string, Shape>>(new Map());
  
  // Cursor debounce state
  const lastCursorSendRef = useRef<number>(0);
  const pendingCursorRef = useRef<{ position: Point | null; isDrawing: boolean } | null>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !username) {
      return;
    }

    const socket = getSocket();

    // Called on initial connection AND on reconnection (Socket.io auto-reconnects)
    // Re-joining the room triggers canvas:state which re-syncs all strokes/shapes
    function onConnect() {
      setIsConnected(true);
      socket.emit("room:join", { roomId, username });
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    // Handle connection errors gracefully
    function onConnectError(error: Error) {
      console.warn("Socket connection error:", error.message);
      setIsConnected(false);
    }

    function onRoomJoined(joinedRoomId: string, socketUserId: string, userName: string, color: string) {
      if (joinedRoomId === roomId) {
        setCurrentUser({
          id: socketUserId,
          username: userName,
          color,
          cursorPosition: null,
          isDrawing: false,
        });
      }
    }

    function onUserList(userList: User[]) {
      setUsers(userList);
    }

    function onUserJoined(user: User) {
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    }

    function onUserLeft(userId: string) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setCursors((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    }

    function onCursorUpdate(update: CursorUpdate) {
      setCursors((prev) => {
        const next = new Map(prev);
        next.set(update.userId, update);
        return next;
      });
    }

    function onCanvasState(data: { strokes: Stroke[]; shapes: Shape[] }) {
      setStrokes(data.strokes);
      setShapes(data.shapes || []);
      strokesRef.current = new Map(data.strokes.map((s) => [s.id, s]));
      shapesRef.current = new Map((data.shapes || []).map((s) => [s.id, s]));
      setOperationCount(data.strokes.length + (data.shapes?.length || 0));
      setUndoneCount(0);
    }

    function onHistoryState(data: { operationCount: number; undoneCount: number }) {
      setOperationCount(data.operationCount);
      setUndoneCount(data.undoneCount);
    }

    function onStrokeStart(data: { stroke: Stroke; roomId: string }) {
      if (data.roomId === roomId) {
        strokesRef.current.set(data.stroke.id, { ...data.stroke });
        setStrokes(Array.from(strokesRef.current.values()));
      }
    }

    function onStrokePoint(data: { strokeId: string; point: Point; roomId: string }) {
      if (data.roomId === roomId) {
        const stroke = strokesRef.current.get(data.strokeId);
        if (stroke) {
          stroke.points = [...stroke.points, data.point];
          strokesRef.current.set(data.strokeId, stroke);
          setStrokes(Array.from(strokesRef.current.values()));
        }
      }
    }

    function onStrokeEnd(data: { strokeId: string; roomId: string }) {
      if (data.roomId === roomId) {
        setStrokes(Array.from(strokesRef.current.values()));
      }
    }

    function onShapeAdd(data: { shape: Shape; roomId: string }) {
      if (data.roomId === roomId) {
        shapesRef.current.set(data.shape.id, data.shape);
        setShapes(Array.from(shapesRef.current.values()));
      }
    }

    function onCanvasClear() {
      strokesRef.current.clear();
      shapesRef.current.clear();
      setStrokes([]);
      setShapes([]);
      setOperationCount(0);
      setUndoneCount(0);
    }

    function onOperationUndo(operation: { type: string; strokeId?: string; stroke?: Stroke; shape?: Shape }) {
      if (operation.type === "draw") {
        // Delete stroke if strokeId provided
        if (operation.strokeId) {
          strokesRef.current.delete(operation.strokeId);
          setStrokes(Array.from(strokesRef.current.values()));
        }
        // Delete shape if shape data provided (use shape.id for accurate removal)
        if (operation.shape) {
          shapesRef.current.delete(operation.shape.id);
          setShapes(Array.from(shapesRef.current.values()));
        }
        // Also try to delete from shapesRef by strokeId as fallback
        if (operation.strokeId && !operation.shape) {
          shapesRef.current.delete(operation.strokeId);
          setShapes(Array.from(shapesRef.current.values()));
        }
      } else if (operation.type === "erase") {
        // Restore erased stroke
        if (operation.stroke) {
          strokesRef.current.set(operation.stroke.id, operation.stroke);
          setStrokes(Array.from(strokesRef.current.values()));
        }
        // Restore erased shape
        if (operation.shape) {
          shapesRef.current.set(operation.shape.id, operation.shape);
          setShapes(Array.from(shapesRef.current.values()));
        }
      }
    }

    function onOperationRedo(operation: { type: string; strokeId?: string; stroke?: Stroke; shape?: Shape }) {
      if (operation.type === "draw") {
        if (operation.stroke) {
          strokesRef.current.set(operation.stroke.id, operation.stroke);
          setStrokes(Array.from(strokesRef.current.values()));
        }
        if (operation.shape) {
          shapesRef.current.set(operation.shape.id, operation.shape);
          setShapes(Array.from(shapesRef.current.values()));
        }
      } else if (operation.type === "erase") {
        // Re-erase stroke
        if (operation.strokeId) {
          strokesRef.current.delete(operation.strokeId);
          setStrokes(Array.from(strokesRef.current.values()));
        }
        // Re-erase shape
        if (operation.shape) {
          shapesRef.current.delete(operation.shape.id);
          setShapes(Array.from(shapesRef.current.values()));
        }
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("room:joined", onRoomJoined);
    socket.on("user:list", onUserList);
    socket.on("user:joined", onUserJoined);
    socket.on("user:left", onUserLeft);
    socket.on("cursor:update", onCursorUpdate);
    socket.on("canvas:state", onCanvasState);
    socket.on("history:state", onHistoryState);
    socket.on("stroke:start", onStrokeStart);
    socket.on("stroke:point", onStrokePoint);
    socket.on("stroke:end", onStrokeEnd);
    socket.on("shape:add", onShapeAdd);
    socket.on("canvas:clear", onCanvasClear);
    socket.on("operation:undo", onOperationUndo);
    socket.on("operation:redo", onOperationRedo);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:joined", onRoomJoined);
      socket.off("user:list", onUserList);
      socket.off("user:joined", onUserJoined);
      socket.off("user:left", onUserLeft);
      socket.off("cursor:update", onCursorUpdate);
      socket.off("canvas:state", onCanvasState);
      socket.off("history:state", onHistoryState);
      socket.off("stroke:start", onStrokeStart);
      socket.off("stroke:point", onStrokePoint);
      socket.off("stroke:end", onStrokeEnd);
      socket.off("shape:add", onShapeAdd);
      socket.off("canvas:clear", onCanvasClear);
      socket.off("operation:undo", onOperationUndo);
      socket.off("operation:redo", onOperationRedo);
      socket.emit("room:leave", roomId);
      
      // Cleanup cursor debounce timeout
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [roomId, username, enabled]);

  // Debounced cursor move - reduces socket traffic by ~60%
  const sendCursorMove = useCallback(
    (position: Point | null, isDrawing: boolean) => {
      const now = Date.now();
      const timeSinceLastSend = now - lastCursorSendRef.current;
      
      // Store latest cursor position
      pendingCursorRef.current = { position, isDrawing };
      
      // If enough time has passed, send immediately
      if (timeSinceLastSend >= CURSOR_DEBOUNCE_MS) {
        lastCursorSendRef.current = now;
        const socket = getSocket();
        socket.emit("cursor:move", { roomId, position, isDrawing });
        pendingCursorRef.current = null;
        
        // Clear any pending timeout
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
          cursorTimeoutRef.current = null;
        }
      } else if (!cursorTimeoutRef.current) {
        // Schedule a delayed send for the pending position
        cursorTimeoutRef.current = setTimeout(() => {
          if (pendingCursorRef.current) {
            lastCursorSendRef.current = Date.now();
            const socket = getSocket();
            socket.emit("cursor:move", { 
              roomId, 
              position: pendingCursorRef.current.position, 
              isDrawing: pendingCursorRef.current.isDrawing 
            });
            pendingCursorRef.current = null;
          }
          cursorTimeoutRef.current = null;
        }, CURSOR_DEBOUNCE_MS - timeSinceLastSend);
      }
    },
    [roomId]
  );

  const startStroke = useCallback(
    (stroke: Stroke) => {
      const socket = getSocket();
      socket.emit("stroke:start", { stroke, roomId });
    },
    [roomId]
  );

  const addStrokePoint = useCallback(
    (strokeId: string, point: Point) => {
      const socket = getSocket();
      socket.emit("stroke:point", { strokeId, point, roomId });
    },
    [roomId]
  );

  const endStroke = useCallback(
    (strokeId: string) => {
      const socket = getSocket();
      socket.emit("stroke:end", { strokeId, roomId });
    },
    [roomId]
  );

  const addShape = useCallback(
    (shape: Shape) => {
      const socket = getSocket();
      socket.emit("shape:add", { shape, roomId });
    },
    [roomId]
  );

  const clearCanvas = useCallback(() => {
    const socket = getSocket();
    socket.emit("canvas:clear", roomId);
  }, [roomId]);

  const undo = useCallback(() => {
    const socket = getSocket();
    socket.emit("operation:undo", roomId);
  }, [roomId]);

  const redo = useCallback(() => {
    const socket = getSocket();
    socket.emit("operation:redo", roomId);
  }, [roomId]);

  const addLocalStroke = useCallback((stroke: Stroke) => {
    strokesRef.current.set(stroke.id, { ...stroke });
    setStrokes(Array.from(strokesRef.current.values()));
  }, []);

  const updateLocalStroke = useCallback((strokeId: string, point: Point) => {
    const stroke = strokesRef.current.get(strokeId);
    if (stroke) {
      stroke.points = [...stroke.points, point];
      strokesRef.current.set(strokeId, stroke);
      setStrokes(Array.from(strokesRef.current.values()));
    }
  }, []);

  const addLocalShape = useCallback((shape: Shape) => {
    shapesRef.current.set(shape.id, shape);
    setShapes(Array.from(shapesRef.current.values()));
  }, []);

  return {
    isConnected,
    currentUser,
    users,
    strokes,
    shapes,
    cursors,
    socket: enabled && username ? getSocket() : null,
    canUndo: operationCount > 0,
    canRedo: undoneCount > 0,
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
  };
}
