import React from 'react';
import { Card } from '../ui/Card';
import { ImportResponse } from '../../types';

interface ResultsSummaryProps {
  result: ImportResponse['data'];
  processingTime?: number;
}

export const ResultsSummary: React.FC<ResultsSummaryProps> = ({ result, processingTime }) => {
  return (
    <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
      <Card style={{ flex: 1, minWidth: '200px', borderLeft: '4px solid var(--primary)' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Records</h3>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{result.totalRecords}</p>
      </Card>
      
      <Card style={{ flex: 1, minWidth: '200px', borderLeft: '4px solid var(--success)' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Successfully Imported</h3>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{result.importedRecords}</p>
      </Card>
      
      <Card style={{ flex: 1, minWidth: '200px', borderLeft: '4px solid var(--warning)' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Skipped Records</h3>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{result.skippedRecords}</p>
      </Card>

      {processingTime && (
        <Card style={{ flex: 1, minWidth: '200px', borderLeft: '4px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Processing Time</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(processingTime / 1000).toFixed(1)}s</p>
        </Card>
      )}
    </div>
  );
};
