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
      shape: { ...shape },
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

  // Erase a shape with proper operation history (supports undo/redo)
  eraseShape(roomId: string, shapeId: string, userId: string): Shape | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const shape = room.shapes.get(shapeId);
    if (!shape) return null;
    
    // Remove shape from current state
    room.shapes.delete(shapeId);
    
    // Add erase operation to history with the shape data for undo
    room.operationHistory.push({
      type: "erase",
      strokeId: shapeId,
      shape: { ...shape },
      userId,
      timestamp: Date.now(),
    });
    
    // Clear undone operations (new action invalidates redo stack)
    room.undoneOperations = [];
    
    return shape;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId: string, socketUserId: string, username: string): User {
    const room = this.getOrCreateRoom(roomId);
    
    const color = USER_COLORS[room.userColorIndex % USER_COLORS.length];
    room.userColorIndex++;

    const user: User = {
      id: socketUserId,
      username,
      color,
      cursorPosition: null,
      isDrawing: false,
    };

    room.users.set(socketUserId, user);
    return user;
  }

  isValidRoomCode(roomId: string): boolean {
    return /^[A-Z0-9]{6}$/.test(roomId);
  }

  removeUserFromRoom(roomId: string, socketUserId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(socketUserId);
      
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
    socketUserId: string,
    position: { x: number; y: number } | null,
    isDrawing: boolean
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const user = room.users.get(socketUserId);
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
    
    if (lastOperation.type === "draw") {
      // Delete stroke if present
      if (lastOperation.strokeId && room.strokes.has(lastOperation.strokeId)) {
        room.strokes.delete(lastOperation.strokeId);
      }
      // Delete shape if present (shapes are stored with their id as key)
      if (lastOperation.shape) {
        room.shapes.delete(lastOperation.shape.id);
      } else if (lastOperation.strokeId) {
        // Fallback: try to delete from shapes by strokeId
        room.shapes.delete(lastOperation.strokeId);
      }
    } else if (lastOperation.type === "erase") {
      // Restore erased stroke
      if (lastOperation.stroke) {
        room.strokes.set(lastOperation.stroke.id, lastOperation.stroke);
      }
      // Restore erased shape
      if (lastOperation.shape) {
        room.shapes.set(lastOperation.shape.id, lastOperation.shape);
      }
    }
    
    return lastOperation;
  }

  redo(roomId: string): Operation | null {
    const room = this.rooms.get(roomId);
    if (!room || room.undoneOperations.length === 0) return null;
    
    const operation = room.undoneOperations.pop()!;
    room.operationHistory.push(operation);
    
    if (operation.type === "draw") {
      // Restore stroke if present
      if (operation.stroke) {
        room.strokes.set(operation.stroke.id, operation.stroke);
      }
      // Restore shape if present
      if (operation.shape) {
        room.shapes.set(operation.shape.id, operation.shape);
      }
    } else if (operation.type === "erase") {
      // Re-erase stroke
      if (operation.strokeId && room.strokes.has(operation.strokeId)) {
        room.strokes.delete(operation.strokeId);
      }
      // Re-erase shape
      if (operation.shape) {
        room.shapes.delete(operation.shape.id);
      }
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
