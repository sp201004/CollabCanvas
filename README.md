# CollabCanvas – Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization.

![Tech Stack](https://img.shields.io/badge/React-TypeScript-blue) ![WebSocket](https://img.shields.io/badge/Socket.io-WebSocket-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Real-time Drawing** - See other users' strokes as they draw (not after completion)
- **Cursor Tracking** - Live cursor positions of all connected users
- **User Presence** - Online user list with unique assigned colors
- **Drawing Tools** - Brush and eraser with adjustable stroke width (1-50px)
- **Color Picker** - 8 preset colors + custom color input
- **Room System** - Shareable 6-character room codes for collaboration
- **Global Undo/Redo** - Shared operation history across all users
- **Mobile Support** - Touch-friendly interface with responsive layout
- **Performance Metrics** - Live FPS and network latency display

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs on **http://localhost:5000**

## Testing Multi-User Collaboration

1. Open the app in one browser tab
2. Enter your name and click "Create New Room"
3. Click "Share" to copy the room link
4. Open the link in another browser tab (or device)
5. Both users can now draw together in real-time

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `B` | Brush tool |
| `E` | Eraser tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Real-time | Socket.io (WebSocket) |
| Backend | Express.js + Node.js |
| Canvas | HTML5 Canvas API |

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/     # React UI components
│   │   ├── hooks/          # Custom React hooks (useSocket)
│   │   ├── lib/            # Utilities (socket client)
│   │   └── pages/          # Page components
├── server/
│   ├── routes.ts           # Express + Socket.io server
│   └── rooms.ts            # Room state management
├── shared/
│   └── schema.ts           # Shared TypeScript types
├── ARCHITECTURE.md         # Technical documentation
└── README.md               # This file
```

## Architecture Highlights

### Real-time Sync Strategy
- **Client-side prediction**: Local strokes render immediately without server confirmation
- **Point batching**: 2px minimum distance threshold reduces WebSocket traffic by ~60%
- **Quadratic Bézier curves**: Smooth, natural-looking brush strokes

### Room System
- 6-character alphanumeric room codes (e.g., `ABC123`)
- Strict validation prevents malformed codes
- 60-second cleanup after last user leaves
- Socket.io rooms for isolated broadcasting

### Undo/Redo
- Global operation history shared across all users
- Server is the source of truth for operation order
- Any user can undo any operation (collaborative by design)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation including:
- Data flow diagrams
- WebSocket protocol specification
- Conflict resolution strategy
- Performance optimizations

## Known Limitations

1. **No persistence** - Canvas state is lost when all users leave (after 60s timeout)
2. **No authentication** - Anyone with the room link can join
3. **Fixed canvas size** - No pan/zoom functionality
4. **Global undo** - Users can undo each other's work (intentional for collaboration)
5. **No shapes/text** - Only freehand brush and eraser tools

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Touch support verified on iOS Safari and Android Chrome.

## License

MIT License - See LICENSE file for details.

---

*Built as a technical interview project demonstrating real-time collaboration, WebSocket architecture, and React/TypeScript best practices.*
