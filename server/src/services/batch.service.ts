import { CRMRecord } from '../types/crm.types';
import { SkippedRecord } from '../types/api.types';
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

    // Sanitize enums — check negative/specific patterns BEFORE broad positive ones
    const validStatuses = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
    if (record.crm_status) {
       const statusStr = record.crm_status.toUpperCase();
       // Negative patterns first ("not interested" must not match "interested")
       if (statusStr.includes('NOT INTERESTED') || statusStr.includes('BAD') || statusStr.includes('INVALID') || statusStr.includes('SPAM') || statusStr.includes('WRONG') || statusStr.includes('JUNK')) {
         record.crm_status = 'BAD_LEAD';
       } else if (statusStr.includes('NOT CONNECT') || statusStr.includes('NO ANSWER') || statusStr.includes('UNREACHABLE') || statusStr.includes('BUSY') || statusStr.includes('NO RESPONSE')) {
         record.crm_status = 'DID_NOT_CONNECT';
       } else if (statusStr.includes('CLOSED') && (statusStr.includes('LOST') || statusStr.includes('REJECT'))) {
         // "closed lost" / "closed rejected" is NOT a sale
         record.crm_status = 'BAD_LEAD';
       } else if (statusStr.includes('SALE') || statusStr.includes('WON') || statusStr.includes('CONVERTED') || statusStr.includes('PURCHASED') || (statusStr.includes('CLOSED') && !statusStr.includes('LOST'))) {
         record.crm_status = 'SALE_DONE';
       } else if (statusStr.includes('INTERESTED') || statusStr.includes('FOLLOW') || statusStr.includes('WARM') || statusStr.includes('HOT') || statusStr.includes('QUALIFIED')) {
         record.crm_status = 'GOOD_LEAD_FOLLOW_UP';
       }
       if (!validStatuses.includes(record.crm_status)) {
         record.crm_status = null;
       }
    }

    const validSources = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
    if (record.data_source) {
       // Strip non-alphanumeric, require at least 3 meaningful chars to avoid noisy matches
       const normalizedSource = record.data_source.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
       let matched = false;
       if (normalizedSource.length >= 3) {
         for (const source of validSources) {
           if (normalizedSource.includes(source)) {
             record.data_source = source;
             matched = true;
             break;
           }
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

    // Build a restricted fallback text from ONLY mapped contact columns (email, phone, notes, description)
    // to avoid importing owner emails / unrelated fields as lead contact info.
    const contactColumns = new Set<string>();
    for (const field of ['email', 'mobile_without_country_code', 'crm_note', 'description']) {
      const col = columnMapping[field];
      if (col) contactColumns.add(col);
    }
    
    // Safety net: If AI failed to map a column like "Contact Info", still include it in the scan
    // as long as it's not an owner column.
    for (const header of Object.keys(originalData)) {
      const lower = header.toLowerCase();
      const isContactRelated = lower.includes('contact') || lower.includes('email') || lower.includes('phone') || lower.includes('mobile');
      const isOwner = lower.includes('owner');
      if (isContactRelated && !isOwner) {
        contactColumns.add(header);
      }
    }
    const contactRawValues = Object.entries(originalData)
      .filter(([key]) => contactColumns.has(key))
      .map(([, val]) => val)
      .join(' ');

    // Email extraction & fallback (scans mapped email + contact columns only)
    const textToScanForEmail = (record.email || '') + ' ' + contactRawValues;
    const emailMatches = textToScanForEmail.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/g);
    if (emailMatches && emailMatches.length > 0) {
      const uniqueEmails = Array.from(new Set(emailMatches));
      record.email = uniqueEmails[0];
      if (uniqueEmails.length > 1) {
        const extraEmails = uniqueEmails.slice(1).join(', ');
        record.crm_note = record.crm_note ? `${record.crm_note} | Extra emails: ${extraEmails}` : `Extra emails: ${extraEmails}`;
      }
    } else {
      record.email = null;
    }

    // Phone extraction & fallback (scans mapped phone + contact columns only)
    const textToScanForPhone = (record.mobile_without_country_code || '') + ' ' + contactRawValues;
    // Two-stage phone extraction:
    // 1. Match any run of digits, spaces, hyphens, dots, parens, optionally prefixed with +
    // 2. Filter to candidates with 10+ digits (a real phone number)
    // 3. Split over-long candidates (>15 digits per ITU max) by treating them as multiple numbers
    const rawPhoneCandidates = textToScanForPhone.match(/\+?[\d\s\-().]{7,}/g) || [];
    const phoneMatches: string[] = [];
    for (const candidate of rawPhoneCandidates) {
      const digitCount = candidate.replace(/\D/g, '').length;
      if (digitCount < 10) continue;
      if (digitCount <= 15) {
        phoneMatches.push(candidate.trim());
      } else {
        // Likely multiple numbers jammed together — split on common delimiters or whitespace gaps
        const subCandidates = candidate.split(/[,;\/]+|(?<=\d)\s{2,}(?=\d)/).map(s => s.trim()).filter(Boolean);
        if (subCandidates.length > 1) {
          for (const sub of subCandidates) {
            if (sub.replace(/\D/g, '').length >= 10) phoneMatches.push(sub);
          }
        } else {
          // Try splitting pure digit string into 10-digit chunks
          const allDigits = candidate.replace(/\D/g, '');
          for (let i = 0; i + 10 <= allDigits.length; i += 10) {
            phoneMatches.push(allDigits.slice(i, i + 10));
          }
        }
      }
    }
    
    // Preserve original country_code from CSV if provided; only reset phone for re-extraction
    const originalCountryCode = record.country_code;
    record.mobile_without_country_code = null;
    record.country_code = null;
    
    if (phoneMatches && phoneMatches.length > 0) {
      const validPhones: { cc: string, nat: string }[] = [];
      const seenPhones = new Set<string>();
      
      for (const phoneStr of phoneMatches) {
        let cc: string | null = null;
        let nat: string | null = null;
        
        // If original CSV had a country_code, try parsing with that first
        const phoneWithCC = originalCountryCode ? originalCountryCode + phoneStr : phoneStr;
        const parsedPhone = parsePhoneNumberFromString(phoneWithCC, 'IN');
        if (parsedPhone && parsedPhone.isValid()) {
          cc = `+${parsedPhone.countryCallingCode}`;
          nat = parsedPhone.nationalNumber;
        } else {
          const digits = phoneStr.replace(/\D/g, '');
          if (digits.length >= 10) {
            nat = digits.slice(-10);
          }
        }

        if (nat) {
          const uniqueKey = `${cc || ''}${nat}`;
          if (!seenPhones.has(uniqueKey)) {
            seenPhones.add(uniqueKey);
            validPhones.push({ cc: cc as any, nat });
          }
        }
      }

      if (validPhones.length > 0) {
        record.country_code = validPhones[0].cc || originalCountryCode;
        record.mobile_without_country_code = validPhones[0].nat;
        
        if (validPhones.length > 1) {
          const extraPhones = validPhones.slice(1).map(p => (p.cc || '') + p.nat).join(', ');
          record.crm_note = record.crm_note ? `${record.crm_note} | Extra phones: ${extraPhones}` : `Extra phones: ${extraPhones}`;
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
