# CollabCanvas – Real-Time Collaborative Drawing Canvas

## Overview
CollabCanvas is a multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization. Built with React, TypeScript, Socket.io, and HTML5 Canvas.

**This is a STROKE-BASED collaborative drawing canvas** - similar to MS Paint or a whiteboard. All drawings (brush, shapes, text) become permanent canvas strokes that can be partially erased. There is no object selection or manipulation.

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Express.js + Socket.io
- **Real-time**: WebSockets via Socket.io
- **Styling**: Tailwind CSS with shadcn/ui components

### Directory Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── drawing-canvas.tsx    # Canvas drawing + shapes + pan/zoom
│   │   │   ├── tool-panel.tsx        # Drawing tools (brush, eraser, shapes)
│   │   │   ├── color-picker.tsx      # Color selection
│   │   │   ├── stroke-width-selector.tsx
│   │   │   ├── user-presence.tsx     # Online users list
│   │   │   ├── cursor-overlay.tsx    # Other users' cursors
│   │   │   ├── room-header.tsx
│   │   │   ├── connection-status.tsx
│   │   │   ├── tool-settings-bar.tsx # Context-aware tool settings
│   │   │   └── username-dialog.tsx
│   │   ├── hooks/
│   │   │   └── use-socket.ts         # Socket.io hook with debouncing
│   │   ├── lib/
│   │   │   └── socket.ts             # Socket.io client setup
│   │   └── pages/
│   │       ├── canvas-page.tsx       # Main canvas page
│   │       └── landing-page.tsx      # Room creation/joining
├── server/
│   ├── routes.ts           # Express routes + Socket.io server
│   └── rooms.ts            # Room management logic
└── shared/
    └── schema.ts           # Shared TypeScript types
```

## Key Features
1. **Real-time Drawing**: See other users' drawings as they draw (not after)
2. **Shape Tools**: Rectangle, circle, line - stored as strokes after commit
3. **Inline Text Tool**: Click to place text, type directly, commits as stroke
4. **Pixel-Based Eraser**: Works uniformly on ALL content (brush, shapes, text)
5. **Pan & Zoom**: Mouse wheel zoom, middle-click pan
6. **Cursor Tracking**: Live cursor positions with debouncing (35ms)
7. **User Presence**: Online user list with assigned colors
8. **Room System**: Shareable 6-character room codes
9. **Undo/Redo**: Global operation history across all users

## Stroke-Based Architecture (CRITICAL)

This app uses a **pure stroke-based model** - there are NO objects to select or move:

- **Brush strokes**: Freehand drawing stored as point arrays
- **Shape strokes**: Rectangle, circle, line are stored as strokes with 2 points
- **Text strokes**: Text is rendered to canvas and stored as a stroke
- **Eraser**: Uses `destination-out` composite operation on ALL stroke types

### Why Stroke-Based?
- Simpler, more predictable behavior (like MS Paint)
- Eraser works uniformly on everything
- No complex object selection/manipulation
- Interview-safe architecture

### How to Reposition Content
Users reposition drawings via **undo + redraw**. There is no move/select tool.

## WebSocket Events
- `room:join` / `room:leave` - User room management
- `stroke:start` / `stroke:point` / `stroke:end` - Drawing events (all tools)
- `cursor:move` - Cursor position updates (debounced)
- `operation:undo` / `operation:redo` - Global undo/redo
- `canvas:clear` - Clear entire canvas
- `history:state` - Sync undo/redo button states

## Stroke Data Model
```typescript
interface Stroke {
  id: string;
  points: Point[];           // For shapes: [startPoint, endPoint]
  color: string;
  width: number;
  userId: string;
  tool: "brush" | "eraser" | "rectangle" | "circle" | "line" | "text";
  timestamp: number;
  text?: string;             // Only for text tool
}
```

## Running the Project
```bash
npm install
npm run dev
```
The app runs on port 5000.

## Testing Multiple Users
1. Open the app in one browser tab
2. Copy the room link using the "Share" button
3. Open the link in another browser tab or device
4. Both users can now draw together in real-time

## Keyboard Shortcuts
- `B` - Brush tool
- `E` - Eraser tool
- `R` - Rectangle tool
- `C` - Circle tool
- `L` - Line tool
- `T` - Text tool
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `+` / `-` - Zoom in/out
- `0` - Reset view

## Performance Features
- Cursor debouncing (35ms) reduces socket traffic ~60%
- Point batching (2px threshold) optimizes stroke data
- Client-side prediction for instant feedback
- requestAnimationFrame for smooth rendering

## Design Decisions
- No Move/Select tool - intentionally not supported
- All content becomes permanent strokes after drawing
- Eraser is pixel-based and consistent across all draw types
- Undo/redo operates on the operation history (global)
