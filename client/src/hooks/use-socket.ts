import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Stroke, Point, User, CursorUpdate } from "@shared/schema";

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
  cursors: Map<string, CursorUpdate>;
  socket: ReturnType<typeof getSocket> | null;
  canUndo: boolean;
  canRedo: boolean;
  sendCursorMove: (position: Point | null, isDrawing: boolean) => void;
  startStroke: (stroke: Stroke) => void;
  addStrokePoint: (strokeId: string, point: Point) => void;
  endStroke: (strokeId: string) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  addLocalStroke: (stroke: Stroke) => void;
  updateLocalStroke: (strokeId: string, point: Point) => void;
}

const CURSOR_DEBOUNCE_MS = 35;

export function useSocket({ roomId, username, enabled = true }: UseSocketOptions): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorUpdate>>(new Map());
  const [operationCount, setOperationCount] = useState(0);
  const [undoneCount, setUndoneCount] = useState(0);
  const strokesRef = useRef<Map<string, Stroke>>(new Map());
  
  const lastCursorSendRef = useRef<number>(0);
  const pendingCursorRef = useRef<{ position: Point | null; isDrawing: boolean } | null>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !username) {
      return;
    }

    const socket = getSocket();

    function onConnect() {
      setIsConnected(true);
      socket.emit("room:join", { roomId, username });
    }

    function onDisconnect() {
      setIsConnected(false);
    }

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

    function onCanvasState(data: { strokes: Stroke[] }) {
      setStrokes(data.strokes);
      strokesRef.current = new Map(data.strokes.map((s) => [s.id, s]));
      setOperationCount(data.strokes.length);
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

    function onCanvasClear() {
      strokesRef.current.clear();
      setStrokes([]);
      setOperationCount(0);
      setUndoneCount(0);
    }

    function onOperationUndo(operation: { type: string; strokeId?: string; stroke?: Stroke }) {
      if (operation.type === "draw") {
        if (operation.strokeId) {
          strokesRef.current.delete(operation.strokeId);
          setStrokes(Array.from(strokesRef.current.values()));
        }
      } else if (operation.type === "erase") {
        if (operation.stroke) {
          strokesRef.current.set(operation.stroke.id, operation.stroke);
          setStrokes(Array.from(strokesRef.current.values()));
        }
      }
    }

    function onOperationRedo(operation: { type: string; strokeId?: string; stroke?: Stroke }) {
      if (operation.type === "draw") {
        if (operation.stroke) {
          strokesRef.current.set(operation.stroke.id, operation.stroke);
          setStrokes(Array.from(strokesRef.current.values()));
        }
      } else if (operation.type === "erase") {
        if (operation.strokeId) {
          strokesRef.current.delete(operation.strokeId);
          setStrokes(Array.from(strokesRef.current.values()));
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
      socket.off("canvas:clear", onCanvasClear);
      socket.off("operation:undo", onOperationUndo);
      socket.off("operation:redo", onOperationRedo);
      socket.emit("room:leave", roomId);
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [roomId, username, enabled]);

  const sendCursorMove = useCallback(
    (position: Point | null, isDrawing: boolean) => {
      const now = Date.now();
      const timeSinceLastSend = now - lastCursorSendRef.current;
      
      pendingCursorRef.current = { position, isDrawing };
      
      if (timeSinceLastSend >= CURSOR_DEBOUNCE_MS) {
        lastCursorSendRef.current = now;
        const socket = getSocket();
        socket.emit("cursor:move", { roomId, position, isDrawing });
        pendingCursorRef.current = null;
        
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
          cursorTimeoutRef.current = null;
        }
      } else if (!cursorTimeoutRef.current) {
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

  return {
    isConnected,
    currentUser,
    users,
    strokes,
    cursors,
    socket: enabled && username ? getSocket() : null,
    canUndo: operationCount > 0,
    canRedo: undoneCount > 0,
    sendCursorMove,
    startStroke,
    addStrokePoint,
    endStroke,
    clearCanvas,
    undo,
    redo,
    addLocalStroke,
    updateLocalStroke,
  };
}
