# 5-CollabCanvas - SYSTEM - Data Flow & Scaling

## 1. Scope & Responsibility

**What This Document Covers:**
- End-to-end data flow (mouse click → canvas → WebSocket → server → other clients)
- Latency handling and optimization strategies
- Conflict resolution approaches
- Scaling architecture from 10 to 10,000+ users
- Performance bottlenecks and solutions
- Production deployment considerations

**Why This Matters:**
Understanding the full system flow is critical for:
- Debugging synchronization issues
- Optimizing performance under load
- Planning infrastructure for scale
- Answering system design interview questions

---

## 2. Complete Data Flow Diagrams

### 2.1 Drawing Stroke Flow (Happy Path)

```
┌─────────────────────── USER A (Drawing) ────────────────────────┐
│                                                                   │
│  Mouse Down (100, 200)                                          │
│       ↓                                                           │
│  PointerEvent → getCanvasPoint() → Account for zoom & DPR       │
│       ↓                                                           │
│  Create Stroke object:                                           │
│    {                                                              │
│      id: "stroke_abc123",                                        │
│      points: [{x: 100, y: 200}],                                 │
│      color: "#EF4444",                                           │
│      userId: "socket_xyz",                                       │
│      tool: "brush",                                              │
│      timestamp: 1234567890                                       │
│    }                                                              │
│       ↓                                                           │
│  [OPTIMISTIC UI] Add to local state immediately                 │
│       ↓                                                           │
│  Render to canvas (instant feedback)                             │
│       ↓                                                           │
│  socket.emit("stroke:start", { stroke, roomId })                │
│       ║                                                           │
└───────╫───────────────────────────────────────────────────────────┘
        ║
        ║ WebSocket (binary frame, ~200 bytes)
        ║ Latency: 10-200ms depending on network
        ║
        ▼
┌─────────────────────── SERVER ──────────────────────────────────┐
│                                                                   │
│  Socket.io receives "stroke:start" event                        │
│       ↓                                                           │
│  Validate:                                                        │
│    - User is in room                                             │
│    - Stroke belongs to sender (prevent spoofing)                │
│       ↓                                                           │
│  roomManager.addStroke(roomId, stroke)                          │
│       ↓                                                           │
│  In-memory Map: room.strokes.set(stroke.id, stroke)            │
│       ↓                                                           │
│  Add to operation history:                                       │
│    room.operationHistory.push({                                  │
│      type: "draw",                                               │
│      strokeId: stroke.id,                                        │
│      stroke: stroke,                                             │
│      userId: stroke.userId,                                      │
│      timestamp: Date.now()                                       │
│    })                                                             │
│       ↓                                                           │
│  socket.to(roomId).emit("stroke:start", { stroke, roomId })    │
│       ║                                                           │
│       ╠═══════════════╗                                          │
│       ║               ║                                          │
└───────╫───────────────╫──────────────────────────────────────────┘
        ║               ║
        ║               ║ Broadcast to all users in room (except sender)
        ▼               ▼
┌─────── USER B ─────┐ ┌─────── USER C ─────┐
│                     │ │                     │
│  Receives stroke    │ │  Receives stroke    │
│       ↓             │ │       ↓             │
│  Add to local state │ │  Add to local state │
│       ↓             │ │       ↓             │
│  Render to canvas   │ │  Render to canvas   │
│  (sees A's stroke)  │ │  (sees A's stroke)  │
│                     │ │                     │
└─────────────────────┘ └─────────────────────┘

Total latency for User B/C to see stroke: 50-300ms
- Network latency: 10-200ms (client → server)
- Server processing: 1-5ms (validation + broadcast)
- Network latency: 10-200ms (server → other clients)
- Render time: 1-5ms (canvas drawing)
```

**Key observations:**
1. **User A sees stroke immediately** (0ms) due to optimistic UI
2. **User B/C see stroke after network round-trip** (50-300ms)
3. **Server is authoritative** but doesn't block User A
4. **Progressive streaming**: More points added via "stroke:point" events

---

### 2.2 Point Streaming During Active Drawing

