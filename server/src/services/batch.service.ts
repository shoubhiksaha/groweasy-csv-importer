import { CRMRecord } from '../types/crm.types';
import { SkippedRecord } from '../types/api.types';
import { logger } from '../utils/logger';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { CrmRecordSchema } from '../utils/import.validator';

export const processBatchLocal = (
  columnMapping: Record<string, string | null>,
  batch: any[],
  batchIndex: number,
  totalRecordsStart: number // index offset for accurate row numbers
): { crmRecords: CRMRecord[], skippedRecords: SkippedRecord[] } => {
  const crmRecords: CRMRecord[] = [];
  const skippedRecords: SkippedRecord[] = [];

  // Validate and post-process
  batch.forEach((originalData: any, index: number) => {
    const extractedRecord: any = {};
    for (const crmField of Object.keys(columnMapping)) {
      const csvHeader = columnMapping[crmField];
      extractedRecord[crmField] = csvHeader ? (originalData[csvHeader] || null) : null;
    }

    const defaultRecord = {
      created_at: null, name: null, email: null, country_code: null,
      mobile_without_country_code: null, company: null, city: null,
      state: null, country: null, lead_owner: null, crm_status: null,
      crm_note: null, data_source: null, possession_time: null, description: null
    };
    const record = { ...defaultRecord, ...extractedRecord };
    
    const rowIndex = totalRecordsStart - batch.length + index + 1;

    // Sanitize enums
    const validStatuses = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
    // Try to map obvious strings to statuses
    if (record.crm_status) {
       const statusStr = record.crm_status.toUpperCase();
       if (statusStr.includes('INTERESTED') || statusStr.includes('FOLLOW')) {
         record.crm_status = 'GOOD_LEAD_FOLLOW_UP';
       } else if (statusStr.includes('NOT CONNECT') || statusStr.includes('NO ANSWER')) {
         record.crm_status = 'DID_NOT_CONNECT';
       } else if (statusStr.includes('BAD') || statusStr.includes('NOT INTERESTED') || statusStr.includes('INVALID')) {
         record.crm_status = 'BAD_LEAD';
       } else if (statusStr.includes('SALE') || statusStr.includes('DONE')) {
         record.crm_status = 'SALE_DONE';
       }
       if (!validStatuses.includes(record.crm_status)) {
         record.crm_status = null;
       }
    }

    const validSources = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
    if (record.data_source) {
       let matched = false;
       for (const source of validSources) {
         if (record.data_source.toLowerCase().includes(source)) {
           record.data_source = source;
           matched = true;
           break;
         }
       }
       if (!matched) record.data_source = null;
    }

    // Date validation and normalization
    if (record.created_at) {
      const d = new Date(record.created_at);
      if (isNaN(d.getTime())) {
        record.created_at = null; // Invalid date
      } else {
        record.created_at = d.toISOString();
      }
    }

    // Email validation & split
    if (record.email) {
      const emails = record.email.split(/[,;]+/).map((e: string) => e.trim()).filter(Boolean);
      if (emails.length > 0) {
        const firstEmail = emails[0];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(firstEmail)) {
          record.email = firstEmail;
          if (emails.length > 1) {
            const extraEmails = emails.slice(1).join(', ');
            record.crm_note = record.crm_note ? `${record.crm_note} | Extra emails: ${extraEmails}` : `Extra emails: ${extraEmails}`;
          }
        } else {
          record.email = null;
        }
      }
    }

    // Phone fallback & split
    if (record.mobile_without_country_code) {
       const phones = record.mobile_without_country_code.split(/[,;\/]+/).filter(Boolean);
       let mainPhoneStr = phones[0];
       const fullPhoneToParse = (record.country_code || '') + mainPhoneStr;
       const parsedPhone = parsePhoneNumberFromString(fullPhoneToParse, 'IN');
       
       if (parsedPhone && parsedPhone.isValid()) {
         record.country_code = `+${parsedPhone.countryCallingCode}`;
         record.mobile_without_country_code = parsedPhone.nationalNumber;
       } else {
         // Fallback: strip non-digits
         const digits = mainPhoneStr.replace(/\D/g, '');
         record.mobile_without_country_code = digits || null;
       }
       
       if (record.mobile_without_country_code) {
          if (phones.length > 1) {
            const extraPhones = phones.slice(1).join(', ');
            record.crm_note = record.crm_note ? `${record.crm_note} | Extra phones: ${extraPhones}` : `Extra phones: ${extraPhones}`;
          }
       }
    }
    
    if (!record.mobile_without_country_code) {
      // try to find phone in original data
      const rawValues = Object.values(originalData).join(' ');
      const phoneMatch = rawValues.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/);
      if (phoneMatch) {
         const phoneNumber = parsePhoneNumberFromString(phoneMatch[0], 'IN');
         if (phoneNumber && phoneNumber.isValid()) {
            record.country_code = `+${phoneNumber.countryCallingCode}`;
            record.mobile_without_country_code = phoneNumber.nationalNumber;
         } else {
           const digits = phoneMatch[0].replace(/\D/g, '');
           if (digits.length >= 10) {
             record.mobile_without_country_code = digits.slice(-10);
           }
         }
      }
    }

    // Newline escaping for all string fields
    for (const key of Object.keys(record)) {
      if (typeof record[key] === 'string') {
        record[key] = record[key].replace(/\r?\n/g, '\\n');
      }
    }

    // Strict validation and sanitization
    const validationResult = CrmRecordSchema.safeParse(record);
    if (validationResult.success) {
      const finalRecord = validationResult.data as CRMRecord;
      if (!finalRecord.email && !finalRecord.mobile_without_country_code) {
        skippedRecords.push({
          rowIndex,
          originalData,
          reason: 'No valid email or mobile number found',
        });
      } else {
        crmRecords.push(finalRecord);
      }
    } else {
      // Strip invalid fields or skip
      skippedRecords.push({
        rowIndex,
        originalData,
        reason: `Validation failed: ${validationResult.error.issues.map(e => e.message).join(', ')}`
      });
    }
  });

  return { crmRecords, skippedRecords };
};
