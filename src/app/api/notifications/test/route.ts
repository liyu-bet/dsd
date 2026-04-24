import { NextResponse } from 'next/server';
import { sendTelegramEvent } from '@/lib/telegram-notifications';

const ALLOWED_TYPES = ['down', 'up', 'domain', 'billing', 'summary'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string): value is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(value);
}

function messageByType(type: AllowedType) {
  const now = new Date().toLocaleString('ru-RU');
  if (type === 'down') return `🧪 Тест уведомления DOWN\nВремя: ${now}`;
  if (type === 'up') return `🧪 Тест уведомления UP\nВремя: ${now}`;
  if (type === 'domain') {
    return (
      `🟠 Продление домена\n` +
      `Домен: tower-rush-game.online\n` +
      `До продления: 5 дн.\n` +
      `Дата: 29 апр. 2026 г., 23:59\n` +
      `Регистратор: <a href="https://regway.com">REGWAY</a>`
    );
  }
  if (type === 'billing') {
    return (
      `🔴 Неоплаченные счета\n` +
      `• Биллинг: <a href="https://cp.inferno.name">INFERNO</a>\n` +
      `• Счетов: 1\n` +
      `• Сумма: 20.00\n` +
      `• Дедлайн оплаты: 30 апр. 2026 г., 23:59 (6 дн.)`
    );
  }
  return (
    `☀️ Утренний саммари\n` +
    `• Серверы: online 6, offline 0\n` +
    `• Сайты: online 133, offline 5\n` +
    `• Домены для оплаты: 8\n` +
    `• Неоплаченные сервера: 1 на сумму 20.00\n` +
    `• Биллинги: <a href="https://cp.inferno.name">INFERNO</a>`
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as { eventType?: string }));
    const rawType = String(body?.eventType || 'down').toLowerCase();
    const eventType: AllowedType = isAllowedType(rawType) ? rawType : 'down';
    const key = `test-${eventType}:${Date.now()}`;
    const result = await sendTelegramEvent({
      eventType,
      eventKey: key,
      text: messageByType(eventType),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/notifications/test failed', error);
    return NextResponse.json({ error: 'Failed to send test' }, { status: 500 });
  }
}
