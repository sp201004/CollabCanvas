import { useState, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Bold, Pipette, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DrawingTool } from "@shared/schema";
import { DRAWING_COLORS } from "@shared/schema";
import { AdvancedColorPicker } from "@/components/ColorPicker/AdvancedColorPicker";

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
  onZoomChange: (zoom: number) => void;
  onExport?: () => void;
  onImport?: () => void;
}

const isValueOutOfRange = (value: number, min: number, max: number): boolean => {
  return !isNaN(value) && (value < min || value > max);
};

const isValidInRange = (value: number, min: number, max: number): boolean => {
  return !isNaN(value) && value >= min && value <= max;
};

const clampValue = (value: number, min: number, max: number): number => {
  if (isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
};

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
  // Local state for input to allow multi-digit typing without forced resets
  const [inputValue, setInputValue] = useState(String(value));
  const [isInvalid, setIsInvalid] = useState(false);
  
  // Generate unique ID from label
  const inputId = `${label.toLowerCase().replace(/\s+/g, '-')}-input`;
  const sliderId = `${label.toLowerCase().replace(/\s+/g, '-')}-slider`;
  
  // Sync local input when parent state changes (e.g., from slider)
  useEffect(() => {
    setInputValue(String(value));
    setIsInvalid(false);
  }, [value]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);
    
    const numValue = parseInt(rawValue, 10);
    
    // Check range validity
    setIsInvalid(isValueOutOfRange(numValue, min, max));
    
    // Only update parent if value is valid
    if (isValidInRange(numValue, min, max)) {
      onChange(numValue);
    }
  };
  
  const handleInputBlur = () => {
    const numValue = parseInt(inputValue, 10);
    const clampedValue = clampValue(numValue, min, max);
    
    onChange(clampedValue);
    setInputValue(String(clampedValue));
    setIsInvalid(false);
  };
  
  // Handle Enter key - same as blur
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      e.currentTarget.blur();
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <Label id={sliderId} htmlFor={inputId} className="text-xs text-muted-foreground whitespace-nowrap">{label}</Label>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
        className="w-24"
        aria-labelledby={sliderId}
      />
      <div className="relative flex flex-col items-center">
        <Input
          type="text"
          id={inputId}
          name={inputId}
          inputMode="numeric"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className={`w-14 h-7 text-xs ${isInvalid ? 'border-red-500 border-2' : ''}`}
          aria-label={`${label} value`}
        />
        {isInvalid && (
          <span className="absolute top-8 text-[11px] font-semibold text-red-600 whitespace-nowrap bg-red-50 px-1.5 py-0.5 rounded border border-red-200 z-50">
            Range: {min}-{max}
          </span>
        )}
      </div>
      <div 
        className="w-6 h-6 rounded-full bg-foreground flex-shrink-0"
        style={{ width: Math.min(value, 24), height: Math.min(value, 24) }}
        aria-hidden="true"
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
  onZoomChange,
  onExport,
  onImport,
}: ToolSettingsBarProps) {
  // Zoom constants
  const ZOOM_MIN = 10;   // 10%
  const ZOOM_MAX = 500;  // 500%
  
  // Local state for zoom input
  const [zoomInputValue, setZoomInputValue] = useState(String(Math.round(zoom * 100)));
  const [isZoomInvalid, setIsZoomInvalid] = useState(false);
  
  // Sync zoom input when zoom changes externally
  useEffect(() => {
    setZoomInputValue(String(Math.round(zoom * 100)));
    setIsZoomInvalid(false);
  }, [zoom]);
  
  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setZoomInputValue(rawValue);
    
    const numValue = parseInt(rawValue, 10);
    
    // Check range validity
    setIsZoomInvalid(isValueOutOfRange(numValue, ZOOM_MIN, ZOOM_MAX));
    
    // Update zoom if valid percentage
    if (isValidInRange(numValue, ZOOM_MIN, ZOOM_MAX)) {
      onZoomChange(numValue / 100);
    }
  };
  
  const handleZoomInputBlur = () => {
    const numValue = parseInt(zoomInputValue, 10);
    const clampedValue = clampValue(numValue, ZOOM_MIN, ZOOM_MAX);
    
    onZoomChange(clampedValue / 100);
    setZoomInputValue(String(clampedValue));
    setIsZoomInvalid(false);
  };
  
  // Handle zoom input Enter key
  const handleZoomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleZoomInputBlur();
      e.currentTarget.blur();
    }
  };
  const renderBrushSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Size" max={100} />
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Color</span>
        {DRAWING_COLORS.slice(0, 6).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
        <Tooltip>
          <AdvancedColorPicker currentColor={currentColor} onColorChange={onColorChange}>
            <TooltipTrigger asChild>
              <button
                className="w-6 h-6 rounded-md border-2 border-border hover:border-primary/50 transition-colors flex items-center justify-center"
                style={{ backgroundColor: currentColor }}
              >
                <Pipette className="w-3 h-3 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.5))' }} />
              </button>
            </TooltipTrigger>
          </AdvancedColorPicker>
          <TooltipContent>Advanced Color Picker</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );

  const renderEraserSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Size" max={100} />
    </div>
  );

  const renderShapeSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Stroke" min={1} max={20} />
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Color</span>
        {DRAWING_COLORS.slice(0, 6).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
        <Tooltip>
          <AdvancedColorPicker currentColor={currentColor} onColorChange={onColorChange}>
            <TooltipTrigger asChild>
              <button
                className="w-6 h-6 rounded-md border-2 border-border hover:border-primary/50 transition-colors flex items-center justify-center"
                style={{ backgroundColor: currentColor }}
              >
                <Pipette className="w-3 h-3 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.5))' }} />
              </button>
            </TooltipTrigger>
          </AdvancedColorPicker>
          <TooltipContent>Advanced Color Picker</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );

  const renderTextSettings = () => (
    <div className="flex items-center gap-4">
      <SizeSlider value={strokeWidth} onChange={onStrokeWidthChange} label="Size" min={8} max={72} />
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Color</span>
        {DRAWING_COLORS.slice(0, 6).map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            selected={currentColor === color}
            onClick={() => onColorChange(color)}
          />
        ))}
        <Tooltip>
          <AdvancedColorPicker currentColor={currentColor} onColorChange={onColorChange}>
            <TooltipTrigger asChild>
              <button
                className="w-6 h-6 rounded-md border-2 border-border hover:border-primary/50 transition-colors flex items-center justify-center"
                style={{ backgroundColor: currentColor }}
              >
                <Pipette className="w-3 h-3 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.5))' }} />
              </button>
            </TooltipTrigger>
          </AdvancedColorPicker>
          <TooltipContent>Advanced Color Picker</TooltipContent>
        </Tooltip>
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
      <div className="flex items-center gap-0.5 relative">
        <Label htmlFor="zoom-input" className="sr-only">Zoom Level</Label>
        <div className="relative flex flex-col items-center">
          <Input
            type="text"
            id="zoom-input"
            name="zoomLevel"
            inputMode="numeric"
            value={zoomInputValue}
            onChange={handleZoomInputChange}
            onBlur={handleZoomInputBlur}
            onKeyDown={handleZoomKeyDown}
            className={`w-12 h-7 text-xs text-center ${isZoomInvalid ? 'border-red-500 border-2' : ''}`}
            aria-label="Zoom percentage"
          />
          {isZoomInvalid && (
            <span className="absolute top-8 text-[11px] font-semibold text-red-600 whitespace-nowrap bg-red-50 px-1.5 py-0.5 rounded border border-red-200 z-10">
              Range: 10-500
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">%</span>
      </div>
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
      
      {/* Export/Import */}
      {(onExport || onImport) && (
        <>
          <div className="flex items-center gap-1">
            {onExport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={onExport} className="h-7" data-testid="button-export">
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Export Canvas as JSON</p></TooltipContent>
              </Tooltip>
            )}
            {onImport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={onImport} className="h-7" data-testid="button-import">
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    Import
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Import Canvas from JSON</p></TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="h-6 w-px bg-border" />
        </>
      )}
      
      {renderZoomSettings()}
    </div>
  );
}
