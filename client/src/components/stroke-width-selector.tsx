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
      
      {/* Size preview - centered visual feedback */}
      <div className="flex items-center justify-center h-10">
        <div
          className="rounded-full transition-all duration-100 border border-border"
          style={{
            width: `${Math.max(Math.min(currentWidth, 28), 4)}px`,
            height: `${Math.max(Math.min(currentWidth, 28), 4)}px`,
            backgroundColor: currentColor,
          }}
        />
      </div>
      
      {/* Range slider - uses onInput for real-time updates while dragging */}
      <input
        type="range"
        min="1"
        max="30"
        value={currentWidth}
        onInput={(e) => onWidthChange(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => onWidthChange(Number(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: currentColor }}
        aria-label={`Stroke width: ${currentWidth}px`}
        data-testid="input-stroke-width"
      />
      
      {/* Size value label */}
      <span className="text-[10px] text-center font-medium text-foreground">{currentWidth}px</span>
    </div>
  );
}