```
User A continues drawing (mouse moves):

T0: Mouse at (100, 200) → stroke:start emitted
T1: Mouse at (105, 203) → stroke:point emitted
T2: Mouse at (110, 207) → stroke:point emitted
T3: Mouse at (115, 210) → stroke:point emitted
... (30 more points)
T33: Mouse released → stroke:end emitted

Timeline for User B:
T0 + 50ms: Receives stroke:start → Draws first point
T1 + 50ms: Receives stroke:point → Adds point to stroke
T2 + 50ms: Receives stroke:point → Adds point to stroke
...
T33 + 50ms: Receives stroke:end → Marks stroke complete

Result: User B sees stroke "draw itself" in near real-time
Lag: 50ms behind User A (barely noticeable)
```

**Optimization: Point batching**
```
Without batching:
  Mouse moves 100 times/sec
  → 100 WebSocket events/sec
  → Network congestion

With batching (minDistance = 1px):
  Skip points closer than 1px
  → ~30 WebSocket events/sec
  → Smooth, manageable

With interpolation (maxDistance = 8px):
  Fast stroke creates 20px gap
  → Interpolate intermediate points
  → Smooth continuous line
```

---

### 2.3 Undo/Redo Flow (Global)

```
Initial state:
  Canvas: [Stroke1, Stroke2, Stroke3]
  operationHistory: [Op1, Op2, Op3]
  undoneOperations: []

User clicks Undo:

┌─────── CLIENT ──────┐
│                      │
│  Button clicked      │
│       ↓              │
│  socket.emit(        │
│    "operation:undo", │
│    { roomId }        │
│  )                   │
│       ║              │
└───────╫──────────────┘
        ║
        ▼
┌─────── SERVER ──────┐
│                      │
│  Validate user       │
│       ↓              │
│  Pop from history:   │
│    op = operationHistory.pop()  // Op3
│    undoneOperations.push(op)    │
│       ↓              │
│  Remove stroke:      │
│    room.strokes.delete(op.strokeId)  │
│       ↓              │
│  Broadcast to ALL:   │
│    io.to(roomId).emit("operation:undo", op)  │
│    io.to(roomId).emit("history:state", {     │
│      canUndo: true,  // Still have Op1, Op2  │
│      canRedo: true   // Have Op3 in undone   │
│    })                │
│       ║              │
└───────╫──────────────┘
        ║
        ▼
┌─────── ALL CLIENTS ──────┐
│                           │
│  Receive operation:undo   │
│       ↓                   │
│  Remove stroke from       │
│  local canvas             │
│       ↓                   │
│  Update undo/redo buttons │
│    Undo: Enabled          │
│    Redo: Enabled          │
│                           │
└───────────────────────────┘

Result: All users see stroke disappear simultaneously
```

**Why global undo works:**
- Collaborative whiteboard: Team works together
- Anyone can fix mistakes immediately
- Matches Google Docs behavior
- Simpler than per-user undo stacks

---

### 2.4 Room Persistence Flow

```
Room lifecycle:

1. First user joins:
   ┌──────────────────────────────────────────┐
   │ User joins "ROOM01"                      │
   │      ↓                                   │
   │ Server: getOrCreateRoom("ROOM01")       │
   │      ↓                                   │
   │ Check disk: .canvas-data/ROOM01.json    │
   │      ├─ Exists → Load state              │
   │      └─ Not exists → Create empty room   │
   │      ↓                                   │
   │ Room in memory with state                │
   │      ↓                                   │
   │ Send state to user                       │
   └──────────────────────────────────────────┘

2. Multiple users collaborate:
   - All changes in memory only
   - Fast: No disk I/O on every stroke
   - State shared via WebSocket broadcasts

3. All users leave:
   ┌──────────────────────────────────────────┐
   │ Last user disconnects                    │
   │      ↓                                   │
   │ Start 60-second timer                    │
   │      ↓                                   │
   │ (Wait for potential reconnection)        │
   │      ↓                                   │
   │ Timer expires, room still empty          │
   │      ↓                                   │
   │ saveRoomState(room)                      │
   │      ↓                                   │
   │ Write to .canvas-data/ROOM01.json        │
   │      ↓                                   │
   │ Delete room from memory                  │
   └──────────────────────────────────────────┘

4. User rejoins later:
   - Load from disk (step 1)
   - Canvas restored exactly as left
```

**Why 60-second delay:**
- Browser refresh: Reconnects within 5-10 seconds
- No unnecessary disk I/O
- Room stays in memory (faster)
- After 60s: Likely no one coming back

---

## 3. Latency Handling & Optimization

### 3.1 Latency Sources

