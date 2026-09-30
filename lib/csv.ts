export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (value: unknown) => {
    const raw = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return '"' + raw.replace(/"/g, '""') + '"';
  };
  return [
    headers.map(esc).join(","),
    ...rows.map((row) => headers.map((h) => esc(row[h])).join(","))
  ].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = "\ufeff" + toCsv(rows);
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
