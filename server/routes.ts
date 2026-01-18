import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { roomManager, type RoomId, type SocketUserId, type StrokeId, type Point as RoomPoint, type UserIdentifier, type CursorUpdate } from "./rooms";
import type { Stroke, Point } from "@shared/schema";

interface SocketState {
  currentRoomId: RoomId | null;
  currentUserId: SocketUserId | null;
}

function isUserAuthenticated(state: SocketState): boolean {
  return state.currentUserId !== null && state.currentRoomId !== null;
}

function isValidRoomRequest(state: SocketState, requestedRoomId: string): boolean {
  return state.currentRoomId !== null && requestedRoomId === state.currentRoomId;
}

function broadcastHistoryState(io: SocketIOServer, roomId: RoomId): void {
  const historyState = roomManager.getHistoryState(roomId);
  io.to(roomId).emit("history:state", historyState);
}

function handleRoomJoin(
  socket: Socket,
  io: SocketIOServer,
  state: SocketState,
  data: { roomId: string; username: string }
) {
  return async () => {
    const { roomId, username } = data;

    if (!roomManager.isValidRoomCode(roomId)) {
      socket.emit("error", "Invalid room code. Must be exactly 6 alphanumeric characters.");
      return;
    }

    // Leave previous room if exists
    if (state.currentRoomId) {
      socket.leave(state.currentRoomId);
      if (state.currentUserId) {
        roomManager.removeUserFromRoom(state.currentRoomId, state.currentUserId);
        socket.to(state.currentRoomId).emit("user:left", state.currentUserId);
      }
    }

    // Update state
    state.currentRoomId = roomId as RoomId;
    state.currentUserId = socket.id as SocketUserId;

    socket.join(roomId);

    // Load or create room (with persistence)
    const room = await roomManager.getOrCreateRoom(roomId as RoomId);

    const user = roomManager.addUserToRoom(
      roomId as RoomId,
      socket.id as SocketUserId,
      username
    );

    // Send initial state to joining user
    socket.emit("room:joined", roomId, user.id, user.username, user.color);
    socket.emit("user:list", roomManager.getUsersInRoom(roomId as RoomId));

    const strokes = roomManager.getStrokes(roomId as RoomId);
    socket.emit("canvas:state", { strokes });

    // Notify client if state was restored from disk
    if (room.restoredFromDisk && strokes.length > 0) {
      socket.emit("canvas:restored", { strokeCount: strokes.length });
    }

    const historyState = roomManager.getHistoryState(roomId as RoomId);
    socket.emit("history:state", historyState);

    // Notify other users
    socket.to(roomId).emit("user:joined", user);
  };
}

function handleRoomLeave(socket: Socket, state: SocketState, roomId: string) {
  return () => {
    if (state.currentRoomId === roomId && state.currentUserId) {
      socket.leave(roomId);
      roomManager.removeUserFromRoom(state.currentRoomId, state.currentUserId);
      socket.to(roomId).emit("user:left", state.currentUserId);
      state.currentRoomId = null;
      state.currentUserId = null;
    }
  };
}

function handleCursorMove(
  socket: Socket,
  state: SocketState,
  data: { roomId: string; position: Point | null; isDrawing: boolean }
) {
  return () => {
    // Validate user authentication and room
    if (!isUserAuthenticated(state) || !isValidRoomRequest(state, data.roomId)) {
      return;
    }

    const identifier: UserIdentifier = {
      roomId: state.currentRoomId!,
      socketUserId: state.currentUserId!,
    };
    const cursor: CursorUpdate = {
      position: data.position as RoomPoint | null,
      isDrawing: data.isDrawing,
    };

    roomManager.updateUserCursor(identifier, cursor);

    socket.to(state.currentRoomId!).emit("cursor:update", {
      userId: state.currentUserId,
      position: data.position,
      isDrawing: data.isDrawing,
    });
  };
}

