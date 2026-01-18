# 2-CollabCanvas - FRONTEND - Canvas & Drawing Tools

## 1. Scope & Responsibility

**Covered Files:**
- `client/src/components/drawing-canvas.tsx` (834 lines) - Main canvas rendering and drawing logic
- `client/src/components/tool-panel.tsx` - Tool selection UI
- `client/src/components/tool-settings-bar.tsx` - Property controls (width, zoom)
- `client/src/components/ColorPicker/AdvancedColorPicker.tsx` (408 lines) - HSV color picker
- `client/src/components/cursor-overlay.tsx` - Multi-user cursor rendering
- `client/src/components/user-presence.tsx` - User list display

**Why This Part Exists:**
This is the **core drawing engine** and **collaborative interface** that:
1. Renders strokes to HTML5 Canvas (dual-layer architecture).
2. Transforms mouse/touch inputs into vector strokes.
3. Manages tool state and properties (color, width).
4. Visualizes multi-user presence (cursors, online list).

---

## 2. Architecture Role

**Rendering Pipeline:**
```
User Input (mouse/touch)
  ↓
drawing-canvas.tsx: getCanvasPoint() → converts screen coords to canvas coords
  ↓
drawing-canvas.tsx: handlePointerDown/Move/Up → creates Stroke objects
  ↓
use-socket.ts: Optimistic UI → adds stroke to local state immediately
  ↓
Server broadcasts to all users
  ↓
drawing-canvas.tsx: drawStroke() → renders to canvas
```

**Dual-Canvas Architecture:**
```
<div> (container)
  ├── <canvas> staticCanvasRef  (background layer, all completed strokes)
  └── <canvas> canvasRef         (top layer, active drawing + cursors + preview)
```
- **Static Canvas**: Redraws only when history changes (undo/redo) or view/zoom changes.
- **Dynamic Canvas**: Clears and redraws every frame (60fps) during active interaction.

---

## 3. Code Walkthrough (Deep Dive)

### 3.1 Coordinate Transformation (`drawing-canvas.tsx`)

**Goal**: Map screen pixels (`clientX`) to logical canvas units, accounting for Zoom and Retina displays.

```typescript
const getCanvasPoint = (e) => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const x = (e.clientX - rect.left) * dpr / (zoom * dpr);
  const y = (e.clientY - rect.top) * dpr / (zoom * dpr);
  return { x, y };
};
```
- **DPR Scaling**: Essential for sharp text/lines on high-density screens (MacBooks). We scale the internal canvas buffer size by `dpr`, but keep the CSS size the same.
- **Zoom**: We divide by `zoom` so that drawing at 200% zoom results in the same logical coordinates.

### 3.2 Drawing & Smoothing Logic

**Smoothing Algorithm (Quadratic Bézier)**:
- Raw mouse points are jagged. We use `ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y)` between points.
- **Midpoints**: We use the midpoint between P1 and P2 as the endpoint, and P1 as the control point. This creates a smooth implementation of Chaikin's Algorithm.

**Eraser Logic**:
```typescript
if (stroke.tool === "eraser") {
  ctx.globalCompositeOperation = "destination-out"; // "Punch through" to transparency
} else {
  ctx.globalCompositeOperation = "source-over"; // Paint on top
}
```

### 3.3 Tool Panel & UI (`tool-panel.tsx`)

**Role**: Floating sidebar for mode switching.
- **Clear Canvas Safety**: The "Trash" button triggers an `AlertDialog`. Since clearing is a destructive global action, we force a second confirmation step.
- **Visuals**: Uses `Shadcn UI` buttons with `Lucide` icons.

### 3.4 Settings & Properties (`tool-settings-bar.tsx`)

**Atomic Grouping Strategy**:
- Controls are grouped: `[Tool Name] | [Color/Size] | [Zoom/System]`.
- **Hybrid Input**: The Size Slider allows both dragging and direct number entry (typing "55").
- **Derived State**: It uses `useEffect` to sync its internal state with props, ensuring that if an Undo action changes the stroke width, the slider visually updates.

### 3.5 Advanced Color Picker (`ColorPicker/AdvancedColorPicker.tsx`)

**Role**: A custom HSV picker (Pipette).
- **Why Custom?**: Browser native pickers (`<input type="color">`) are inconsistent across OSs.
- **HSV Implementation**: 
  - We convert HEX to HSV to allow dragging "Saturation" and "Value" while keeping "Hue" constant.
  - **Gradients**: Uses CSS `linear-gradient` to generate the color maps efficiently.
