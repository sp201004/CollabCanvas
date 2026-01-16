import { ZoomIn, ZoomOut, RotateCcw, Bold } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DrawingTool } from "@shared/schema";
import { DRAWING_COLORS } from "@shared/schema";

interface ToolSettingsBarProps {
  currentTool: DrawingTool;
  strokeWidth: number;
  currentColor: string;
  zoom: number;
  onStrokeWidthChange: (width: number) => void;
  onColorChange: (color: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded-md border-2 transition-all ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
      }`}
      style={{ backgroundColor: color }}
      data-testid={`color-swatch-${color.replace("#", "")}`}
    />
  );
}

function SizeSlider({ value, onChange, label, min = 1, max = 50 }: { 
  value: number; 
  onChange: (v: number) => void; 
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground whitespace-nowrap">{label}</Label>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
        className="w-24"
      />
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
        className="w-14 h-7 text-xs"
        min={min}
        max={max}
      />
      <div 
        className="w-6 h-6 rounded-full bg-foreground flex-shrink-0"
        style={{ width: Math.min(value, 24), height: Math.min(value, 24) }}
      />
    </div>
  );
}

export function ToolSettingsBar({
  currentTool,
  strokeWidth,
  currentColor,
  zoom,
  onStrokeWidthChange,
  onColorChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ToolSettingsBarProps) {
  const renderBrushSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Size" />
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Color</Label>
        {DRAWING_COLORS.slice(0, 6).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
    </div>
  );

  const renderEraserSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Size" />
    </div>
  );

  const renderShapeSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Stroke" min={1} max={20} />
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Color</Label>
        {DRAWING_COLORS.slice(0, 6).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
    </div>
  );

  const renderTextSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Size" min={8} max={72} />
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Color</Label>
        {DRAWING_COLORS.slice(0, 6).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
    </div>
  );

  const renderZoomSettings = () => (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" onClick={onZoomOut} className="h-7 w-7" data-testid="button-zoom-out-bar">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Zoom Out</p></TooltipContent>
      </Tooltip>
      <span className="text-sm font-medium w-14 text-center">{Math.round(zoom * 100)}%</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" onClick={onZoomIn} className="h-7 w-7" data-testid="button-zoom-in-bar">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Zoom In</p></TooltipContent>
      </Tooltip>
      <div className="h-6 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={onZoomReset} className="h-7" data-testid="button-zoom-reset-bar">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Reset View</p></TooltipContent>
      </Tooltip>
    </div>
  );

  const getToolLabel = () => {
    switch (currentTool) {
      case "brush": return "Brush";
      case "eraser": return "Eraser";
      case "rectangle": return "Rectangle";
      case "circle": return "Circle";
      case "line": return "Line";
      case "text": return "Text";
      default: return "";
    }
  };

  const renderToolSettings = () => {
    switch (currentTool) {
      case "brush":
        return renderBrushSettings();
      case "eraser":
        return renderEraserSettings();
      case "rectangle":
      case "circle":
      case "line":
        return renderShapeSettings();
      case "text":
        return renderTextSettings();
      default:
        return null;
    }
  };

  return (
    <div 
      className="flex items-center gap-4 px-4 py-2 bg-card border-b border-border min-h-[48px]"
      data-testid="tool-settings-bar"
    >
      <span className="text-sm font-medium text-foreground min-w-[80px]">{getToolLabel()}</span>
      <div className="h-6 w-px bg-border" />
      <div className="flex-1 flex items-center gap-4 overflow-x-auto">
        {renderToolSettings()}
      </div>
      <div className="h-6 w-px bg-border" />
      {renderZoomSettings()}
    </div>
  );
}
