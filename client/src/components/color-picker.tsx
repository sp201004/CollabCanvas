import { cn } from "@/lib/utils";
import { DRAWING_COLORS } from "@shared/schema";

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2.5 p-2.5 bg-card border border-card-border rounded-lg" data-testid="color-picker">
      {/* Section header - Canva-style subtle label */}
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Color</span>
      
      {/* Color grid - 4x2 compact layout for wider toolbar */}
      <div className="grid grid-cols-4 gap-1.5 justify-items-center">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              currentColor === color
                ? "ring-2 ring-foreground ring-offset-1 scale-105"
                : "hover:scale-110"
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            data-testid={`button-color-${color.replace('#', '')}`}
          />
        ))}
      </div>
      
      {/* Subtle divider */}
      <div className="w-full h-px bg-border/50" />
      
      {/* Custom color picker - larger touch target */}
      <label className="flex items-center justify-center gap-2 cursor-pointer py-0.5">
        <input
          type="color"
          value={currentColor}
          onInput={(e) => onColorChange((e.target as HTMLInputElement).value)}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-border"
          data-testid="input-custom-color"
        />
        <span className="text-[10px] text-muted-foreground">Custom</span>
      </label>
    </div>
  );
}
