# 1-CollabCanvas - FRONTEND - Client Architecture

## 1. Scope & Responsibility

**Covered Files:**
- `client/src/main.tsx` - Application entry point
- `client/src/App.tsx` - Root component with routing
- `client/src/hooks/use-socket.ts` - WebSocket state management hook (Core logic)
- `client/src/lib/socket.ts` - Socket.io client wrapper
- `client/src/lib/persistence.ts` - localStorage canvas persistence
- `client/src/pages/landing-page.tsx` - Onboarding flow
- `client/src/pages/canvas-page.tsx` - Main controller
- `client/src/components/error-boundary.tsx` - Crash protection
- `client/src/lib/utils.ts` - Utility functions

**Why This Part Exists:**
This is the **application bootstrapping layer** that:
1. Initializes the React app and error boundaries
2. Sets up client-side routing (landing page vs canvas page)
3. Manages WebSocket connection lifecycle
4. Handles real-time state synchronization with the server
5. Provides localStorage-based canvas persistence for recovery
6. Manages global UI state (connection status, metrics)

---

## 2. Architecture Role

**Position in System:**
```
Browser
  └── main.tsx (React 18 createRoot)
       └── ErrorBoundary (Crash protection)
            └── App.tsx (Routing - Wouter)
                 ├── LandingPage (Entry / Name capture)
                 └── CanvasPage (Collaborative Session)
                      ├── RoomHeader (Session control)
                      └── useSocket() hook (State Sync)
                           ├── socket.ts (Singleton connection)
                           └── persistence.ts (Local Backup)
```

**Dependencies:**
- **React 18**: Uses `createRoot` (concurrent features)
- **Wouter**: Lightweight routing library (~1KB vs React Router 30KB)
- **Socket.io-client**: Real-time WebSocket communication
- **shadcn/ui**: Toast notifications, tooltips, UI components
- **Zod schemas**: Type-safe WebSocket events

---

## 3. Code Walkthrough (Deep Dive)

### 3.1 Application Bootstrap (`client/src/main.tsx`)

**File**: `client/src/main.tsx`
**Role**: Entry point.

