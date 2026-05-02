import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const ROLL_NUMBER = 'YOUR_ROLL_NUMBER';      // ← change this
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN';    // ← change this after Step 9

// ── Logging Middleware ──────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  const originalJson = res.json.bind(res);
  let responseBody: any;
  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', async () => {
    const log = {
      roll_number:      ROLL_NUMBER,
      access_token:     ACCESS_TOKEN,
      request_method:   req.method,
      request_url:      req.originalUrl,
      request_headers:  req.headers,
      request_body:     req.body,
      response_headers: res.getHeaders(),
      response_body:    responseBody,
      response_time:    `${Date.now() - start}ms`,
    };

    try {
      await axios.post(
        'http://34.131.48.25/evaluation-service/log',
        log
      );
      console.log('✅ Log sent');
    } catch (err) {
      console.error('❌ Log failed:', err);
    }
  });

  next();
});

// ── Test Route ──────────────────────────────────
app.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Middleware working!' });
});

app.listen(3000, () => console.log('🚀 Server on http://localhost:3000'));