```
Total latency = Client Processing + Network Upload + Server Processing + Network Download + Client Rendering

Typical breakdown:
- Client processing: 1-5ms (event handling, state updates)
- Network upload: 10-100ms (depends on connection)
- Server processing: 1-10ms (validation, broadcast)
- Network download: 10-100ms (to other clients)
- Client rendering: 1-5ms (canvas draw)

Total: 23-220ms (typically 50-100ms on good connection)
```

### 3.2 Optimization Strategies

**1. Optimistic UI (IMPLEMENTED)**
```typescript
// User sees their own actions immediately
onLocalStrokeStart(stroke);  // Render instantly (0ms)
onStrokeStart(stroke);       // Send to server (async)
```
- **Impact**: User A's latency = 0ms (perceived)
- **Trade-off**: Might need rollback if server rejects

**2. Point Batching (IMPLEMENTED)**
```typescript
const minDistance = 1px;  // Skip redundant points
const maxDistance = 8px;  // Interpolate gaps
```
- **Impact**: 70% fewer WebSocket events
- **Benefit**: Lower network congestion, same visual quality

**3. Cursor Debouncing (IMPLEMENTED)**
```typescript
const CURSOR_DEBOUNCE_MS = 35;  // ~28 updates/sec
```
- **Impact**: 100 events/sec → 28 events/sec
- **Benefit**: 72% less cursor traffic

**4. Request Animation Frame (IMPLEMENTED)**
```typescript
requestAnimationFrame(() => {
  redrawDynamicCanvas();  // Only render once per frame
});
```
- **Impact**: Multiple state changes → Single render
- **Benefit**: Smooth 60fps, no wasted renders

**5. Binary WebSocket Frames (NOT IMPLEMENTED)**
```typescript
// Current: JSON (text)
{ "type": "stroke:point", "point": { "x": 100, "y": 200 } }
// Size: ~70 bytes

// With binary protocol (MessagePack)
[2, 100, 200]  // type=2 (stroke:point), x=100, y=200
// Size: ~10 bytes

// Impact: 86% smaller payloads
```
- **Why not implemented**: Added complexity, JSON sufficient for scale
- **When to implement**: 1000+ concurrent users, bandwidth bottleneck

---

### 3.3 Perceived Performance Tricks

**1. Skeleton loading**
```tsx
{isLoading && <Skeleton />}  // Shows placeholder
{!isLoading && <DrawingCanvas />}
```
- Makes loading feel faster
- User knows something is happening

**2. Progressive stroke rendering**
```
Instead of:
  Wait for all 100 points → Render complete stroke
  
Do:
  Point 1 arrives → Render dot
  Point 2 arrives → Render line
  Point 3 arrives → Render line
  ...
  Result: Stroke "draws itself"
```

**3. Local echo for cursors**
```typescript
// Show your own cursor immediately
setCursorPos(point);  // Instant

// Send to others asynchronously
sendCursorMove(point);  // Debounced
```

---

## 4. Conflict Resolution

### 4.1 Current Approach: Last-Write-Wins

```
Scenario: Two users draw simultaneously

Time T0:
  User A starts red stroke (id: "stroke_A1")
  User B starts blue stroke (id: "stroke_B1")

Time T1:
  Server receives stroke_A1 → Add to room
  room.strokes.set("stroke_A1", strokeA)

Time T2:
  Server receives stroke_B1 → Add to room
  room.strokes.set("stroke_B1", strokeB)

Time T3:
  Both strokes in room, no conflict (different IDs)

Result: Both strokes coexist peacefully
```

**Why no conflicts:**
1. **Append-only strokes**: Never modified after creation
2. **Unique IDs**: nanoid generates collision-free IDs
3. **No deletion during drawing**: Only undo deletes (which is serialized)

**Edge case: Same timestamp**
```typescript
// Two strokes with exact same timestamp
strokes.sort((a, b) => {
  if (a.timestamp === b.timestamp) {
    return a.id.localeCompare(b.id);  // Deterministic tiebreaker
  }
  return a.timestamp - b.timestamp;
});
```
- Ensures consistent render order across all clients

---

### 4.2 Alternative: Operational Transform (OT)

**When OT is needed:**
- Collaborative text editing (Google Docs)
- Concurrent edits to same object
- Complex merge logic

