import { cn } from "@/lib/utils";
import { STROKE_WIDTHS } from "@shared/schema";

interface StrokeWidthSelectorProps {
  currentWidth: number;
  onWidthChange: (width: number) => void;
  currentColor: string;
}

export function StrokeWidthSelector({
  currentWidth,
  onWidthChange,
  currentColor,
}: StrokeWidthSelectorProps) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-card border border-card-border rounded-lg" data-testid="stroke-width-selector">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Size</span>
      <div className="flex flex-col gap-2">
        {STROKE_WIDTHS.map((width) => (
          <button
            key={width}
            onClick={() => onWidthChange(width)}
            className={cn(
              "flex items-center justify-center h-10 w-full rounded-md transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              currentWidth === width
                ? "bg-accent border-2 border-foreground/20"
                : "bg-muted/50 hover:bg-muted"
            )}
            aria-label={`Stroke width ${width}px`}
            data-testid={`button-stroke-width-${width}`}
          >
            <div
              className="rounded-full"
              style={{
                width: `${Math.min(width * 1.5, 30)}px`,
                height: `${Math.min(width * 1.5, 30)}px`,
                backgroundColor: currentColor,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
