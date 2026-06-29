export function buildCsv(rows: string[][], delimiter = ";") {
  return rows
    .map((row) =>
      row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter),
    )
    .join("\r\n");
}

export function csvResponse(filename: string, rows: string[][]) {
  return new Response(`${buildCsv(rows)}\r\n`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function escapeCsvCell(value: string, delimiter: string) {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
