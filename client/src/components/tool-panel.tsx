import { Brush, Eraser, Undo2, Redo2, Trash2 } from "lucide-react";
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
      {/* Section header - Canva-style subtle label */}
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Tools</span>
      
      {/* Drawing tools - horizontal row for compact layout */}
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

      {/* Subtle divider */}
      <div className="w-full h-px bg-border/50" />

      {/* History controls - horizontal row */}
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

      {/* Subtle divider */}
      <div className="w-full h-px bg-border/50" />

      {/* Clear action with confirmation dialog */}
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
