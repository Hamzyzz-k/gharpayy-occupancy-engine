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

/** Compact thousands for chart labels: ₹20.2k. */
export function inrK(n: number): string {
  if (Math.abs(n) < 1000) return '₹' + Math.round(n)
  return '₹' + (n / 1000).toFixed(1) + 'k'
}

/** "Gharpayy HSR Sector 2" -> "HSR Sector 2". Every property carries the brand. */
export function shortProperty(name: string): string {
  return name.replace(/^Gharpayy\s+/i, '')
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** Task due times: "Today, 10:30 AM", "Tomorrow, 9:00 AM", "24 Sept, 4:00 PM". */
export function dueLabel(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(d) - start(new Date())) / 86_400_000)
  if (diff === 0) return `Today, ${time}`
  if (diff === 1) return `Tomorrow, ${time}`
  if (diff === -1) return `Yesterday, ${time}`
  return `${shortDate(iso)}, ${time}`
}

/** Digits only, for wa.me links. */
export function waNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}
