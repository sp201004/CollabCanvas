import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { roomManager } from "./rooms";
import type { Stroke, Point, Shape } from "@shared/schema";

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
    let currentRoomId: string | null = null;
    let currentUserId: string | null = null;

    socket.on("room:join", (data: { roomId: string; username: string }) => {
      const { roomId, username } = data;
      
      if (currentRoomId) {
        socket.leave(currentRoomId);
        if (currentUserId) {
          roomManager.removeUserFromRoom(currentRoomId, currentUserId);
          socket.to(currentRoomId).emit("user:left", currentUserId);
        }
      }

      currentRoomId = roomId;
      currentUserId = socket.id;

      socket.join(roomId);
      
      const user = roomManager.addUserToRoom(roomId, socket.id, username);
      
      socket.emit("room:joined", roomId, user.id, user.username, user.color);
      
      const users = roomManager.getUsersInRoom(roomId);
      socket.emit("user:list", users);
      
      const strokes = roomManager.getStrokes(roomId);
      const shapes = roomManager.getShapes(roomId);
      socket.emit("canvas:state", { strokes, shapes });
      
      // Send history state so client knows if undo/redo is available
      const historyState = roomManager.getHistoryState(roomId);
      socket.emit("history:state", historyState);
      
      socket.to(roomId).emit("user:joined", user);
    });

    socket.on("room:leave", (roomId: string) => {
      if (currentRoomId === roomId && currentUserId) {
        socket.leave(roomId);
        roomManager.removeUserFromRoom(roomId, currentUserId);
        socket.to(roomId).emit("user:left", currentUserId);
        currentRoomId = null;
        currentUserId = null;
      }
    });

    socket.on("cursor:move", (data: { roomId: string; position: Point | null; isDrawing: boolean }) => {
      if (!currentUserId || !currentRoomId || data.roomId !== currentRoomId) return;
      
      roomManager.updateUserCursor(currentRoomId, currentUserId, data.position, data.isDrawing);
      
      socket.to(currentRoomId).emit("cursor:update", {
        userId: currentUserId,
        position: data.position,
        isDrawing: data.isDrawing,
      });
    });

    socket.on("stroke:start", (data: { stroke: Stroke; roomId: string }) => {
      if (!currentRoomId || data.roomId !== currentRoomId) return;
      
      roomManager.addStroke(currentRoomId, data.stroke);
      
      socket.to(currentRoomId).emit("stroke:start", { stroke: data.stroke, roomId: currentRoomId });
    });

    socket.on("stroke:point", (data: { strokeId: string; point: Point; roomId: string }) => {
      if (!currentRoomId || data.roomId !== currentRoomId) return;
      
      roomManager.updateStroke(currentRoomId, data.strokeId, data.point);
      
      socket.to(currentRoomId).emit("stroke:point", { strokeId: data.strokeId, point: data.point, roomId: currentRoomId });
    });

    socket.on("stroke:end", (data: { strokeId: string; roomId: string }) => {
      if (!currentRoomId || data.roomId !== currentRoomId) return;
      
      roomManager.finalizeStroke(currentRoomId, data.strokeId);
      
      socket.to(currentRoomId).emit("stroke:end", { strokeId: data.strokeId, roomId: currentRoomId });
      
      // Broadcast history state to ALL clients (including sender) so undo/redo buttons update
      const historyState = roomManager.getHistoryState(currentRoomId);
      io.to(currentRoomId).emit("history:state", historyState);
    });

    // Shape events for rectangle, circle, line, text tools
    socket.on("shape:add", (data: { shape: Shape; roomId: string }) => {
      if (!currentRoomId || data.roomId !== currentRoomId) return;
      
      roomManager.addShape(currentRoomId, data.shape);
      
      io.to(currentRoomId).emit("shape:add", { shape: data.shape, roomId: currentRoomId });
      
      const historyState = roomManager.getHistoryState(currentRoomId);
      io.to(currentRoomId).emit("history:state", historyState);
    });

    socket.on("canvas:clear", (roomId: string) => {
      if (!currentRoomId || roomId !== currentRoomId) return;
      
      roomManager.clearCanvas(currentRoomId);
      
      io.to(currentRoomId).emit("canvas:clear");
      // Broadcast updated history state (now empty)
      const historyState = roomManager.getHistoryState(currentRoomId);
      io.to(currentRoomId).emit("history:state", historyState);
    });

    socket.on("operation:undo", (roomId: string) => {
      if (!currentRoomId || roomId !== currentRoomId) return;
      
      const operation = roomManager.undo(currentRoomId);
      if (operation) {
        io.to(currentRoomId).emit("operation:undo", operation);
        // Broadcast updated history state
        const historyState = roomManager.getHistoryState(currentRoomId);
        io.to(currentRoomId).emit("history:state", historyState);
      }
    });

    socket.on("operation:redo", (roomId: string) => {
      if (!currentRoomId || roomId !== currentRoomId) return;
      
      const operation = roomManager.redo(currentRoomId);
      if (operation) {
        io.to(currentRoomId).emit("operation:redo", operation);
        // Broadcast updated history state
        const historyState = roomManager.getHistoryState(currentRoomId);
        io.to(currentRoomId).emit("history:state", historyState);
      }
    });

    // Ping handler for latency measurement - responds immediately with callback
    socket.on("ping", (callback: () => void) => {
      if (typeof callback === "function") {
        callback();
      }
    });

    socket.on("disconnect", () => {
      if (currentRoomId && currentUserId) {
        roomManager.removeUserFromRoom(currentRoomId, currentUserId);
        socket.to(currentRoomId).emit("user:left", currentUserId);
      }
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return httpServer;
}
