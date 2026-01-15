import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/landing-page";
import CanvasPage from "@/pages/canvas-page";
import NotFound from "@/pages/not-found";

// Routing: Landing page is the entry point, canvas requires a room param
// Users must go through landing page to set their name before joining a room
function Router() {
  return (
    <Switch>
      <Route path="/" component={CanvasRouteHandler} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Route handler: Show landing page if no room in URL, otherwise show canvas
// This allows direct room links to work while ensuring proper onboarding flow
function CanvasRouteHandler() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");
  
  // No room in URL = show landing page for name entry and room selection
  if (!roomId) {
    return <LandingPage />;
  }
  
  // Room in URL = show canvas (user came from landing page or shared link)
  return <CanvasPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
