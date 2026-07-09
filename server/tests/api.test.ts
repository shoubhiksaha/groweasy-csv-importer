import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { uploadMiddleware } from '../src/middleware/upload';
import { parseCSVStream } from '../src/services/csv.service';

// Mock the AI service to return deterministic column mapping
vi.mock('../src/services/ai.service', () => ({
  inferColumnMappingWithAI: vi.fn().mockImplementation(async (headers, batch) => {
    return {
      name: 'Full Name',
      email: 'Email',
      mobile_without_country_code: 'Phone'
    };
  })
}));

const app = express();
app.post('/api/import', uploadMiddleware.single('file'), async (req, res, next) => {
  try {
    if (!req.file || req.file.size === 0 || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: 'No file uploaded or file is empty' });
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

import { inferColumnMappingWithAI } from '../src/services/ai.service';

describe('POST /api/import', () => {
  it('should successfully parse a small valid CSV', async () => {
    const csvContent = `Full Name,Email,Phone
John Doe,john@test.com,9988776655
Alice,alice@test.com,`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.status).toBe(200);
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

    expect(response.status).toBe(400);
    expect(response.text).toContain('No file uploaded or file is empty');
  });

  // --- AI mapping failure fallback: should still complete using deterministic mapping ---
  it('should fall back to deterministic mapping when AI fails', async () => {
    vi.mocked(inferColumnMappingWithAI).mockImplementationOnce(async () => {
      throw new Error('AI quota exceeded');
    });

    // Use standard headers that the deterministic fallback will recognize
    const csvContent = `Full Name,Email,Phone\nBob,bob@test.com,9876543210`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    // Should NOT error — should complete successfully using fallback
    expect(response.text).toContain('"type":"complete"');
    expect(response.text).toContain('bob@test.com');
    expect(response.text).toContain('9876543210');
  });

  it('should normalize multiple emails and phones', async () => {
    vi.mocked(inferColumnMappingWithAI).mockImplementationOnce(async (headers, batch) => {
      return {
        name: 'Full Name',
        email: 'Email',
        mobile_without_country_code: 'Phone'
      };
    });

    // Multiple emails separated by comma inside a quoted field, multiple phones separated by space
    const csvContent = `Full Name,Email,Phone\nBob,"bob@test.com, bob2@test.com","9876543210 1234567890"`;

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.text).toContain('"type":"complete"');
    expect(response.text).toContain('bob@test.com');
    expect(response.text).toContain('9876543210');
    expect(response.text).toContain('Extra emails: bob2@test.com');
  });

  // --- Messy CSV full flow: 3 imported, 1 skipped ---
  it('should handle messy CSV: import valid rows, skip empty ones', async () => {
    vi.mocked(inferColumnMappingWithAI).mockImplementationOnce(async () => ({
      name: 'Name',
      email: 'Email',
      mobile_without_country_code: 'Phone',
      crm_status: 'Status',
      lead_owner: 'Owner'
    }));

    const csvContent = [
      'Name,Email,Phone,Status,Owner',
      'Alice,alice@test.com,9876543210,interested,rep@co.com',
      'Bob,,8765432109,warm,rep@co.com',
      'Carol,carol@test.com,,not interested,rep@co.com',
      'Dead,,,,owner@groweasy.ai',
    ].join('\n');

    const response = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(response.text).toContain('"type":"complete"');
    expect(response.text).toContain('"importedRecords":3');
    expect(response.text).toContain('"skippedRecords":1');
    // Verify "not interested" mapped correctly
    expect(response.text).toContain('"crm_status":"BAD_LEAD"');
    // Verify owner email did NOT leak as lead email
    expect(response.text).not.toContain('"email":"owner@groweasy.ai"');
  });
});
