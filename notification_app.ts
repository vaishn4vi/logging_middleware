import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const ROLL_NUMBER = 'RA2311003011723';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQzNTc0MzQ0LCJpYXQiOjE3NDM1NzQwNDQsImlzcyI6IkFmZm9yZG1lZG1lZGljYWwiLCJqdGkiOiJkOWEyYjY5OS02YTI3LTQ0YTUtODFiZS1mYTQxNmRhNmQ5In0sImVtYWlsIjoic3RyaW5nIiwiZmlyc3RfbmFtZSI6InN0cmluZyIsImxhc3RfbmFtZSI6InN0cmluZyJ9.YApD98gq0IN_OWw7JMfmuUfK1m4hLTm7AIcLDcLAzVg';

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
      const result = await axios.post(
        'http://34.131.48.25/evaluation-service/log',
        log,
        { timeout: 10000 }
      );
      console.log('✅ Log sent:', result.status, result.data);
    } catch (err: any) {
      console.error('❌ Log failed:', err.message);
    }
  });

  next();
});

app.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Middleware working!' });
});

app.listen(3000, () => console.log('🚀 Server on http://localhost:3000'));