**OT algorithm example:**
```
User A: Delete character at position 5
User B: Insert "hello" at position 3

Without OT:
  A deletes at 5 → "hello world" → "hell world"
  B inserts at 3 → "hello world" → "helhelloo world"
  Result: Conflict, inconsistent state

With OT:
  A's delete operation transformed based on B's insert
  New position: 5 + len("hello") = 10
  Result: Consistent state
```

**Why we don't need OT:**
- Strokes are immutable (no edits)
- No merging of drawing primitives
- Delete is global (undo), not concurrent

**If adding text editing:**
- Would need OT for multi-user text editing
- Libraries: ShareDB, Yjs, Automerge

---

### 4.3 Alternative: CRDTs (Conflict-free Replicated Data Types)

**CRDT principles:**
- Operations are commutative: Order doesn't matter
- Eventual consistency: All replicas converge to same state
- No central authority needed (peer-to-peer)

**CRDT for drawing:**
```typescript
// Each stroke is a CRDT
class StrokeSet {
  private strokes: Map<string, Stroke> = new Map();
  
  add(stroke: Stroke) {
    // Merge: Union of strokes
    this.strokes.set(stroke.id, stroke);
  }
  
  remove(strokeId: string, timestamp: number) {
    // Remove with timestamp (LWW-Element-Set)
    const existing = this.strokes.get(strokeId);
    if (existing && timestamp > existing.removeTimestamp) {
      existing.removeTimestamp = timestamp;
    }
  }
  
  // Merge two sets
  merge(other: StrokeSet) {
    for (const [id, stroke] of other.strokes) {
      const local = this.strokes.get(id);
      if (!local || stroke.timestamp > local.timestamp) {
        this.strokes.set(id, stroke);
      }
    }
  }
}
```

**Benefits:**
- No server needed (peer-to-peer)
- Offline-first (sync when reconnected)
- Automatic conflict resolution

**Trade-offs:**
- More complex implementation
- Larger data structures (tombstones for deletes)
- Current server-authoritative model is simpler

---

## 5. Scaling Architecture

### 5.1 Current Architecture (10-100 users)

```
┌─────────────┐
│   Client 1  │───┐
└─────────────┘   │
                  │
┌─────────────┐   │    ┌──────────────────────┐
│   Client 2  │───┼───→│  Node.js Server      │
└─────────────┘   │    │  - Express           │
                  │    │  - Socket.io         │
┌─────────────┐   │    │  - In-memory state   │
│   Client 3  │───┘    │  - File persistence  │
└─────────────┘        └──────────────────────┘

Characteristics:
- Single server instance
- In-memory Map for rooms
- File-based persistence (.canvas-data/)
- Works great for small scale
```

**Limitations:**
- Single point of failure (server crash = all users disconnected)
- Memory limit: ~1GB for 100 rooms × 1000 strokes
- CPU limit: 100 concurrent users × 30 events/sec = 3000 events/sec (manageable)

---

### 5.2 Phase 1: Redis + Load Balancer (100-1000 users)

```
┌─────────────┐       ┌────────────────┐
│   Client 1  │──────→│ Load Balancer  │
└─────────────┘       │ (Sticky Session)│
                      └────────┬────────┘
┌─────────────┐              │
│   Client 2  │──────→       │
└─────────────┘              │
                      ┌──────┴───────┐
┌─────────────┐       │              │
│   Client 3  │──────→│              │
└─────────────┘       │              │
                 ┌────▼───┐    ┌────▼───┐
                 │ Server │    │ Server │
                 │   1    │    │   2    │
                 └────┬───┘    └────┬───┘
                      │             │
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │    Redis    │
                      │  - Pub/Sub  │
                      │  - State    │
                      └─────────────┘
```

**Changes needed:**

**1. Redis for state storage**
```typescript
class RoomManager {
  async getRoom(roomId: string): Promise<Room> {
    const data = await redis.get(`room:${roomId}`);
    return JSON.parse(data);
  }
  
  async saveRoom(room: Room) {
    await redis.set(`room:${room.id}`, JSON.stringify(room));
  }
}
```

**2. Redis Pub/Sub for broadcasts**
```typescript
// Server 1 publishes
redis.publish(`room:${roomId}`, JSON.stringify({ event: "stroke:start", data }));

// Server 2 subscribes
redis.subscribe(`room:${roomId}`, (message) => {
  const { event, data } = JSON.parse(message);
  io.to(roomId).emit(event, data);
});
```

