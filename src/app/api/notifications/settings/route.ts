import { NextResponse } from 'next/server';
import { getTelegramSettingsForUi, saveTelegramSettings } from '@/lib/telegram-notifications';

export async function GET() {
  try {
    const data = await getTelegramSettingsForUi();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/notifications/settings failed', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    await saveTelegramSettings({
      enabled: body.enabled,
      botToken: body.botToken,
      timezone: body.timezone,
      morningSummaryHour: body.morningSummaryHour,
      serverFailThreshold: body.serverFailThreshold,
      siteFailThreshold: body.siteFailThreshold,
      recoverySuccessCount: body.recoverySuccessCount,
      domainRenewalDays: body.domainRenewalDays,
    });
    const data = await getTelegramSettingsForUi();
    return NextResponse.json(data);
  } catch (error) {
    console.error('PATCH /api/notifications/settings failed', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
