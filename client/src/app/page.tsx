"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import { DropZone } from '@/components/upload/DropZone';
import { DataTable } from '@/components/preview/DataTable';
import { ResultsSummary } from '@/components/results/ResultsSummary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { importCSV } from '@/lib/api';
import { ImportResponse, ProgressEvent } from '@/types';

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  
  // Preview State
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  // Import State
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse['data'] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setStep(2);
    
    // Parse for preview
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      preview: 100, // Load only first 100 rows for preview
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          setImportError(`CSV Warnings: ${results.errors.map(e => e.message).join(', ')}`);
        }
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
        }
        setPreviewData(results.data as Record<string, unknown>[]);
        setTotalRows(results.data.length); // This is just the preview count
        setIsParsing(false);
      },
      error: (error) => {
        setImportError(`Parse Error: ${error.message}`);
        setIsParsing(false);
      }
    });
  };

  const handleConfirm = async () => {
    if (!file) return;
    
    setStep(3);
    setImportError(null);
    setProgress(null);
    
    try {
      const result = await importCSV(file, (event) => {
        setProgress(event);
      });
      setImportResult(result);
      setStep(4);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setImportError(error.message);
      } else {
        setImportError('An error occurred during import.');
      }
      setStep(2); // Go back to preview
    }
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setImportResult(null);
    setProgress(null);
    setImportError(null);
  };

  return (
    <>
      
      {/* Basic Step Indicator */}
      <div className="flex justify-center gap-4 mb-4">
        {[1, 2, 3, 4].map((s) => (
          <span key={s} style={{ fontWeight: step === s ? 'bold' : 'normal', color: step >= s ? 'var(--primary)' : 'var(--text-muted)' }}>
            Step {s}
          </span>
        ))}
      </div>

      {importError && (
        <Card className="mb-4" style={{ borderColor: 'var(--danger)', backgroundColor: 'var(--danger-light)' }}>
          <p style={{ color: 'var(--danger)', margin: 0 }}>{importError}</p>
        </Card>
      )}

      {step === 1 && (
        <div className="animate-fade-in flex-col items-center">
          <DropZone onFileSelect={handleFileSelect} />
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in">
          <Card>
            <h2>Preview: {file?.name}</h2>
            <p>Showing first {totalRows} records (full file will be imported)...</p>
            {isParsing ? (
              <p>Parsing...</p>
            ) : (
              <DataTable headers={headers} data={previewData} />
            )}
            <div className="flex justify-between mt-4">
              <Button variant="secondary" onClick={handleReset}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={isParsing || headers.length === 0 || totalRows === 0}>Confirm Import</Button>
            </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in">
          <Card className="text-center">
            <h2>Processing with AI</h2>
            <p>Please wait while we intelligently map your CSV to our CRM format...</p>
            {progress ? (
              <ProgressBar 
                progress={
                  progress.totalRecords !== '?' && progress.totalRecords !== undefined
                    ? (progress.processedRecords / (progress.totalRecords as number)) * 100 
                    : (progress.processedRecords / Math.max(1, totalRows)) * 100 // Estimate based on client parse
                } 
                label={progress.message}
              />
            ) : (
              <div style={{ margin: '1rem 0', textAlign: 'center' }}>
                <p>Initializing AI models... this may take a few seconds.</p>
                <div className="animate-spin" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', marginTop: '0.5rem' }}></div>
              </div>
            )}
          </Card>
        </div>
      )}

      {step === 4 && importResult && (
        <div className="animate-fade-in">
          <Card>
            <h2>Import Complete!</h2>
            <ResultsSummary result={importResult} processingTime={importResult.processingTime} />
            
            <h3>Imported Records ({importResult.importedRecords})</h3>
            <div className="mb-4">
              {importResult.crmRecords.length > 0 ? (
                <DataTable 
                  headers={Object.keys(importResult.crmRecords[0] || {})} 
                  data={importResult.crmRecords as unknown as Record<string, unknown>[]} 
                  maxHeight="300px"
                />
              ) : (
                <p>No records imported.</p>
              )}
            </div>

            {importResult.skippedDetails.length > 0 && (
              <>
                <h3>Skipped Records ({importResult.skippedRecords})</h3>
                <div>
                  <DataTable 
                    headers={['rowIndex', 'reason', 'originalData']} 
                    data={importResult.skippedDetails.map(sr => ({
                      rowIndex: sr.rowIndex,
                      reason: sr.reason,
                      originalData: typeof sr.originalData === 'object' && sr.originalData !== null 
                        ? Object.entries(sr.originalData).map(([k,v]) => `${k}: ${v}`).join(' | ') 
                        : String(sr.originalData)
                    }))} 
                    maxHeight="300px"
                  />
                </div>
              </>
            )}

            <div className="mt-4 flex gap-4 justify-center">
              <Button variant="secondary" onClick={() => {
                const csvData = Papa.unparse(importResult.crmRecords);
                const blob = new Blob([csvData], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `groweasy-import-${new Date().toISOString()}.csv`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>Export CRM Data</Button>
              <Button onClick={handleReset}>Import Another File</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
