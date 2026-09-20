/** Indian-format currency and date helpers used across the Occupancy screens. */

export function inr(n: number | null | undefined): string {
  if (n == null) return '—'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

/** Compact rupees for headline tiles: ₹4.2L, ₹1.3Cr. */
export function inrShort(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_00_00_000) return '₹' + (n / 1_00_00_000).toFixed(2) + ' Cr'
  if (abs >= 1_00_000) return '₹' + (n / 1_00_000).toFixed(2) + ' L'
  if (abs >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  return `${Math.floor(d / 30)} mo ago`
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}
