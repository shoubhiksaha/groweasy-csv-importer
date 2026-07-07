import { CRMRecord } from './crm.types';

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
}
