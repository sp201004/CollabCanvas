import * as fs from "fs";
import * as path from "path";
import type { Room } from "./rooms";
import type { Stroke, Operation } from "@shared/schema";

interface PersistedRoomState {
  version: number;
  roomId: string;
  strokes: Stroke[];
  operationHistory: Operation[];
  undoneOperations: Operation[];
  timestamp: number;
}

const STORAGE_VERSION = 1;
const STORAGE_DIR = path.join(process.cwd(), ".canvas-data");

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function getRoomFilePath(roomId: string): string {
  return path.join(STORAGE_DIR, `${roomId}.json`);
}

export async function saveRoomState(room: Room): Promise<boolean> {
  try {
    ensureStorageDir();

    const state: PersistedRoomState = {
      version: STORAGE_VERSION,
      roomId: room.id,
      strokes: Array.from(room.strokes.values()),
      operationHistory: room.operationHistory,
      undoneOperations: room.undoneOperations,
      timestamp: Date.now(),
    };

    const filePath = getRoomFilePath(room.id);
    await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");

    return true;
  } catch (error) {
    console.error(`Failed to save room state for ${room.id}:`, error);
    return false;
  }
}

const hasValidRoomStructure = (state: any, expectedRoomId: string): boolean => {
  return !!(
    state &&
    typeof state.version === "number" &&
    state.roomId === expectedRoomId &&
    Array.isArray(state.strokes) &&
    Array.isArray(state.operationHistory)
  );
};

const isCurrentStorageVersion = (state: PersistedRoomState): boolean => {
  return state.version === STORAGE_VERSION;
};

const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

export async function loadRoomState(roomId: string): Promise<PersistedRoomState | null> {
  try {
    const filePath = getRoomFilePath(roomId);

    // Early return: No saved state exists
    if (!fileExists(filePath)) {
      return null;
    }

    const data = await fs.promises.readFile(filePath, "utf-8");
    const state = JSON.parse(data) as PersistedRoomState;

    // Validate structure
    if (!hasValidRoomStructure(state, roomId)) {
      console.warn(`Invalid room state structure for ${roomId}, ignoring`);
      return null;
    }

    // Check version compatibility
    if (!isCurrentStorageVersion(state)) {
      console.warn(`Room state version mismatch for ${roomId}: ${state.version} vs ${STORAGE_VERSION}`);
      // Could add migration logic here
    }

    return state;
  } catch (error) {
    console.error(`Failed to load room state for ${roomId}:`, error);
    return null;
  }
}

/**
 * Deletes persisted room state
 */
export async function deleteRoomState(roomId: string): Promise<boolean> {
  try {
    const filePath = getRoomFilePath(roomId);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    return true;
  } catch (error) {
    console.error(`Failed to delete room state for ${roomId}:`, error);
    return false;
  }
}

export function hasPersistedState(roomId: string): boolean {
  try {
    return fs.existsSync(getRoomFilePath(roomId));
  } catch {
    return false;
  }
}

export async function listPersistedRooms(): Promise<string[]> {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      return [];
    }

    const files = await fs.promises.readdir(STORAGE_DIR);
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""));
  } catch (error) {
    console.error("Failed to list persisted rooms:", error);
    return [];
  }
}

export async function cleanupOldStates(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      return 0;
    }

    const files = await fs.promises.readdir(STORAGE_DIR);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(STORAGE_DIR, file);
      const stats = await fs.promises.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Failed to cleanup old states:", error);
    return 0;
  }
}
