export function parseUptimeSeconds(value: string | null | undefined): number {
  if (!value) return 0;

  const trimmed = value.trim();
  if (/^\d+s$/i.test(trimmed)) return Math.max(0, parseInt(trimmed, 10));
  if (/^\d+m$/i.test(trimmed)) return Math.max(0, parseInt(trimmed, 10) * 60);
  if (/^\d+h$/i.test(trimmed)) return Math.max(0, parseInt(trimmed, 10) * 3600);
  if (/^\d+d$/i.test(trimmed)) return Math.max(0, parseInt(trimmed, 10) * 86400);

  const parts = {
    days: Number((trimmed.match(/(\d+)\s*d/i) || [])[1] || 0),
    hours: Number((trimmed.match(/(\d+)\s*h/i) || [])[1] || 0),
    minutes: Number((trimmed.match(/(\d+)\s*m/i) || [])[1] || 0),
    seconds: Number((trimmed.match(/(\d+)\s*s/i) || [])[1] || 0),
  };

  return parts.days * 86400 + parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
}

export function formatDurationRu(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${days} д ${hours} ч ${minutes} м ${seconds} с`;
}

export function formatUptimeRu(value: string | null | undefined): string {
  return formatDurationRu(parseUptimeSeconds(value));
}

export function splitLoadAverage(value: string | null | undefined): [string, string, string] {
  const raw = (value || '0.00, 0.00, 0.00').trim();
  const parts = raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return [parts[0] || '0.00', parts[1] || '0.00', parts[2] || '0.00'];
}
