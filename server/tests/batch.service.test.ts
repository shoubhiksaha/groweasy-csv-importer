import { describe, it, expect } from 'vitest';
import { processBatch } from '../src/services/batch.service';
import * as aiService from '../src/services/ai.service';
import { vi } from 'vitest';

vi.mock('../src/services/ai.service', () => ({
  extractCrmDataWithAI: vi.fn(),
}));

describe('batch.service', () => {
  it('should process a batch and validate emails and phones', async () => {
    // Mock the AI response with unvalidated dirty data
    const mockAiResponse = [
      {
        name: 'John Doe',
        email: 'john@example.com, invalid-email',
        mobile_without_country_code: '9876543210/1234567890',
        crm_status: 'INVALID_STATUS',
        created_at: 'invalid-date',
      }
    ];

    vi.mocked(aiService.extractCrmDataWithAI).mockResolvedValue(mockAiResponse);

    const headers = ['Full Name', 'Mail', 'Phone'];
    const batch = [{'Full Name': 'John Doe', 'Mail': 'john@example.com, invalid-email', 'Phone': '9876543210/1234567890'}];

    const result = await processBatch(headers, batch, 1, 0);

    expect(result.crmRecords).toHaveLength(1);
    const record = result.crmRecords[0];

    // Status should be sanitized
    expect(record.crm_status).toBeNull();
    
    // Dates should be sanitized
    expect(record.created_at).toBeNull();

    // Email should be the first valid one, rest in notes
    expect(record.email).toBe('john@example.com');
    expect(record.crm_note).toContain('Extra emails: invalid-email');

    // Phone should take first set of digits, rest in notes
    expect(record.mobile_without_country_code).toBe('9876543210');
    expect(record.crm_note).toContain('Extra phones: 1234567890');
  });

  it('should skip records without email and mobile', async () => {
    const mockAiResponse = [
      {
        name: 'Jane Doe',
        email: null,
        mobile_without_country_code: null,
      }
    ];

    vi.mocked(aiService.extractCrmDataWithAI).mockResolvedValue(mockAiResponse);

    const result = await processBatch(['Name'], [{'Name': 'Jane Doe'}], 1, 0);

    expect(result.crmRecords).toHaveLength(0);
    expect(result.skippedRecords).toHaveLength(1);
    expect(result.skippedRecords[0].reason).toBe('No email or mobile number found');
  });
});