function handleStrokeStart(
  socket: Socket,
  state: SocketState,
  data: { stroke: Stroke; roomId: string }
) {
  return () => {
    if (!state.currentRoomId || data.roomId !== state.currentRoomId) return;

    // Validate stroke ownership to prevent spoofing
    if (data.stroke.userId !== state.currentUserId) {
      console.warn(`[Security] User ${state.currentUserId} attempted to create stroke with spoofed userId ${data.stroke.userId}`);
      return;
    }

    roomManager.addStroke(state.currentRoomId, data.stroke);

    socket.to(state.currentRoomId).emit("stroke:start", {
      stroke: data.stroke,
      roomId: state.currentRoomId,
    });
  };
}

function handleStrokePoint(
  socket: Socket,
  state: SocketState,
  data: { strokeId: string; point: Point; roomId: string }
) {
  return () => {
    if (!state.currentRoomId || data.roomId !== state.currentRoomId) return;

    // Validate stroke ownership to prevent malicious modifications
    const stroke = roomManager.getStroke(
      state.currentRoomId,
      data.strokeId as StrokeId
    );
    if (!stroke || stroke.userId !== state.currentUserId) {
      console.warn(`[Security] User ${state.currentUserId} attempted to modify stroke ${data.strokeId} owned by ${stroke?.userId}`);
      return;
    }

    roomManager.updateStroke(
      state.currentRoomId,
      data.strokeId as StrokeId,
      data.point as RoomPoint
    );

    socket.to(state.currentRoomId).emit("stroke:point", {
      strokeId: data.strokeId,
      point: data.point,
      roomId: state.currentRoomId,
    });
  };
}

function handleStrokeEnd(
  socket: Socket,
  io: SocketIOServer,
  state: SocketState,
  data: { strokeId: string; roomId: string }
) {
  return () => {
    if (!isValidRoomRequest(state, data.roomId)) return;

    // Verify stroke ownership before finalizing
    const stroke = roomManager.getStroke(state.currentRoomId!, data.strokeId as StrokeId);
    if (!stroke || stroke.userId !== state.currentUserId) {
      console.warn(`Unauthorized stroke finalization attempt by user ${state.currentUserId} for stroke ${data.strokeId}`);
      return;
    }

    roomManager.finalizeStroke(state.currentRoomId!, data.strokeId as StrokeId);

    socket.to(state.currentRoomId!).emit("stroke:end", {
      strokeId: data.strokeId,
      roomId: state.currentRoomId,
    });

    broadcastHistoryState(io, state.currentRoomId!);
  };
}

interface RoomOperationConfig<T = void> {
  io: SocketIOServer;
  state: SocketState;
  roomId: string;
  operation: (roomId: RoomId) => T;
  onSuccess?: (io: SocketIOServer, roomId: RoomId, result: T) => void;
}

function createRoomOperationHandler<T = void>(config: RoomOperationConfig<T>) {
  return () => {
    if (!isValidRoomRequest(config.state, config.roomId)) return;

    const result = config.operation(config.state.currentRoomId!);

    if (config.onSuccess) {
      config.onSuccess(config.io, config.state.currentRoomId!, result);
    }

    broadcastHistoryState(config.io, config.state.currentRoomId!);
  };
}

function createHistoryOperationHandler(
  io: SocketIOServer,
  state: SocketState,
  roomId: string,
  operation: (roomId: RoomId) => any,
  eventName: "operation:undo" | "operation:redo"
) {
  return createRoomOperationHandler({
    io,
    state,
    roomId,
    operation,
    onSuccess: (io, roomId, result) => {
      if (result) {
        io.to(roomId).emit(eventName, result);
      }
    }
  });
}

function handleCanvasClear(
  socket: Socket,
  io: SocketIOServer,
  state: SocketState,
  roomId: string
) {
  return createRoomOperationHandler({
    io,
    state,
    roomId,
    operation: (roomId) => roomManager.clearCanvas(roomId),
    onSuccess: (io, roomId) => io.to(roomId).emit("canvas:clear")
  });
}

