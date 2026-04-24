import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptSecret, hasStoredSecret } from '@/lib/crypto-secrets';

export const dynamic = 'force-dynamic';

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const cleanHost = (value: string) => value.replace(/^https?:\/\//, '').split('/')[0].trim().toLowerCase();

const parseTags = (value: unknown) => {
  if (typeof value !== 'string') return '[]';
  return JSON.stringify(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
};

const parseDateInput = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function GET() {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { url: 'asc' },
      include: {
        server: true,
        cfAccount: {
          select: {
            id: true,
            name: true,
            login: true,
            createdAt: true,
            password: true,
          },
        },
        registrarAccount: {
          select: {
            id: true,
            name: true,
            url: true,
            login: true,
            password: true,
            apiKey: true,
            createdAt: true,
          },
        },
        checks: {
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
    });

    return NextResponse.json(
      sites.map((site: any) => ({
        ...site,
        adminPassword: undefined,
        hasAdminPassword: hasStoredSecret(site.adminPassword),
        cfAccount: site.cfAccount
          ? {
              id: site.cfAccount.id,
              name: site.cfAccount.name,
              login: site.cfAccount.login,
              createdAt: site.cfAccount.createdAt,
              hasPassword: hasStoredSecret(site.cfAccount.password),
            }
          : null,
        registrarAccount: site.registrarAccount
          ? {
              id: site.registrarAccount.id,
              name: site.registrarAccount.name,
              url: site.registrarAccount.url,
              login: site.registrarAccount.login,
              createdAt: site.registrarAccount.createdAt,
              hasPassword: hasStoredSecret(site.registrarAccount.password),
              hasApiKey: hasStoredSecret(site.registrarAccount.apiKey),
            }
          : null,
      }))
    );
  } catch (error) {
    console.error('Failed to fetch sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'Укажите URL сайта' }, { status: 400 });
    }

    const url = cleanHost(body.url);
    if (!url) return NextResponse.json({ error: 'Некорректный URL сайта' }, { status: 400 });

    const exists = await prisma.site.findFirst({ where: { url } });
    if (exists) return NextResponse.json({ error: 'Этот сайт уже есть в базе' }, { status: 400 });

    const hasAdmin = body.hasAdmin !== false;

    const site = await prisma.site.create({
      data: {
        url,
        serverId: normalizeString(body.serverId),
        group: normalizeString(body.group),
        comment: normalizeString(body.comment),
        adminUrl: hasAdmin ? normalizeString(body.adminUrl) : null,
        adminLogin: hasAdmin ? normalizeString(body.adminLogin) : null,
        adminPassword: hasAdmin ? await encryptSecret(normalizeString(body.adminPassword)) : null,
        cfAccountId: normalizeString(body.cfAccountId),
        registrarAccountId: normalizeString(body.registrarAccountId),
        domainExpiresAt: parseDateInput(body.domainExpiresAt),
        telegramMuted: body.telegramMuted === true,
        tags: parseTags(body.tags),
      },
      include: {
        server: true,
        cfAccount: { select: { id: true, name: true, login: true, createdAt: true, password: true } },
        registrarAccount: { select: { id: true, name: true, url: true, login: true, password: true, apiKey: true, createdAt: true } },
        checks: { orderBy: { createdAt: 'desc' }, take: 6 },
      },
    });

    return NextResponse.json({
      ...site,
      adminPassword: undefined,
      hasAdminPassword: hasStoredSecret(site.adminPassword),
      cfAccount: site.cfAccount
        ? {
            id: site.cfAccount.id,
            name: site.cfAccount.name,
            login: site.cfAccount.login,
            createdAt: site.cfAccount.createdAt,
            hasPassword: hasStoredSecret(site.cfAccount.password),
          }
        : null,
      registrarAccount: site.registrarAccount
        ? {
            id: site.registrarAccount.id,
            name: site.registrarAccount.name,
            url: site.registrarAccount.url,
            login: site.registrarAccount.login,
            createdAt: site.registrarAccount.createdAt,
            hasPassword: hasStoredSecret(site.registrarAccount.password),
            hasApiKey: hasStoredSecret(site.registrarAccount.apiKey),
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to create site:', error);
    return NextResponse.json({ error: 'Ошибка при добавлении' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await prisma.site.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Сайт не найден' }, { status: 404 });
    }

    const nextAdminPassword = normalizeString(body.adminPassword);
    const hasAdmin = body.hasAdmin !== false;

    const updated = await prisma.site.update({
      where: { id: body.id },
      data: {
        tags: parseTags(body.tags),
        group: normalizeString(body.group),
        comment: normalizeString(body.comment),
        adminUrl: hasAdmin ? normalizeString(body.adminUrl) : null,
        adminLogin: hasAdmin ? normalizeString(body.adminLogin) : null,
        adminPassword: !hasAdmin
          ? null
          : body.adminPassword === '' || body.adminPassword === undefined
            ? existing.adminPassword
            : await encryptSecret(nextAdminPassword),
        cfAccountId: normalizeString(body.cfAccountId),
        registrarAccountId: normalizeString(body.registrarAccountId),
        domainExpiresAt: body.domainExpiresAt === '' || body.domainExpiresAt === undefined ? null : parseDateInput(body.domainExpiresAt),
        telegramMuted: typeof body.telegramMuted === 'boolean' ? body.telegramMuted : existing.telegramMuted,
        serverId: normalizeString(body.serverId),
      },
      include: {
        server: true,
        cfAccount: { select: { id: true, name: true, login: true, createdAt: true, password: true } },
        registrarAccount: { select: { id: true, name: true, url: true, login: true, password: true, apiKey: true, createdAt: true } },
        checks: { orderBy: { createdAt: 'desc' }, take: 6 },
      },
    });

    return NextResponse.json({
      ...updated,
      adminPassword: undefined,
      hasAdminPassword: hasStoredSecret(updated.adminPassword),
      cfAccount: updated.cfAccount
        ? {
            id: updated.cfAccount.id,
            name: updated.cfAccount.name,
            login: updated.cfAccount.login,
            createdAt: updated.cfAccount.createdAt,
            hasPassword: hasStoredSecret(updated.cfAccount.password),
          }
        : null,
      registrarAccount: updated.registrarAccount
        ? {
            id: updated.registrarAccount.id,
            name: updated.registrarAccount.name,
            url: updated.registrarAccount.url,
            login: updated.registrarAccount.login,
            createdAt: updated.registrarAccount.createdAt,
            hasPassword: hasStoredSecret(updated.registrarAccount.password),
            hasApiKey: hasStoredSecret(updated.registrarAccount.apiKey),
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to update site:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.site.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete site:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
