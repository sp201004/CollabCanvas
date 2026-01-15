import { useState, useEffect, useRef } from "react";
import { Activity, Wifi } from "lucide-react";

interface PerformanceMetricsProps {
  socket: any;
  isConnected: boolean;
}

export function PerformanceMetrics({ socket, isConnected }: PerformanceMetricsProps) {
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let animationId: number;

    const measureFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationId = requestAnimationFrame(measureFps);
    };

    animationId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const measureLatency = () => {
      const start = performance.now();
      socket.emit("ping", () => {
        const end = performance.now();
        setLatency(Math.round(end - start));
      });
    };

    measureLatency();
    const interval = setInterval(measureLatency, 5000);

    return () => clearInterval(interval);
  }, [socket, isConnected]);

  const getLatencyColor = () => {
    if (latency === null) return "text-muted-foreground";
    if (latency < 50) return "text-green-500";
    if (latency < 150) return "text-yellow-500";
    return "text-red-500";
  };

  const getFpsColor = () => {
    if (fps >= 55) return "text-green-500";
    if (fps >= 30) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div 
      className="fixed bottom-2 left-2 flex items-center gap-3 px-2 py-1 bg-background/80 backdrop-blur-sm border border-border/50 rounded text-[10px] font-mono z-50"
      data-testid="performance-metrics"
    >
      <div className="flex items-center gap-1" title="Frames per second">
        <Activity className={`h-3 w-3 ${getFpsColor()}`} />
        <span className={getFpsColor()}>{fps}</span>
        <span className="text-muted-foreground">fps</span>
      </div>
      
      <div className="w-px h-3 bg-border" />
      
      <div className="flex items-center gap-1" title="Network latency">
        <Wifi className={`h-3 w-3 ${getLatencyColor()}`} />
        <span className={getLatencyColor()}>
          {latency !== null ? latency : "--"}
        </span>
        <span className="text-muted-foreground">ms</span>
      </div>
    </div>
  );
}
