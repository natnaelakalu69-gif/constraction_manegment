"use client";

import { downloadCsv, type CsvRow } from "@/lib/report-export";

type Props = {
  filename: string;
  buildRows: () => CsvRow[];
  disabled?: boolean;
};

export function ReportExportButtons({ filename, buildRows, disabled }: Props) {
  return (
    <div className="export-actions print-hide">
      <button className="button button-secondary" type="button" disabled={disabled} onClick={() => downloadCsv(filename, buildRows())}>
        Download CSV
      </button>
      <button className="button button-secondary" type="button" disabled={disabled} onClick={() => window.print()}>
        Print / Save PDF
      </button>
    </div>
  );
}
