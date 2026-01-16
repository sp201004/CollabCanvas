import { Share2, Copy, Check, Plus, LogIn, LogOut } from "lucide-react";
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

// Room code validation: EXACTLY 6 uppercase alphanumeric characters
// Prevents malformed codes from being used - must validate BEFORE socket join
const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;

function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
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
  // Validates room code format BEFORE any socket connection attempt
  const handleJoinRoom = () => {
    const trimmedId = joinRoomId.trim().toUpperCase();
    // Only allow valid 6-char alphanumeric codes
    if (isValidRoomCode(trimmedId) && trimmedId !== roomId) {
      const url = new URL(window.location.href);
      url.searchParams.set("room", trimmedId);
      window.location.href = url.toString();
    }
    setShowJoinInput(false);
    setJoinRoomId("");
  };

  // Check if current input is a valid room code (for enabling/disabling button)
  const isJoinCodeValid = isValidRoomCode(joinRoomId.trim().toUpperCase());

  // Exit room: disconnect from socket, clear session, redirect to landing
  // This cleanly removes user from room without destroying room state
  const handleExitRoom = () => {
    // Emit leave event before navigating (socket cleanup)
    if (socket && socket.connected) {
      socket.emit("room:leave", roomId);
    }
    // Clear stored username so user can re-enter with new name if desired
    sessionStorage.removeItem("canvas_username");
    // Redirect to landing page
    window.location.href = "/";
  };

  return (
    // RESPONSIVE FIX: Use min-h instead of fixed h to allow wrapping on mobile
    // flex-wrap ensures header content stacks when viewport is narrow
    <header className="flex flex-wrap items-center justify-between min-h-12 gap-2 py-2 px-2 sm:px-4 md:px-6 bg-card border-b border-card-border" data-testid="room-header">
      {/* Left section: Title + Room info - always visible */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <h1 className="text-sm sm:text-base font-semibold tracking-tight shrink-0">CollabCanvas</h1>
        
        {/* Current room display - always visible, compact on mobile */}
        <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-md shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground">Room:</span>
          <span className="text-xs font-mono font-medium" data-testid="text-room-id">{roomId}</span>
        </div>

        {/* Room controls: Create new room or Join existing - icon-only on mobile */}
        <div className="flex items-center gap-1 shrink-0">
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
              {/* Input-level + submit-level validation both needed:
                  maxLength stops typing beyond 6, onChange filters invalid chars,
                  submit validation is final safety check before socket.join */}
              <div className="relative">
                <Input
                  type="text"
                  placeholder="ABC123"
                  value={joinRoomId}
                  onChange={(e) => {
                    // Strip invalid chars and limit to 6 - only allow A-Z, 0-9
                    const filtered = e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6);
                    setJoinRoomId(filtered);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && isJoinCodeValid && handleJoinRoom()}
                  maxLength={6}
                  pattern="[A-Z0-9]{6}"
                  className={`h-7 w-20 sm:w-24 text-xs font-mono uppercase ${
                    joinRoomId && !isJoinCodeValid ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  autoFocus
                  data-testid="input-join-room"
                />
                {/* Visual feedback: show character count while typing */}
                {joinRoomId && (
                  <span className={`absolute -bottom-4 left-0 text-[9px] ${
                    isJoinCodeValid ? "text-green-500" : "text-muted-foreground"
                  }`}>
                    {joinRoomId.length}/6
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={handleJoinRoom}
                className="h-7 px-2"
                disabled={!isJoinCodeValid}
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

      {/* Right section: Metrics + Actions - always visible, compact on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
        {/* Performance metrics - compact display */}
        <PerformanceMetrics socket={socket} isConnected={isConnected} />
        <ConnectionStatus isConnected={isConnected} />
        
        {/* Share button - icon-only on mobile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="h-7 px-2 gap-1"
              data-testid="button-share-room"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline text-xs">{copied ? "Copied!" : "Share"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy room link to invite others</p>
          </TooltipContent>
        </Tooltip>

        {/* Exit Room button - icon-only on mobile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExitRoom}
              className="h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
              data-testid="button-exit-room"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Exit</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Leave this room</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
