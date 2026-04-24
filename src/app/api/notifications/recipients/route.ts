import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function norm(v: unknown) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

export async function GET() {
  try {
    const rows = await prisma.telegramNotificationRecipient.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/notifications/recipients failed', error);
    return NextResponse.json({ error: 'Failed to load recipients' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = norm(body.name);
    const chatId = norm(body.chatId);
    if (!name || !chatId) {
      return NextResponse.json({ error: 'Name and chatId are required' }, { status: 400 });
    }
    const row = await prisma.telegramNotificationRecipient.create({
      data: {
        name,
        chatId,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json(row);
  } catch (error) {
    console.error('POST /api/notifications/recipients failed', error);
    return NextResponse.json({ error: 'Failed to create recipient' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = norm(body.id);
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const row = await prisma.telegramNotificationRecipient.update({
      where: { id },
      data: {
        name: typeof body.name === 'string' ? norm(body.name) : undefined,
        chatId: typeof body.chatId === 'string' ? norm(body.chatId) : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        notifyDown: typeof body.notifyDown === 'boolean' ? body.notifyDown : undefined,
        notifyUp: typeof body.notifyUp === 'boolean' ? body.notifyUp : undefined,
        notifyDomain: typeof body.notifyDomain === 'boolean' ? body.notifyDomain : undefined,
        notifyBilling: typeof body.notifyBilling === 'boolean' ? body.notifyBilling : undefined,
        notifySummary: typeof body.notifySummary === 'boolean' ? body.notifySummary : undefined,
      },
    });
    return NextResponse.json(row);
  } catch (error) {
    console.error('PATCH /api/notifications/recipients failed', error);
    return NextResponse.json({ error: 'Failed to update recipient' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = norm(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await prisma.telegramNotificationRecipient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/notifications/recipients failed', error);
    return NextResponse.json({ error: 'Failed to delete recipient' }, { status: 500 });
  }
}
