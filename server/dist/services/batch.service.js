"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBatch = void 0;
const ai_service_1 = require("./ai.service");
const logger_1 = require("../utils/logger");
const libphonenumber_js_1 = require("libphonenumber-js");
const import_validator_1 = require("../utils/import.validator");
const MAX_RETRIES = 3;
const processBatch = async (headers, batch, batchIndex, totalRecordsStart // index offset for accurate row numbers
) => {
    let attempt = 0;
    let delay = 1000;
    while (attempt < MAX_RETRIES) {
        try {
            const extractedRecords = await (0, ai_service_1.extractCrmDataWithAI)(headers, batch);
            const crmRecords = [];
            const skippedRecords = [];
            // Validate and post-process
            extractedRecords.forEach((record, index) => {
                const rowIndex = totalRecordsStart - batch.length + index + 1;
                const originalData = batch[index];
                // Sanitize enums
                const validStatuses = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
                if (record.crm_status && !validStatuses.includes(record.crm_status)) {
                    record.crm_status = null;
                }
                const validSources = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
                if (record.data_source && !validSources.includes(record.data_source)) {
                    record.data_source = null;
                }
                // Date validation
                if (record.created_at) {
                    const d = new Date(record.created_at);
                    if (isNaN(d.getTime())) {
                        record.created_at = null; // Invalid date
                    }
                }
                // Email validation & split
                if (record.email) {
                    const emails = record.email.split(/[,;\s]+/).filter(Boolean);
                    if (emails.length > 0) {
                        const firstEmail = emails[0];
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (emailRegex.test(firstEmail)) {
                            record.email = firstEmail;
                            if (emails.length > 1) {
                                const extraEmails = emails.slice(1).join(', ');
                                record.crm_note = record.crm_note ? `${record.crm_note} | Extra emails: ${extraEmails}` : `Extra emails: ${extraEmails}`;
                            }
                        }
                        else {
                            record.email = null;
                        }
                    }
                }
                // Phone fallback & split
                if (record.mobile_without_country_code) {
                    const phones = record.mobile_without_country_code.split(/[,;\/]+/).filter(Boolean);
                    let mainPhone = phones[0].replace(/\D/g, ''); // Digits only check
                    if (mainPhone) {
                        record.mobile_without_country_code = mainPhone;
                        if (phones.length > 1) {
                            const extraPhones = phones.slice(1).join(', ');
                            record.crm_note = record.crm_note ? `${record.crm_note} | Extra phones: ${extraPhones}` : `Extra phones: ${extraPhones}`;
                        }
                    }
                    else {
                        record.mobile_without_country_code = null;
                    }
                }
                if (!record.mobile_without_country_code) {
                    // try to find phone in original data
                    const rawValues = Object.values(originalData).join(' ');
                    // Libphonenumber needs a country hint, we can use 'IN' as a reasonable default for Indian numbers or parse generally
                    // Alternatively, try to extract digits. Let's do a basic check
                    const phoneMatch = rawValues.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/);
                    if (phoneMatch) {
                        const phoneNumber = (0, libphonenumber_js_1.parsePhoneNumberFromString)(phoneMatch[0], 'IN');
                        if (phoneNumber && phoneNumber.isValid()) {
                            record.country_code = `+${phoneNumber.countryCallingCode}`;
                            record.mobile_without_country_code = phoneNumber.nationalNumber;
                        }
                        else {
                            // Fallback: just strip non-digits
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
                        record[key] = record[key].replace(/\n/g, ' ');
                    }
                }
                // Skip rule: skip if NO email AND NO mobile
                if (!record.email && !record.mobile_without_country_code) {
                    skippedRecords.push({
                        rowIndex,
                        originalData,
                        reason: 'No email or mobile number found',
                    });
                }
                else {
                    crmRecords.push(record);
                }
            });
            let validatedRecords = [];
            try {
                validatedRecords = import_validator_1.BatchOutputSchema.parse(crmRecords);
            }
            catch (e) {
                logger_1.logger.error('Zod validation failed, using unvalidated', e);
                validatedRecords = crmRecords;
            }
            return { crmRecords: validatedRecords, skippedRecords };
        }
        catch (error) {
            attempt++;
            logger_1.logger.warn(`AI batch extraction failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
            if (attempt >= MAX_RETRIES) {
                // If max retries reached, skip the entire batch
                logger_1.logger.error(`Batch ${batchIndex} completely failed after ${MAX_RETRIES} attempts.`);
                const skippedRecords = batch.map((originalData, index) => ({
                    rowIndex: totalRecordsStart - batch.length + index + 1,
                    originalData,
                    reason: `AI processing failed: ${error.message}`
                }));
                return { crmRecords: [], skippedRecords };
            }
            // Exponential backoff
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
    return { crmRecords: [], skippedRecords: [] };
};
exports.processBatch = processBatch;