**3. Sticky sessions**
```nginx
# Nginx config
upstream backend {
  ip_hash;  # Same client always routes to same server
  server server1:5000;
  server server2:5000;
}
```
- Why needed: Socket.io requires persistent connection
- Alternative: Socket.io Redis adapter (handles cross-server broadcasts)

**Benefits:**
- Horizontal scaling (add more servers)
- High availability (one server crashes, others handle load)
- 10× capacity increase

**New bottlenecks:**
- Redis memory limit (10GB typical)
- Redis CPU for Pub/Sub
- Network bandwidth between servers and Redis

---

### 5.3 Phase 2: Database + Sharding (1000-10,000 users)

```
┌────────────────┐
│ Load Balancer  │
└───────┬────────┘
        │
    ┌───┴───┐
    │       │
┌───▼──┐ ┌──▼───┐     ┌──────────────┐
│Server│ │Server│────→│  Postgres    │
│ Shard│ │ Shard│     │  - Rooms     │
│ A-M  │ │ N-Z  │     │  - Strokes   │
└──┬───┘ └──┬───┘     │  - Operations│
   │        │          └──────────────┘
   └────┬───┘
        │
   ┌────▼────┐
   │  Redis  │
   │ (Cache) │
   └─────────┘
```

**Sharding strategy:**
```typescript
// Route rooms to servers by consistent hashing
function getServerForRoom(roomId: string): Server {
  const hash = hashCode(roomId);
  const serverIndex = hash % serverCount;
  return servers[serverIndex];
}

// Example:
// Room "ABCD12" → hash = 12345 → 12345 % 4 = 1 → Server 2
// Room "XYZT89" → hash = 67890 → 67890 % 4 = 2 → Server 3
```

**Database schema:**
```sql
CREATE TABLE rooms (
  id VARCHAR(6) PRIMARY KEY,
  state JSONB,
  last_activity TIMESTAMP,
  created_at TIMESTAMP
);

CREATE TABLE strokes (
  id VARCHAR(32) PRIMARY KEY,
  room_id VARCHAR(6) REFERENCES rooms(id),
  data JSONB,
  timestamp BIGINT
);

CREATE INDEX idx_room_strokes ON strokes(room_id, timestamp);
```

**Benefits:**
- Persistent storage (survives server restarts)
- Query capabilities (analytics, search)
- Backup/replication built-in

**Challenges:**
- Slower than Redis (10ms vs 1ms)
- Need caching layer (Redis + Postgres)
- Database becomes bottleneck at scale

---

### 5.4 Phase 3: Microservices (10,000+ users)

```
                  ┌────────────────┐
                  │  API Gateway   │
                  └───────┬────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ WebSocket│     │  Stroke │     │  Room   │
    │ Service  │     │ Service │     │ Service │
    └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                ┌────────▼────────┐
                │  Message Queue  │
                │  (Kafka/RabbitMQ)│
                └────────┬────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │Postgres │    │  Redis  │    │ Storage │
    │(Primary)│    │ (Cache) │    │   S3    │
    └─────────┘    └─────────┘    └─────────┘
```

**Service responsibilities:**

**1. WebSocket Service**
- Handles client connections
- Routes events to appropriate services
- Broadcasts to connected clients

**2. Stroke Service**
- Validates stroke data
- Stores in database
- Publishes events to message queue

**3. Room Service**
- Manages room lifecycle
- User presence
- Undo/redo operations

