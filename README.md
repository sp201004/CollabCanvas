# CollabCanvas – Real-Time Collaborative Drawing Canvas

<div align="center">

<img width="1440" alt="CollabCanvas Banner" src="https://github.com/user-attachments/assets/3a554c39-f36f-4c0e-9bda-9158d75f1317" />

</div>

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization.


<div align="center">

![Tech Stack](https://img.shields.io/badge/React-TypeScript-blue) ![WebSocket](https://img.shields.io/badge/Socket.io-WebSocket-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

</div>



<div align="center">

*"Creativity is just connecting things. When you ask creative people how they did something, they feel a little guilty because they didn't really do it, they just saw something."*

**— Steve Jobs**

</div>




## 🚀 Deployed Demo

Try the live application here: **[CollabCanvas Demo](https://collabcanvas-flam.vercel.app/)**
*(Experience real-time collaboration instantly)*

## ✨ Features

### Core Drawing Tools
- **Brush & Eraser** - Freehand drawing with adjustable stroke width (1-100px)
- **Rectangle Tool** - Draw rectangles with drag-and-drop
- **Circle Tool** - Draw ellipses/circles with drag-and-drop
- **Line Tool** - Draw straight lines between two points
- **Inline Text Tool** - Click to place text, type directly on canvas (Canva-style)
- **Advanced Color Picker** - Professional Figma/Excalidraw-style color picker with 2D SV panel, hue slider, HEX input
- **Preset Colors** - 6 quick-access color buttons for common colors

### Real-time Collaboration
- **Live Drawing Sync** - See other users' strokes as they draw (not after completion)
- **Cursor Tracking** - Live cursor positions of all connected users
- **User Presence** - Online user list with unique assigned colors
- **Global Undo/Redo** - Shared operation history across all users

### Canvas Controls
- **Zoom** - Mouse wheel to zoom in/out
- **Zoom Controls** - Button controls + keyboard shortcuts (+/-/0)
- **Reset View** - Quickly return to default view (1x zoom)
- **Export/Import** - Save canvas as JSON file, load from JSON file

### Mobile Touch Support
- **Single-touch Drawing** - Use one finger to draw naturally
- **Multi-touch Prevention** - Additional fingers ignored during drawing
- **Touch-optimized UI** - Larger buttons, collapsible panels
- **Pinch to Zoom** - Native browser zoom support
- **Responsive Layout** - Adapts to phone and tablet screens

### Drawing Persistence
- **Browser Storage** - Automatic save to localStorage on every stroke/shape/undo/redo
- **Server Storage** - File-based persistence survives server restarts
- **Session Recovery** - Canvas automatically restores on refresh or rejoin
- **Export Canvas** - Download canvas as JSON for backup or sharing
- **Import Canvas** - Load canvas from exported JSON file
- **Auto-Save** - Non-blocking saves every time drawing state changes

### Error Handling & Reliability
- **Loading States** - Clear spinner and sync status during room join
- **Connection Indicator** - Real-time status (Connected/Reconnecting/Disconnected)
- **Error Notifications** - Toast messages for connection failures and errors
- **Auto-Reconnect** - Automatic reconnection with up to 5 retry attempts
- **Error Boundary** - Graceful fallback UI if app crashes, with reload button
- **Exit Confirmation** - Prevents accidental room exits

### Room System
- **6-Character Room Codes** - Shareable alphanumeric codes (e.g., \`ABC123\`)
- **Strict Validation** - Invalid codes prevented from creating rooms
- **Share Button** - One-click room URL copying

### Performance
- **FPS & Latency Display** - Real-time performance metrics in header
- **Cursor Debouncing** - 35ms debounce reduces socket traffic by ~60%
- **Point Batching** - 2px minimum distance threshold for stroke points



## 🎯 Key Technical Achievements

### Canvas Performance
- **60fps drawing** - RAF-based rendering with event coalescing
- **Dual-canvas architecture** - Separate layers for static vs. active strokes
- **Point interpolation** - Smooth curves from discrete mouse events

### Network Efficiency
- **Progressive streaming** - 3-phase stroke transmission (start/point/end)
- **Optimistic rendering** - Zero perceived latency with client prediction
- **Throttling** - Cursor updates @30Hz, point skipping for fast strokes

### State Management
- **Operation-based CRDT** - Command pattern with timestamp ordering
- **Last-operation undo** - Global undo/redo across all users
- **Server authority** - Single source of truth for consistency



## 📁 Project Structure

```
CollabCanvas/
├── client/                          # Frontend React application
│   ├── public/
│   │   ├── diagrams/                # Architecture diagrams (SVG)
│   │   └── ...                      # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── ColorPicker/
│   │   │   │   └── AdvancedColorPicker.tsx    # Figma-style color picker
│   │   │   ├── ui/                            # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── slider.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── ...                        # Other UI primitives
│   │   │   ├── connection-status.tsx          # WebSocket connection indicator
│   │   │   ├── cursor-overlay.tsx             # Remote users' cursors
│   │   │   ├── drawing-canvas.tsx             # Main canvas component (Raw API)
│   │   │   ├── error-boundary.tsx             # React error boundary
│   │   │   ├── performance-metrics.tsx        # FPS & latency display
│   │   │   ├── room-header.tsx                # Room controls & metrics
│   │   │   ├── tool-panel.tsx                 # Drawing tool selector
│   │   │   ├── tool-settings-bar.tsx          # Color & stroke settings
│   │   │   ├── user-presence.tsx              # Online users list
│   │   │   └── username-dialog.tsx            # Initial username prompt
│   │   ├── hooks/
│   │   │   ├── use-socket.ts                  # WebSocket connection hook
│   │   │   └── use-toast.ts                   # Toast notification hook
│   │   ├── lib/
│   │   │   ├── persistence.ts                 # localStorage utilities
│   │   │   ├── socket.ts                      # Socket.io client setup
│   │   │   └── utils.ts                       # Helper functions
│   │   ├── pages/
│   │   │   ├── canvas-page.tsx                # Main drawing page
│   │   │   ├── landing-page.tsx               # Room creation/join
│   │   │   └── not-found.tsx                  # 404 page
│   │   ├── App.tsx                            # App router & layout
│   │   ├── main.tsx                           # React entry point
│   │   └── index.css                          # Global styles
│   └── index.html                             # HTML entry point
│
├── server/                          # Backend Node.js server
│   ├── index.ts                     # Server entry point
│   ├── routes.ts                    # Socket.io event handlers
│   ├── rooms.ts                     # Room state management
│   ├── persistence.ts               # File-based storage (.canvas-data/)
│   ├── static.ts                    # Static file serving
│   └── vite.ts                      # Vite middleware (dev mode)
│
├── shared/                          # Shared types between client/server
│   └── schema.ts                    # TypeScript interfaces & Zod schemas
│
├── script/                          # Build scripts
│   └── build.ts                     # Production build script
│
├── .canvas-data/                    # Persisted canvas files (gitignored)
│   └── <roomId>.json                # Canvas state per room
│
├── generate_diagrams.sh             # Diagram generation script
├── ARCHITECTURE.md                  # Technical documentation
├── README.md                        # This file
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── components.json                  # shadcn/ui configuration
└── postcss.config.js                # PostCSS configuration
```

**Key Files Explained:**

- **`client/src/components/drawing-canvas.tsx`** - Core canvas logic with raw HTML5 Canvas API, dual-layer rendering, Bézier smoothing
- **`client/src/hooks/use-socket.ts`** - WebSocket connection management, event handling, auto-reconnection
- **`server/routes.ts`** - Socket.io event handlers for stroke:start, stroke:point, stroke:end, undo/redo
- **`server/rooms.ts`** - Room state (users, strokes, operation history), cleanup timers
- **`server/persistence.ts`** - File-based canvas storage, auto-save on operations
- **`shared/schema.ts`** - Type-safe interfaces (Stroke, User, Operation) shared across client/server

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical architecture, data flow diagrams, WebSocket protocol, and performance optimizations.



## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ and npm 8+

### Quick Start (One Command)

```bash
# Install dependencies and start development server
npm install && npm start
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5000

### Manual Setup (Alternative)

If the above doesn't work, use separate terminals:

```bash
# Terminal 1 - Start backend server
npm run dev

# Terminal 2 - Start frontend (in new terminal)
cd client && npm install && npm run dev
```

### Production Build

```bash
# Build the application
npm run build

# Run the production build
npm run start:prod
```



## 🧪 How to Test Multi-User Collaboration

### Method 1: Multiple Browser Windows (Easiest)

1. Start the application: `npm install && npm start`
2. Open **http://localhost:5173** in Chrome
3. Enter your name and click **"Create New Room"**
4. Copy the room code (e.g., `ABC123`)
5. Open **http://localhost:5173** in an **Incognito/Private window**
6. Enter a different name and paste the room code
7. Click **"Join Room"**
8. Start drawing in either window – strokes appear in real-time! ✨

### Method 2: Multiple Devices (Same Network)

1. Start the application: `npm install && npm start`
2. Find your local IP address:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig | findstr IPv4
   ```
3. On **Device 1**: Open http://localhost:5173
4. On **Device 2**: Open http://YOUR_IP:5173 (e.g., http://192.168.1.5:5173)
5. Create room on Device 1, join with same room code on Device 2

### Test Scenarios

**Real-Time Drawing:**
- ✅ Draw simultaneously from both windows
- ✅ Watch strokes appear as you draw (not after completing)
- ✅ Try overlapping strokes - both render correctly

**Cursor Tracking:**
- ✅ Move mouse in one window
- ✅ See colored cursor indicator in the other window
- ✅ Each user has a unique color

**Undo/Redo (Global):**
- ✅ Draw several strokes in Window 1
- ✅ Press **Ctrl+Z** in Window 2
- ✅ Last stroke disappears in **both windows** (any user can undo any operation)
- ✅ Press **Ctrl+Y** to redo

**Persistence:**
- ✅ Draw some strokes
- ✅ Refresh the page
- ✅ Canvas state should be restored from localStorage
- ✅ Kill server (`Ctrl+C`), restart, rejoin room - canvas restored from disk

**User Management:**
- ✅ Open user list (top-right icon)
- ✅ Watch user count update as users join/leave
- ✅ See unique colors assigned to each user



## 🧪 Testing & Validation

### Automated Testing
Run TypeScript type checking:
```bash
npm run check
```

### Manual Multi-User Testing
Open multiple browser windows/tabs:
1. **Create room** in Tab 1 → Enter room code in Tab 2
2. **Draw simultaneously** → Verify strokes appear in real-time
3. **Test undo/redo** → Verify global operation history works
4. **Test reconnection** → Kill server (`Ctrl+C`), restart, verify canvas restores
5. **Test persistence** → Refresh page, verify canvas state persists



## 📚 Documentation

For a complete technical deep dive covering:
- Canvas rendering optimization strategies
- Real-time event streaming architecture
- Global undo/redo conflict resolution
- Network latency compensation
- State synchronization guarantees

**Read: [ARCHITECTURE.md](ARCHITECTURE.md)** ← Required reading!



## ⏱️ Time Spent on the Project

As a student, the development of this project was carried out over a period of **3 days** and required approximately **43 hours (± a few hours)** in total.  
The time was distributed across different tasks as follows:

- Understanding the problem statement and planning the architecture: ~5 hours  
- Core architecture implementation and real-time synchronization: ~6 hours  
- Canvas drawing logic and HTML5 Canvas API implementation: ~6 hours  
- Shape tools (rectangle, circle, line, text): ~4 hours  
- Zoom and pan functionality: ~2 hours  
- Room management and user presence handling: ~4 hours  
- UI/UX improvements and responsive design adjustments: ~4 hours  
- Drawing persistence (client-side and server-side): ~3 hours  
- Performance optimization and basic stress testing: ~3 hours  
- Testing, debugging, and fixing edge cases: ~3 hours  
- Documentation and explanation writing: ~3 hours  

**Total development time: approximately 43 hours (± a few hours).**



## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Touch support verified on iOS Safari and Android Chrome.



## ⚠️ Known Limitations

**Canvas Size**: Fixed at 800×600px (use browser zoom for different sizes)

**Performance**: Canvas redraw slows after ~5000 strokes (use Clear Canvas periodically)

**Offline Mode**: Requires active internet connection for real-time collaboration

**Mobile**: Older Safari versions may have occasional touch event issues (works well on modern browsers)

**Architecture**: Single-server design suitable for 10-100 concurrent rooms (horizontal scaling requires Redis - see [ARCHITECTURE.md](ARCHITECTURE.md))



## 🙏 Acknowledgments

- Built with modern web technologies: React, TypeScript, Socket.io, Vite
- UI components powered by [shadcn/ui](https://ui.shadcn.com/)
- Inspired by collaborative tools like Figma, Excalidraw, and Miro
- **Design Preview**: [View on Figma](https://www.figma.com/design/0Be2blOeXbpZx2WECrSjkA/CollabCanvas--Flam-Frontend-?node-id=0-1&t=XRd6d7VyeokOU8nw-1)


<div align="center">

**Built as a technical interview project demonstrating real-time collaboration, WebSocket architecture, and React/TypeScript best practices.**

⭐ **Star this repository if you found it helpful!** ⭐


*Last updated: January 2026*  
*Project: CollabCanvas - Real-Time Collaborative Drawing Canvas*  
*Developer: [sp201004](https://github.com/sp201004)*

</div>