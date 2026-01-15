# Real-Time Collaborative Drawing Canvas

## Overview
A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization. Built with React, TypeScript, Socket.io, and HTML5 Canvas.

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
│   │   │   ├── drawing-canvas.tsx    # Canvas drawing logic
│   │   │   ├── tool-panel.tsx        # Drawing tools (brush, eraser)
│   │   │   ├── color-picker.tsx      # Color selection
│   │   │   ├── stroke-width-selector.tsx
│   │   │   ├── user-presence.tsx     # Online users list
│   │   │   ├── cursor-overlay.tsx    # Other users' cursors
│   │   │   ├── room-header.tsx
│   │   │   ├── connection-status.tsx
│   │   │   └── username-dialog.tsx
│   │   ├── hooks/
│   │   │   └── use-socket.ts         # Socket.io hook
│   │   ├── lib/
│   │   │   └── socket.ts             # Socket.io client setup
│   │   └── pages/
│   │       └── canvas-page.tsx       # Main canvas page
├── server/
│   ├── routes.ts           # Express routes + Socket.io server
│   └── rooms.ts            # Room management logic
└── shared/
    └── schema.ts           # Shared TypeScript types
```

## Key Features
1. **Real-time Drawing**: See other users' drawings as they draw (not after)
2. **Cursor Tracking**: Live cursor positions of all users
3. **User Presence**: Online user list with assigned colors
4. **Drawing Tools**: Brush, eraser, color picker, stroke width
5. **Room System**: Shareable room links for collaboration
6. **Undo/Redo**: Global operation history across all users

## WebSocket Events
- `room:join` / `room:leave` - User room management
- `stroke:start` / `stroke:point` / `stroke:end` - Drawing events
- `cursor:move` - Cursor position updates
- `operation:undo` / `operation:redo` - Global undo/redo
- `canvas:clear` - Clear entire canvas

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
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
