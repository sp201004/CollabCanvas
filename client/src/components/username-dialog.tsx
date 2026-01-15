import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Brush } from "lucide-react";

interface UsernameDialogProps {
  open: boolean;
  onSubmit: (username: string) => void;
}

export function UsernameDialog({ open, onSubmit }: UsernameDialogProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter a username");
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }
    if (trimmed.length > 20) {
      setError("Username must be less than 20 characters");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton data-testid="username-dialog">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Brush className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">Welcome to Collaborative Canvas</DialogTitle>
          <DialogDescription className="text-center">
            Enter a username to join the drawing room. Other users will see your name next to your cursor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              className="text-center text-lg h-12"
              autoFocus
              data-testid="input-username"
            />
            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-username-error">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button type="submit" size="lg" className="w-full sm:w-auto px-8" data-testid="button-join">
              Join Canvas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
