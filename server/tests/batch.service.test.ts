import { describe, it, expect } from 'vitest';
import { processBatchLocal } from '../src/services/batch.service';

describe('batch.service', () => {
  it('should process a batch and validate emails and phones', () => {
    const columnMapping = {
      name: 'Full Name',
      email: 'Mail',
      mobile_without_country_code: 'Phone',
      crm_status: 'Status'
    };

    const batch = [{'Full Name': 'John Doe', 'Mail': 'john@example.com, extra@example.com', 'Phone': '9876543210/1234567890', 'Status': 'INVALID_STATUS'}];

    const result = processBatchLocal(columnMapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    const record = result.crmRecords[0];

    // Status should map INVALID to BAD_LEAD
    expect(record.crm_status).toBe('BAD_LEAD');

    // Dates should be sanitized
    expect(record.created_at).toBeNull();

    // Email should be the first valid one, rest in notes
    expect(record.email).toBe('john@example.com');
    expect(record.crm_note).toContain('Extra emails: extra@example.com');

    // Phone should take first set of digits, rest in notes
    expect(record.mobile_without_country_code).toBe('9876543210');
    expect(record.crm_note).toContain('Extra phones: +911234567890');
  });

  it('should skip records without email and mobile', () => {
    const columnMapping = {
      name: 'Name'
    };

    const result = processBatchLocal(columnMapping, [{'Name': 'Jane Doe'}], 1, 1);

    expect(result.crmRecords).toHaveLength(0);
    expect(result.skippedRecords).toHaveLength(1);
    expect(result.skippedRecords[0].reason).toBe('No valid email or mobile number found');
  });

  // --- Bug 1: "not interested" must become BAD_LEAD, not GOOD_LEAD_FOLLOW_UP ---
  it('should map "not interested" to BAD_LEAD', () => {
    const mapping = { name: 'Name', email: 'Email', crm_status: 'Status' };
    const batch = [{ Name: 'Alice', Email: 'alice@test.com', Status: 'not interested' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].crm_status).toBe('BAD_LEAD');
  });

  it('should map "interested" to GOOD_LEAD_FOLLOW_UP', () => {
    const mapping = { name: 'Name', email: 'Email', crm_status: 'Status' };
    const batch = [{ Name: 'Bob', Email: 'bob@test.com', Status: 'interested' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].crm_status).toBe('GOOD_LEAD_FOLLOW_UP');
  });

  // --- Bug 1 continued: "closed lost" must NOT become SALE_DONE ---
  it('should map "closed lost" to BAD_LEAD, not SALE_DONE', () => {
    const mapping = { name: 'Name', email: 'Email', crm_status: 'Status' };
    const batch = [{ Name: 'Carol', Email: 'carol@test.com', Status: 'Closed Lost' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].crm_status).toBe('BAD_LEAD');
  });

  it('should map "closed won" to SALE_DONE', () => {
    const mapping = { name: 'Name', email: 'Email', crm_status: 'Status' };
    const batch = [{ Name: 'Dan', Email: 'dan@test.com', Status: 'Closed Won' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].crm_status).toBe('SALE_DONE');
  });

  // --- Bug 2: Source = "-" should become null ---
  it('should map source "-" to null', () => {
    const mapping = { name: 'Name', email: 'Email', data_source: 'Source' };
    const batch = [{ Name: 'Eve', Email: 'eve@test.com', Source: '-' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].data_source).toBeNull();
  });

  it('should map source "N/A" to null', () => {
    const mapping = { name: 'Name', email: 'Email', data_source: 'Source' };
    const batch = [{ Name: 'Frank', Email: 'frank@test.com', Source: 'N/A' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].data_source).toBeNull();
  });

  it('should correctly match a valid source like "leads_on_demand"', () => {
    const mapping = { name: 'Name', email: 'Email', data_source: 'Source' };
    const batch = [{ Name: 'Grace', Email: 'grace@test.com', Source: 'Leads On Demand' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].data_source).toBe('leads_on_demand');
  });

  // --- Bug 3: Owner email should NOT become lead email ---
  it('should skip row when only lead_owner has an email but lead has none', () => {
    const mapping = {
      name: 'Name',
      email: 'Email',
      lead_owner: 'Owner'
    };
    const batch = [{ Name: 'Ghost Lead', Email: '', Owner: 'owner@groweasy.ai' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    // Should be skipped because the lead has no real email/phone
    expect(result.crmRecords).toHaveLength(0);
    expect(result.skippedRecords).toHaveLength(1);
    expect(result.skippedRecords[0].reason).toBe('No valid email or mobile number found');
  });

  // --- Bug 4: Separate country_code + phone fields ---
  it('should preserve country_code from a separate CSV column', () => {
    const mapping = {
      name: 'Name',
      email: 'Email',
      country_code: 'CC',
      mobile_without_country_code: 'Phone'
    };
    // Use a number that doesn't parse as valid Indian
    const batch = [{ Name: 'Intl User', Email: 'intl@test.com', CC: '+44', Phone: '2012345678' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    // Country code should be preserved when phone parser doesn't find a valid country
    expect(result.crmRecords[0].country_code).toBe('+44');
    expect(result.crmRecords[0].mobile_without_country_code).toBeTruthy();
  });

  // --- Quoted newline rows ---
  it('should handle values with embedded newlines', () => {
    const mapping = {
      name: 'Name',
      email: 'Email',
      crm_note: 'Notes'
    };
    const batch = [{ Name: 'Newline User', Email: 'nl@test.com', Notes: 'Line 1\nLine 2\nLine 3' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    // Newlines should be escaped
    expect(result.crmRecords[0].crm_note).not.toContain('\n');
    expect(result.crmRecords[0].crm_note).toContain('\\n');
  });

  // --- Messy CSV full flow: 3 imported, 1 skipped ---
  it('should handle messy mixed data: 3 imported, 1 skipped', () => {
    const mapping = {
      name: 'Name',
      email: 'Email',
      mobile_without_country_code: 'Phone',
      crm_status: 'Status',
      data_source: 'Source',
      lead_owner: 'Owner'
    };

    const batch = [
      // Row 1: Good lead with email + phone
      { Name: 'Alice', Email: 'alice@test.com', Phone: '9876543210', Status: 'interested', Source: 'leads_on_demand', Owner: 'rep@co.com' },
      // Row 2: Lead with phone only (no email)
      { Name: 'Bob', Email: '', Phone: '8765432109', Status: 'warm', Source: '-', Owner: 'rep@co.com' },
      // Row 3: Lead with email only (no phone)
      { Name: 'Carol', Email: 'carol@test.com', Phone: '', Status: 'not interested', Source: 'N/A', Owner: 'rep@co.com' },
      // Row 4: No email, no phone — should be skipped (owner email must not leak)
      { Name: 'Dead Lead', Email: '', Phone: '', Status: '', Source: '', Owner: 'owner@groweasy.ai' },
    ];

    const result = processBatchLocal(mapping, batch, 1, 4);

    expect(result.crmRecords).toHaveLength(3);
    expect(result.skippedRecords).toHaveLength(1);
    expect(result.skippedRecords[0].originalData.Name).toBe('Dead Lead');

    // Verify statuses
    expect(result.crmRecords[0].crm_status).toBe('GOOD_LEAD_FOLLOW_UP');
    expect(result.crmRecords[1].crm_status).toBe('GOOD_LEAD_FOLLOW_UP'); // warm
    expect(result.crmRecords[2].crm_status).toBe('BAD_LEAD'); // not interested

    // Verify noisy sources became null
    expect(result.crmRecords[0].data_source).toBe('leads_on_demand');
    expect(result.crmRecords[1].data_source).toBeNull(); // "-"
    expect(result.crmRecords[2].data_source).toBeNull(); // "N/A"
  });

  // --- Phone format tests: space-separated Indian numbers ---
  it('should parse "98765 43210" (Indian 5-5 format)', () => {
    const mapping = { name: 'Name', mobile_without_country_code: 'Phone' };
    const batch = [{ Name: 'SpacePhone', Phone: '98765 43210' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].mobile_without_country_code).toBe('9876543210');
  });

  it('should parse "+91 98765 43210" (Indian with country code)', () => {
    const mapping = { name: 'Name', mobile_without_country_code: 'Phone' };
    const batch = [{ Name: 'CCPhone', Phone: '+91 98765 43210' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].mobile_without_country_code).toBe('9876543210');
    expect(result.crmRecords[0].country_code).toBe('+91');
  });

  it('should parse "987-654-3210" (US-style dashes)', () => {
    const mapping = { name: 'Name', mobile_without_country_code: 'Phone' };
    const batch = [{ Name: 'DashPhone', Phone: '987-654-3210' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].mobile_without_country_code).toBe('9876543210');
  });

  // --- Contact Info column: email + phone in one field ---
  it('should extract email and phone from a "Contact Info" column', () => {
    const mapping = {
      name: 'Name',
      email: 'Contact Info',
      mobile_without_country_code: 'Contact Info'
    };
    const batch = [{ Name: 'Mixed', 'Contact Info': 'call me at 9876543210 or mail me at mixed@test.com' }];

    const result = processBatchLocal(mapping, batch, 1, 1);

    expect(result.crmRecords).toHaveLength(1);
    expect(result.crmRecords[0].email).toBe('mixed@test.com');
    expect(result.crmRecords[0].mobile_without_country_code).toBe('9876543210');
  });
});
