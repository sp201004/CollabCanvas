# 3-CollabCanvas - BACKEND - Server Architecture

## 1. Scope & Responsibility

**Covered Files:**
- `server/index.ts` (130 lines) - Express + Socket.io server initialization
- `server/routes.ts` (182 lines) - WebSocket event handlers
- `server/rooms.ts` (376 lines) - Room management, undo/redo, state ownership
- `server/persistence.ts` (182 lines) - File-based canvas state persistence
- `server/static.ts` - Production static file serving
- `server/vite.ts` - Development Vite middleware

**Why This Part Exists:**
This is the **authoritative server** that:
1. Manages all room state (users, strokes, operation history)
2. Handles WebSocket connections and real-time synchronization
3. Implements global undo/redo across all users
4. Validates and broadcasts drawing operations
5. Persists canvas state to disk for recovery
6. Prevents malicious modifications through ownership validation

---

## 2. Architecture Role

**Server Responsibility Model:**
```
Client                         Server (Authoritative)
  ↓                               ↓
Optimistic UI                  Validation Layer
  ↓                               ↓
WebSocket emit ────────────→ Event handlers (routes.ts)
                                  ↓
                            Room Manager (rooms.ts)
                                  ↓
                            In-memory state (Map)
                                  ↓
                            Persistence (persistence.ts)
                                  ↓
                            File system (.canvas-data/)
                                  ↓
                            Broadcast to all clients ←────┐
                                                          │
Client receives update ───────────────────────────────────┘
```

**Why server-authoritative:**
- Single source of truth prevents sync bugs
- Server can validate operations (prevent cheating/spoofing)
- Undo/redo works globally across all users
- Easier conflict resolution

**Dependencies:**
- **Express.js**: HTTP server for API + static files
- **Socket.io**: WebSocket server for real-time events
- **Node.js fs**: File-based persistence
- **TypeScript**: Type safety on events and data structures

---

## 3. Code Walkthrough (Deep Dive)

### 3.1 Server Initialization (`server/index.ts`)

**File**: `server/index.ts`
**Role**: Entry point. Bridges the raw Node.js `http` server with Express logic and Socket.io.

#### 3.1.1 Middleware & Setup
```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
```

- **Explicit HTTP Server**: We create `httpServer` explicitly instead of using `app.listen()` because Socket.io needs access to the underlying HTTP server instance to attach its "Upgrade" listeners (switching protocols from HTTP to WebSocket).
- **JSON Middleware**: `app.use(express.json())` enables standard body parsing for API routes.

#### 3.1.2 Custom Logging Middleware
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  // ... monkey-patch res.json to capture response body ...
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});
```
- **Why custom?**: Allows us to see exact API performance (`in 15ms`) and capture response bodies for debugging, which standard loggers like `morgan` don't make easy.

#### 3.1.3 Port Selection Strategy
```typescript
const startServer = (port: number) => {
  httpServer.listen(port, "0.0.0.0").once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log(`Port ${port} is in use, finding a free port...`);
      startServer(0); // Retry with port 0 (OS random assignment)
    }
  });
};
```
- **Robustness**: Attempts to bind to port 5000 (or `PORT` env var).
- **Fallback**: If 5000 is busy (`EADDRINUSE`), it falls back to port `0`, letting the OS assign a random free port. This prevents "Port already in use" crashes during development loops.

---

### 3.2 WebSocket Event Handlers (`server/routes.ts`)

**File**: `server/routes.ts`
**Role**: Maps network events (`stroke:start`) to business logic (`roomManager`). Separates transport layer from domain logic.

#### 3.2.1 Handler Factory Pattern
We use **Higher-Order Functions** (Currying) to inject dependencies:
```typescript
function handleRoomJoin(io: Server, socket: Socket) {
  return async (data: { roomId: string; username: string }) => {
    // ... logic ...
  };
}
```
- **Benefit**: Keeps route definitions clean (`socket.on('room:join', handleRoomJoin(io, socket))`) while giving handlers access to the global `io` instance and socket-specific closures.

#### 3.2.2 Room Join & Initial Sync
```typescript
socket.on("room:join", async (data) => {
  // 1. Validation & Cleanup
  if (!roomManager.isValidRoomCode(data.roomId)) return;
  if (currentRoomId) socket.leave(currentRoomId);
  
  // 2. Join Socket.io Room
  socket.join(data.roomId);
  
  // 3. Load State (Async - may hit disk)
  const room = await roomManager.getOrCreateRoom(data.roomId);
  
  // 4. Send State to NEW User
  socket.emit("room:joined", ...);
  socket.emit("canvas:state", { strokes: room.strokes });      // All strokes
  socket.emit("history:state", roomManager.getHistoryState()); // Undo/Redo stack
  
  // 5. Notify OTHERS
  socket.to(data.roomId).emit("user:joined", user);
});
```
- **Sequence Matters**: The new user gets the full state *before* others are notified, ensuring they are ready to receive real-time updates.
- **`await getOrCreateRoom`**: Critical for race condition prevention (see Room Management).

#### 3.2.3 Stroke Handling (Security)
```typescript
socket.on("stroke:start", (data) => {
  // Security Check: Verify user owns the strokes
  if (data.stroke.userId !== currentUserId) {
    console.warn("Spoofing attempt detected");
    return;
  }
  
  roomManager.addStroke(currentRoomId, data.stroke);
  
  // Broadcast to OTHERS (excluding sender)
  socket.to(currentRoomId).emit("stroke:start", data);
});
```
- **Broadcasting**: Uses `socket.to(roomId)` instead of `io.to(roomId)`. The sender already has the stroke locally (Optimistic UI), so echoing it back would cause duplication/flicker.
- **Spoofing Check**: A malicious client could send a `stroke.userId` belonging to someone else. The server validates that the socket's internal `currentUserId` matches the packet data.

---

### 3.3 Room Management (`server/rooms.ts`)

**File**: `server/rooms.ts`
**Role**: The core business logic. Manages in-memory state, conflict resolution, and persistence coordination.

#### 3.3.1 Data Structures
```typescript
class RoomManager {
  // Map for O(1) Access - Critical for performance
  private rooms: Map<string, Room> = new Map();
  // Locking mechanism for async creation
  private roomCreationPromises: Map<string, Promise<Room>> = new Map();
}

