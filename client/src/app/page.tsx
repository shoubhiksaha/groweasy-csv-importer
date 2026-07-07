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
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
        }
        setPreviewData(results.data as Record<string, unknown>[]);
        setTotalRows(results.data.length);
        setIsParsing(false);
      },
      error: (error) => {
        setImportError(error.message);
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
    <main className="container">
      
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
            <p>Total records detected: {totalRows}</p>
            {isParsing ? (
              <p>Parsing...</p>
            ) : (
              <DataTable headers={headers} data={previewData} />
            )}
            <div className="flex justify-between mt-4">
              <Button variant="secondary" onClick={handleReset}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={isParsing}>Confirm Import</Button>
            </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in">
          <Card className="text-center">
            <h2>Processing with AI</h2>
            <p>Please wait while we intelligently map your CSV to our CRM format...</p>
            {progress && (
              <ProgressBar 
                progress={
                  progress.totalRecords !== '?' && progress.totalRecords !== undefined
                    ? (progress.processedRecords / (progress.totalRecords as number)) * 100 
                    : (progress.processedRecords / totalRows) * 100 // Estimate based on client parse
                } 
                label={progress.message}
              />
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
                      originalData: JSON.stringify(sr.originalData)
                    }))} 
                    maxHeight="300px"
                  />
                </div>
              </>
            )}

            <div className="mt-4 text-center">
              <Button onClick={handleReset}>Import Another File</Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
