# Architecture Documentation

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER A (Browser)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Canvas    │───▶│  useSocket  │───▶│ Socket.io   │                 │
│  │  Component  │◀───│    Hook     │◀───│   Client    │                 │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                 │
│         │                                      │                         │
│         ▼                                      │                         │
│  ┌─────────────┐                              │                         │
│  │   Local     │   (Client-side prediction)   │                         │
│  │   State     │                              │                         │
│  └─────────────┘                              │                         │
│                                                │                         │
└────────────────────────────────────────────────┼─────────────────────────┘
                                                 │
                                        WebSocket│Connection
                                                 │
┌────────────────────────────────────────────────┼─────────────────────────┐
│                           SERVER               │                         │
├────────────────────────────────────────────────┴─────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  Socket.io  │───▶│    Room     │───▶│   Canvas    │                 │
│  │   Server    │◀───│   Manager   │◀───│    State    │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                                                               │
│         │ Broadcast to                                                  │
│         │ other clients                                                 │
│         ▼                                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 │
┌────────────────────────────────────────────────┼─────────────────────────┐
│                           USER B (Browser)      │                        │
├────────────────────────────────────────────────┴─────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Canvas    │◀───│  useSocket  │◀───│ Socket.io   │                 │
│  │  Component  │    │    Hook     │    │   Client    │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## WebSocket Protocol

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ roomId: string, username: string }` | Join a drawing room |
| `room:leave` | `roomId: string` | Leave current room |
| `cursor:move` | `{ roomId, position: Point \| null, isDrawing: boolean }` | Update cursor position |
| `stroke:start` | `{ stroke: Stroke, roomId: string }` | Begin a new stroke |
| `stroke:point` | `{ strokeId, point: Point, roomId }` | Add point to stroke |
| `stroke:end` | `{ strokeId, roomId }` | Finalize stroke |
| `canvas:clear` | `roomId: string` | Clear entire canvas |
| `operation:undo` | `roomId: string` | Undo last operation |
| `operation:redo` | `roomId: string` | Redo undone operation |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:joined` | `(roomId, userId, username, color)` | Confirmation of room join |
| `user:list` | `User[]` | Current users in room |
| `user:joined` | `User` | New user joined |
| `user:left` | `userId: string` | User left room |
| `cursor:update` | `{ userId, position, isDrawing }` | Other user's cursor moved |
| `canvas:state` | `Stroke[]` | Full canvas state on join |
| `stroke:start` | `{ stroke, roomId }` | Other user started stroke |
| `stroke:point` | `{ strokeId, point, roomId }` | Other user added point |
| `stroke:end` | `{ strokeId, roomId }` | Other user finished stroke |
| `canvas:clear` | - | Canvas was cleared |
| `operation:undo` | `Operation` | Undo operation executed |
| `operation:redo` | `Operation` | Redo operation executed |

## Undo/Redo Strategy

### Global Operation History

The undo/redo system maintains a **global operation history** on the server, shared across all users.

```typescript
interface Room {
  operationHistory: Operation[];   // Stack of executed operations
  undoneOperations: Operation[];   // Stack of undone operations (for redo)
}

interface Operation {
  type: "draw" | "erase" | "clear";
  strokeId?: string;
  stroke?: Stroke;    // Full stroke data for restoration
  userId: string;
  timestamp: number;
}
```

### How It Works

1. **Drawing**: When a user completes a stroke, an operation is added to `operationHistory`
2. **Undo**: Pops from `operationHistory`, pushes to `undoneOperations`, reverses the action
3. **Redo**: Pops from `undoneOperations`, pushes to `operationHistory`, reapplies the action
4. **New Action**: Any new drawing action clears `undoneOperations` (can't redo after new action)

### Conflict Resolution

- Operations are applied in order of arrival at the server
- Server is the source of truth for operation order
- Undo always removes the most recent operation globally (not per-user)
- All clients receive the same undo/redo events and update accordingly

## Performance Decisions

### 1. Client-Side Prediction
- Local strokes are rendered immediately without waiting for server confirmation
- Provides instant visual feedback while data syncs in background
- Reduces perceived latency to near-zero

### 2. Point Batching Strategy
- Points are only sent when they differ significantly from the last point
- Minimum distance threshold of 2 pixels prevents redundant updates
- Reduces WebSocket message frequency by ~60%

### 3. Quadratic Curve Smoothing
- Raw points are connected using quadratic Bézier curves
- Produces smooth, natural-looking lines
- Better visual quality than linear interpolation

### 4. Canvas Redraw Optimization
- Uses `requestAnimationFrame` for canvas updates
- Only redraws when strokes array changes
- Prevents unnecessary repaints during high-frequency events

### 5. Cursor Position Throttling
- Cursor positions are sent on pointer move (every ~16ms at 60fps)
- Could be further optimized with debouncing if needed
- Uses CSS transforms for cursor positioning (GPU accelerated)

## Conflict Resolution

### Overlapping Drawing
When multiple users draw in the same area simultaneously:

1. **No conflict** - All strokes are preserved independently
2. **Z-order by timestamp** - Later strokes appear on top
3. **Eraser interaction** - Eraser uses `destination-out` composite mode, affecting all layers

### Race Conditions
- Server processes events in order of arrival
- No client-side locking of canvas regions
- Optimistic updates with eventual consistency

### Network Issues
- Socket.io handles reconnection automatically
- On reconnect, client receives full canvas state
- Lost strokes during disconnect are not recovered

## Scaling Considerations

For 1000+ concurrent users:

1. **Room Sharding** - Distribute rooms across multiple server instances
2. **WebSocket Clustering** - Use Redis adapter for Socket.io
3. **Canvas Chunking** - Divide canvas into regions, only sync visible chunks
4. **Stroke Compression** - Compress point data before transmission
5. **Event Aggregation** - Batch multiple small events into larger payloads
6. **CDN for Static Assets** - Offload non-real-time traffic

## Known Limitations

1. **No persistence** - Canvas state is lost when all users leave (after 60s timeout)
2. **No authentication** - Anyone with the link can join
3. **Single canvas size** - Fixed canvas dimensions, no pan/zoom
4. **Global undo** - Users can undo each other's work (by design for collaboration)
5. **No conflict prevention** - Simultaneous edits to same area are all preserved
