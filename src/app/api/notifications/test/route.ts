import { NextResponse } from 'next/server';
import { sendTelegramEvent } from '@/lib/telegram-notifications';

export async function POST() {
  try {
    const key = `test-down:${Date.now()}`;
    const result = await sendTelegramEvent({
      eventType: 'down',
      eventKey: key,
      text:
        `🧪 Тест уведомления SITE DOWN\n` +
        `Это тестовый алерт типа "down", чтобы проверить реальные настройки получателей.\n` +
        `Время: ${new Date().toLocaleString('ru-RU')}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/notifications/test failed', error);
    return NextResponse.json({ error: 'Failed to send test' }, { status: 500 });
  }
}
