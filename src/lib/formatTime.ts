const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Local-time `YYYY-MM-DD HH:mm` for an RFC3339 string.
 *
 * Returns "" for missing or unparseable input, so a caller renders nothing
 * instead of "Invalid Date" — that happens for notes written before
 * timestamps existed, or a hand-edited JSON file.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
