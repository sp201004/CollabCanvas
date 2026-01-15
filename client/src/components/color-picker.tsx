import { useState } from "react";
import { cn } from "@/lib/utils";
import { DRAWING_COLORS } from "@shared/schema";

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

// FIX: Determine if a color is dark to apply appropriate contrast ring
// Dark colors need a light outer ring to be visible; light colors need dark ring
function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Luminance formula - values below 128 are considered dark
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  // Track if custom picker is open for enhanced preview
  const [isPickerActive, setIsPickerActive] = useState(false);

  return (
    <div className="flex flex-col gap-2.5 p-2.5 bg-card border border-card-border rounded-lg" data-testid="color-picker">
      {/* Section header - Canva-style subtle label */}
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Color</span>
      
      {/* Color grid - 4x2 compact layout with consistent spacing */}
      <div className="grid grid-cols-4 gap-2 justify-items-center px-0.5">
        {DRAWING_COLORS.map((color) => {
          const isSelected = currentColor === color;
          const isDark = isColorDark(color);
          
          return (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={cn(
                // FIX: Consistent size with box-sizing to prevent layout shift
                "h-7 w-7 rounded-full transition-all duration-150 flex-shrink-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                // FIX: Use dual-ring technique for visible selection on ALL colors
                // Outer ring provides contrast, inner border provides definition
                isSelected
                  ? "scale-110"
                  : "hover:scale-105 hover:shadow-md"
              )}
              style={{
                backgroundColor: color,
                // FIX: High-contrast selection ring that works for dark AND light colors
                // Dark colors (like black) get white outer ring; light colors get dark ring
                boxShadow: isSelected
                  ? `0 0 0 2px ${isDark ? 'white' : '#374151'}, 0 0 0 3.5px ${isDark ? '#374151' : 'white'}`
                  : undefined,
                // Subtle inner border for definition against similar backgrounds
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
              }}
              aria-label={`Select color ${color}`}
              aria-pressed={isSelected}
              data-testid={`button-color-${color.replace('#', '')}`}
            />
          );
        })}
      </div>
      
      {/* Subtle divider between presets and custom picker */}
      <div className="w-full h-px bg-border/50 my-0.5" />
      
      {/* Custom color picker - design-tool style with large preview */}
      <div className="flex flex-col items-center gap-2">
        {/* Large color preview circle - shows current/custom color */}
        <div
          className={cn(
            "w-10 h-10 rounded-full transition-all duration-200 cursor-pointer",
            "border-2 border-border/50",
            isPickerActive && "ring-2 ring-primary ring-offset-1"
          )}
          style={{ backgroundColor: currentColor }}
          onClick={() => document.getElementById('custom-color-input')?.click()}
          aria-label="Current color preview"
          data-testid="color-preview"
        />
        
        {/* Hidden native color input + visible label */}
        <label className="flex items-center gap-1.5 cursor-pointer group">
          <input
            id="custom-color-input"
            type="color"
            value={currentColor}
            onFocus={() => setIsPickerActive(true)}
            onBlur={() => setIsPickerActive(false)}
            onInput={(e) => onColorChange((e.target as HTMLInputElement).value)}
            onChange={(e) => onColorChange(e.target.value)}
            // FIX: Smaller native picker, preview circle is the main visual
            className="w-5 h-5 rounded cursor-pointer border border-border opacity-80 hover:opacity-100 transition-opacity"
            data-testid="input-custom-color"
          />
          <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
            Custom
          </span>
        </label>
      </div>
    </div>
  );
}
