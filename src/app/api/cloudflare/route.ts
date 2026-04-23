import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret, hasStoredSecret } from "@/lib/crypto-secrets";

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export async function GET() {
  try {
    const accounts = await prisma.cloudflareAccount.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        login: true,
        createdAt: true,
        password: true,
        apiToken: true,
        apiKey: true,
        _count: {
          select: { sites: true },
        },
      },
    });

    return NextResponse.json(
      accounts.map(({ password, apiToken, apiKey, _count, ...account }) => ({
        ...account,
        sitesCount: _count.sites,
        hasPassword: hasStoredSecret(password),
        hasApiToken: hasStoredSecret(apiToken),
        hasApiKey: hasStoredSecret(apiKey),
      }))
    );
  } catch (error) {
    console.error("Error fetching Cloudflare accounts:", error);
    return NextResponse.json({ error: "Error fetching" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = normalizeString(body.name);
    const login = normalizeString(body.login);
    const password = normalizeString(body.password);
    const apiToken = normalizeString(body.apiToken);
    const apiKey = normalizeString(body.apiKey);

    if (!name || !login || !password) {
      return NextResponse.json(
        { error: "Name, login and password are required" },
        { status: 400 }
      );
    }

    const item = await prisma.cloudflareAccount.create({
      data: {
        name,
        login,
        password: (await encryptSecret(password)) || '',
        apiToken: await encryptSecret(apiToken),
        apiKey: await encryptSecret(apiKey),
      },
      select: {
        id: true,
        name: true,
        login: true,
        createdAt: true,
        password: true,
        apiToken: true,
        apiKey: true,
        _count: {
          select: { sites: true },
        },
      },
    });

    return NextResponse.json({
      id: item.id,
      name: item.name,
      login: item.login,
      createdAt: item.createdAt,
      hasPassword: hasStoredSecret(item.password),
      hasApiToken: hasStoredSecret(item.apiToken),
      hasApiKey: hasStoredSecret(item.apiKey),
      sitesCount: item._count.sites,
    });
  } catch (error) {
    console.error("POST /api/cloudflare failed", error);
    return NextResponse.json(
      { error: "Failed to create Cloudflare account" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = normalizeString(body.id);
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await prisma.cloudflareAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Cloudflare account not found' }, { status: 404 });
    }

    const name = normalizeString(body.name);
    const login = normalizeString(body.login);
    const password = normalizeString(body.password);
    const apiToken = normalizeString(body.apiToken);
    const apiKey = normalizeString(body.apiKey);
    const clearApiToken = body.clearApiToken === true;
    const clearApiKey = body.clearApiKey === true;

    const updated = await prisma.cloudflareAccount.update({
      where: { id },
      data: {
        name: name || existing.name,
        login: login || existing.login,
        password: body.password === '' || body.password === undefined
          ? existing.password
          : (await encryptSecret(password)) || existing.password,
        apiToken: clearApiToken
          ? null
          : body.apiToken === '' || body.apiToken === undefined
            ? existing.apiToken
            : await encryptSecret(apiToken),
        apiKey: clearApiKey
          ? null
          : body.apiKey === '' || body.apiKey === undefined
            ? existing.apiKey
            : await encryptSecret(apiKey),
      },
      select: {
        id: true,
        name: true,
        login: true,
        createdAt: true,
        password: true,
        apiToken: true,
        apiKey: true,
        _count: {
          select: { sites: true },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      login: updated.login,
      createdAt: updated.createdAt,
      hasPassword: hasStoredSecret(updated.password),
      hasApiToken: hasStoredSecret(updated.apiToken),
      hasApiKey: hasStoredSecret(updated.apiKey),
      sitesCount: updated._count.sites,
    });
  } catch (error) {
    console.error('PATCH /api/cloudflare failed', error);
    return NextResponse.json({ error: 'Failed to update Cloudflare account' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.cloudflareAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Cloudflare account:", error);
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
