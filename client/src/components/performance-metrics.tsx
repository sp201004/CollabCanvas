import { useState, useEffect, useRef } from "react";
import { Activity, Wifi, Layers } from "lucide-react";

interface PerformanceMetricsProps {
  socket: any;
  isConnected: boolean;
  strokeCount?: number;
}

export function PerformanceMetrics({ socket, isConnected, strokeCount = 0 }: PerformanceMetricsProps) {
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

  // Positioned inline in header (near "Connected" status) for quick visibility
  // without obscuring canvas content at bottom
  return (
    <div 
      className="flex items-center gap-2 px-2 py-0.5 bg-muted/60 rounded-full text-[10px] font-mono"
      data-testid="performance-metrics"
    >
      <div className="flex items-center gap-1" title="Frames per second">
        <Activity className={`h-2.5 w-2.5 ${getFpsColor()}`} />
        <span className={getFpsColor()}>{fps} FPS</span>
      </div>
      
      <div className="w-px h-2.5 bg-border/50" />
      
      <div className="flex items-center gap-1" title="Network latency (round-trip)">
        <Wifi className={`h-2.5 w-2.5 ${getLatencyColor()}`} />
        <span className={getLatencyColor()}>
          {latency !== null ? `${latency}ms` : "--"}
        </span>
      </div>
      
      {strokeCount > 0 && (
        <>
          <div className="w-px h-2.5 bg-border/50" />
          <div className="flex items-center gap-1" title="Active strokes on canvas">
            <Layers className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-muted-foreground">{strokeCount}</span>
          </div>
        </>
      )}
    </div>
  );
}
