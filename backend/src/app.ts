/**
 * Express app setup — middlewares + route mounting.
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import {
  requestLogger, errorHandler, notFoundHandler,
  authRequired, captureIdempotencyKey, optionalAuth,
} from './middleware';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { rolesRouter } from './routes/roles';
import { tablesRouter } from './routes/tables';
import { productsRouter } from './routes/products';
import { ordersRouter } from './routes/orders';
import { stationsRouter } from './routes/stations';
import { paymentsRouter } from './routes/payments';
import { inventoryRouter } from './routes/inventory';
import { reportsRouter } from './routes/reports';
import { printersRouter } from './routes/printers';
import { auditRouter, backupsRouter } from './routes/audit_backups';
import { syncRouter } from './routes/sync';
import { shiftsRouter } from './routes/shifts';

export function createApp(): express.Express {
  const app = express();

  // Security middlewares — Helmet with enhanced CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Next.js dev requires unsafe-eval
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }));
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Device-Id'],
  }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request logging
  app.use(requestLogger());
  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.isProd ? 'combined' : 'dev'));
  }

  // Global rate limit (per IP)
  // In test environment, allow more requests so tests don't interfere
  app.use(rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.nodeEnv === 'test' ? 10000 : config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Capture idempotency-key header on mutations
  app.use(captureIdempotencyKey);

  // Health check (no auth)
  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/station', stationsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/shifts', shiftsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/printers', printersRouter);
  app.use('/api/audit-logs', auditRouter);
  app.use('/api/backups', backupsRouter);
  app.use('/api/sync', syncRouter);

  // 404 + error handlers
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
