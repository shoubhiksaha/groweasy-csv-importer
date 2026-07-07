import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import styles from './DataTable.module.css';

interface DataTableProps {
  headers: string[];
  data: Record<string, unknown>[];
  maxHeight?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ headers, data, maxHeight = '400px' }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // approximate row height
    overscan: 5,
  });

  return (
    <div 
      className={styles.tableContainer} 
      ref={parentRef}
      style={{ maxHeight, overflow: 'auto' }}
    >
      <div 
        className={styles.gridTable} 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${headers.length}, minmax(150px, 1fr))` 
        }}
      >
        {/* Header row */}
        <div className={styles.gridHeader} style={{ display: 'contents' }}>
          {headers.map((header, i) => (
            <div key={i} className={styles.gridHeaderCell}>{header}</div>
          ))}
        </div>

        {/* Virtualized body */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            gridColumn: `1 / -1`
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${headers.length}, minmax(150px, 1fr))`
                }}
                className={styles.gridRow}
              >
                {headers.map((header, j) => {
                  let cellValue = row[header];
                  if (typeof cellValue === 'object' && cellValue !== null) {
                    cellValue = JSON.stringify(cellValue);
                  }
                  return (
                    <div key={j} className={styles.gridCell} title={cellValue?.toString() || ''}>
                      <div className={styles.cellContent}>
                        {header === 'crm_status' && cellValue ? (
                          <span className={styles.statusBadge}>{cellValue.toString()}</span>
                        ) : header === 'reason' && cellValue ? (
                          <span className={styles.errorBadge}>{cellValue.toString()}</span>
                        ) : (
                          cellValue?.toString() || '-'
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
