import { useState } from "react";
import { Brush, Users, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Generates a random 6-character room code for new rooms
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Room code validation: EXACTLY 6 uppercase alphanumeric characters
// This prevents malformed codes from being used and ensures consistent format
const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;

function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

function getRoomCodeError(code: string): string | null {
  if (!code) return "Please enter a room code";
  if (code.length !== 6) return "Room code must be exactly 6 characters";
  if (!ROOM_CODE_REGEX.test(code)) return "Room code must contain only letters and numbers";
  return null;
}

// Landing page provides a clean onboarding flow:
// 1. User enters their name first (required for all actions)
// 2. User chooses to either create a new room or join an existing one
// This flow ensures users always have a name before entering the canvas,
// improving the collaborative experience with proper identity
export default function LandingPage() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<"initial" | "join" | "create">("initial");
  const [error, setError] = useState("");

  // Validate username meets requirements
  const validateUsername = (): boolean => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return false;
    }
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return false;
    }
    if (trimmed.length > 20) {
      setError("Name must be less than 20 characters");
      return false;
    }
    return true;
  };

  // Navigate to canvas with username stored for the session
  // Uses full page navigation to ensure URL params are properly read
  const navigateToRoom = (code: string) => {
    const trimmedName = username.trim();
    // Store username in sessionStorage so canvas page can retrieve it
    // This avoids showing the username dialog again
    sessionStorage.setItem("canvas_username", trimmedName);
    window.location.href = `/?room=${code}`;
  };

  // Handle "Create New Room" button click
  const handleCreateRoom = () => {
    if (!validateUsername()) return;
    const newCode = generateRoomCode();
    navigateToRoom(newCode);
  };

  // Handle "Join Existing Room" - show room code input
  const handleShowJoinForm = () => {
    if (!validateUsername()) return;
    setError("");
    setMode("join");
  };

  // Handle joining with entered room code
  // Validates format BEFORE any socket connection attempt
  const handleJoinRoom = () => {
    const trimmedCode = roomCode.trim().toUpperCase();
    const validationError = getRoomCodeError(trimmedCode);
    if (validationError) {
      setError(validationError);
      return;
    }
    navigateToRoom(trimmedCode);
  };

  // Check if current room code input is valid (for disabling button)
  const isRoomCodeValid = isValidRoomCode(roomCode.trim().toUpperCase());

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30"
      data-testid="landing-page"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Brush className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Collaborative Canvas</CardTitle>
          <CardDescription>
            Draw together in real-time with friends and colleagues
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Username input - always visible */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Your Name
            </label>
            <Input
              placeholder="Enter your name..."
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              className="text-center text-lg h-12"
              autoFocus
              data-testid="input-landing-username"
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive text-center" data-testid="text-landing-error">
              {error}
            </p>
          )}

          {/* Initial mode: Show two main action buttons */}
          {mode === "initial" && (
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleCreateRoom}
                size="lg"
                className="w-full gap-2"
                data-testid="button-landing-create"
              >
                <Plus className="h-5 w-5" />
                Create New Room
              </Button>
              
              <Button
                onClick={handleShowJoinForm}
                size="lg"
                variant="outline"
                className="w-full gap-2"
                data-testid="button-landing-join"
              >
                <Users className="h-5 w-5" />
                Join Existing Room
              </Button>
            </div>
          )}

          {/* Join mode: Show room code input */}
          {mode === "join" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Room Code
                </label>
                <Input
                  placeholder="Enter room code (e.g., ABC123)"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                  className="text-center text-lg h-12 font-mono uppercase"
                  autoFocus
                  data-testid="input-landing-roomcode"
                />
              </div>

              {/* Show validation hint while typing */}
              {roomCode && !isRoomCodeValid && (
                <p className="text-xs text-muted-foreground text-center">
                  Room code must be exactly 6 letters/numbers
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => { setMode("initial"); setError(""); setRoomCode(""); }}
                  size="lg"
                  variant="ghost"
                  className="flex-1"
                  data-testid="button-landing-back"
                >
                  Back
                </Button>
                <Button
                  onClick={handleJoinRoom}
                  size="lg"
                  className="flex-1 gap-2"
                  disabled={!isRoomCodeValid}
                  data-testid="button-landing-join-submit"
                >
                  <ArrowRight className="h-5 w-5" />
                  Join Room
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
