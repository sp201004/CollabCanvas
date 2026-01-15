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
    <div className="flex flex-col gap-3 p-2 bg-card border border-card-border rounded-lg" data-testid="stroke-width-selector">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">Size</span>
      
      {/* Size preview - larger area for clear visual feedback */}
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
      
      {/* Larger slider - increased height and custom styling for easier grabbing */}
      <input
        type="range"
        min="1"
        max="30"
        value={currentWidth}
        onInput={(e) => onWidthChange(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => onWidthChange(Number(e.target.value))}
        className="size-slider w-full cursor-pointer"
        style={{ accentColor: currentColor }}
        aria-label={`Stroke width: ${currentWidth}px`}
        data-testid="input-stroke-width"
      />
      
      {/* Clear size value label */}
      <div className="flex items-center justify-center gap-1 bg-muted/50 rounded py-1">
        <span className="text-xs font-semibold text-foreground">{currentWidth}</span>
        <span className="text-[10px] text-muted-foreground">px</span>
      </div>
    </div>
  );
}
