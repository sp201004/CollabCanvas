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
    <div className="flex flex-col gap-2 p-2 bg-card border border-card-border rounded-lg" data-testid="stroke-width-selector">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">Size</span>
      
      {/* Size preview - shows current stroke size visually */}
      <div className="flex items-center justify-center h-8">
        <div
          className="rounded-full transition-all duration-100"
          style={{
            width: `${Math.min(currentWidth, 24)}px`,
            height: `${Math.min(currentWidth, 24)}px`,
            backgroundColor: currentColor,
          }}
        />
      </div>
      
      {/* Vertical slider for narrow toolbar - prevents overflow */}
      <input
        type="range"
        min="1"
        max="30"
        value={currentWidth}
        onChange={(e) => onWidthChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground"
        aria-label={`Stroke width: ${currentWidth}px`}
        data-testid="input-stroke-width"
      />
      
      <span className="text-[9px] text-center text-muted-foreground">{currentWidth}px</span>
    </div>
  );
}
