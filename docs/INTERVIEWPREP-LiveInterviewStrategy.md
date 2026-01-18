# Interview Prep & Live Strategy

## 1. The 5-Minute Demo Script

*Goal: Show competence immediately.*

**0:00 - The Hook**
"I built a real-time collaborative whiteboard. It helps distributed teams brainstorm by allowing multiple users to draw simultaneously with zero perceived latency."

**0:45 - Key Features Demo**
1. **Open two distinct browser windows** (Incognito vs Regular).
2. **Create Room** in one, copy code, join in the other.
3. **Draw a shape** in Window A. "As you see, it appears instantly in Window B."
4. **Demonstrate Conflict/Undo**: "If I undo in Window B, it removes the action from Window A. This requires a global operation history."
5. **Demonstrate Reconnection**: Kill the server terminal. Reload page. "The state persists because we save to disk."

**2:30 - Architecture Brief**
"I chose a dual-layer canvas architecture. The static layer holds the history, while the dynamic layer handles high-frequency updates. This ensures we can maintain 60FPS even with thousands of existing strokes."

**3:30 - Code Walkthrough**
"I can show you the `useSocket` hook which manages the optimistic UI updates, or the `DrawingCanvas` component where the interpolation logic lives. Which would you prefer?"

---

## 2. Technical Talking Points

### "How do you handle latency?"
- **Optimistic UI**: I render the user's own stroke immediately. I don't wait for server ACK.
- **Interpolation**: Data points come in discrete packets (e.g., every 10-20ms). I use curve algorithms to smooth the lines so they look natural despite network jitter.

### "Why Socket.io?"
- It handles reconnections automatically.
- It provides 'Process isolation' via Rooms.
- While WebSockets are lighter, the development velocity gained from Socket.io's reliability features outweighed the byte-size overhead.

### "How does Undo/Redo work efficiently?"
- We don't save full snapshots (too much memory).
- We use an **Operation Log** (CRDT-style).
- We have a **Static Canvas**. When we undo, we actually have to clear the canvas and replay the history minus the last action.
- *Optimization*: If history is huge, we can introduce "Checkpoints" (snapshots) every 50 operations to limit replay time (future improvement).

---

## 3. Scaling Discussion

**Interviewer: "How would you scale this to 10,000 users?"**

**Phase 1: Vertical Scaling (Now)**
- Node.js is single-threaded. One server can handle ~1-2k concurrent connections before event loop blocks.

**Phase 2: Redis Adapter (Next Step)**
- Use `socket.io-redis-adapter`.
- Run multiple Node.js instances (Cluster mode).
- Redis acts as the Pub/Sub bus. If User A is on Server 1 and User B on Server 2, Redis routes the messages between them.

**Phase 3: Geographic Distribution (Global)**
- Use a managed WebSocket service (like Pusher or AWS API Gateway + Lambda) or deploy Edge nodes.
- Canvas state (JSON) moves from local disk to S3/Blob Storage or a database like DynamoDB.

---

## 4. Live Coding: "Add a Rectangle Tool"

If asked to add a feature live:
1. **Model**: Update `Stroke` type to include `type: 'free' | 'rectangle'`.
2. **Component**: Add button to `ToolPanel`.
3. **Logic**: In `DrawingCanvas`, on `pointerDown`, record start `(x1, y1)`.
4. **Draft**: On `pointerMove`, calculate `width = x2-x1`, `height = y2-y1`. Use `ctx.strokeRect`.
5. **Finalize**: On `pointerUp`, emit rectangle data structure instead of point array.

---

## 5. Potential Debugging Scenarios

**Bug: "Lines look jagged/pointy."**
- *Fix*: Check the `DrawingCanvas`. Are we using `lineTo` (linear) or `quadraticCurveTo` (smooth)? The fix is implementing point averaging or Catmull-Rom splines.

**Bug: "My drawing disappears on refresh."**
- *Fix*: Check `client/src/hooks/useSocket.ts`. Are we listening for the `room:state` event? Check Server `rooms.ts`: is it correctly reading the JSON file on initialization?
