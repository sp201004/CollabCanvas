# Client-Server Architecture Overview

## 1. System Responsibilities

### Client (Frontend)
The frontend is built with **React** and **TypeScript**. Its primary responsibilities are:
- **Capturing User Input**: Handling high-frequency mouse/touch events (up to 120Hz).
- **Rendering**: displaying the drawing state using the HTML5 Canvas API at 60FPS.
- **Optimism**: Immediately drawing the user's own strokes before server confirmation (Zero Interpolated Latency).
- **Synchronization**: Listening for updates from the server and reconciling the local state.
- **Interpolation**: Smoothing discrete pointer events into continuous Bézier curves.

### Server (Backend)
The backend is a **Node.js** server using **Socket.io**. Its primary responsibilities are:
- **Single Source of Truth**: Maintaining the canonical state of the drawing room (strokes, shapes, users).
- **Broadcasting**: Relaying events (stroke start, point, end) to other connected clients.
- **Persistence**: Saving the room state to the file system (JSON files) for durability.
- **Conflict Resolution**: Ordering operations for global Undo/Redo functionality using a linear operation log.

## 2. Canvas Layering Strategy

To achieve 60FPS performance, the standard single-canvas approach is insufficient. We employ a **Dual-Layer Architecture**:

### Dynamic Canvas (Top Layer)
- **Purpose**: Rendering *active* strokes that are currently being drawn or received.
- **Performance**: Cleared and redrawn frequently (every frame during interaction).
- **Content**: The current user's cursor path, remote users' current strokes, or shape previews.

### Static Canvas (Bottom Layer)
- **Purpose**: Rendering *completed* strokes.
- **Performance**: Only redrawn when a stroke is finished, removed (undo), or restored (redo).
- **Content**: All finalized drawing history.

**Why this matters**:
When a user draws, we only clear/redraw the top transparent layer. The widely complex history of thousands of strokes on the bottom layer remains untouched, drastically reducing CPU usage.

## 3. WebSocket Lifecycle

We use **Socket.io** for robust real-time communication.

1. **Connection**: Client connects via WebSocket (with polling fallback).
2. **Room Join**: User enters a room ID. Server sends the *full initial state* (all past strokes).
3. **Active Session**:
   - **Events Out**: `stroke:start`, `stroke:point`, `stroke:end`, `shape:add`.
   - **Events In**: `stroke:start` (from others), `operation:undo`, `user:join`.
4. **Reconnection**: If disconnected, Socket.io automatically attempts reconnection. Upon success, the client re-requests the latest room state to handle any missed events.

## 4. Undo/Redo Design (CRDT-lite)

We implement **Global Undo/Redo**, meaning drawing is a collaborative history, not just per-user.

- **Data Structure**: We maintain a linear `operationHistory` array on the server.
- **Action**: When a user triggers "Undo":
  1. Server pops the last operation (getLastOp).
  2. Server identifies the stroke ID associated with it.
  3. Server removes that stroke from the active state.
  4. Server broadcasts `operation:undo` to ALL clients.
  5. Clients see the stroke vanish (from Static Canvas).

This ensures eventual consistency: all users see the same document state after operations settle.

## 5. Performance Optimizations

- **Event Coalescing**: Reacting to `getCoalescedEvents` to capture sub-frame mouse movements for smoother curves.
- **Throttling**: Limiting the transmission rate of `cursor:move` events to ~30Hz to save bandwidth without sacrificing perceived smoothness.
- **Batching**: Grouping stroke points if network congestion is detected (implicit via TCP, explicit logic available).
- **Dirty Rectangle Rendering**: When redrawing the static canvas, we calculate the bounding box of the change to avoid repainting the entire widespread canvas if possible.
