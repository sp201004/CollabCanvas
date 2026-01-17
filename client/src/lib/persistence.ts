import type { Stroke, Operation } from "@shared/schema";

type RoomId = string;
type SerializedJson = string;

interface CanvasState {
  version: number;
  roomId: RoomId;
  strokes: Stroke[];
  operationHistory: Operation[];
  undoneOperations: Operation[];
  timestamp: number;
}

const STORAGE_VERSION = 1;
const STORAGE_KEY_PREFIX = "collabcanvas";

/**
 * Generates storage key for a specific room
 */
function getStorageKey(roomId: RoomId): string {
  return `${STORAGE_KEY_PREFIX}:${roomId}:state`;
}

const hasValidBasicStructure = (state: any): boolean => {
  return !!(
    state &&
    typeof state.version === "number" &&
    typeof state.roomId === "string" &&
    Array.isArray(state.strokes)
  );
};

const isValidStroke = (stroke: any): boolean => {
  return !!(
    stroke.id &&
    stroke.tool &&
    Array.isArray(stroke.points) &&
    typeof stroke.userId === "string"
  );
};

const isCorrectRoom = (state: CanvasState, expectedRoomId: RoomId): boolean => {
  return state.roomId === expectedRoomId;
};

const isCurrentVersion = (state: CanvasState): boolean => {
  return state.version === STORAGE_VERSION;
};

const validateStrokes = (strokes: Stroke[]): boolean => {
  return strokes.every(isValidStroke);
};

export function saveCanvasState(
  roomId: RoomId,
  strokes: Stroke[],
  operationHistory: Operation[] = [],
  undoneOperations: Operation[] = []
): boolean {
  try {
    const state: CanvasState = {
      version: STORAGE_VERSION,
      roomId,
      strokes,
      operationHistory,
      undoneOperations,
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(state);
    localStorage.setItem(getStorageKey(roomId), serialized);
    return true;
  } catch (error) {
    console.error("Failed to save canvas state:", error);
    return false;
  }
}

export function loadCanvasState(roomId: RoomId): CanvasState | null {
  try {
    const key = getStorageKey(roomId);
    const serialized = localStorage.getItem(key);

    if (!serialized) {
      return null;
    }

    const state = JSON.parse(serialized) as CanvasState;

    // Validate structure
    if (!hasValidBasicStructure(state)) {
      console.warn("Invalid canvas state structure, ignoring");
      return null;
    }

    // Validate room ID matches
    if (!isCorrectRoom(state, roomId)) {
      console.warn("Room ID mismatch in stored state");
      return null;
    }

    // Check version compatibility
    if (!isCurrentVersion(state)) {
      console.warn(`Canvas state version mismatch: ${state.version} vs ${STORAGE_VERSION}`);
      // Could add migration logic here in the future
    }

    return state;
  } catch (error) {
    console.error("Failed to load canvas state:", error);
    return null;
  }
}

/**
 * Clears saved canvas state for a room
 */
export function clearCanvasState(roomId: RoomId): void {
  try {
    localStorage.removeItem(getStorageKey(roomId));
  } catch (error) {
    console.error("Failed to clear canvas state:", error);
  }
}

export function exportCanvasToJSON(
  roomId: RoomId,
  strokes: Stroke[],
  operationHistory: Operation[] = [],
  undoneOperations: Operation[] = []
): SerializedJson {
  const state: CanvasState = {
    version: STORAGE_VERSION,
    roomId,
    strokes,
    operationHistory,
    undoneOperations,
    timestamp: Date.now(),
  };

  return JSON.stringify(state, null, 2);
}

export function importCanvasFromJSON(jsonString: SerializedJson): CanvasState | null {
  try {
    const state = JSON.parse(jsonString) as CanvasState;

    // Validate basic structure
    if (!hasValidBasicStructure(state)) {
      throw new Error("Invalid canvas state structure");
    }

    // Validate all strokes
    if (!validateStrokes(state.strokes)) {
      throw new Error("Invalid stroke structure in canvas data");
    }

    return state;
  } catch (error) {
    console.error("Failed to import canvas state:", error);
    return null;
  }
}

export function getStateAge(roomId: RoomId): number | null {
  const state = loadCanvasState(roomId);
  if (!state) return null;

  return Date.now() - state.timestamp;
}

export function hasState(roomId: RoomId): boolean {
  try {
    return localStorage.getItem(getStorageKey(roomId)) !== null;
  } catch {
    return false;
  }
}