function handleCanvasRestore(
  socket: Socket,
  io: SocketIOServer,
  state: SocketState,
  data: { roomId: string; strokes: Stroke[] }
) {
  return () => {
    if (!isValidRoomRequest(state, data.roomId)) return;

    // Limit stroke count to prevent DoS
    const MAX_STROKES = 10000;
    if (!Array.isArray(data.strokes) || data.strokes.length > MAX_STROKES) {
      socket.emit("error", `Invalid stroke import: Exceeds limit of ${MAX_STROKES} strokes.`);
      return;
    }

    // Validate structure and types
    for (const stroke of data.strokes) {
      if (typeof stroke.id !== 'string' || typeof stroke.userId !== 'string') {
        socket.emit("error", "Invalid stroke data: ID and UserID must be strings.");
        return;
      }

      if (!Array.isArray(stroke.points)) {
        socket.emit("error", "Invalid stroke data: Points must be an array.");
        return;
      }

      if (stroke.points.length > 20000) { // Safety cap
        socket.emit("error", "Invalid stroke: Too many points in a single stroke.");
        return;
      }

      for (const point of stroke.points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          socket.emit("error", "Invalid stroke point: Coordinates must be finite numbers.");
          return;
        }
      }

      if (typeof stroke.width !== 'number' || stroke.width <= 0) {
        socket.emit("error", "Invalid stroke data: Width must be a positive number.");
        return;
      }
    }

    roomManager.restoreCanvas(state.currentRoomId!, data.strokes);

    // Broadcast full state update to ALL clients (including sender) to ensure consistency
    const strokes = roomManager.getStrokes(state.currentRoomId!);
    io.to(state.currentRoomId!).emit("canvas:state", { strokes });

    // Notify about restoration
    io.to(state.currentRoomId!).emit("canvas:restored", {
      strokeCount: strokes.length
    });

    broadcastHistoryState(io, state.currentRoomId!);
  };
}

function handleHistoryOperation(
  socket: Socket,
  io: SocketIOServer,
  state: SocketState,
  roomId: string,
  operationType: "undo" | "redo"
) {
  const operations = {
    undo: {
      execute: (roomId: RoomId) => roomManager.undo(roomId),
      eventName: "operation:undo" as const
    },
    redo: {
      execute: (roomId: RoomId) => roomManager.redo(roomId),
      eventName: "operation:redo" as const
    }
  };

  const { execute, eventName } = operations[operationType];

  return createHistoryOperationHandler(
    io,
    state,
    roomId,
    execute,
    eventName
  );
}

function handleDisconnect(socket: Socket, state: SocketState) {
  return () => {
    if (state.currentRoomId && state.currentUserId) {
      roomManager.removeUserFromRoom(state.currentRoomId, state.currentUserId);
      socket.to(state.currentRoomId).emit("user:left", state.currentUserId);
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    const state: SocketState = {
      currentRoomId: null,
      currentUserId: null,
    };

    // Register all event handlers with extracted functions
    socket.on("room:join", async (data) => {
      await handleRoomJoin(socket, io, state, data)();
    });

    socket.on("room:leave", (roomId) => {
      handleRoomLeave(socket, state, roomId)();
    });

    socket.on("cursor:move", (data) => {
      handleCursorMove(socket, state, data)();
    });

    socket.on("stroke:start", (data) => {
      handleStrokeStart(socket, state, data)();
    });

    socket.on("stroke:point", (data) => {
      handleStrokePoint(socket, state, data)();
    });

    socket.on("stroke:end", (data) => {
      handleStrokeEnd(socket, io, state, data)();
    });

    socket.on("canvas:clear", (roomId) => {
      handleCanvasClear(socket, io, state, roomId)();
    });

    socket.on("canvas:restore", (data) => {
      handleCanvasRestore(socket, io, state, data)();
    });

    socket.on("operation:undo", (roomId) => {
      handleHistoryOperation(socket, io, state, roomId, "undo")();
    });

    socket.on("operation:redo", (roomId) => {
      handleHistoryOperation(socket, io, state, roomId, "redo")();
    });

    // Latency measurement: Client sends ping with callback, server immediately invokes it
    // Round-trip time = time_after_callback - time_before_emit
    // Used by PerformanceMetrics component for network health monitoring
    socket.on("ping", (callback: () => void) => {
      if (typeof callback === "function") {
        callback();
      }
    });

    socket.on("disconnect", () => {
      handleDisconnect(socket, state)();
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return httpServer;
}
