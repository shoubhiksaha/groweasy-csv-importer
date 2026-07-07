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
    const totalRecordsCount = req.file.buffer.toString('utf-8').split(/\r\n|\n|\r/).filter(l => l.trim().length > 0).length - 1;
    await parseCSVStream(req.file.buffer, res, Math.max(0, totalRecordsCount));
  } catch (err) {
    next(err);
  }
});

import { extractCrmDataWithAI } from '../src/services/ai.service';

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

  it('should reject empty CSV', async () => {
    const csvContent = ``;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'empty.csv');

    expect(response.text).toContain('"type":"error"');
    expect(response.text).toContain('CSV file is empty or contains no headers');
  });

  it('should handle AI row-count mismatch and skip batch', async () => {
    vi.mocked(extractCrmDataWithAI).mockImplementationOnce(async (headers, batch) => {
      return []; // Return empty array to trigger mismatch
    }).mockImplementationOnce(async (headers, batch) => {
      return []; // Retry 1
    }).mockImplementationOnce(async (headers, batch) => {
      return []; // Retry 2
    });

    const csvContent = `Full Name,Email,Phone\nBob,bob@test.com,12345`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.text).toContain('"skippedRecords":1');
    expect(response.text).toContain('AI processing failed');
  });

  it('should fail Zod validation if data type is wrong', async () => {
    vi.mocked(extractCrmDataWithAI).mockImplementationOnce(async (headers, batch) => {
      return batch.map((row: any) => ({
        name: 'Bob',
        email: 'bob@test.com',
        mobile_without_country_code: '1234567890',
        city: true, // invalid type for string field
      }));
    });

    const csvContent = `Full Name,Email,Phone\nBob,bob@test.com,1234567890`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.text).toContain('"skippedRecords":1');
    expect(response.text).toContain('Validation failed');
  });

  it('should normalize multiple emails and phones', async () => {
    vi.mocked(extractCrmDataWithAI).mockImplementationOnce(async (headers, batch) => {
      return batch.map((row: any) => ({
        name: row['Full Name'],
        email: 'bob@test.com, bob2@test.com',
        mobile_without_country_code: '9876543210, 1234567890',
      }));
    });

    const csvContent = `Full Name,Email,Phone\nBob,bob@test.com, bob2@test.com,9876543210`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.text).toContain('"type":"complete"');
    expect(response.text).toContain('bob@test.com');
    expect(response.text).toContain('9876543210');
    expect(response.text).toContain('Extra emails: bob2@test.com');
    expect(response.text).toContain('1234567890');
  });
});
