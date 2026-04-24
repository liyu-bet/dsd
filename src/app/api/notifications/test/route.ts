import { NextResponse } from 'next/server';
import { sendTelegramEvent } from '@/lib/telegram-notifications';

export async function POST() {
  try {
    const key = `test:${Date.now()}`;
    const result = await sendTelegramEvent({
      eventType: 'summary',
      eventKey: key,
      text: `✅ Тест Telegram уведомлений\nВремя: ${new Date().toLocaleString('ru-RU')}\nЕсли видите это сообщение — настройка рабочая.`,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/notifications/test failed', error);
    return NextResponse.json({ error: 'Failed to send test' }, { status: 500 });
  }
}
