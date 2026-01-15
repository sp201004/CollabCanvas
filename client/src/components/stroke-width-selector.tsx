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
  // Native range slider for real-time stroke size control (1-30px)
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-1.5 sm:p-2 md:p-3 bg-card border border-card-border rounded-lg" data-testid="stroke-width-selector">
      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Size</span>
      
      {/* Size preview circle - shows current stroke size visually */}
      <div className="flex items-center justify-center h-8 sm:h-10">
        <div
          className="rounded-full transition-all duration-100"
          style={{
            width: `${Math.min(currentWidth * 1, 28)}px`,
            height: `${Math.min(currentWidth * 1, 28)}px`,
            backgroundColor: currentColor,
          }}
        />
      </div>
      
      {/* Native range slider - updates stroke width in real-time */}
      <input
        type="range"
        min="1"
        max="30"
        value={currentWidth}
        onChange={(e) => onWidthChange(Number(e.target.value))}
        className="w-full h-1.5 sm:h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground"
        aria-label={`Stroke width: ${currentWidth}px`}
        data-testid="input-stroke-width"
      />
      
      {/* Current size label */}
      <span className="text-[10px] sm:text-xs text-center text-muted-foreground">{currentWidth}px</span>
    </div>
  );
}
