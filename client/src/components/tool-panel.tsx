import { Brush, Eraser, Undo2, Redo2, Trash2, Square, Circle, Minus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    <div className="flex flex-col gap-2 p-2.5 bg-card border border-card-border rounded-lg" data-testid="tool-panel">
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Draw</span>
      
      <div className="flex justify-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "brush" ? "default" : "ghost"}
              onClick={() => onToolChange("brush")}
              className="h-9 w-9"
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
              className="h-9 w-9"
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

      <div className="w-full h-px bg-border/50" />

      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Shapes</span>
      
      <div className="flex justify-center gap-1.5 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "rectangle" ? "default" : "ghost"}
              onClick={() => onToolChange("rectangle")}
              className="h-9 w-9"
              data-testid="button-rectangle-tool"
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Rectangle (R)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "circle" ? "default" : "ghost"}
              onClick={() => onToolChange("circle")}
              className="h-9 w-9"
              data-testid="button-circle-tool"
            >
              <Circle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Circle (C)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "line" ? "default" : "ghost"}
              onClick={() => onToolChange("line")}
              className="h-9 w-9"
              data-testid="button-line-tool"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Line (L)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={currentTool === "text" ? "default" : "ghost"}
              onClick={() => onToolChange("text")}
              className="h-9 w-9"
              data-testid="button-text-tool"
            >
              <Type className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Text (T)</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="w-full h-px bg-border/50" />

      <div className="flex justify-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-9 w-9"
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
              className="h-9 w-9"
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

      <div className="w-full h-px bg-border/50" />

      <div className="flex justify-center">
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  data-testid="button-clear-canvas"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Clear Canvas</p>
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear entire canvas?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all drawings for everyone in the room. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-clear-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onClear}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-clear-confirm"
              >
                Clear Canvas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
