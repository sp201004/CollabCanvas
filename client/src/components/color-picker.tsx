import { cn } from "@/lib/utils";
import { DRAWING_COLORS } from "@shared/schema";

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-card border border-card-border rounded-lg" data-testid="color-picker">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</span>
      <div className="grid grid-cols-2 gap-1.5">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={cn(
              "h-8 w-8 rounded-md transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              currentColor === color
                ? "ring-2 ring-foreground ring-offset-2 scale-110"
                : "hover:scale-105"
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            data-testid={`button-color-${color.replace('#', '')}`}
          />
        ))}
      </div>
      <div className="mt-2">
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-8 h-8 rounded-md cursor-pointer border-0 p-0"
            data-testid="input-custom-color"
          />
          <span className="text-xs text-muted-foreground">Custom</span>
        </label>
      </div>
    </div>
  );
}
