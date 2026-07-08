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
  created_at: z.string().nullable().optional().catch(null),
  name: z.preprocess((val) => val != null ? String(val) : null, z.string().nullable().optional().catch(null)),
  email: z.preprocess((val) => val === '' ? null : val, z.string().email().nullable().optional().catch(null)),
  country_code: z.string().nullable().optional().catch(null),
  mobile_without_country_code: z.string().nullable().optional().catch(null),
  company: z.string().nullable().optional().catch(null),
  city: z.string().nullable().optional().catch(null),
  state: z.string().nullable().optional().catch(null),
  country: z.string().nullable().optional().catch(null),
  lead_owner: z.string().nullable().optional().catch(null),
  crm_status: CrmStatusEnum.nullable().optional().catch(null),
  crm_note: z.string().nullable().optional().catch(null),
  data_source: DataSourceEnum.nullable().optional().catch(null),
  possession_time: z.string().nullable().optional().catch(null),
  description: z.string().nullable().optional().catch(null),
});
