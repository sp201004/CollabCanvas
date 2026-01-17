import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdvancedColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  children: React.ReactNode;
}

interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

function isValidHexFormat(hex: string): boolean {
  const hexPattern = /^#?[0-9A-Fa-f]{6}$/;
  return hexPattern.test(hex);
}

function areRGBComponentsValid(rgb: RGB): boolean {
  return !isNaN(rgb.r) && !isNaN(rgb.g) && !isNaN(rgb.b);
}

function isGrayscale(delta: number): boolean {
  return delta === 0;
}

function hexToHSV(hex: string): HSV {
  // Validate input format
  if (!isValidHexFormat(hex)) {
    console.warn(`Invalid hex color: ${hex}, using default`);
    return { h: 0, s: 0, v: 0 };
  }
  
  hex = hex.replace("#", "");
  const rgb: RGB = {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
  
  // Guard against NaN
  if (!areRGBComponentsValid(rgb)) {
    console.warn(`Failed to parse hex color: ${hex}, using default`);
    return { h: 0, s: 0, v: 0 };
  }
  
  const rNorm = rgb.r / 255;
  const gNorm = rgb.g / 255;
  const bNorm = rgb.b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const v = max;

  // Handle grayscale colors
  if (isGrayscale(delta)) {
    return {
      h: 0,
      s: 0,
      v: Math.round(v * 100),
    };
  }

  // Calculate saturation and hue
  s = delta / max;
  
  if (max === rNorm) {
    h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
  } else if (max === gNorm) {
    h = ((bNorm - rNorm) / delta + 2) / 6;
  } else {
    h = ((rNorm - gNorm) / delta + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

export function AdvancedColorPicker({ currentColor, onColorChange, children }: AdvancedColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHSV(currentColor));
  const [isTypingHex, setIsTypingHex] = useState(false);
  const [hexInputValue, setHexInputValue] = useState("");
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("collab-canvas-recent-colors");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that parsed data is an array
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      // Remove corrupted data
      console.warn('Failed to parse recent colors from localStorage:', error);
      localStorage.removeItem("collab-canvas-recent-colors");
    }
    return [currentColor];
  });

  const svPanelRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const [isDraggingSV, setIsDraggingSV] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  // Update HSV when external color changes (only when picker is closed)
  useEffect(() => {
    if (!isOpen) {
      setHsv(hexToHSV(currentColor));
    }
  }, [currentColor, isOpen]);

  const hsvToRGB = (hsv: HSV): RGB => {
    const s = hsv.s / 100;
    const v = hsv.v / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((hsv.h / 60) % 2) - 1));
    const m = v - c;

    // Use hue range as index for RGB calculation
    const sextant = Math.floor(hsv.h / 60) % 6;
    const rgbTable: [number, number, number][] = [
      [c, x, 0], // 0-60°: Red to Yellow
      [x, c, 0], // 60-120°: Yellow to Green
      [0, c, x], // 120-180°: Green to Cyan
      [0, x, c], // 180-240°: Cyan to Blue
      [x, 0, c], // 240-300°: Blue to Magenta
      [c, 0, x], // 300-360°: Magenta to Red
    ];

    const [r, g, b] = rgbTable[sextant];

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  };

  const rgbToHex = (rgb: RGB): string => {
    return "#" + [rgb.r, rgb.g, rgb.b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("").toUpperCase();
  };

  const currentHex = useMemo((): string => {
    const rgb = hsvToRGB(hsv);
    return rgbToHex(rgb);
  }, [hsv]);

  // Update canvas color in real-time as HSV changes
  useEffect(() => {
    if (isOpen && !isTypingHex) {
      onColorChange(currentHex);
    }
  }, [currentHex, isOpen, isTypingHex, onColorChange]);

  // Add color to recent colors
  const addToRecentColors = (color: string) => {
    const newRecent = [color, ...recentColors.filter(c => c !== color)].slice(0, 10);
    setRecentColors(newRecent);
    localStorage.setItem("collab-canvas-recent-colors", JSON.stringify(newRecent));
  };

  // Handle SV panel interaction
  const handleSVPanelInteraction = (e: React.MouseEvent | MouseEvent) => {
    if (!svPanelRef.current) return;
    const rect = svPanelRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const s = (x / rect.width) * 100;
    const v = 100 - (y / rect.height) * 100;
    
    setHsv(prev => ({ ...prev, s, v }));
  };

  // Handle hue slider interaction
  const handleHueSliderInteraction = (e: React.MouseEvent | MouseEvent) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const h = (x / rect.width) * 360;
    
    setHsv(prev => ({ ...prev, h }));
  };

  // Mouse event handlers
  const handleSVMouseDown = (e: React.MouseEvent) => {
    setIsDraggingSV(true);
    handleSVPanelInteraction(e);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    setIsDraggingHue(true);
    handleHueSliderInteraction(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSV) handleSVPanelInteraction(e);
      if (isDraggingHue) handleHueSliderInteraction(e);
    };

    const handleMouseUp = () => {
      setIsDraggingSV(false);
      setIsDraggingHue(false);
    };

    if (isDraggingSV || isDraggingHue) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingSV, isDraggingHue]);

  // Handle HEX input change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();
    if (!value.startsWith("#")) value = "#" + value;
    
    setIsTypingHex(true);
    setHexInputValue(value);

    // Validate and update HSV if valid
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      setHsv(hexToHSV(value));
      setIsTypingHex(false);
    }
  };

  // Handle HEX input blur - sync with current HSV
  const handleHexInputBlur = () => {
    setIsTypingHex(false);
    setHexInputValue("");
  };

  // Handle HEX input focus
  const handleHexInputFocus = () => {
    setIsTypingHex(true);
    setHexInputValue(currentHex);
  };

  // Apply color and close picker
  const applyColor = () => {
    onColorChange(currentHex);
    addToRecentColors(currentHex);
    setIsOpen(false);
  };

  // Get pure hue color for SV panel background
  // Uses domain types for type safety and consistency
  const getPureHueColor = () => {
    const rgb = hsvToRGB({ h: hsv.h, s: 100, v: 100 });
    return rgbToHex(rgb);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          {/* Saturation/Value Panel */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Color</span>
            <div
              ref={svPanelRef}
              role="slider"
              aria-label="Color saturation and brightness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv.s)}
              tabIndex={0}
              className="relative w-full h-40 rounded-md cursor-crosshair overflow-hidden"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${getPureHueColor()})`,
              }}
              onMouseDown={handleSVMouseDown}
            >
              {/* Color cursor indicator */}
              <div
                className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none"
                style={{
                  left: `calc(${hsv.s}% - 8px)`,
                  top: `calc(${100 - hsv.v}% - 8px)`,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>

          {/* Hue Slider */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Hue</span>
            <div
              ref={hueSliderRef}
              role="slider"
              aria-label="Color hue"
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(hsv.h)}
              tabIndex={0}
              className="relative w-full h-3 rounded-full cursor-pointer overflow-hidden"
              style={{
                background: "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
              }}
              onMouseDown={handleHueMouseDown}
            >
              {/* Hue cursor indicator */}
              <div
                className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-lg pointer-events-none"
                style={{
                  left: `calc(${(hsv.h / 360) * 100}% - 8px)`,
                  top: "-2px",
                }}
              />
            </div>
          </div>

          {/* Color Preview & HEX Input */}
          <div className="flex items-center gap-2">
            <div
              className="w-12 h-12 rounded-md border-2 border-border flex-shrink-0"
              style={{ backgroundColor: currentHex }}
              role="img"
              aria-label={`Current color preview: ${currentHex}`}
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="hex-input" className="text-xs">Hex</Label>
              <Input
                id="hex-input"
                name="hexColor"
                type="text"
                value={isTypingHex ? hexInputValue : currentHex}
                onChange={handleHexInputChange}
                onFocus={handleHexInputFocus}
                onBlur={handleHexInputBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleHexInputBlur();
                    applyColor();
                  }
                }}
                className="h-8 text-xs font-mono uppercase"
                maxLength={7}
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Recent Colors */}
          {recentColors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Recent</span>
              <div className="grid grid-cols-8 gap-1">
                {recentColors.map((color, index) => (
                  <button
                    key={`${color}-${index}`}
                    className="w-6 h-6 rounded border-2 border-border hover:border-primary transition-colors"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setHsv(hexToHSV(color));
                    }}
                    aria-label={`Select recent color ${color}`}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Apply Button */}
          <button
            onClick={applyColor}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Apply Color
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
