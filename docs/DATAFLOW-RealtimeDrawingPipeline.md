# Data Flow & Real-time Drawing Pipeline

This document maps the journey of a single pixel from one user's mouse to another user's screen.

## 1. The Input Pipeline (Local User)

**1. Mouse Down (`handlePointerDown`)**
- A `Stroke` object is initialized with a unique ID (nanoID).
- **Local Render**: The first point is immediately drawn to the **Dynamic Canvas**.
- **Network**: `stroke:start` event is emitted to Server.

**2. Mouse Move (`handlePointerMove`)**
- Browser fires pointer events (potentially 120Hz+).
- **Interpolation**: We use Catmull-Rom or quadratic Bézier curves to smooth the raw points.
- **Local Render**: New segments are appended to the path on **Dynamic Canvas**.
- **Network**: Points are streamed via `stroke:point`.
  - *Optimization*: Points are not sent 1:1. We sample or throttle slightly to prevent network flooding, sending ~30-60 packets/sec.

**3. Mouse Up (`handlePointerUp`)**
- Stroke is finalized.
- **Local Render**: The stroke is "transferred" from **Dynamic Canvas** to **Static Canvas** (burned in).
- **Network**: `stroke:end` is emitted.

---

## 2. The Network Pipeline (Server Relay)

The Server acts as a high-speed relay station.

**1. Event Reception**
- Server receives `stroke:point` for Room `ABC-123`.
- Server validates user is in room.
- Server appends point to its in-memory `Stroke` object.

**2. Broadcast**
- Server rebroadcasts the event to `room_ABC-123` *excluding* the sender.
- `socket.broadcast.to(roomId).emit(...)`

**3. Persistence (Async)**
- If `stroke:end` triggers:
  - Stroke is added to `operationHistory`.
  - Full room state is asynchronously flushed to `.canvas-data/ABC-123.json` (debounced or periodic).

---

## 3. The Rendering Pipeline (Remote User)

**1. Event Reception**
- remote Client receives `stroke:start`.
- Client initializes a "Ghost Stroke" buffer for that specific user ID.

**2. Real-time Rendering**
- Client receives `stroke:point`.
- Points are appended to the Ghost Stroke.
- **Dynamic Canvas** is cleared and redrawn.
  - *Why redraw all?* Because dynamic canvas contains ALL active remote strokes.
  - It iterates through all active "Ghost Strokes" and renders their current paths.

**3. Finalization**
- Client receives `stroke:end`.
- The completed Ghost Stroke is drawn onto the **Static Canvas**.
- The Ghost Stroke is removed from memory.
- The **Dynamic Canvas** is cleared (waiting for next input).

---

## 4. Cursor Presence Flow

To show where other users are:

1. **Input**: User moves mouse.
2. **Throttle**: Client checks if `lastEmit > 30ms`.
3. **Emit**: `cursor:move` { x, y, userId }.
4. **Server**: Relays to room.
5. **Client**: Updates a `cursors` map: `Map<UserId, {x, y, color}>`.
6. **Render**: A separate React component (`CursorOverlay`) uses `requestAnimationFrame` to interpolate cursor positions smoothly between network updates.
