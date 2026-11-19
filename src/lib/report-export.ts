export type CsvCell = string | number | null | undefined;
export type CsvRow = CsvCell[];

function escapeCsv(value: CsvCell): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, rows: CsvRow[]): void {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function statusRows(title: string, counts: Record<string, number>): CsvRow[] {
  const rows: CsvRow[] = [[title, "Count"]];
  for (const [key, value] of Object.entries(counts)) rows.push([key, value]);
  if (Object.keys(counts).length === 0) rows.push(["None", 0]);
  return rows;
}
