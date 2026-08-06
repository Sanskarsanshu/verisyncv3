import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { existsSync } from 'fs';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

if (!process.env.PUBLIC_APP_URL?.trim()) {
  console.warn(
    '[Dynamic QR] PUBLIC_APP_URL is not set. Attendance QR codes cannot be generated until you ' +
      'set PUBLIC_APP_URL in backend/.env (e.g. https://abc123.trycloudflare.com).'
  );
}

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Trust the first proxy hop (needed for correct client IPs behind a reverse proxy).
app.set('trust proxy', 1);

app.use(helmet());
const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/api', apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

// In production, serve the built frontend from this Express process so the whole
// app runs as a single service (e.g. Render). API and health routes are excluded.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  const indexHtml = path.join(frontendDist, 'index.html');

  app.use(express.static(frontendDist, { index: false }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      next();
      return;
    }
    if (!existsSync(indexHtml)) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
