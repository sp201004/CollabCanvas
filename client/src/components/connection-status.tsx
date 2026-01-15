import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting?: boolean;
}

export function ConnectionStatus({ isConnected, isConnecting }: ConnectionStatusProps) {
  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full" data-testid="connection-status-connecting">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full",
        isConnected ? "bg-green-500/10" : "bg-destructive/10"
      )}
      data-testid={isConnected ? "connection-status-connected" : "connection-status-disconnected"}
    >
      {isConnected ? (
        <>
          <div className="relative">
            <Wifi className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full" />
          </div>
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs font-medium text-destructive">Disconnected</span>
        </>
      )}
    </div>
  );
}
