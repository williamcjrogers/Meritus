export function mapImportRow(row: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> { if (!Object.keys(mapping).length)
    throw new Error('A field mapping is required'); const mapped: Record<string, unknown> = {}; for (const [field, column] of Object.entries(mapping)) {
    if (!field.trim() || !column.trim() || !Object.prototype.hasOwnProperty.call(row, column))
        throw new Error(`Missing mapped field ${field}: ${column}`);
    if (['__proto__', 'constructor', 'prototype'].includes(field))
        throw new Error('Unsafe mapping field');
    mapped[field] = row[column];
} return mapped; }
