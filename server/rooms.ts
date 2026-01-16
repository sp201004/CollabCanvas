import type { Stroke, User, Operation, Shape } from "@shared/schema";
import { USER_COLORS } from "@shared/schema";

export interface Room {
  id: string;
  users: Map<string, User>;
  strokes: Map<string, Stroke>;
  shapes: Map<string, Shape>;
  operationHistory: Operation[];
  undoneOperations: Operation[];
  userColorIndex: number;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        users: new Map(),
        strokes: new Map(),
        shapes: new Map(),
        operationHistory: [],
        undoneOperations: [],
        userColorIndex: 0,
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  // Add a shape to the room
  addShape(roomId: string, shape: Shape): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.shapes.set(shape.id, shape);
    
    room.operationHistory.push({
      type: "draw",
      strokeId: shape.id,
      userId: shape.userId,
      timestamp: Date.now(),
    });
    
    room.undoneOperations = [];
  }

  getShapes(roomId: string): Shape[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.shapes.values());
  }

  deleteShape(roomId: string, shapeId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.shapes.delete(shapeId);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId: string, odifyUserId: string, username: string): User {
    const room = this.getOrCreateRoom(roomId);
    
    const color = USER_COLORS[room.userColorIndex % USER_COLORS.length];
    room.userColorIndex++;

    const user: User = {
      id: odifyUserId,
      username,
      color,
      cursorPosition: null,
      isDrawing: false,
    };

    room.users.set(odifyUserId, user);
    return user;
  }

  isValidRoomCode(roomId: string): boolean {
    return /^[A-Z0-9]{6}$/.test(roomId);
  }

  removeUserFromRoom(roomId: string, odifyUserId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(odifyUserId);
      
      if (room.users.size === 0) {
        setTimeout(() => {
          const currentRoom = this.rooms.get(roomId);
          if (currentRoom && currentRoom.users.size === 0) {
            this.rooms.delete(roomId);
          }
        }, 60000);
      }
    }
  }

  getUsersInRoom(roomId: string): User[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.users.values());
  }

  updateUserCursor(
    roomId: string,
    odifyUserId: string,
    position: { x: number; y: number } | null,
    isDrawing: boolean
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const user = room.users.get(odifyUserId);
    if (user) {
      user.cursorPosition = position;
      user.isDrawing = isDrawing;
    }
  }

  addStroke(roomId: string, stroke: Stroke): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.strokes.set(stroke.id, stroke);
    
    room.operationHistory.push({
      type: "draw",
      strokeId: stroke.id,
      stroke: { ...stroke },
      userId: stroke.userId,
      timestamp: Date.now(),
    });
    
    room.undoneOperations = [];
  }

  updateStroke(roomId: string, strokeId: string, point: { x: number; y: number }): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const stroke = room.strokes.get(strokeId);
    if (stroke) {
      stroke.points = [...stroke.points, point];
    }
  }

  finalizeStroke(roomId: string, strokeId: string): Stroke | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const stroke = room.strokes.get(strokeId);
    if (stroke) {
      const operation = room.operationHistory.find(
        (op) => op.strokeId === strokeId && op.type === "draw"
      );
      if (operation) {
        operation.stroke = { ...stroke };
      }
    }
    return stroke;
  }

  getStrokes(roomId: string): Stroke[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.strokes.values());
  }

  clearCanvas(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.strokes.clear();
    room.shapes.clear();
    room.operationHistory = [];
    room.undoneOperations = [];
  }

  undo(roomId: string): Operation | null {
    const room = this.rooms.get(roomId);
    if (!room || room.operationHistory.length === 0) return null;
    
    const lastOperation = room.operationHistory.pop()!;
    room.undoneOperations.push(lastOperation);
    
    if (lastOperation.type === "draw" && lastOperation.strokeId) {
      room.strokes.delete(lastOperation.strokeId);
    } else if (lastOperation.type === "erase" && lastOperation.stroke) {
      room.strokes.set(lastOperation.stroke.id, lastOperation.stroke);
    }
    
    return lastOperation;
  }

  redo(roomId: string): Operation | null {
    const room = this.rooms.get(roomId);
    if (!room || room.undoneOperations.length === 0) return null;
    
    const operation = room.undoneOperations.pop()!;
    room.operationHistory.push(operation);
    
    if (operation.type === "draw" && operation.stroke) {
      room.strokes.set(operation.stroke.id, operation.stroke);
    } else if (operation.type === "erase" && operation.strokeId) {
      room.strokes.delete(operation.strokeId);
    }
    
    return operation;
  }

  // Get current history state for syncing canUndo/canRedo to clients
  getHistoryState(roomId: string): { operationCount: number; undoneCount: number } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { operationCount: 0, undoneCount: 0 };
    }
    return {
      operationCount: room.operationHistory.length,
      undoneCount: room.undoneOperations.length,
    };
  }
}

export const roomManager = new RoomManager();
