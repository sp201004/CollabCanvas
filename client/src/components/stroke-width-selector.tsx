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
  // Handle number input - fires on every keystroke for real-time sync
  // FIX: Using onInput instead of only onChange to update immediately as user types
  const handleNumberInput = (e: React.FormEvent<HTMLInputElement>) => {
    const rawValue = (e.target as HTMLInputElement).value;
    // Allow empty field while typing, but don't update state with invalid values
    if (rawValue === "") return;
    const value = parseInt(rawValue, 10);
    if (!isNaN(value) && value >= MIN_SIZE && value <= MAX_SIZE) {
      onWidthChange(value);
    }
  };

  // Handle blur - clamp to valid range when user leaves the field
  const handleNumberBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < MIN_SIZE) {
      onWidthChange(MIN_SIZE);
    } else if (value > MAX_SIZE) {
      onWidthChange(MAX_SIZE);
    }
  };

  // Handle slider changes - real-time updates while dragging
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    onWidthChange(clampSize(Number((e.target as HTMLInputElement).value)));
  };

  return (
    <div className="flex flex-col gap-3 p-2 bg-card border border-card-border rounded-lg" data-testid="stroke-width-selector">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">Size</span>
      
      {/* Size preview - visual feedback showing current brush size */}
      <div className="flex items-center justify-center h-12 bg-muted/30 rounded-md">
        <div
          className="rounded-full transition-all duration-150 shadow-sm"
          style={{
            width: `${Math.max(Math.min(currentWidth, 32), 6)}px`,
            height: `${Math.max(Math.min(currentWidth, 32), 6)}px`,
            backgroundColor: currentColor,
          }}
        />
      </div>
      
      {/* Range slider - drag to change size (1-50px) */}
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
      
      {/* Number input - click to type exact size value, syncs with slider */}
      {/* FIX: Added onInput for real-time updates + onBlur for clamping */}
      <div className="flex items-center justify-center gap-1">
        <input
          type="number"
          min={MIN_SIZE}
          max={MAX_SIZE}
          value={currentWidth}
          onInput={handleNumberInput}
          onBlur={handleNumberBlur}
          className="size-number-input w-12 text-center text-xs font-semibold bg-muted/50 border border-border rounded py-1 px-1 focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Stroke width in pixels"
          data-testid="input-stroke-width-number"
        />
        <span className="text-[10px] text-muted-foreground">px</span>
      </div>
    </div>
  );
}
