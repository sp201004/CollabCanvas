import { cn } from "@/lib/utils";
import { DRAWING_COLORS } from "@shared/schema";

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2 p-2 bg-card border border-card-border rounded-lg" data-testid="color-picker">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">Color</span>
      {/* Color grid - 2 columns, centered */}
      <div className="grid grid-cols-2 gap-1 justify-items-center">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              currentColor === color
                ? "ring-2 ring-foreground ring-offset-1 scale-105"
                : "hover:scale-105"
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            data-testid={`button-color-${color.replace('#', '')}`}
          />
        ))}
      </div>
      {/* Custom color - vertically stacked to prevent text overflow */}
      <div className="flex flex-col items-center gap-1">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-7 h-7 rounded-md cursor-pointer border-0 p-0"
          data-testid="input-custom-color"
        />
        <span className="text-[9px] text-muted-foreground">Custom</span>
      </div>
    </div>
  );
}
