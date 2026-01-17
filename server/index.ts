import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Port selection strategy:
  // 1. Use PORT environment variable if provided
  // 2. Try default port 5000
  // 3. If port is in use, let OS assign a free port (port 0)
  const preferredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  
  const startServer = (port: number) => {
    return new Promise<void>((resolve, reject) => {
      httpServer
        .listen(port, "0.0.0.0")
        .once("listening", () => {
          const address = httpServer.address();
          const actualPort = typeof address === "object" && address ? address.port : port;
          log(`🚀 Server running on http://localhost:${actualPort}`);
          log(`Frontend: http://localhost:${actualPort}`);
          log(`Socket.IO: ws://localhost:${actualPort}/socket.io`);
          resolve();
        })
        .once("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            reject(err);
          } else {
            log(`Server error: ${err.message}`);
            reject(err);
          }
        });
    });
  };

  try {
    await startServer(preferredPort);
  } catch (err: any) {
    if (err.code === "EADDRINUSE") {
      log(`Port ${preferredPort} is in use, finding a free port...`);
      try {
        // Port 0 tells the OS to assign any available port
        await startServer(0);
      } catch (secondErr) {
        log(`Failed to start server: ${secondErr}`);
        process.exit(1);
      }
    } else {
      log(`Failed to start server: ${err}`);
      process.exit(1);
    }
  }
})();
