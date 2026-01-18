# 4-CollabCanvas - SHARED - Types & Contracts

## 1. Scope & Responsibility

**Covered Files:**
- `shared/schema.ts` (110 lines) - TypeScript type definitions and Zod schemas

**Why This Part Exists:**
This is the **API contract layer** that:
1. Defines data structures shared between client and server
2. Provides runtime type validation using Zod
3. Ensures type safety across WebSocket events
4. Prevents deserialization errors
5. Documents the data model for the entire system

**Key principle**: Single source of truth for all data types.

---

## 2. Architecture Role

**Position in System:**
```
Client (TypeScript)
  ↓
shared/schema.ts (Type definitions)
  ↑
Server (TypeScript)

WebSocket Event:
  Client → socket.emit("stroke:start", { stroke: Stroke })
                                            ↑
                                  Type checked by TypeScript
                                  Validated by Zod at runtime
  Server → socket.on("stroke:start", (data: { stroke: Stroke }))
                                              ↑
                                    Type checked by TypeScript
```

**Benefits of shared types:**
1. **Compile-time safety**: TypeScript catches mismatches during development
2. **Runtime validation**: Zod validates data at runtime (catches malformed WebSocket data)
3. **Self-documenting**: Types serve as API documentation
4. **Refactoring safety**: Change type once, errors show everywhere it's used

---

## 3. Code Walkthrough (Interview Level)

### 3.1 Point Schema (Lines 3-7)

```typescript
export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Point = z.infer<typeof pointSchema>;
```

**What it does:**
Defines a 2D coordinate point.

**Zod schema explained:**
```typescript
z.object({        // Object with specific properties
  x: z.number(),  // x must be a number
  y: z.number(),  // y must be a number
})
```

**Runtime validation:**
```typescript
// Valid
const point = pointSchema.parse({ x: 100, y: 200 });

// Throws error
const invalid = pointSchema.parse({ x: "hello", y: 200 });
// ZodError: Expected number, received string

// Safe parsing (returns result object)
const result = pointSchema.safeParse({ x: 100, y: 200 });
if (result.success) {
  console.log(result.data);  // { x: 100, y: 200 }
} else {
  console.log(result.error);  // ZodError
}
```

**Why both schema and type:**
```typescript
export const pointSchema = z.object(...);  // Runtime validation
export type Point = z.infer<typeof pointSchema>;  // Compile-time type
```
- **Schema**: Used at runtime to validate incoming data
- **Type**: Used at compile-time by TypeScript
- **z.infer<>**: Extracts TypeScript type from Zod schema (keeps them in sync)

**Alternative (without Zod):**
```typescript
// Manual definition (more verbose, easy to drift)
export interface Point {
  x: number;
  y: number;
}

// Manual validation (error-prone)
function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    typeof value.x === "number" &&
    "y" in value &&
    typeof value.y === "number"
  );
}
```
- ❌ Schema and type can drift apart
- ❌ Validation logic duplicated
- ✅ Zod: Define once, get both schema and type

---

### 3.2 Stroke Schema (Lines 9-18)

```typescript
export const strokeSchema = z.object({
  id: z.string(),
  points: z.array(pointSchema),
  color: z.string(),
  width: z.number(),
  userId: z.string(),
  tool: z.enum(["brush", "eraser", "rectangle", "circle", "line", "text"]),
  timestamp: z.number(),
  text: z.string().optional(),
});

export type Stroke = z.infer<typeof strokeSchema>;
```

**What it does:**
Defines a complete drawing stroke with all metadata.

**Field explanations:**

**id (string):**
```typescript
id: "stroke_abc123def456"
```
- Unique identifier for this stroke
- Generated using nanoid: `stroke_${nanoid()}`
- Used for:
  - Map lookups (O(1) access)
  - WebSocket event targeting ("update stroke X")
  - Undo/redo tracking

