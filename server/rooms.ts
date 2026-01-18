import type { Stroke, User, Operation } from "@shared/schema";
import { USER_COLORS } from "@shared/schema";
import { loadRoomState, saveRoomState, hasPersistedState } from "./persistence";

// Branded types for type safety
export type RoomId = string & { readonly __brand: 'RoomId' };
export type SocketUserId = string & { readonly __brand: 'SocketUserId' };
export type StrokeId = string & { readonly __brand: 'StrokeId' };

export interface Point {
  x: number;
  y: number;
}

export interface UserIdentifier {
  roomId: RoomId;
  socketUserId: SocketUserId;
}

export interface CursorUpdate {
  position: Point | null;
  isDrawing: boolean;
}

export interface Room {
  id: string;
  users: Map<string, User>;
  strokes: Map<string, Stroke>;
  operationHistory: Operation[];
  undoneOperations: Operation[];
  userColorIndex: number;
  restoredFromDisk?: boolean;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private roomCleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private roomCreationPromises: Map<string, Promise<Room>> = new Map();

  async getOrCreateRoom(roomId: RoomId): Promise<Room> {
    let room = this.rooms.get(roomId);
    if (room) {
      return room;
    }

    let creationPromise = this.roomCreationPromises.get(roomId);
    if (creationPromise) {
      return creationPromise;
    }

    // Prevent race conditions during async room creation
    creationPromise = (async () => {
      try {
        const existingRoom = this.rooms.get(roomId);
        if (existingRoom) {
          return existingRoom;
        }

        // Try to load persisted state
        const persistedState = await loadRoomState(roomId);

        let newRoom: Room;

        if (persistedState) {
          // Restore room from disk
          const strokesMap = new Map<string, Stroke>();
          for (const stroke of persistedState.strokes) {
            strokesMap.set(stroke.id, stroke);
          }

          newRoom = {
            id: roomId,
            users: new Map(),
            strokes: strokesMap,
            operationHistory: persistedState.operationHistory,
            undoneOperations: persistedState.undoneOperations,
            userColorIndex: 0,
            restoredFromDisk: true,
          };

          console.log(`[Room ${roomId}] Restored from persistence (${persistedState.strokes.length} strokes)`);
        } else {
          // Create fresh room
          newRoom = {
            id: roomId,
            users: new Map(),
            strokes: new Map(),
            operationHistory: [],
            undoneOperations: [],
            userColorIndex: 0,
            restoredFromDisk: false,
          };

          console.log(`[Room ${roomId}] Created fresh room`);
        }

        this.rooms.set(roomId, newRoom);
        return newRoom;
      } finally {
        // Clean up promise from map
        this.roomCreationPromises.delete(roomId);
      }
    })();

    this.roomCreationPromises.set(roomId, creationPromise);
    return creationPromise;
  }

