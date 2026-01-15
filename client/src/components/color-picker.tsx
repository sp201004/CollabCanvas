import { cn } from "@/lib/utils";
import { DRAWING_COLORS } from "@shared/schema";

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 md:p-3 bg-card border border-card-border rounded-lg" data-testid="color-picker">
      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</span>
      <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={cn(
              "h-6 w-6 sm:h-8 sm:w-8 rounded-md transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 sm:focus:ring-offset-2",
              currentColor === color
                ? "ring-2 ring-foreground ring-offset-1 sm:ring-offset-2 scale-105 sm:scale-110"
                : "hover:scale-105"
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            data-testid={`button-color-${color.replace('#', '')}`}
          />
        ))}
      </div>
      <div className="mt-1 sm:mt-2">
        <label className="flex items-center gap-1.5 sm:gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-md cursor-pointer border-0 p-0"
            data-testid="input-custom-color"
          />
          <span className="text-[10px] sm:text-xs text-muted-foreground">Custom</span>
        </label>
      </div>
    </div>
  );
}