**Benefits:**
- Independent scaling (scale WebSocket separately from stroke processing)
- Fault isolation (one service crash doesn't affect others)
- Technology flexibility (use best tool for each job)

**Challenges:**
- Complex deployment
- Service communication overhead
- Distributed tracing needed

---

## 6. Production Deployment Considerations

### 6.1 Monitoring & Observability

**Key metrics to track:**

**1. WebSocket metrics**
```typescript
// Connection metrics
- Active connections count
- Connection duration
- Reconnection rate

// Event metrics
- Events per second (by type)
- Event processing latency
- Failed event rate

// Room metrics
- Active rooms count
- Users per room (avg, max)
- Strokes per room (avg, max)
```

**2. Performance metrics**
```typescript
// Server
- CPU usage
- Memory usage
- Event loop lag

// Database
- Query latency
- Connection pool size
- Slow queries

// Network
- Bandwidth usage
- Packet loss rate
- Latency (p50, p95, p99)
```

**3. Business metrics**
```typescript
// Engagement
- Daily active users
- Average session duration
- Strokes per session

// Growth
- New rooms created
- Returning users
- Viral coefficient (shares)
```

**Tools:**
- **Metrics**: Prometheus + Grafana
- **Logging**: Winston + ELK stack
- **Tracing**: OpenTelemetry + Jaeger
- **Errors**: Sentry

---

### 6.2 Cost Optimization

**Current costs (AWS estimate):**

**Single server (10-100 users):**
```
- EC2 t3.medium: $30/month
- S3 storage (1GB): $0.02/month
- Data transfer (10GB): $1/month
Total: ~$31/month
```

**Redis + Load Balancer (100-1000 users):**
```
- 3× EC2 t3.large: $150/month
- ElastiCache Redis (cache.t3.medium): $45/month
- Application Load Balancer: $20/month
- S3 storage (100GB): $2/month
- Data transfer (1TB): $90/month
Total: ~$307/month
```

**Database + Sharding (1000-10,000 users):**
```
- 10× EC2 c5.xlarge: $1200/month
- RDS Postgres (db.r5.xlarge): $400/month
- ElastiCache Redis (cache.r5.xlarge): $200/month
- Application Load Balancer: $20/month
- S3 storage (1TB): $20/month
- Data transfer (10TB): $900/month
Total: ~$2740/month
```

**Optimization strategies:**

**1. Use spot instances (70% cheaper)**
```
- Stateless servers can use spot instances
- Save ~$800/month at scale
```

**2. Compress WebSocket messages**
```typescript
// Enable compression
const io = new SocketIOServer(httpServer, {
  perMessageDeflate: true,
});

// Reduce bandwidth by 60-80%
// Save ~$500/month on data transfer
```

**3. Aggressive caching**
```
- Cache room state in Redis (reduce DB queries)
- Cache static assets in CDN
- Save ~$100/month on DB costs
```

**4. Batch writes**
```typescript
// Instead of saving every stroke immediately
let pendingWrites: Stroke[] = [];

setInterval(() => {
  if (pendingWrites.length > 0) {
    await batchInsertStrokes(pendingWrites);
    pendingWrites = [];
  }
}, 5000);  // Batch every 5 seconds

// Reduce DB write operations by 90%
```

---

## 7. Interview Q&A

### Q: "How would you handle 10,000 users in the same room?"

**Answer:**
"10,000 users in one room is extreme but possible with architectural changes:

**Challenge 1: Broadcast storm**
```
Current: Server broadcasts every stroke to all users
10,000 users × 30 strokes/sec = 300,000 messages/sec
Result: Server overwhelmed
```

**Solution 1: Hierarchical broadcasting**
```
Users divided into sectors (100 users each)
Each sector has a leader
Leader aggregates events, broadcasts to sector
Server only broadcasts to leaders

Messages: 100 leaders × 30 strokes/sec = 3,000 messages/sec
96% reduction
```

**Solution 2: Spatial partitioning**
```
Canvas divided into regions (quadtree)
Users only receive strokes in their viewport
If viewport = 10% of canvas
Messages: 10,000 × 10% × 30 = 30,000 messages/sec
90% reduction
```

**Challenge 2: Cursor updates**
```
10,000 users × 28 cursors/sec = 280,000 updates/sec
Overwhelming
```

**Solution: Sample cursors**
```
Show only 50 nearest cursors
Or: Show cursors probabilistically (1% chance)
Result: Manageable update rate
```

**Challenge 3: Synchronization**
```
New user joins → needs full state
10,000 users × 100 strokes each = 1M strokes to load
```

**Solution: Progressive loading**
```
Send visible strokes first (viewport)
Stream rest in background
Priority: Recent strokes > Old strokes
```

**Real-world examples:**
- Figma: Limits 200 users per file
- Miro: Limits 500 users per board
- Our app: Recommend 50 users per room max

Would implement in phases, measure bottlenecks, optimize."

---

### Q: "What's your disaster recovery plan?"

**Answer:**
"Multi-layered approach:

**1. Continuous backups**
```
- Postgres: Automatic snapshots every hour
- Redis: RDB snapshots every 15 minutes
- S3: Versioning enabled (recover deleted files)
- Retention: 7 days point-in-time recovery
```

**2. Multi-region replication**
```
Primary: us-east-1
Replica: us-west-2 (read-only)
Replication lag: <1 second

If primary fails:
  1. Promote replica to primary (30 seconds)
  2. Update DNS (2 minutes)
  3. Resume operations
Total downtime: <3 minutes
```

**3. Data integrity**
```
- Checksums on all stored data
- Validate on read, detect corruption
- Quarterly restore tests (ensure backups work)
```

**4. Incident response**
```
1. Detect (alerts fire)
2. Assess (is it partial or total failure?)
3. Mitigate (switch to backup, rollback deploy)
4. Communicate (status page updates)
5. Post-mortem (what went wrong, how to prevent)
```

**Recent example (simulated):**
- Database corruption detected
- Restored from backup 1 hour old
- Lost 1 hour of drawings (acceptable)
- Communicated to affected users
- Root cause: Disk failure, migrated to new hardware

RPO (Recovery Point Objective): 1 hour
RTO (Recovery Time Objective): 3 minutes"

---

### Q: "How do you test WebSocket functionality?"

**Answer:**
"Multi-level testing strategy:

**1. Unit tests (Jest)**
```typescript
describe("RoomManager", () => {
  it("should add stroke to room", () => {
    const room = new Room("TEST01");
    const stroke = createMockStroke();
    room.addStroke(stroke);
    expect(room.strokes.size).toBe(1);
  });
});
```

**2. Integration tests (Socket.io test utils)**
```typescript
import { createServer } from "http";
import { io as Client } from "socket.io-client";

describe("WebSocket events", () => {
  let serverSocket, clientSocket;
  
  beforeAll((done) => {
    const httpServer = createServer();
    const io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`);
      io.on("connection", (socket) => {
        serverSocket = socket;
      });
      clientSocket.on("connect", done);
    });
  });
  
  it("should broadcast stroke to other users", (done) => {
    // User 1 emits stroke
    clientSocket.emit("stroke:start", { stroke, roomId });
    
    // User 2 should receive it
    clientSocket2.on("stroke:start", (data) => {
      expect(data.stroke.id).toBe(stroke.id);
      done();
    });
  });
});
```

**3. End-to-end tests (Playwright)**
```typescript
test("collaborative drawing", async ({ page, context }) => {
  // Open two browser tabs
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  
  // Both join same room
  await page1.goto("/?room=TEST01");
  await page2.goto("/?room=TEST01");
  
  // Page 1 draws stroke
  await page1.mouse.click(100, 100);
  await page1.mouse.move(200, 200);
  
  // Page 2 should see stroke
  await page2.waitForSelector('canvas[data-has-strokes="true"]');
  const canvas = await page2.$('canvas');
  const pixels = await canvas.screenshot();
  expect(pixels).toMatchSnapshot();
});
```

**4. Load tests (Artillery)**
```yaml
config:
  target: "http://localhost:5000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 users/sec
  engines:
    socketio: {}

