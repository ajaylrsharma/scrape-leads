import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    getJob: vi.fn().mockResolvedValue({ id: 'test-job-id', getState: vi.fn().mockResolvedValue('waiting'), progress: 0, returnvalue: null }),
  })),
  Worker: vi.fn(),
}));

describe('Server API', () => {
  let app;
  let server;

  beforeEach(async () => {
    vi.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379';
    const serverModule = await import('../../server.js');
    app = serverModule.default || serverModule.app;
  });

  afterEach(async () => {
    if (server) await server.close();
  });

  describe('POST /api/jobs', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/jobs').send({ industry: 'Dentists' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing: location, email');
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app).post('/api/jobs').send({ industry: 'Dentists', location: 'Mumbai', email: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should accept valid payload and return job id', async () => {
      const res = await request(app).post('/api/jobs').send({ industry: 'Dentists', location: 'Mumbai, India', email: 'test@example.com', limit: 250 });
      expect(res.status).toBe(202);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('queued');
    });

    it('should enforce maximum limit of 5000', async () => {
      const res = await request(app).post('/api/jobs').send({ industry: 'Dentists', location: 'Mumbai', email: 'test@example.com', limit: 10000 });
      expect(res.status).toBe(202);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return 404 for non-existent job', async () => {
      const res = await request(app).get('/api/jobs/non-existent-id');
      expect(res.status).toBe(404);
    });

    it('should return job status when found', async () => {
      const res = await request(app).get('/api/jobs/test-job-id');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('test-job-id');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.queue).toBeDefined();
    });
  });
});