```typescript
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

**Key Components:**
- **ErrorBoundary**: A Class Component (required for `componentDidCatch`). Wraps the entire app. If a runtime error crashes the rendering tree (e.g., `undefined.map`), it catches it and shows a "Something went wrong" screen with a Reload button, rather than a White Screen of Death (WSOD).
- **React 18**: Enables automatic batching (fewer re-renders) and concurrent features.

---

### 3.2 Routing & Navigation (`client/src/App.tsx`)

**File**: `client/src/App.tsx`
**Role**: Directs the user based on URL state.

**Strategy: Query Parameters**
```typescript
function CanvasRouteHandler() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");
  
  if (!roomId) return <LandingPage />;
  return <CanvasPage />;
}
```
- **Why?**: Simple URL-parameter based routing (`?room=ABC`) allows deep-linking. Sharing a link works instantly.
- **Wouter**: We use `wouter` instead of `react-router-dom` because we have a flat 2-page structure. It saves ~30KB of bundle size.

**Landing Page Flow (`landing-page.tsx`)**:
1. User enters Name.
2. User enters Room Code OR clicks "Create New".
3. Saves name to `sessionStorage` (so it persists on refresh).
4. Updates URL to `?room=CODE`.

**Room Header (`room-header.tsx`)**:
- Manages "Exit Room" logic: Explicitly calls `disconnectSocket()` to update presence immediately, then reloads the page to clear state.
- **Client-side ID Generation**: Generates 6-char alphanumeric room codes locally.

---

### 3.3 WebSocket Lifecycle Hook (`client/src/hooks/use-socket.ts`)

**File**: `client/src/hooks/use-socket.ts`
**Role**: The "Brain" of the frontend. Manages the socket connection, syncs state (strokes, users, cursors), and provides action methods (`startStroke`, `undo`).

#### 3.3.1 Dual State Management (Ref + State)
```typescript
const [strokes, setStrokes] = useState<Stroke[]>([]);
const strokesRef = useRef<Map<string, Stroke>>(new Map());
```
- **The Problem**: WebSocket listeners (`on('stroke:point')`) are closures. If they read `strokes` state, they might see stale data from the previous render.
- **The Solution**: We maintain a mutable `strokesRef` (Map) alongside React State.
  - **Reads**: Listeners read from `strokesRef` (always fresh).
  - **Writes**: Listeners update `strokesRef` AND call `setStrokes` to trigger a UI re-render.
- **Why Map?**: O(1) stroke lookup during high-frequency updates (60fps drawing).

#### 3.3.2 Optimistic Rendering
```typescript
const startStroke = useCallback((stroke) => {
  addLocalStroke(stroke); // 1. Update UI immediately
  socket.emit("stroke:start", ...); // 2. Send to server
}, ...);
```
- **Why?**: Network latency is 50-200ms. Waiting for server ACK would feel like input lag.
- **Trade-off**: If the server rejects the stroke (unlikely), the UI might briefly show a ghost stroke.

#### 3.3.3 Cursor Debouncing & Throttling
```typescript
const CURSOR_DEBOUNCE_MS = 35; // ~28fps
// ... logic to limit emit rate ...
```
- **Why?**: `mousemove` fires 100+ times/sec. Sending every event floods the WebSocket channel and server CPU.
- **Algorithm**: We throttle to ~30fps. Crucially, we use a **trailing edge** debounce (via `setTimeout`) to ensure the *final* resting position is always sent, even if the mouse stops moving between ticks.

---

### 3.4 Socket Singleton (`client/src/lib/socket.ts`)

**File**: `client/src/lib/socket.ts`
**Role**: Global connection instance.

```typescript
let socket: Socket | null = null;
export function getSocket() {
  if (!socket) { socket = io(...); }
  return socket;
}
```
- **Singleton Pattern**: Ensures we never accidentally open two connections (which would double-fire events and corrupt state).
- **Transport Strategy**: `transports: ["websocket", "polling"]`. Prefers WebSocket (lower latency), falls back to Long Polling (for corporate firewalls).

---

### 3.5 LocalStorage Persistence (`client/src/lib/persistence.ts`)

**File**: `client/src/lib/persistence.ts`
**Role**: Client-side backup.

- **Storage Key**: `collabcanvas:ROOM_ID:state`. Namespaced by room so users can have multiple active rooms in tabs.
- **Usage**:
  - **Write**: On `stroke:end` or debounced.
  - **Read**: On load, before server connects.
- **Limit**: LocalStorage has ~5MB limit. We catch `QuotaExceededError` gracefully.

---

### 3.6 Performance & Monitoring Utilities

**Files**: `client/src/components/performance-metrics.tsx`, `connection-status.tsx`

- **FPS Counter**: Measures time between `requestAnimationFrame` calls. If it drops below 30fps, we know our canvas rendering is too heavy.
- **Latency Ping**: Emits `socket.emit('ping', () => Date.now())` to measure round-trip time.
- **Connection Status**:
  - 🟢 Connected
  - 🟡 Reconnecting (Network glitch)
  - 🔴 Disconnected
  - Visual feedback is critical for collaborative apps so users don't keep drawing while offline.

---

## 4. Key Design Decisions

### 4.1 Wouter vs React Router
**Decision**: Wouter.
- **Why**: 1KB library vs 30KB. We have a simple flat route structure. Small bundle size = faster First Contentful Paint.

### 4.2 Optimistic UI
**Decision**: Update local state before server confirms.
- **Reasoning**: Drawing must feel instant. Latency > 16ms is noticeable. We sacrifice "perfect consistency" for "perfect responsiveness".

### 4.3 Singleton Socket
**Decision**: One global socket instance.
- **Reasoning**: React components mount/unmount frequently (e.g. strict mode bubbles). A singleton prevents "connection thrashing" where the socket connects/disconnects rapidly on page load.

---

## 5. Debugging Scenarios

### Scenario 1: "Users can't join rooms"
**Symptoms**: Infinite loading spinner.
**Debug**:
1. Check `window.socket.connected` in console.
2. Check `socket.listeners("room:state")`. If empty, the component didn't mount or username is missing.
3. Check Network tab for WS upgrade failure (Status 101 Switching Protocols).

### Scenario 2: "My strokes disappear then reappear"
**Symptoms**: You draw a line, it vanishes, then pops back in.
**Cause**: "Full Sync" event handling.
- You draw stroke A (Optimistic ID: `temp-1`).
- Server receives it, assigns ID `server-1` (or keeps ID if client-generated).
- Server sends `canvas:state` (Full Sync).
- Client replaces local state with server state.
- If timing is off, the Optimistic stroke is wiped before the Server stroke arrives.
**Fix**: Ensure IDs are consistent (client-generated nanoids).

### Scenario 3: "Canvas clears on refresh"
**Symptoms**: Data lost on reload.
**Cause**: Server persistence failed AND LocalStorage failed.
**Check**: Look for `QuotaExceededError` in console (LocalStorage full). Check server logs for write permission errors.

---

## 6. Feature Extension Guide

### Example: User Kick/Ban
1. **Hook**: Add `kickUser(targetId)` to `useSocket`.
2. **Server**: Handler checks if requester is Room Creator (needs `creatorId` in Room schema).
3. **Client**: Listen for `room:kicked`. `disconnectSocket()` and redirect to `/`.

### Example: Reconnection Progress
1. **State**: Add `reconnectAttempts` state to `useSocket`.
2. **Events**: Listen to `io.on("reconnect_attempt", (n) => setAttempts(n))`.
3. **UI**: Show a banner "Reconnecting... (Attempt 3/10)".

---

## 7. Interview Q&A

### Q: "Why handle `stroke:point` in React state? Isn't it slow?"
**Answer:**
"It can be. For 60fps drawing, React state updates overhead is risky.
- **Current Optimization**: We use `strokesRef` (Map) for O(1) data updates and only trigger `setStrokes` to request a render.
- **Future Scale**: If this became a bottleneck (e.g. 10k strokes), I would move the canvas state entirely outside React (e.g. a Mutable class or Zustand vanilla store) and use an explicit `requestAnimationFrame` loop that reads from that external store, bypassing React's render cycle completely for the canvas."

### Q: "How does the app handle offline editing?"
**Answer:**
"Currently, it doesn't support full offline editing (sending changes when back online) because conflict resolution would be too hard without CRDTs. However, it supports **Offline View & Recovery**: LocalStorage keeps the last known state, so if you lose connection, your work isn't lost immediately. You just can't push new updates until reconnected."