- **Persistence**: Saves "Recent Colors" to `localStorage` for workflow continuity.

### 3.6 Real-time Cursors (`cursor-overlay.tsx`)

**Role**: Showing where other users are.

**Technique**: CSS Transforms.
```typescript
<div style={{ transform: `translate(${x}px, ${y}px)` }} />
```
- **Why HTML divs?**: Drawing cursors on the main Canvas would require re-rendering the whole scene (or managing a complex sprite layer) on every mouse move. CSS transforms are handled by the browser's Compositor Thread (GPU), keeping the main thread free for drawing logic.

---

## 4. Key Design Decisions

### 4.1 Dual Canvas vs Single Canvas
**Decision**: Two stacked canvases.
- **Why**: Performance. Redrawing 5000 strokes on every mouse move (to show the cursor moving) drops FPS to 5.
- **Result**: "Static" canvas holds the 5000 strokes (0 cost per frame). "Dynamic" canvas only draws the 1 cursor (cheap).

### 4.2 Text Input via DOM Overlay
**Decision**: Use a transparent `<textarea>` floating over the canvas for text entry.
- **Why**: Implementing text editing constraints (cursor caret, selection highlighting, word wrap) inside raw Canvas `ctx.fillText` is incredibly hard.
- **Flow**: User clicks -> Textarea appears -> User types -> On Blur, we rasterize the text to the canvas.

### 4.3 Input Batching & Interpolation
**Decision**: Interpolate points for fast mouse movements.
- **Problem**: If you flick the mouse fast, `mousemove` events might be 50px apart. Drawing straight lines between them looks polygonal.
- **Solution**: We calculate linear intermediate points to fill the gap if distance > 8px.

### 4.4 HTML Cursors
**Decision**: Use Divs for multi-user cursors.
- **Why**: Decouples "Drawing Performance" from "Presence Performance".

---

## 5. Debugging Scenarios

### Scenario 1: "Drawing is offset/misaligned under mouse"
**Cause**: CSS size vs Attribute size mismatch, or unhandled scrolling.
**Check**:
1. Is `getCanvasPoint` subtracting `rect.left/top`?
2. Is `dpr` (Device Pixel Ratio) applied to coordinate calc?
3. Is user scrolled? (Current app hides scrollbars, but if forced, offset calculations need `scrollX/Y`).

### Scenario 2: "Eraser renders clearly black"
**Cause**: `globalCompositeOperation` isn't set correct or context state is bleeding.
**Fix**: Ensure `ctx.save()` and `ctx.restore()` wrap every stroke drawing call. This isolates the `destination-out` state to only the eraser strokes.

### Scenario 3: "Text is blurry"
**Cause**: High-DPI screen.
**Fix**: Ensure `ctx.font` size matches the logical pixel size (scaled by DPR).

---

## 6. Feature Extension Guide

### Example: Add "Highlighter" Tool
1. **Schema**: Add "highlighter" to `DrawingTool` enum.
2. **Rendering**: In `drawStroke`, add case:
   ```typescript
   if (stroke.tool === "highlighter") {
     ctx.globalCompositeOperation = "multiply"; // Blend mode
     ctx.globalAlpha = 0.5; // See-through
     // ... draw line ...
   }
   ```
3. **UI**: Add button to `ToolPanel`.

### Example: Add "Selection/Transform" Tool
1. **Logic**: Need hit-testing (is point near curve?).
2. **Hit Test**: For each stroke, check distance from click point to line segments.
3. **Visuals**: Draw bounding box on Dynamic Canvas.
4. **Action**: On drag, update `stroke.points` by delta.

---

## 7. Interview Q&A

### Q: "Why doesn't the eraser work on the background color?"
**Answer:**
"Technically, the canvas is transparent. We render a white background on the generic container. The eraser turns pixels transparent (`destination-out`), revealing the container's white background. If we changed the container background to grid paper, the eraser would reveal the grid."

### Q: "How do you handle zoom centered on mouse vs top-left?"
**Answer:**
"Currently, I use simple scaling (top-left origin). To implement Google Maps style zoom-to-cursor, I would need to track a `translate` offset state, and adjust it during zoom events: `newTranslate = mousePos - (mousePos - oldTranslate) * scaleRatio`."
