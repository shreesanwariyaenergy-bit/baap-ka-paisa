/** Indian digit grouping: ₹1,00,000. Amounts are whole rupees for display; storage is integer paise. */
export function inr(rupees: number): string {
  return '₹' + Math.round(rupees).toLocaleString('en-IN');
}

export function inrShort(rupees: number): string {
  const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  if (rupees >= 1e7) return '₹' + f(rupees / 1e7) + 'Cr';
  if (rupees >= 1e5) return '₹' + f(rupees / 1e5) + 'L';
  if (rupees >= 1e3) return '₹' + f(rupees / 1e3) + 'K';
  return '₹' + rupees;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const memberNo = (n: number | null) => (n === null ? 'Hidden' : String(n).padStart(5, '0'));

export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number) => MONTHS[m];
export const monthShort = (m: number) => MONTHS[m].slice(0, 3);
