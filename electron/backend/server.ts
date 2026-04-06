import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { app as electronApp } from 'electron';
import path from 'path';
import net from 'net';
import dashboardRoutes from './routes/dashboard';
import { setupSecureStorageIPC } from '../utils/secure-storage';
import { agentService } from './services/AgentService';

let server: ReturnType<Express['listen']> | null = null;
let expressApp: Express | null = null;

export interface ServerConfig {
  port?: number;
  host?: string;
}

export async function startBackendServer(config: ServerConfig = {}): Promise<number> {
  const { port = 3001, host = '127.0.0.1' } = config;

  expressApp = express();

  // CORS - allow all local connections
  expressApp.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests from file://, localhost, 127.0.0.1, or no origin (same-origin)
        if (!origin || 
            origin.startsWith('file://') || 
            origin.includes('localhost') || 
            origin.includes('127.0.0.1')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    })
  );

  // Compression
  expressApp.use(compression());

  // Body parsing
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));

  // Request logging (development only)
  if (!electronApp.isPackaged) {
    expressApp.use((req, _res, next) => {
      console.log(`[API] ${req.method} ${req.path}`);
      next();
    });
  }

  // Health check
  expressApp.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: electronApp.getVersion(),
      packaged: electronApp.isPackaged,
      platform: process.platform,
      arch: process.arch,
    });
  });

  // Mount dashboard routes
  expressApp.use('/api/dashboard', dashboardRoutes);

  // Serve static dashboard files in packaged app
  if (electronApp.isPackaged) {
    // __dirname is dist/electron in the asar, dashboard is at root/dashboard/out
    const dashboardPath = path.join(__dirname, '../../../dashboard/out');
    console.log('[Backend] Serving dashboard from:', dashboardPath);
    expressApp.use(express.static(dashboardPath));
    
    // SPA fallback - serve index.html for all non-API routes
    expressApp.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(dashboardPath, 'index.html'));
    });
  }

  // Setup secure storage IPC handlers
  setupSecureStorageIPC();

  // Error handling
  expressApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: electronApp.isPackaged ? undefined : err.message,
    });
  });

  // Find available port
  const actualPort = await findAvailablePort(port);

  return new Promise((resolve, reject) => {
    server = expressApp!.listen(actualPort, host, async () => {
      console.log(`[Backend] Server running on http://${host}:${actualPort}`);
      
      // Auto-start the agent if configured
      try {
        const started = await agentService.start();
        if (started) {
          console.log('[Backend] Agent auto-started successfully');
        } else {
          console.log('[Backend] Agent not auto-started (not configured or missing permissions)');
        }
      } catch (err) {
        console.error('[Backend] Failed to auto-start agent:', err);
      }
      
      resolve(actualPort);
    });

    server.on('error', reject);
  });
}

export async function stopBackendServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        expressApp = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const testServer = net.createServer();

    testServer.listen(startPort, '127.0.0.1', () => {
      testServer.close(() => resolve(startPort));
    });

    testServer.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

export function getExpressApp(): Express | null {
  return expressApp;
}
