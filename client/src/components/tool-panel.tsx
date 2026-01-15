import { Brush, Eraser, Undo2, Redo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DrawingTool } from "@shared/schema";

interface ToolPanelProps {
  currentTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function ToolPanel({
  currentTool,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: ToolPanelProps) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-card border border-card-border rounded-lg" data-testid="tool-panel">
      {/* Drawing tools group - consistent button sizing */}
      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "brush" ? "default" : "ghost"}
              onClick={() => onToolChange("brush")}
              className="h-8 w-8"
              data-testid="button-brush-tool"
            >
              <Brush className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Brush (B)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "eraser" ? "default" : "ghost"}
              onClick={() => onToolChange("eraser")}
              className="h-8 w-8"
              data-testid="button-eraser-tool"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Eraser (E)</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Separator */}
      <div className="w-full h-px bg-border my-1" />

      {/* Undo/Redo group - centered alignment */}
      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 w-8"
              data-testid="button-undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Undo (Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 w-8"
              data-testid="button-redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Redo (Ctrl+Y)</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Separator */}
      <div className="w-full h-px bg-border my-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClear}
            className="h-8 w-8 text-destructive hover:text-destructive"
            data-testid="button-clear-canvas"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Clear Canvas</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
