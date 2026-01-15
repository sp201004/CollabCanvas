import { Share2, Copy, Check, Plus, LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatus } from "./connection-status";
import { PerformanceMetrics } from "./performance-metrics";

interface RoomHeaderProps {
  roomId: string;
  isConnected: boolean;
  socket?: any;
  onRoomChange?: (newRoomId: string) => void;
}

// Generates a random 6-character room ID for new rooms
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function RoomHeader({ roomId, isConnected, socket, onRoomChange }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Create a new room with a fresh ID
  // Room isolation works because useSocket joins the specific roomId via WebSocket
  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    const url = new URL(window.location.href);
    url.searchParams.set("room", newRoomId);
    window.location.href = url.toString();
  };

  // Join an existing room by navigating to its URL
  // The socket will automatically leave current room and join the new one
  const handleJoinRoom = () => {
    const trimmedId = joinRoomId.trim().toUpperCase();
    if (trimmedId && trimmedId !== roomId) {
      const url = new URL(window.location.href);
      url.searchParams.set("room", trimmedId);
      window.location.href = url.toString();
    }
    setShowJoinInput(false);
    setJoinRoomId("");
  };

  return (
    <header className="flex items-center justify-between h-12 sm:h-14 md:h-16 px-2 sm:px-4 md:px-6 bg-card border-b border-card-border" data-testid="room-header">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
        <h1 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight">Canvas</h1>
        
        {/* Current room display */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-muted rounded-md">
          <span className="text-[10px] sm:text-xs font-mono text-muted-foreground hidden sm:inline">Room:</span>
          <span className="text-xs sm:text-sm font-mono font-medium" data-testid="text-room-id">{roomId}</span>
        </div>

        {/* Room controls: Create new room or Join existing */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCreateRoom}
                className="h-7 px-2 gap-1"
                data-testid="button-create-room"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">New</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create a new room</p>
            </TooltipContent>
          </Tooltip>

          {/* Join room: toggle input visibility */}
          {showJoinInput ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                className="h-7 w-20 sm:w-24 text-xs font-mono uppercase"
                autoFocus
                data-testid="input-join-room"
              />
              <Button
                size="sm"
                variant="default"
                onClick={handleJoinRoom}
                className="h-7 px-2"
                disabled={!joinRoomId.trim()}
                data-testid="button-join-room-submit"
              >
                Go
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowJoinInput(false); setJoinRoomId(""); }}
                className="h-7 px-1.5"
              >
                ×
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowJoinInput(true)}
                  className="h-7 px-2 gap-1"
                  data-testid="button-join-room"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Join</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Join an existing room</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Performance metrics placed near connection status for quick visibility */}
        <PerformanceMetrics socket={socket} isConnected={isConnected} />
        <ConnectionStatus isConnected={isConnected} />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="gap-1 sm:gap-2 h-7 sm:h-8 px-2 sm:px-3"
              data-testid="button-share-room"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy room link to invite others</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
