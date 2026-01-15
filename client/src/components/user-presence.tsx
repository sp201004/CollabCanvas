import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";

interface UserPresenceProps {
  users: User[];
  currentUserId: string | null;
}

export function UserPresence({ users, currentUserId }: UserPresenceProps) {
  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden" data-testid="user-presence">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">
          Active Users ({users.length})
        </span>
      </div>
      <div className="p-2 max-h-64 overflow-y-auto">
        {users.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No users connected
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {users.map((user) => (
              <li
                key={user.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md",
                  user.id === currentUserId && "bg-accent"
                )}
                data-testid={`user-item-${user.id}`}
              >
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm font-medium truncate flex-1">
                  {user.username}
                </span>
                {user.id === currentUserId && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    You
                  </span>
                )}
                {user.isDrawing && (
                  <span className="relative flex h-2 w-2">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: user.color }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: user.color }}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
