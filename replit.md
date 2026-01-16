# CollabCanvas – Real-Time Collaborative Drawing Canvas

## Overview
CollabCanvas is a multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization. Built with React, TypeScript, Socket.io, and HTML5 Canvas.

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
    └── schema.ts           # Shared TypeScript types (Stroke, Shape, etc.)
```

## Key Features
1. **Real-time Drawing**: See other users' drawings as they draw (not after)
2. **Shape Tools**: Rectangle, circle, line tools with drag-and-drop
3. **Inline Text Tool**: Click to place text, type directly on canvas (Canva-style)
4. **Pixel-Based Eraser**: MS Paint/Photoshop-style erasing - gradual pixel removal, no object deletion
5. **Pan & Zoom**: Mouse wheel zoom, middle-click pan
6. **Cursor Tracking**: Live cursor positions with debouncing (35ms)
7. **User Presence**: Online user list with assigned colors
8. **Drawing Tools**: Brush, eraser, color picker, stroke width
9. **Room System**: Shareable 6-character room codes
10. **Undo/Redo**: Global operation history across all users
11. **Move/Select Tool**: Click to select shapes/text, drag to reposition with undo/redo support
12. **ToolSettingsBar**: Photoshop-style context-aware top bar showing tool-specific settings

## Eraser Implementation
The eraser only works on freehand brush strokes (NOT shapes or text):
- Uses `globalCompositeOperation = "destination-out"` for Canvas API pixel clearing
- Strokes are rendered first, then shapes are rendered on top
- Eraser strokes ONLY affect other brush strokes drawn before them
- Shapes and text are NEVER affected by the eraser
- To delete shapes/text, use the Move/Select tool (V) → select shape → Delete button
- Undo removes the eraser stroke, triggering a full canvas redraw that restores strokes

## WebSocket Events
- `room:join` / `room:leave` - User room management
- `stroke:start` / `stroke:point` / `stroke:end` - Drawing events
- `shape:add` - Shape creation events
- `shape:update` - Shape position updates (for move operations)
- `cursor:move` - Cursor position updates (debounced)
- `operation:undo` / `operation:redo` - Global undo/redo
- `canvas:clear` - Clear entire canvas
- `history:state` - Sync undo/redo button states

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
- `V` - Move/Select tool
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `+` / `-` - Zoom in/out
- `0` - Reset view

## Performance Features
- Cursor debouncing (35ms) reduces socket traffic ~60%
- Point batching (2px threshold) optimizes stroke data
- Client-side prediction for instant feedback
- requestAnimationFrame for smooth rendering
