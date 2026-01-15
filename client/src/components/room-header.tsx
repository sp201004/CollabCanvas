import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatus } from "./connection-status";
import { PerformanceMetrics } from "./performance-metrics";

interface RoomHeaderProps {
  roomId: string;
  isConnected: boolean;
  socket?: any;
}

export function RoomHeader({ roomId, isConnected, socket }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <header className="flex items-center justify-between h-12 sm:h-14 md:h-16 px-2 sm:px-4 md:px-6 bg-card border-b border-card-border" data-testid="room-header">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        <h1 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight">Canvas</h1>
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-muted rounded-md">
          <span className="text-[10px] sm:text-xs font-mono text-muted-foreground hidden sm:inline">Room:</span>
          <span className="text-xs sm:text-sm font-mono font-medium" data-testid="text-room-id">{roomId}</span>
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
