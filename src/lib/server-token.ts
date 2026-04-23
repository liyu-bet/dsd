import { randomBytes } from 'crypto';

export function generateMonitorToken(): string {
  return randomBytes(24).toString('hex');
}
