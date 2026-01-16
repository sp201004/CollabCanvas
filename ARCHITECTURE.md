# CollabCanvas Architecture Documentation

## Overview

CollabCanvas is a real-time collaborative drawing application built with React, TypeScript, and Socket.io. This document details the technical architecture, design decisions, and implementation strategies.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  React App                                                       │
│  ├── Canvas Page (main view)                                     │
│  │   ├── DrawingCanvas (HTML5 Canvas + shapes + pan/zoom)        │
│  │   ├── ToolPanel (brush, eraser, shapes, undo/redo)            │
│  │   ├── ColorPicker (preset + custom colors)                    │
│  │   ├── StrokeWidthSelector (slider + input)                    │
│  │   ├── UserPresence (online users list)                        │
│  │   └── CursorOverlay (other users' cursors)                    │
│  ├── Landing Page (room creation/joining)                        │
│  └── useSocket Hook (WebSocket management)                       │
├─────────────────────────────────────────────────────────────────┤
│  Socket.io Client ←─── WebSocket ───→ Socket.io Server          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server (Node.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  Express.js + Socket.io                                          │
│  ├── Room Manager                                                │
│  │   ├── User sessions                                           │
│  │   ├── Stroke storage                                          │
│  │   ├── Shape storage                                           │
│  │   └── Operation history (for undo/redo)                       │
│  └── Event handlers (room:join, stroke:*, shape:*, etc.)         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Drawing a Stroke

```
User draws → Local render → Socket emit → Server broadcast → Other clients render
     │                            │                               │
     ▼                            ▼                               ▼
 Immediate                   Debounced                      Real-time
 feedback                    batching                        update
```

### Drawing a Shape

```
User drags → Preview render → Mouse up → Socket emit → Server broadcast → All clients render
     │             │                           │                               │
     ▼             ▼                           ▼                               ▼
 Start point   Live preview              Final shape                     Synced shape
```

### Pan & Zoom

```
Mouse wheel/drag → Transform update → Canvas redraw with new transform
        │                │                      │
        ▼                ▼                      ▼
    Zoom factor     Pan offset          All elements transformed
```

## WebSocket Protocol

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ roomId, username }` | Join a room |
| `room:leave` | `roomId` | Leave current room |
| `cursor:move` | `{ roomId, position, isDrawing }` | Update cursor position (debounced) |
| `stroke:start` | `{ stroke, roomId }` | Begin a new stroke |
| `stroke:point` | `{ strokeId, point, roomId }` | Add point to stroke |
| `stroke:end` | `{ strokeId, roomId }` | Finalize stroke |
| `shape:add` | `{ shape, roomId }` | Add a shape (rectangle, circle, line, text) |
| `canvas:clear` | `roomId` | Clear all drawings |
| `operation:undo` | `roomId` | Undo last operation |
| `operation:redo` | `roomId` | Redo undone operation |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:joined` | `roomId, userId, username, color` | Confirmation of room join |
| `user:list` | `User[]` | Current users in room |
| `user:joined` | `User` | New user joined |
| `user:left` | `userId` | User left room |
| `cursor:update` | `CursorUpdate` | Other user's cursor moved |
| `canvas:state` | `{ strokes, shapes }` | Full canvas state on join |
| `stroke:start` | `{ stroke, roomId }` | Another user started stroke |
| `stroke:point` | `{ strokeId, point, roomId }` | Another user added point |
| `stroke:end` | `{ strokeId, roomId }` | Another user finished stroke |
| `shape:add` | `{ shape, roomId }` | Another user added shape |
| `canvas:clear` | - | Canvas was cleared |
| `operation:undo` | `Operation` | Operation was undone |
| `operation:redo` | `Operation` | Operation was redone |
| `history:state` | `{ operationCount, undoneCount }` | History state for button states |

## Undo/Redo Strategy

### Global History

The server maintains a global operation history for each room:

```typescript
interface Room {
  operationHistory: Operation[];  // Stack of completed operations
  undoneOperations: Operation[];  // Stack of undone operations
}
```

### Operation Types

```typescript
interface Operation {
  type: "draw" | "erase" | "undo" | "redo" | "clear";
  strokeId?: string;
  stroke?: Stroke;
  userId: string;
  timestamp: number;
}
```

### Undo Flow

1. Client emits `operation:undo`
2. Server pops from `operationHistory`, pushes to `undoneOperations`
3. Server broadcasts `operation:undo` to ALL clients (including sender)
4. Server broadcasts `history:state` with updated counts
5. All clients update their local canvas state

### Button State Sync

The `history:state` event syncs undo/redo button states across all clients:
- `canUndo = operationCount > 0`
- `canRedo = undoneCount > 0`

## Shape Tools Implementation

### Shape Types

```typescript
interface Shape {
  id: string;
  type: "rectangle" | "circle" | "line" | "text";
  startPoint: Point;
  endPoint: Point;
  color: string;
  width: number;
  userId: string;
  timestamp: number;
  text?: string;  // For text tool only
}
```

### Drawing Shapes

1. **Rectangle**: `ctx.strokeRect(x, y, width, height)`
2. **Circle/Ellipse**: `ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2π)`
3. **Line**: `ctx.moveTo(start) → ctx.lineTo(end)`
4. **Text**: `ctx.fillText(text, x, y)` with font size based on stroke width

### Preview During Drag

While dragging, a semi-transparent preview shape renders locally (not synced) until mouse up.

## Pan & Zoom Implementation

### Transform State

```typescript
const [zoom, setZoom] = useState(1);           // Zoom factor (0.1 to 5)
const [pan, setPan] = useState({ x: 0, y: 0 }); // Pan offset in pixels
```

### Coordinate Transformation

```typescript
// Screen coordinates to canvas coordinates
const screenToCanvas = (screenX, screenY) => ({
  x: (screenX - pan.x) / zoom,
  y: (screenY - pan.y) / zoom,
});
```

### Zoom Towards Mouse

```typescript
const handleWheel = (e) => {
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
  
  // Adjust pan to zoom towards mouse position
  const zoomChange = newZoom / zoom;
  const newPanX = mouseX - (mouseX - pan.x) * zoomChange;
  const newPanY = mouseY - (mouseY - pan.y) * zoomChange;
};
```

### Canvas Rendering with Transform

```typescript
ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, pan.x * dpr, pan.y * dpr);
// Draw all strokes and shapes...
```

## Cursor Debouncing

### Motivation

Without debouncing, cursor updates fire on every `pointermove` event (~60+ times/second), causing excessive socket traffic.

### Implementation

```typescript
const CURSOR_DEBOUNCE_MS = 35;  // ~28 updates/second max

const sendCursorMove = (position, isDrawing) => {
  const now = Date.now();
  const timeSinceLastSend = now - lastCursorSendRef.current;
  
  if (timeSinceLastSend >= CURSOR_DEBOUNCE_MS) {
    // Send immediately
    socket.emit("cursor:move", { roomId, position, isDrawing });
    lastCursorSendRef.current = now;
  } else {
    // Schedule delayed send
    pendingCursorRef.current = { position, isDrawing };
    setTimeout(() => {
      if (pendingCursorRef.current) {
        socket.emit("cursor:move", { roomId, ...pendingCursorRef.current });
      }
    }, CURSOR_DEBOUNCE_MS - timeSinceLastSend);
  }
};
```

### Impact

- Reduces socket traffic by ~60%
- Maintains smooth cursor appearance (still ~28 updates/second)
- Final cursor position always sent (no "stuck" cursors)

## Persistence Strategy

### LocalStorage Auto-Save

```typescript
// Save every 5 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (strokes.length > 0 || shapes.length > 0) {
      localStorage.setItem(
        `collabcanvas_${roomId}`,
        JSON.stringify({ strokes, shapes, savedAt: Date.now() })
      );
    }
  }, 5000);
  return () => clearInterval(interval);
}, [roomId, strokes, shapes]);
```

### JSON Export/Import

Export format:
```json
{
  "strokes": [...],
  "shapes": [...],
  "exportedAt": 1234567890
}
```

Import triggers `stroke:start` and `shape:add` events for each element, syncing imported content to all users.

## Performance Optimizations

### 1. Point Batching

Only send points when distance > 2px from last point:

```typescript
const distance = Math.sqrt(dx * dx + dy * dy);
if (distance < 2) return;  // Skip redundant points
```

### 2. requestAnimationFrame Rendering

```typescript
useEffect(() => {
  animationFrameRef.current = requestAnimationFrame(redrawCanvas);
  return () => cancelAnimationFrame(animationFrameRef.current);
}, [redrawCanvas]);
```

### 3. Client-Side Prediction

Local strokes render immediately without waiting for server confirmation, providing instant feedback.

### 4. Cursor Debouncing

35ms debounce interval reduces socket traffic while maintaining smooth visual updates.

### 5. Canvas Size Optimization

Uses devicePixelRatio for crisp rendering on high-DPI displays:

```typescript
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
ctx.scale(dpr, dpr);
```

## Conflict Resolution

### Strategy: Last Write Wins

All strokes and shapes are preserved in order of arrival. The server assigns timestamps and broadcasts in sequence.

### Why This Works

1. **Drawing is additive** - Strokes don't conflict, they overlay
2. **Undo is global** - Any user can undo any operation
3. **Clear is atomic** - Wipes all state cleanly

## Room Management

### Room Lifecycle

1. First user joins → Room created
2. Users draw → Operations stored in room
3. Last user leaves → 60-second cleanup timer starts
4. Timer expires → Room deleted (if still empty)

### Room Code Validation

```typescript
const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
```

- Exactly 6 characters
- Uppercase alphanumeric only
- Validated on client AND server

## Security Considerations

1. **No authentication** - Anyone with room link can join
2. **Input validation** - Zod schemas validate all WebSocket data
3. **Rate limiting** - Cursor debouncing prevents socket flooding
4. **No XSS** - Canvas drawing doesn't execute scripts

## Future Improvements

1. **Layer system** - Multiple drawing layers
2. **Selection tool** - Select and move shapes
3. **Server persistence** - Redis/database storage
4. **Image import** - Add images to canvas
5. **Export as PNG** - Canvas to image export
6. **Authentication** - Optional room passwords