  // Sync version - doesn't load persisted state
  getOrCreateRoomSync(roomId: RoomId): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        users: new Map(),
        strokes: new Map(),
        operationHistory: [],
        undoneOperations: [],
        userColorIndex: 0,
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  getRoom(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId: RoomId, socketUserId: SocketUserId, username: string): User {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found. Call getOrCreateRoom() first.`);
    }

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

  isValidRoomCode(roomId: string): roomId is RoomId {
    return /^[A-Z0-9]{6}$/.test(roomId);
  }

  private cancelRoomCleanupTimer(roomId: RoomId): void {
    const existingTimer = this.roomCleanupTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.roomCleanupTimers.delete(roomId);
    }
  }

  private scheduleRoomCleanup(roomId: RoomId): void {
    this.cancelRoomCleanupTimer(roomId);

    const timer = setTimeout(async () => {
      const room = this.rooms.get(roomId);
      if (room && room.users.size === 0) {
        await saveRoomState(room);
        this.rooms.delete(roomId);
        this.roomCleanupTimers.delete(roomId);
        console.log(`[Room ${roomId}] Saved and cleaned up after inactivity`);
      }
    }, 60000);

    this.roomCleanupTimers.set(roomId, timer);
  }

  private handleRoomEmptyState(roomId: RoomId, isEmpty: boolean): void {
    if (isEmpty) {
      this.scheduleRoomCleanup(roomId);
    } else {
      this.cancelRoomCleanupTimer(roomId);
      console.log(`[Room ${roomId}] Cleanup cancelled - users rejoined`);
    }
  }

  removeUserFromRoom(roomId: RoomId, socketUserId: SocketUserId): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.users.delete(socketUserId);
    this.handleRoomEmptyState(roomId, room.users.size === 0);
  }

  getUsersInRoom(roomId: RoomId): User[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.users.values());
  }

  updateUserCursor(
    identifier: UserIdentifier,
    cursor: CursorUpdate
  ): void {
    const room = this.rooms.get(identifier.roomId);
    if (!room) return;

    const user = room.users.get(identifier.socketUserId);
    if (user) {
      user.cursorPosition = cursor.position;
      user.isDrawing = cursor.isDrawing;
    }
  }

  addStroke(roomId: RoomId, stroke: Stroke): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.strokes.set(stroke.id, stroke);

    room.operationHistory.push({
      type: stroke.tool === "eraser" ? "erase" : "draw",
      strokeId: stroke.id,
      stroke: { ...stroke },
      userId: stroke.userId,
      timestamp: Date.now(),
    });

    room.undoneOperations = [];

    // Auto-save after stroke added
    this.persistRoom(roomId);
  }

  getStroke(roomId: RoomId, strokeId: StrokeId): Stroke | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return room.strokes.get(strokeId);
  }

  updateStroke(roomId: RoomId, strokeId: StrokeId, point: Point): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const stroke = room.strokes.get(strokeId);
    if (stroke) {
      stroke.points = [...stroke.points, point];
    }
  }

  finalizeStroke(roomId: RoomId, strokeId: StrokeId): Stroke | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const stroke = room.strokes.get(strokeId);
    if (stroke) {
      // Find the operation that contains this stroke
      // We look for both "draw" and "erase" operations now
      const operation = room.operationHistory.find((op) => {
        // Check single stroke (legacy or unbatched)
        if (op.strokeId === strokeId) return true;

        // Check batched strokes
        if (op.strokeIds && op.strokeIds.includes(strokeId)) return true;

        return false;
      });

      if (operation) {
        // Update single stroke field (legacy/compatibility)
        if (operation.strokeId === strokeId) {
          operation.stroke = { ...stroke };
        }

        // Update stroke in batched array
        if (operation.strokes) {
          const index = operation.strokes.findIndex(s => s.id === strokeId);
          if (index !== -1) {
            operation.strokes[index] = { ...stroke };
          }
        }
      }

      // Auto-save after stroke finalized
      this.persistRoom(roomId);
    }
    return stroke;
  }

  getStrokes(roomId: RoomId): Stroke[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.strokes.values());
  }

  clearCanvas(roomId: RoomId): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.strokes.clear();
    room.operationHistory = [];
    room.undoneOperations = [];

    // Auto-save after clear
    this.persistRoom(roomId);
  }

  restoreCanvas(roomId: RoomId, strokes: Stroke[]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.strokes.clear();
    room.operationHistory = [];
    room.undoneOperations = [];

    // Re-populate strokes and history
    for (const stroke of strokes) {
      room.strokes.set(stroke.id, stroke);
      room.operationHistory.push({
        type: stroke.tool === "eraser" ? "erase" : "draw",
        strokeId: stroke.id,
        stroke: { ...stroke },
        userId: stroke.userId,
        timestamp: stroke.timestamp || Date.now(),
      });
    }

    // Auto-save after restore
    this.persistRoom(roomId);
  }

  undo(roomId: RoomId): Operation | null {
    const room = this.rooms.get(roomId);
    if (!room || room.operationHistory.length === 0) return null;

    const lastOperation = room.operationHistory.pop()!;
    room.undoneOperations.push(lastOperation);

    if (lastOperation.type === "draw") {
      if (lastOperation.strokeId) {
        room.strokes.delete(lastOperation.strokeId);
      }
    } else if (lastOperation.type === "erase") {
      if (lastOperation.stroke) {
        room.strokes.set(lastOperation.stroke.id, lastOperation.stroke);
      }
    }

    // Auto-save after undo
    this.persistRoom(roomId);

    return lastOperation;
  }

  redo(roomId: RoomId): Operation | null {
    const room = this.rooms.get(roomId);
    if (!room || room.undoneOperations.length === 0) return null;

    const operation = room.undoneOperations.pop()!;
    room.operationHistory.push(operation);

    if (operation.type === "draw") {
      if (operation.stroke) {
        room.strokes.set(operation.stroke.id, operation.stroke);
      }
    } else if (operation.type === "erase") {
      if (operation.strokeId) {
        room.strokes.delete(operation.strokeId);
      }
    }

    // Auto-save after redo
    this.persistRoom(roomId);

    return operation;
  }

  getHistoryState(roomId: RoomId): { operationCount: number; undoneCount: number } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { operationCount: 0, undoneCount: 0 };
    }
    return {
      operationCount: room.operationHistory.length,
      undoneCount: room.undoneOperations.length,
    };
  }

  private persistRoom(roomId: RoomId): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    saveRoomState(room).catch((error) => {
      console.error(`Failed to persist room ${roomId}:`, error);
    });
  }

  hasPersistedState(roomId: RoomId): boolean {
    return hasPersistedState(roomId);
  }
}

export const roomManager = new RoomManager();