interface Room {
  strokes: Map<string, Stroke>; // O(1) lookup
  operationHistory: Operation[]; // Linear undo stack
  undoneOperations: Operation[]; // Linear redo stack
}
```
- **Map vs Array**: Storing strokes in a `Map` allows instant access by ID (`O(1)`). An Array would require `O(N)` scans for every update, which would kill performance with 1000+ strokes.

#### 3.3.2 Race Condition Prevention (The Locking Pattern)
**The Problem**: Two users join a non-existent room simultaneously. Both trigger `loadRoomState` (slow file I/O). Both finish and overwrite each other, creating two split-brain instances.
**The Fix**:
```typescript
async getOrCreateRoom(roomId: string): Promise<Room> {
  // 1. Check existing
  if (this.rooms.has(roomId)) return this.rooms.get(roomId)!;
  
  // 2. Check pending promise (LOCK)
  if (this.roomCreationPromises.has(roomId)) {
    return this.roomCreationPromises.get(roomId)!;
  }
  
  // 3. Create & Cache Promise
  const promise = (async () => {
    // ... load from disk ...
    this.rooms.set(roomId, room);
    return room;
  })();
  
  this.roomCreationPromises.set(roomId, promise);
  
  try { return await promise; }
  finally { this.roomCreationPromises.delete(roomId); }
}
```
- **Result**: The second user receives the *same promise* as the first user. They both resolve to the exact same Room instance.

#### 3.3.3 Lifecycle & Cleanup
- **Auto-Cleanup**: When the last user leaves, `scheduleRoomCleanup` starts a 60-second timer.
- **Debounce**: If a user rejoins within 60s (e.g., page refresh), the timer is cancelled.
- **Persist**: If the timer fires, the room is saved to `.canvas-data/` and removed from RAM.

---

### 3.4 File-Based Persistence (`server/persistence.ts`)

**File**: `server/persistence.ts`
**Role**: Handles saving/loading state to the `.canvas-data/` directory.

- **JSON Format**: Saves `strokes`, `operationHistory`, and `undoStack` as human-readable JSON.
- **Versioning**: Each file includes `version: 1`. This allows future code to migrate old data formats (e.g., if we rename `color` to `strokeColor`).
- **Atomic Operations**: Uses `fs.promises` to avoid blocking the single-threaded Node event loop during I/O.

---

### 3.5 Serving Strategy (`server/static.ts` & `server/vite.ts`)

**Role**: The "BFF" (Backend for Frontend) pattern. Supports two modes:

**1. Development (Vite Middleware)**
- `server/vite.ts` attaches Vite's middleware to Express.
- Intercepts requests for `.tsx` files and compiles them on-the-fly with ESBuild.
- Injects HMR (Hot Module Replacement) scripts into `index.html`.
- **Benefit**: One command (`npm run dev`) starts full stack; no separate frontend terminal needed.

**2. Production (Static)**
- `server/static.ts` uses `express.static('dist/public')`.
- **SPA Fallback**: Includes a generic `*` route that serves `index.html` for any unknown path. This is required for React Router to handle deep links (e.g., `/room/123`) client-side.

---

## 4. Key Design Decisions

### 4.1 Server-Authoritative vs Peer-to-Peer
**Decision**: Server owns all state.
- **Why**:
  - Easier to implement global Undo/Redo.
  - Validates inputs (security).
  - Persistence is straightforward (server just dumps state).
  - P2P (WebRTC) is harder to scale for "broadcast" scenarios and requires complex conflict resolution.

### 4.2 Global Undo vs Per-User Undo
**Decision**: Global Undo.
- **Scenario**: User A draws lines; User B corrects them; User A wants to undo User B's correction.
- **Global**: Undo removes the *last action in the room*, regardless of who did it. Matches "collaborative document" mental model.
- **Per-User**: User A can only undo *their* strokes. This breaks causality (what if User A undoes a stroke that User B already drew on top of?).

### 4.3 In-Memory State + Disk Persistence
**Decision**: RAM for speed, Disk for safety.
- **Why**: Database transactions for every mouse movement (60fps) would be cost-prohibitive and slow.
- **Risk**: Server crash leads to ~1-minute data loss (or loss of unsaved changes since last persist).
- **Mitigation**: Critical actions (room empty, periodic saves) trigger persistence.

### 4.4 Single Server vs Microservices
**Decision**: Monolith.
- **Why**: Simplicity. WebSocket state clustering (Redis Adapter) adds complexity not needed for <1000 users. A single Node process can handle thousands of concurrent socket connections easily.

---

## 5. Debugging Scenarios

### Scenario 1: "Multiple rooms created for same room ID"
**Symptoms**: Users in same room see different canvases.
**Root Cause**: Race condition in `getOrCreateRoom` where two `await loadRoomState` calls ran in parallel.
**Fix**: Implemented the Promise-locking mechanism (Section 3.3.2) to deduplicate simultaneous join requests.

### Scenario 2: "Undo button stuck disabled"
**Symptoms**: Canvas has strokes, but Undo is gray.
**Root Cause**: `operationHistory` array wasn't being populated when strokes were loaded from disk.
**Fix**: Updated `persistence.ts` to save/load the history arrays, not just the strokes.

### Scenario 3: "Server crash: ENOENT: no such file"
**Symptoms**: Crash when saving.
**Root Cause**: `.canvas-data` directory didn't exist (user deleted it).
**Fix**: Added `ensureStorageDir()` check before every write operation.

### Scenario 4: "Frontend 404s in Production"
**Symptoms**: White screen on deploy.
**Root Cause**: Vite middleware only runs in dev. Production expects `dist/` folder.
**Fix**: Ensure `npm run build` runs before start, and `static.ts` SPA fallback catches routing request.

---

## 6. Feature Extension Guide

### Example: Add "Room Expiration"
**Goal**: Delete rooms inactive for 30 days.
1. **Track Activity**: Add `lastActivity: number` timestamp to `Room` interface. Update it on every `stroke:start`.
2. **Cleanup Job**: Create `server/cleanup.ts`.
   - Iterate all files in `.canvas-data`.
   - Reads file stats or content timestamp.
   - `if (now - lastActivity > 30days) fs.unlink(file)`.
3. **Schedule**: Add `setInterval` in `index.ts` to run cleanup daily.

### Example: Add "Room Passwords"
**Goal**: Restrict access.
1. **Schema**: Update `Room` to store `passwordHash`.
2. **Handlers**: Update `room:join` event to accept `{ password }`.
3. **Logic**: In `routes.ts`, before `socket.join`, verify password hash. Return `error` event if mismatch.

---

## 7. Interview Q&A

### Q: "How would you scale this to 10,000 concurrent users?"
**Answer:**
1. **Vertical**: A single Node.js process can handle ~10k connections if optimized (uWebSockets.js), but single-threaded CPU is the bottleneck for room logic.
2. **Horizontal (Redis)**: Use `socket.io-redis-adapter`. Run multiple Node server instances. Redis acts as the Pub/Sub bus to relay messages between users on different servers.
3. **Storage**: Move from JSON files to Redis (hot state) + PostgreSQL (persistence). JSON operations on disk become too slow at scale.
4. **Sharding**: Partition rooms by ID. `RoomID % ServerCount` directs traffic, avoiding the need for global synchronization.

### Q: "Why Use JSON instead of SQLite/Postgres?"
**Answer:**
"For this specific scope (Take-home/Demo), complexity is the enemy. JSON files require zero setup/installation for the reviewer. I abstracted the persistence layer (`server/persistence.ts`), so swapping `fs.writeFile` for `db.query` would be a localized change in one file, demonstrating modular architecture."

### Q: "What happens if a user is drawing when the server restarts?"
**Answer:**
"The client will experience a WebSocket disconnect. Socket.io automatically attempts reconnection.
- **Server**: Restarts, memory is empty.
- **Client**: Reconnects, sends `room:join`.
- **Server**: Loads state from disk.
- **Result**: Canvas restores. The specific stroke in progress might be cut off (missing `stroke:end`), but the session resumes gracefully."
