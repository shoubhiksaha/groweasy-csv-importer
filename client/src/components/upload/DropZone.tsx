import React, { useCallback, useRef, useState } from 'react';
import styles from './DropZone.module.css';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  error?: string | null;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, error }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localError, setLocalError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    setLocalError(null);
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!allowedMimes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Only CSV files are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('File size exceeds the 10MB limit.');
      return;
    }
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };


  return (
    <div className={styles.container}>
      <div 
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${(error || localError) ? styles.hasError : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleChange} 
          accept=".csv" 
          className={styles.hiddenInput} 
        />
        <div className={styles.icon}>📁</div>
        <h3>Drag & Drop your CSV file here</h3>
        <p>or click to browse from your computer</p>
      </div>
      {(error || localError) && <div className={styles.errorMessage}>{error || localError}</div>}
    </div>
  );
};
