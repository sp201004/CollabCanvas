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
4. **Pan & Zoom**: Mouse wheel zoom, middle-click pan
5. **Cursor Tracking**: Live cursor positions with debouncing (35ms)
6. **User Presence**: Online user list with assigned colors
7. **Drawing Tools**: Brush, eraser, color picker, stroke width
8. **Room System**: Shareable 6-character room codes
9. **Undo/Redo**: Global operation history across all users
10. **Persistence**: LocalStorage auto-save + JSON export/import

## WebSocket Events
- `room:join` / `room:leave` - User room management
- `stroke:start` / `stroke:point` / `stroke:end` - Drawing events
- `shape:add` - Shape creation events
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
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `+` / `-` - Zoom in/out
- `0` - Reset view

## Performance Features
- Cursor debouncing (35ms) reduces socket traffic ~60%
- Point batching (2px threshold) optimizes stroke data
- Client-side prediction for instant feedback
- requestAnimationFrame for smooth rendering
