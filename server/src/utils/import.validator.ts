import { z } from 'zod';

export const CrmStatusEnum = z.enum([
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
]);

export const DataSourceEnum = z.enum([
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
]);

export const CrmRecordSchema = z.object({
  created_at: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.preprocess((val) => val === '' ? null : val, z.string().email().nullable().optional()),
  country_code: z.string().nullable().optional(),
  mobile_without_country_code: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  lead_owner: z.string().nullable().optional(),
  crm_status: CrmStatusEnum.nullable().optional(),
  crm_note: z.string().nullable().optional(),
  data_source: DataSourceEnum.nullable().optional(),
  possession_time: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const BatchOutputSchema = z.array(CrmRecordSchema);
