import express from 'express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '1mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

const memory = new Map();
let queue;

if (process.env.REDIS_URL) {
  const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  queue = new Queue('lead-scrapes', { connection });
}

app.post('/api/jobs', async (req, res) => {
  const required = ['industry', 'location', 'email'];
  const missing = required.filter((k) => !req.body[k]);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

  const payload = { ...req.body, limit: Math.min(Number(req.body.limit || 250), 5000), createdAt: new Date().toISOString() };

  if (queue) {
    const job = await queue.add('scrape-and-enrich', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
    });
    return res.status(202).json({ id: job.id, status: 'queued' });
  }

  const id = crypto.randomUUID();
  memory.set(id, { id, status: 'queued', progress: 0, payload });
  res.status(202).json({ id, status: 'queued', demoMode: true });
});

app.get('/api/jobs/:id', async (req, res) => {
  if (queue) {
    const j = await queue.getJob(req.params.id);
    if (!j) return res.sendStatus(404);
    return res.json({ id: j.id, status: await j.getState(), progress: j.progress, result: j.returnvalue });
  }
  const j = memory.get(req.params.id);
  j ? res.json(j) : res.sendStatus(404);
});

app.get('/health', (_, res) => res.json({ ok: true, queue: !!queue, mode: process.env.NODE_ENV || 'development' }));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.sendStatus(404);
  try {
    const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch {
    res.sendStatus(404);
  }
});

// For local development
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 4173;
  createServer(app).listen(PORT, () => console.log(`ScrapeLeads on http://localhost:${PORT}`));
}

export default app;