**points (Point[]):**
```typescript
points: [
  { x: 100, y: 200 },
  { x: 101, y: 201 },
  { x: 102, y: 202 },
  // ... can be 100+ points for long strokes
]
```
- Array of canvas coordinates
- Brush: Many points (smooth curve)
- Rectangle/Circle: Only 2 points (start + end)
- Text: Only 1 point (anchor position)

**color (string):**
```typescript
color: "#EF4444"  // Hex color
```
- CSS hex color format
- Used directly in `ctx.strokeStyle = color`
- No validation beyond "must be string" (could add regex pattern)

**width (number):**
```typescript
width: 5  // Stroke width in pixels
```
- Line thickness for brush/eraser
- Rectangle/circle outline thickness
- Text: Font size = width × 4

**userId (string):**
```typescript
userId: "socket_xyz789"  // Socket.io connection ID
```
- Who created this stroke
- Used for:
  - Ownership validation (prevent spoofing)
  - User presence (show who's drawing)
  - Analytics (track contributions)

**tool (enum):**
```typescript
tool: "brush" | "eraser" | "rectangle" | "circle" | "line" | "text"
```
- Determines rendering logic
- Zod enum: Compile-time type + runtime validation
- Invalid tool rejected by server

**timestamp (number):**
```typescript
timestamp: 1640000000000  // Unix timestamp (ms)
```
- When stroke was created
- Used for:
  - Sorting strokes (render order)
  - Conflict resolution
  - Operation history ordering

**text (optional string):**
```typescript
text: "Hello World"  // Only for text tool
```
- Only present if `tool === "text"`
- Contains user's typed text
- Optional: Most strokes don't have text

---

### 3.3 User Schema (Lines 20-28)

```typescript
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  color: z.string(),
  cursorPosition: pointSchema.nullable(),
  isDrawing: z.boolean(),
});

export type User = z.infer<typeof userSchema>;
```

**What it does:**
Represents a connected user with their presence state.

**Field explanations:**

**id (string):**
```typescript
id: "socket_abc123"  // Socket.io connection ID
```
- Unique per connection
- Changes if user reconnects
- Used to track who's who in the room

**username (string):**
```typescript
username: "Alice"
```
- Display name entered on landing page
- Not guaranteed unique (no validation)
- Shown in user list and presence indicators

**color (string):**
```typescript
color: "#EF4444"  // Assigned from USER_COLORS array
```
- User's cursor and name color
- Assigned by server on join
- Rotates through predefined palette

**cursorPosition (Point | null):**
```typescript
cursorPosition: { x: 150, y: 250 }  // Visible on canvas
cursorPosition: null                  // Mouse left canvas or disconnected
```
- Current mouse position
- Updated 28 times/second (debounced)
- Null when:
  - Mouse leaves canvas
  - User disconnected
  - User hasn't moved mouse yet

**isDrawing (boolean):**
```typescript
isDrawing: true   // User is actively drawing
isDrawing: false  // User just moving cursor
```
- Indicates if user is drawing or just hovering
- Used for:
  - Cursor visual (show thicker cursor while drawing)
  - Presence awareness ("Alice is drawing")

**Design decision: Why include isDrawing?**
```
Alternative 1: Infer from stroke existence
  if (user.activeStrokeId) { isDrawing = true; }
  ❌ Requires tracking active strokes
  ❌ More complex state management

Alternative 2: Explicit boolean (current)
  ✅ Simple to track
  ✅ Works even without active stroke (e.g., shape preview)
```

---

### 3.4 Drawing Tool Enum (Lines 30-32)

```typescript
export const drawingToolSchema = z.enum(["brush", "eraser", "rectangle", "circle", "line", "text"]);
export type DrawingTool = z.infer<typeof drawingToolSchema>;
```

**What it does:**
Defines valid drawing tools as a union type.

**TypeScript type:**
```typescript
type DrawingTool = "brush" | "eraser" | "rectangle" | "circle" | "line" | "text";
```

**Runtime validation:**
```typescript
drawingToolSchema.parse("brush");      // ✓ Valid
drawingToolSchema.parse("pencil");     // ✗ Throws ZodError
```

**Why enum instead of string:**
```typescript
// Without enum (unsafe)
let tool: string = "pencil";
socket.emit("tool:change", tool);  // Server crashes (unknown tool)

// With enum (safe)
let tool: DrawingTool = "pencil";  // ✗ Compile error
let tool: DrawingTool = "brush";   // ✓ Compiles
```

**Adding new tool:**
```typescript
// Step 1: Add to schema
export const drawingToolSchema = z.enum([
  "brush", "eraser", "rectangle", "circle", "line", "text",
  "highlighter"  // New tool
]);

// Step 2: TypeScript errors show everywhere tool is used
// - drawing-canvas.tsx: Add rendering logic
// - tool-panel.tsx: Add button
// - strokeSchema: Already includes tool field
```

---

### 3.5 Operation Schema (Lines 72-82)

```typescript
export const operationSchema = z.object({
  type: z.enum(["draw", "erase", "undo", "redo", "clear"]),
  strokeId: z.string().optional(),
  stroke: strokeSchema.optional(),
  userId: z.string(),
  timestamp: z.number(),
});

export type Operation = z.infer<typeof operationSchema>;
```

**What it does:**
Represents a historical action for undo/redo.

**Field explanations:**

**type (enum):**
```typescript
type: "draw"   // User drew a stroke
type: "erase"  // User erased (special draw)
type: "clear"  // User cleared entire canvas
type: "undo"   // User undid an operation
type: "redo"   // User redid an operation
```

**strokeId (optional string):**
```typescript
// For "draw" operation:
{ type: "draw", strokeId: "stroke_abc123", stroke: { ... } }

// For "clear" operation:
{ type: "clear" }  // No strokeId needed
```

**stroke (optional Stroke):**
```typescript
// When creating operation:
{ type: "draw", stroke: fullStrokeObject }

// When undoing:
// Need full stroke to restore it
```

**Why store full stroke in operation:**
```
Undo "draw" operation:
  1. Remove stroke from canvas
  2. Store stroke in undoneOperations (for redo)
  
Redo "draw" operation:
  1. Restore stroke from undoneOperations
  2. Need full stroke data to re-render
```

**Operation history structure:**
```typescript
interface Room {
  operationHistory: Operation[];    // Can undo these
  undoneOperations: Operation[];    // Can redo these
}

// Example state:
operationHistory: [
  { type: "draw", strokeId: "s1", ... },  // Oldest
  { type: "draw", strokeId: "s2", ... },
  { type: "draw", strokeId: "s3", ... },  // Newest
]
undoneOperations: []  // Nothing to redo

// After undo:
operationHistory: [
  { type: "draw", strokeId: "s1", ... },
  { type: "draw", strokeId: "s2", ... },
]
undoneOperations: [
  { type: "draw", strokeId: "s3", ... },  // Can redo this
]
```

---

### 3.6 Color Palettes (Lines 84-110)

```typescript
export const USER_COLORS = [
  "#EF4444",  // Red
  "#F97316",  // Orange
  "#EAB308",  // Yellow
  "#22C55E",  // Green
  "#06B6D4",  // Cyan
  "#3B82F6",  // Blue
  "#8B5CF6",  // Purple
  "#EC4899",  // Pink
  "#14B8A6",  // Teal
  "#F43F5E",  // Rose
];

export const DRAWING_COLORS = [
  "#1F2937",  // Black
  "#EF4444",  // Red
  "#F97316",  // Orange
  "#EAB308",  // Yellow
  "#22C55E",  // Green
  "#06B6D4",  // Cyan
  "#3B82F6",  // Blue
  "#8B5CF6",  // Purple
  "#EC4899",  // Pink
  "#FFFFFF",  // White
];
```

**What it does:**
Predefined color palettes for users and drawing tools.

**USER_COLORS usage:**
```typescript
// Server assigns color on user join
const color = USER_COLORS[room.userColorIndex % USER_COLORS.length];
room.userColorIndex++;

// Result: Users get distinct colors (rotate through palette)
// User 1 → Red
// User 2 → Orange
// User 3 → Yellow
// ...
// User 11 → Red (wraps around)
```

**DRAWING_COLORS usage:**
```typescript
// Client shows color picker
<div className="color-palette">
  {DRAWING_COLORS.map(color => (
    <button
      key={color}
      style={{ backgroundColor: color }}
      onClick={() => setCurrentColor(color)}
    />
  ))}
</div>
```

**Why predefined palettes:**
- **User colors**: Distinct, high-contrast colors for visibility
- **Drawing colors**: Common colors + black/white
- **Alternative**: Let users pick any color (color picker)
  - ✅ More flexibility
  - ❌ Users might pick similar colors (confusing)
  - ❌ Accessibility issues (low contrast)

**Design decision: Tailwind colors**
```typescript
"#EF4444"  // Tailwind red-500
"#F97316"  // Tailwind orange-500
```
- Uses Tailwind CSS color system
- Professional-looking palette
- Matches rest of UI

---

## 4. Key Design Decisions

### 4.1 Why Zod Instead of Plain TypeScript Types?

**Decision**: Use Zod schemas for all shared types

**Reasoning:**

**Problem: TypeScript types are compile-time only**
```typescript
// Compile-time type
interface Point {
  x: number;
  y: number;
}

// Runtime data from WebSocket
const data = JSON.parse(socketMessage);  // type: any
const point: Point = data;  // ✗ No validation, trusts data blindly
```

**Solution: Zod runtime validation**
```typescript
const point = pointSchema.parse(data);  // ✓ Validates at runtime
// Throws ZodError if data doesn't match schema
```

**Real-world scenario:**
```
Malicious client sends:
{ x: "DROP TABLE users;", y: 200 }

Without Zod:
  Server: point.x is string
  Code: const distance = Math.sqrt(point.x * point.x + ...)
  Result: NaN, app breaks

With Zod:
  Server: pointSchema.parse() throws ZodError
  Code: Never executes, request rejected
  Result: App safe, attack blocked
```

**Trade-offs:**
- ❌ Larger bundle size (~30KB for Zod)
- ❌ Slight runtime overhead (~1ms per validation)
- ✅ Prevents entire class of bugs
- ✅ Self-documenting API
- ✅ Type-safe + runtime-safe

---

### 4.2 Why Optional Text Field in Stroke?

**Decision**: `text: z.string().optional()` instead of separate TextStroke type

**Alternative 1: Separate types**
```typescript
interface BrushStroke {
  id: string;
  points: Point[];
  tool: "brush" | "eraser" | "rectangle" | "circle" | "line";
}

interface TextStroke {
  id: string;
  point: Point;
  tool: "text";
  text: string;
}

type Stroke = BrushStroke | TextStroke;
```
- ✅ More type-safe (text guaranteed for text tool)
- ❌ Complex type guards needed everywhere
- ❌ Harder to store in same array/map

**Alternative 2: Optional field (chosen)**
```typescript
interface Stroke {
  id: string;
  points: Point[];
  tool: DrawingTool;
  text?: string;  // Only used if tool === "text"
}
```
- ✅ Simpler: All strokes same type
- ✅ Easy to store in Map/Array
- ❌ text might be undefined for text strokes (need runtime check)

**Why simpler is better:**
```typescript
// With union type (complex):
function renderStroke(stroke: Stroke) {
  if (stroke.tool === "text") {
    const textStroke = stroke as TextStroke;
    renderText(textStroke.text);  // Type guard needed
  }
}

// With optional field (simple):
function renderStroke(stroke: Stroke) {
  if (stroke.tool === "text" && stroke.text) {
    renderText(stroke.text);  // Simple check
  }
}
```

---

### 4.3 Why Store Full Stroke in Operations?

**Decision**: Operations store full `stroke` object, not just `strokeId`

**Alternative 1: Store only ID**
```typescript
interface Operation {
  type: "draw";
  strokeId: string;  // Just the ID
}

// To undo:
const stroke = room.strokes.get(operation.strokeId);
room.strokes.delete(operation.strokeId);
```
- ✅ Smaller memory footprint
- ❌ What if stroke was already deleted? Can't restore
- ❌ Can't redo after stroke removed

**Alternative 2: Store full stroke (chosen)**
```typescript
interface Operation {
  type: "draw";
  strokeId: string;
  stroke: Stroke;  // Full object
}

// To undo:
room.strokes.delete(operation.strokeId);
// stroke still available in operation for redo

// To redo:
room.strokes.set(operation.strokeId, operation.stroke);
```
- ✅ Can always restore stroke (have full data)
- ✅ Redo works reliably
- ❌ More memory (duplicate stroke data)

**Memory consideration:**
```
1 stroke: ~500 bytes (100 points × 5 bytes per point)
1000 operations: ~500KB (acceptable)
100,000 operations: ~50MB (might need cleanup)
```
- For typical use (1000 operations), memory cost acceptable
- Benefits of reliable undo/redo outweigh cost

---

### 4.4 Shared Schema (Monorepo-style)
**Decision**: Single `shared/` folder for types.
- **Why**: Instead of duplicating types in `client/src/types.ts` and `server/src/types.ts`, we define them once.
- **Benefit**: Unbreakable contract. Changing a type here updates both frontend and backend typescript checks instantly.
- **Trade-off**: Requires build tooling configuration (tsconfig paths) to allow importing outside `src`.

### 4.5 Separating `Stroke` from `StrokePoint`
**Decision**: We have a full `Stroke` object and a partial `StrokePoint` object.
- **Why**: Bandwidth optimization.
- **Scenario**: During drawing (60fps), we stream `StrokePoint` (just `{id, point}`). We only send the full `Stroke` metadata (color, tool, width) once at the start.
- **Impact**: Reduces WebSocket payload size by ~40% during active drawing.

---

## 5. Debugging Scenarios

### Scenario 1: "WebSocket events not firing"

**Symptoms:**
- Client emits event
- Server never receives it

**Debug with Zod:**
```typescript
// Add logging to event handler
socket.on("stroke:start", (data) => {
  console.log("Raw data:", data);
  
  try {
    const validated = strokeDataSchema.parse(data);
    console.log("Validated:", validated);
  } catch (error) {
    console.error("Validation error:", error);
    // ZodError shows exactly what's wrong
  }
});
```

**Common issues:**

**Issue 1: Wrong property name**
```typescript
// Client sends:
socket.emit("stroke:start", { strokes: stroke });  // ❌ "strokes" (plural)

// Server expects:
socket.on("stroke:start", (data: { stroke: Stroke }) => {
  // data.stroke is undefined
});

// Zod catches this:
strokeDataSchema.parse(data);
// ZodError: Required field "stroke" is missing
```

**Issue 2: Wrong type**
```typescript
// Client sends:
socket.emit("stroke:start", { stroke: { points: "100,200" } });  // ❌ String

// Zod catches this:
strokeSchema.parse(data.stroke);
// ZodError: Expected array at path "points", received string
```

---

### Scenario 2: "Stroke renders in wrong position after zoom"

**Symptoms:**
- Stroke appears offset
- Only at certain zoom levels

**Root cause:**
```typescript
// Point coordinates might be strings instead of numbers
const point = { x: "100", y: "200" };  // ❌ Strings from JSON

// Canvas rendering:
ctx.moveTo(point.x, point.y);  // Works (coerced to numbers)
ctx.lineTo(point.x * zoom, point.y * zoom);  // ❌ "100" * 2 = 200 (lucky)
// But: "100" + offset = "100undefined" (broken)
```

**Zod prevents this:**
```typescript
const point = pointSchema.parse({ x: "100", y: "200" });
// ZodError: Expected number, received string

// Fix: Coerce to numbers
const pointSchema = z.object({
  x: z.number().or(z.string().transform(Number)),
  y: z.number().or(z.string().transform(Number)),
});
```

---

## 6. Feature Extension Guide

### Example: Add Stroke Opacity

**Requirements:**
- Each stroke can have opacity (0-100%)
- Default: 100% (fully opaque)
- Eraser always 100%

**Implementation:**

**Step 1: Update schema**
```typescript
export const strokeSchema = z.object({
  id: z.string(),
  points: z.array(pointSchema),
  color: z.string(),
  width: z.number(),
  userId: z.string(),
  tool: z.enum(["brush", "eraser", "rectangle", "circle", "line", "text"]),
  timestamp: z.number(),
  text: z.string().optional(),
  opacity: z.number().min(0).max(1).default(1),  // NEW: 0-1 range
});
```

**Step 2: Update rendering**
```typescript
// client/src/components/drawing-canvas.tsx
const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  ctx.globalAlpha = stroke.opacity;  // NEW: Set opacity
  // ... rest of rendering
  ctx.globalAlpha = 1;  // Reset
};
```

**Step 3: Add UI control**
```typescript
// client/src/components/tool-settings-bar.tsx
<Slider
  value={[opacity * 100]}
  onValueChange={([value]) => setOpacity(value / 100)}
  min={0}
  max={100}
  step={5}
/>
```

**Step 4: Update stroke creation**
```typescript
const newStroke: Stroke = {
  // ... existing fields
  opacity: currentTool === "eraser" ? 1 : opacity,  // Force 100% for eraser
};
```

**Benefits of Zod:**
- Changed schema → TypeScript errors everywhere stroke created
- Runtime validation prevents invalid opacity values
- `.default(1)` ensures backwards compatibility with old strokes

---

## 7. Interview Q&A

### Q: "Why not use JSON Schema instead of Zod?"

**Answer:**
"Both solve similar problems (runtime validation), but Zod has advantages:

**JSON Schema:**
```json
{
  "type": "object",
  "properties": {
    "x": { "type": "number" },
    "y": { "type": "number" }
  },
  "required": ["x", "y"]
}
```
- ✅ Language-agnostic (works in any language)
- ❌ Separate from TypeScript types (duplicated effort)
- ❌ Verbose JSON syntax
- ❌ Weak TypeScript integration

**Zod:**
```typescript
const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
type Point = z.infer<typeof pointSchema>;
```
- ✅ Define once, get both schema and type
- ✅ Type-safe by design (TypeScript first)
- ✅ Concise syntax
- ❌ TypeScript only

For a TypeScript project, Zod is better. For polyglot API (multiple languages), JSON Schema makes sense."

---

### Q: "How would you version this schema?"

**Answer:**
"For breaking changes, add version field:

```typescript
const strokeSchemaV1 = z.object({
  version: z.literal(1),
  // ... fields
});

const strokeSchemaV2 = z.object({
  version: z.literal(2),
  // ... new fields
  opacity: z.number(),  // NEW in V2
});

const strokeSchema = z.discriminatedUnion("version", [
  strokeSchemaV1,
  strokeSchemaV2,
]);
```

**Server handles both:**
```typescript
socket.on("stroke:start", (data) => {
  const stroke = strokeSchema.parse(data.stroke);
  
  if (stroke.version === 1) {
    // Upgrade to V2
    stroke.opacity = 1;  // Default opacity
    stroke.version = 2;
  }
  
  // Process as V2
});
```

**Benefits:**
- Backwards compatible (old clients still work)
- Gradual migration (no big-bang deployment)
- Clear versioning (know what features available)

**When to version:**
- Breaking schema changes
- New required fields
- Changed field meanings

**When NOT to version:**
- New optional fields (backwards compatible)
- Internal refactoring (no API change)
- Bug fixes"

---

**END OF SHARED-TypesAndContracts.md**

------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
