import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Point = z.infer<typeof pointSchema>;

export const strokeSchema = z.object({
  id: z.string(),
  points: z.array(pointSchema),
  color: z.string(),
  width: z.number(),
  userId: z.string(),
  tool: z.enum(["brush", "eraser"]),
  timestamp: z.number(),
});

export type Stroke = z.infer<typeof strokeSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  color: z.string(),
  cursorPosition: pointSchema.nullable(),
  isDrawing: z.boolean(),
});

export type User = z.infer<typeof userSchema>;

export const drawingToolSchema = z.enum(["select", "brush", "eraser", "rectangle", "circle", "line", "text"]);
export type DrawingTool = z.infer<typeof drawingToolSchema>;

// Text style for text shapes
export const textStyleSchema = z.object({
  fontSize: z.number().optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export type TextStyle = z.infer<typeof textStyleSchema>;

// Shape types for rectangle, circle, line, text tools
export const shapeSchema = z.object({
  id: z.string(),
  type: z.enum(["rectangle", "circle", "line", "text"]),
  startPoint: pointSchema,
  endPoint: pointSchema,
  color: z.string(),
  width: z.number(),
  userId: z.string(),
  timestamp: z.number(),
  text: z.string().optional(),
  fillColor: z.string().optional(),
  textStyle: textStyleSchema.optional(),
});

export type Shape = z.infer<typeof shapeSchema>;

export const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  users: z.array(userSchema),
  strokes: z.array(strokeSchema),
  operationHistory: z.array(z.object({
    type: z.enum(["draw", "erase", "undo", "redo", "clear", "move"]),
    strokeId: z.string().optional(),
    stroke: strokeSchema.optional(),
    shape: shapeSchema.optional(),
    oldShape: shapeSchema.optional(),
    userId: z.string(),
    timestamp: z.number(),
  })),
});

export type Room = z.infer<typeof roomSchema>;

export const cursorUpdateSchema = z.object({
  userId: z.string(),
  position: pointSchema.nullable(),
  isDrawing: z.boolean(),
});

export type CursorUpdate = z.infer<typeof cursorUpdateSchema>;

export const strokeDataSchema = z.object({
  stroke: strokeSchema,
  roomId: z.string(),
});

export type StrokeData = z.infer<typeof strokeDataSchema>;

export const strokePointSchema = z.object({
  strokeId: z.string(),
  point: pointSchema,
  roomId: z.string(),
});

export type StrokePoint = z.infer<typeof strokePointSchema>;

export const operationSchema = z.object({
  type: z.enum(["draw", "erase", "undo", "redo", "clear", "move"]),
  strokeId: z.string().optional(),
  stroke: strokeSchema.optional(),
  shape: shapeSchema.optional(),
  oldShape: shapeSchema.optional(),
  userId: z.string(),
  timestamp: z.number(),
});

export type Operation = z.infer<typeof operationSchema>;

export const USER_COLORS = [
  "#EF4444", 
  "#F97316", 
  "#EAB308", 
  "#22C55E", 
  "#06B6D4", 
  "#3B82F6", 
  "#8B5CF6", 
  "#EC4899", 
  "#14B8A6", 
  "#F43F5E", 
];

export const DRAWING_COLORS = [
  "#1F2937", 
  "#EF4444", 
  "#F97316", 
  "#EAB308", 
  "#22C55E", 
  "#3B82F6", 
  "#8B5CF6", 
  "#EC4899", 
];

export const STROKE_WIDTHS = [2, 5, 10, 20];
