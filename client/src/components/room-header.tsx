import { Share2, Copy, Check, Plus, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConnectionStatus } from "./connection-status";
import { PerformanceMetrics } from "./performance-metrics";
import { disconnectSocket } from "@/lib/socket";

interface RoomHeaderProps {
  roomId: string;
  isConnected: boolean;
  isReconnecting?: boolean;
  socket?: any;
  onRoomChange?: (newRoomId: string) => void;
  strokeCount?: number;
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

interface JoinRoomInputProps {
  joinRoomId: string;
  onJoinRoomIdChange: (value: string) => void;
  onJoinRoom: () => void;
  onCancel: () => void;
}

function JoinRoomInput({ joinRoomId, onJoinRoomIdChange, onJoinRoom, onCancel }: JoinRoomInputProps) {
  const isJoinCodeValid = isValidRoomCode(joinRoomId.trim().toUpperCase());

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip invalid chars and limit to 6 - only allow A-Z, 0-9
    const filtered = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    onJoinRoomIdChange(filtered);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isJoinCodeValid) {
      onJoinRoom();
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Input-level + submit-level validation both needed:
          maxLength stops typing beyond 6, onChange filters invalid chars,
          submit validation is final safety check before socket.join */}
      <div className="relative">
        <Input
          id="join-room-input"
          name="roomCode"
          type="text"
          placeholder="ABC123"
          value={joinRoomId}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
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
        onClick={onJoinRoom}
        className="h-7 px-2"
        disabled={!isJoinCodeValid}
        data-testid="button-join-room-submit"
      >
        Go
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        className="h-7 px-1.5"
      >
        ×
      </Button>
    </div>
  );
}

interface RoomControlsProps {
  showJoinInput: boolean;
  joinRoomId: string;
  onCreateRoom: () => void;
  onShowJoinInput: () => void;
  onJoinRoomIdChange: (value: string) => void;
  onJoinRoom: () => void;
  onCancelJoin: () => void;
}

function RoomControls({
  showJoinInput,
  joinRoomId,
  onCreateRoom,
  onShowJoinInput,
  onJoinRoomIdChange,
  onJoinRoom,
  onCancelJoin,
}: RoomControlsProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCreateRoom}
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
        <JoinRoomInput
          joinRoomId={joinRoomId}
          onJoinRoomIdChange={onJoinRoomIdChange}
          onJoinRoom={onJoinRoom}
          onCancel={onCancelJoin}
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={onShowJoinInput}
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
  );
}

interface RoomActionsProps {
  copied: boolean;
  onCopyLink: () => void;
  onExitRoom: () => void;
}

function RoomActions({ copied, onCopyLink, onExitRoom }: RoomActionsProps) {
  return (
    <>
      {/* Share button - icon-only on mobile */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={onCopyLink}
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
            onClick={onExitRoom}
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
    </>
  );
}

export function RoomHeader({ roomId, isConnected, isReconnecting, socket, onRoomChange, strokeCount = 0 }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

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

  const handleCancelJoin = () => {
    setShowJoinInput(false);
    setJoinRoomId("");
  };

  // Exit room: disconnect from socket, clear session, redirect to landing
  // This cleanly removes user from room without destroying room state
  const handleExitRoom = () => {
    setShowExitDialog(true);
  };

  const confirmExitRoom = () => {
    // Emit leave event before navigating (socket cleanup)
    if (socket && socket.connected) {
      socket.emit("room:leave", roomId);
    }
    // Fully disconnect socket to prevent reconnection attempts
    disconnectSocket();
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
        <div className="flex items-center gap-2 shrink-0">
          <img src="/favicon.png" alt="CollabCanvas Logo" className="w-6 h-6 sm:w-7 sm:h-7" />
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">CollabCanvas</h1>
        </div>
        
        {/* Current room display - always visible, compact on mobile */}
        <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-md shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground">Room:</span>
          <span className="text-xs font-mono font-medium" data-testid="text-room-id">{roomId}</span>
        </div>

        {/* Room controls: delegated to RoomControls component */}
        <RoomControls
          showJoinInput={showJoinInput}
          joinRoomId={joinRoomId}
          onCreateRoom={handleCreateRoom}
          onShowJoinInput={() => setShowJoinInput(true)}
          onJoinRoomIdChange={setJoinRoomId}
          onJoinRoom={handleJoinRoom}
          onCancelJoin={handleCancelJoin}
        />
      </div>

      {/* Right section: Metrics + Actions - always visible, compact on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
        {/* Performance metrics - compact display */}
        <PerformanceMetrics socket={socket} isConnected={isConnected} strokeCount={strokeCount} />
        <ConnectionStatus isConnected={isConnected} isReconnecting={isReconnecting} />
        
        {/* Share and Exit actions: delegated to RoomActions component */}
        <RoomActions
          copied={copied}
          onCopyLink={handleCopyLink}
          onExitRoom={handleExitRoom}
        />
      </div>

      {/* Exit confirmation dialog - prevents accidental exits */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Room?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to exit this room? Your drawings will be saved, but you'll need the room code to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExitRoom}>Leave Room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
