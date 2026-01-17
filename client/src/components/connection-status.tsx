import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  isConnecting?: boolean;
}

export function ConnectionStatus({ isConnected, isReconnecting, isConnecting }: ConnectionStatusProps) {
  // Show reconnecting state - distinct from initial connection
  if (isReconnecting) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-500/10 rounded-full" data-testid="connection-status-reconnecting">
        <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin text-yellow-600 dark:text-yellow-400" />
        <span className="text-[10px] sm:text-xs font-medium text-yellow-600 dark:text-yellow-400 hidden sm:inline">Reconnecting...</span>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-muted rounded-full" data-testid="connection-status-connecting">
        <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin text-muted-foreground" />
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground hidden sm:inline">Connecting...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full",
        isConnected ? "bg-green-500/10" : "bg-destructive/10"
      )}
      data-testid={isConnected ? "connection-status-connected" : "connection-status-disconnected"}
    >
      {isConnected ? (
        <>
          <div className="relative">
            <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600 dark:text-green-400" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500 rounded-full" />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 hidden sm:inline">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive" />
          <span className="text-[10px] sm:text-xs font-medium text-destructive hidden sm:inline">Disconnected</span>
        </>
      )}
    </div>
  );
}
