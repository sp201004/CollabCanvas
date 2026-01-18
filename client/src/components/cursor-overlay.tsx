import { useMemo } from "react";
import type { CursorUpdate, User } from "@shared/schema";

interface CursorOverlayProps {
  cursors: Map<string, CursorUpdate>;
  users: User[];
  currentUserId: string | null;
  canvasRect: DOMRect | null;
  zoom?: number;
}

export function CursorOverlay({
  cursors,
  users,
  currentUserId,
  canvasRect,
  zoom = 1,
}: CursorOverlayProps) {
  const visibleCursors = useMemo(() => {
    const result: Array<{
      socketUserId: string;
      username: string;
      color: string;
      x: number;
      y: number;
      isDrawing: boolean;
    }> = [];

    cursors.forEach((cursor, socketUserId) => {
      if (socketUserId === currentUserId) return;
      if (!cursor.position) return;

      const user = users.find((u) => u.id === socketUserId);
      if (!user) return;

      result.push({
        socketUserId,
        username: user.username,
        color: user.color,
        x: cursor.position.x,
        y: cursor.position.y,
        isDrawing: cursor.isDrawing,
      });
    });

    // Debug logging
    if (result.length > 0) {
      console.log('[CursorOverlay] Visible cursors:', result.length, result);
    }

    return result;
  }, [cursors, users, currentUserId]);

  if (!canvasRect) return null;

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-visible z-50"
      data-testid="cursor-overlay"
    >
      {visibleCursors.map((cursor) => {
        const screenX = cursor.x * zoom;
        const screenY = cursor.y * zoom;

        return (
          <div
            key={cursor.socketUserId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
              willChange: 'transform',
            }}
          >
            <div
              className="relative"
              style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.2))` }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{ transform: "rotate(-15deg)" }}
              >
                <path
                  d="M5.65685 4.24264L20.4853 11.6569L12.7279 13.7781L9.89949 21.0711L5.65685 4.24264Z"
                  fill={cursor.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              <div
                className="absolute left-5 top-5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: cursor.color,
                  color: "#FFFFFF",
                }}
              >
                {cursor.username}
                {cursor.isDrawing && (
                  <span className="ml-1.5 inline-flex items-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
