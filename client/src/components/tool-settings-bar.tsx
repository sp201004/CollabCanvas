import { MousePointer2, ZoomIn, ZoomOut, RotateCcw, AlignLeft, AlignCenter, AlignRight, Trash2, Bold } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DrawingTool, Shape, TextStyle } from "@shared/schema";
import { DRAWING_COLORS } from "@shared/schema";

interface ToolSettingsBarProps {
  currentTool: DrawingTool;
  strokeWidth: number;
  currentColor: string;
  fillColor: string;
  textStyle: TextStyle;
  zoom: number;
  selectedShape: Shape | null;
  onStrokeWidthChange: (width: number) => void;
  onColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;
  onTextStyleChange: (style: TextStyle) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDeleteSelected: () => void;
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
  fillColor,
  textStyle,
  zoom,
  selectedShape,
  onStrokeWidthChange,
  onColorChange,
  onFillColorChange,
  onTextStyleChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onDeleteSelected,
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
        <Label className="text-xs text-muted-foreground">Stroke</Label>
        {DRAWING_COLORS.slice(0, 5).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Fill</Label>
        <ColorSwatch
          color="transparent"
          selected={fillColor === "transparent"}
          onClick={() => onFillColorChange("transparent")}
        />
        {DRAWING_COLORS.slice(0, 4).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={fillColor === color}
            onClick={() => onFillColorChange(color)}
          />
        ))}
      </div>
    </div>
  );

  const renderTextSettings = () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Size</Label>
        <Input
          type="number"
          value={textStyle.fontSize || 16}
          onChange={(e) => onTextStyleChange({ ...textStyle, fontSize: parseInt(e.target.value) || 16 })}
          className="w-16 h-7 text-xs"
          min={8}
          max={72}
        />
      </div>
      <div className="h-6 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={textStyle.fontWeight === "bold" ? "default" : "ghost"}
            onClick={() => onTextStyleChange({ ...textStyle, fontWeight: textStyle.fontWeight === "bold" ? "normal" : "bold" })}
            className="h-7 w-7"
            data-testid="button-text-bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Bold</p></TooltipContent>
      </Tooltip>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={textStyle.align === "left" ? "default" : "ghost"}
              onClick={() => onTextStyleChange({ ...textStyle, align: "left" })}
              className="h-7 w-7"
              data-testid="button-text-align-left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Align Left</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={textStyle.align === "center" ? "default" : "ghost"}
              onClick={() => onTextStyleChange({ ...textStyle, align: "center" })}
              className="h-7 w-7"
              data-testid="button-text-align-center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Align Center</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={textStyle.align === "right" ? "default" : "ghost"}
              onClick={() => onTextStyleChange({ ...textStyle, align: "right" })}
              className="h-7 w-7"
              data-testid="button-text-align-right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Align Right</p></TooltipContent>
        </Tooltip>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Color</Label>
        {DRAWING_COLORS.slice(0, 5).map((color) => (
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

  const renderSelectSettings = () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MousePointer2 className="h-4 w-4" />
        <span>{selectedShape ? `Selected: ${selectedShape.type}` : "Click to select a shape"}</span>
      </div>
      {selectedShape && (
        <>
          <div className="h-6 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDeleteSelected}
                className="h-7 text-destructive hover:text-destructive"
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Delete Selected</p></TooltipContent>
          </Tooltip>
        </>
      )}
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
      case "select": return "Move / Select";
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
      case "select":
        return renderSelectSettings();
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
