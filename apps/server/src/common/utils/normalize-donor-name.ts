export function normalizeDonorName(name: string): string {
  return name.trim().replace(/\s+/gu, ' ').toLowerCase();
}
