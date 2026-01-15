# Design Guidelines: Real-Time Collaborative Drawing Canvas

## Design Approach
**System-Based Minimal Design** inspired by productivity tools like Figma, Linear, and Excalidraw. Prioritizes clarity, efficiency, and non-intrusive UI that keeps focus on the canvas.

## Core Design Principles
1. **Canvas-First**: UI elements frame but never compete with the drawing area
2. **Instant Clarity**: All tools and users immediately recognizable
3. **Minimal Friction**: Zero learning curve for basic drawing operations

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, and 12 for consistent rhythm
- Toolbar padding: p-4
- Tool button spacing: gap-2
- Panel margins: m-6
- Component internal spacing: p-3

**App Structure**:
```
┌─────────────────────────────────────────┐
│  Top Toolbar (h-16, fixed)              │
├────┬────────────────────────────────┬───┤
│    │                                │   │
│ L  │     Canvas (flex-1)            │ R │
│ e  │                                │ i │
│ f  │                                │ g │
│ t  │                                │ h │
│    │                                │ t │
│ (w │                                │ (w│
│ -16│                                │ -64│
│ )  │                                │ ) │
└────┴────────────────────────────────┴───┘
```

**Responsive Behavior**:
- Desktop: Side panels visible, full toolbar
- Tablet: Collapsible right panel, compact toolbar
- Mobile: Floating tool palette, minimal UI

## Typography

**Font Families**:
- Primary: Inter (Google Fonts) - UI text, labels, buttons
- Monospace: JetBrains Mono - user IDs, technical info

**Type Scale**:
- Tool labels: text-xs (12px), font-medium
- Panel headers: text-sm (14px), font-semibold
- User names: text-sm (14px), font-normal
- Canvas info: text-xs (12px), font-mono

## Component Library

### Top Toolbar
- Height: h-16, fixed positioning
- Contains: Room name (left), drawing tools (center), user panel toggle (right)
- Shadow: subtle bottom shadow for depth separation
- Tools arranged horizontally with gap-2

### Left Panel (Tool Palette)
- Width: w-16, fixed vertical bar
- Primary tools stacked vertically: Brush, Eraser
- Tool buttons: 12x12 (h-12 w-12), rounded-lg
- Active state: distinct visual treatment
- Color picker: circular swatch preview
- Stroke width: vertical slider or 3 preset buttons (thin/medium/thick)

### Canvas Area
- Background: neutral with subtle grid pattern (optional)
- Cursor overlays for other users: circular indicators with user color
- Cursor labels: small floating badges with username
- Center-aligned, fills available space

### Right Panel (User Presence)
- Width: w-64, may collapse to icons-only (w-16)
- Header: "Active Users (N)"
- User list items with:
  - Color indicator dot (h-3 w-3, rounded-full)
  - Username truncated with ellipsis
  - "You" badge for current user
- Vertical spacing: gap-3 between users

### Drawing Controls
**Color Picker**:
- Grid of preset colors (6-8 common colors)
- Each swatch: h-8 w-8, rounded-md
- Active color has border treatment
- Custom color input as fallback

**Stroke Width Selector**:
- Three preset sizes with visual preview
- Small buttons showing line thickness
- Or vertical slider with live preview line

### User Cursor Indicators
- Circular dot (h-4 w-4) in user's assigned color
- Floating username label (text-xs) positioned above/beside
- Smooth animation trail (subtle)
- Cursor should be clearly visible without obstructing canvas

## Interaction Patterns

**Tool Selection**: Single click to activate, visual feedback immediate
**Drawing**: Natural cursor, no lag indicators during network issues
**User Presence**: Real-time list updates, join/leave micro-animations
**Cursor Tracking**: Smooth interpolation, 60fps target

## Accessibility
- All tools keyboard accessible (hotkeys)
- Color contrast ratio 4.5:1 minimum for all text
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons

## Performance Considerations
- Canvas renders at native resolution, scaled appropriately
- UI overlays use GPU-accelerated transforms
- Minimize DOM reflows during drawing
- Debounce cursor position updates (16ms target)

## Visual Hierarchy
1. **Primary**: Canvas drawing area (largest, central)
2. **Secondary**: Active drawing tools (immediate access)
3. **Tertiary**: User presence, room info (supportive context)

## States & Feedback
- **Connecting**: Loading indicator, disabled tools
- **Connected**: Full functionality enabled
- **Drawing**: Real-time stroke rendering
- **Network Issue**: Toast notification, visual indicator
- **User Join/Leave**: Subtle notification, list animation

## Technical UI Notes
- Use CSS transforms for cursor positioning (not top/left)
- Canvas dimensions should account for device pixel ratio
- SVG icons for all tool buttons (24x24 viewBox)
- Implement proper touch event handling for mobile
- No hover states on mobile, tap-friendly targets (min 44x44px)

**Critical**: Keep UI chrome minimal. Every pixel not dedicated to canvas or essential tools is wasted. The drawing experience should feel spacious and unencumbered.