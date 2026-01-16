import { io, Socket } from "socket.io-client";
import type { Stroke, Point, User, CursorUpdate, StrokeData, StrokePoint, Operation, Shape } from "@shared/schema";

type ServerToClientEvents = {
  "user:joined": (user: User) => void;
  "user:left": (userId: string) => void;
  "user:list": (users: User[]) => void;
  "cursor:update": (update: CursorUpdate) => void;
  "stroke:start": (data: StrokeData) => void;
  "stroke:point": (data: StrokePoint) => void;
  "stroke:end": (data: { strokeId: string; roomId: string }) => void;
  "canvas:state": (data: { strokes: Stroke[]; shapes: Shape[] }) => void;
  "canvas:clear": () => void;
  "operation:undo": (operation: Operation) => void;
  "operation:redo": (operation: Operation) => void;
  "room:joined": (roomId: string, userId: string, username: string, color: string) => void;
  "history:state": (data: { operationCount: number; undoneCount: number }) => void;
  "shape:add": (data: { shape: Shape; roomId: string }) => void;
  "error": (message: string) => void;
};

type ClientToServerEvents = {
  "room:join": (data: { roomId: string; username: string }) => void;
  "room:leave": (roomId: string) => void;
  "cursor:move": (data: { roomId: string; position: Point | null; isDrawing: boolean }) => void;
  "stroke:start": (data: StrokeData) => void;
  "stroke:point": (data: StrokePoint) => void;
  "stroke:end": (data: { strokeId: string; roomId: string }) => void;
  "canvas:clear": (roomId: string) => void;
  "operation:undo": (roomId: string) => void;
  "operation:redo": (roomId: string) => void;
  "shape:add": (data: { shape: Shape; roomId: string }) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
