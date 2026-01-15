import { useState, useEffect } from "react";

interface StrokeWidthSelectorProps {
  currentWidth: number;
  onWidthChange: (width: number) => void;
  currentColor: string;
}

// Min/max range for stroke width - clamped to safe values
const MIN_SIZE = 1;
const MAX_SIZE = 50;

// Clamp value to valid range
function clampSize(value: number): number {
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(value)));
}

export function StrokeWidthSelector({
  currentWidth,
  onWidthChange,
  currentColor,
}: StrokeWidthSelectorProps) {
  // FIX: Use local state for number input to allow multi-digit typing
  // Previous bug: controlled input immediately synced to parent state on every keystroke,
  // causing single-digit lock because React re-rendered with clamped value
  const [inputValue, setInputValue] = useState(String(currentWidth));

  // Sync local input when parent state changes (e.g., from slider)
  useEffect(() => {
    setInputValue(String(currentWidth));
  }, [currentWidth]);

  // Handle number input - allow typing freely without immediate clamping
  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Allow empty or partial values while typing
    setInputValue(rawValue);
    
    // Only update parent state if valid complete number in range
    const value = parseInt(rawValue, 10);
    if (!isNaN(value) && value >= MIN_SIZE && value <= MAX_SIZE) {
      onWidthChange(value);
    }
  };

  // Handle blur - clamp to valid range when user leaves the field
  const handleNumberBlur = () => {
    const value = parseInt(inputValue, 10);
    if (isNaN(value) || value < MIN_SIZE) {
      onWidthChange(MIN_SIZE);
      setInputValue(String(MIN_SIZE));
    } else if (value > MAX_SIZE) {
      onWidthChange(MAX_SIZE);
      setInputValue(String(MAX_SIZE));
    } else {
      setInputValue(String(value));
    }
  };

  // Handle slider changes - real-time updates while dragging
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    onWidthChange(clampSize(Number((e.target as HTMLInputElement).value)));
  };

  return (
    // FIX: Container uses box-sizing border-box with fixed width to prevent overflow
    // overflow-hidden ensures no child element can break out of rounded container
    <div 
      className="flex flex-col gap-2 p-2.5 bg-card border border-card-border rounded-lg w-full box-border overflow-hidden" 
      style={{ minWidth: 0 }}
      data-testid="stroke-width-selector"
    >
      {/* Section header - Canva-style subtle label */}
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Size</span>
      
      {/* Size preview - visual feedback showing current brush size */}
      <div className="flex items-center justify-center h-10 bg-muted/30 rounded-md">
        <div
          className="rounded-full transition-all duration-150 shadow-sm"
          style={{
            width: `${Math.max(Math.min(currentWidth, 28), 6)}px`,
            height: `${Math.max(Math.min(currentWidth, 28), 6)}px`,
            backgroundColor: currentColor,
          }}
        />
      </div>
      
      {/* FIX: Slider container with proper width constraint to prevent overflow */}
      <div className="w-full px-0.5 box-border">
        <input
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          value={currentWidth}
          onInput={handleSliderChange}
          onChange={handleSliderChange}
          className="size-slider w-full cursor-pointer"
          style={{ accentColor: currentColor }}
          aria-label={`Stroke width: ${currentWidth}px`}
          data-testid="input-stroke-width-slider"
        />
      </div>
      
      {/* FIX: Number input row - fixed width input with inline "px" label
          Input width is clamped to prevent layout push-out */}
      <div className="flex items-center justify-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputValue}
          onChange={handleNumberInput}
          onBlur={handleNumberBlur}
          className="w-10 text-center text-xs font-semibold bg-muted/50 border border-border rounded py-1 px-0.5 focus:outline-none focus:ring-1 focus:ring-primary flex-shrink-0"
          style={{ minWidth: 0, maxWidth: '2.5rem' }}
          aria-label="Stroke width in pixels"
          data-testid="input-stroke-width-number"
        />
        <span className="text-[10px] text-muted-foreground flex-shrink-0">px</span>
      </div>
    </div>
  );
}