scenarios:
  - name: "Drawing simulation"
    engine: socketio
    flow:
      - emit:
          channel: "room:join"
          data:
            roomId: "LOAD01"
            username: "User{{ $uuid }}"
      - think: 1
      - emit:
          channel: "stroke:start"
          data:
            stroke: {...}
            roomId: "LOAD01"
```

**5. Chaos testing**
```typescript
// Randomly kill connections
setInterval(() => {
  if (Math.random() < 0.01) {  // 1% chance
    randomSocket.disconnect();
  }
}, 1000);

// Verify system recovers gracefully
```
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


Testing pyramid:
- 70% unit tests (fast, isolated)
- 20% integration tests (WebSocket flows)
- 10% E2E tests (full scenarios)
```

---

**END OF SYSTEM-DataFlowAndScaling.md**

**🎉 ALL 5 INTERVIEW DOCUMENTATION FILES COMPLETE! 🎉**

Files created:
1. ✅ FRONTEND-ClientArchitecture.md
2. ✅ FRONTEND-CanvasAndTools.md
3. ✅ BACKEND-ServerArchitecture.md
4. ✅ SHARED-TypesAndContracts.md
5. ✅ SYSTEM-DataFlowAndScaling.md

Total documentation: ~60 pages of detailed technical explanations, code walkthroughs, debugging scenarios, and interview Q&A.

