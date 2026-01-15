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
      {/* Color grid - 2 columns, evenly spaced */}
      <div className="flex flex-col gap-1.5 items-center">
        {/* Row 1 */}
        <div className="flex gap-1.5">
          {DRAWING_COLORS.slice(0, 2).map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "h-6 w-6 rounded-md transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                currentColor === color
                  ? "ring-2 ring-foreground ring-offset-1"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              data-testid={`button-color-${color.replace('#', '')}`}
            />
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-1.5">
          {DRAWING_COLORS.slice(2, 4).map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "h-6 w-6 rounded-md transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                currentColor === color
                  ? "ring-2 ring-foreground ring-offset-1"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              data-testid={`button-color-${color.replace('#', '')}`}
            />
          ))}
        </div>
        {/* Row 3 */}
        <div className="flex gap-1.5">
          {DRAWING_COLORS.slice(4, 6).map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "h-6 w-6 rounded-md transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                currentColor === color
                  ? "ring-2 ring-foreground ring-offset-1"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              data-testid={`button-color-${color.replace('#', '')}`}
            />
          ))}
        </div>
        {/* Row 4 */}
        <div className="flex gap-1.5">
          {DRAWING_COLORS.slice(6, 8).map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "h-6 w-6 rounded-md transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                currentColor === color
                  ? "ring-2 ring-foreground ring-offset-1"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              data-testid={`button-color-${color.replace('#', '')}`}
            />
          ))}
        </div>
      </div>
      {/* Separator before custom picker */}
      <div className="w-full h-px bg-border" />
      {/* Custom color picker - compact */}
      <label className="flex items-center justify-center gap-1.5 cursor-pointer">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border-0 p-0"
          data-testid="input-custom-color"
        />
        <span className="text-[9px] text-muted-foreground">Custom</span>
      </label>
    </div>
  );
}
