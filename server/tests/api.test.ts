import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { uploadMiddleware } from '../src/middleware/upload';
import { parseCSVStream } from '../src/services/csv.service';

// Mock the AI service to just return deterministic output
vi.mock('../src/services/ai.service', () => ({
  extractCrmDataWithAI: vi.fn().mockImplementation(async (headers, batch) => {
    return batch.map((row: any) => ({
      name: row['Full Name'] || null,
      email: row['Email'] || null,
      mobile_without_country_code: row['Phone'] || null,
      crm_status: 'GOOD_LEAD_FOLLOW_UP',
      data_source: 'leads_on_demand'
    }));
  })
}));

const app = express();
app.post('/api/import', uploadMiddleware.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    await parseCSVStream(req.file.buffer, res);
  } catch (err) {
    next(err);
  }
});

describe('POST /api/import', () => {
  it('should successfully parse a small valid CSV', async () => {
    const csvContent = `Full Name,Email,Phone
John Doe,john@test.com,9988776655
Alice,alice@test.com,`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.status).toBe(200);
    // SSE sends multiple events, we just verify the text contains "complete" and expected data
    expect(response.text).toContain('"type":"complete"');
    expect(response.text).toContain('John Doe');
    expect(response.text).toContain('john@test.com');
  });

  it('should skip rows with no email and no phone', async () => {
    const csvContent = `Full Name,Email,Phone
Bob, , `;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.text).toContain('"type":"complete"');
    expect(response.text).toContain('"skippedRecords":1');
  });
});
