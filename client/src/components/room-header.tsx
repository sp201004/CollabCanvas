import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatus } from "./connection-status";

interface RoomHeaderProps {
  roomId: string;
  isConnected: boolean;
}

export function RoomHeader({ roomId, isConnected }: RoomHeaderProps) {
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
    <header className="flex items-center justify-between h-16 px-6 bg-card border-b border-card-border" data-testid="room-header">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight">Collaborative Canvas</h1>
        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
          <span className="text-xs font-mono text-muted-foreground">Room:</span>
          <span className="text-sm font-mono font-medium" data-testid="text-room-id">{roomId}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ConnectionStatus isConnected={isConnected} />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="gap-2"
              data-testid="button-share-room"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
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
