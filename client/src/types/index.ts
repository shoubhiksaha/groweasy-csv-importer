export type CRMStatus = 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE';
export type DataSource = 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots';

export interface CRMRecord {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: CRMStatus | null;
  crm_note: string | null;
  data_source: DataSource | null;
  possession_time: string | null;
  description: string | null;
}

export interface SkippedRecord {
  rowIndex: number;
  originalData: Record<string, string>;
  reason: string;
}

export interface ImportResponse {
  success: boolean;
  data: {
    totalRecords: number;
    importedRecords: number;
    skippedRecords: number;
    crmRecords: CRMRecord[];
    skippedDetails: SkippedRecord[];
    processingTime?: number;
  };
}

export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  batchIndex: number;
  totalBatches: number | string;
  processedRecords: number;
  totalRecords: number | string;
  message: string;
  data?: ImportResponse['data'];
  processingTime?: number;
}
