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
    const accounts = await prisma.registrarAccount.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, url: true, login: true, createdAt: true, password: true, apiKey: true },
    });

    return NextResponse.json(
      accounts.map(({ password, apiKey, ...account }) => ({
        ...account,
        hasPassword: hasStoredSecret(password),
        hasApiKey: hasStoredSecret(apiKey),
      }))
    );
  } catch (error) {
    console.error("Error fetching registrar accounts:", error);
    return NextResponse.json({ error: "Error fetching" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = normalizeString(body.name);
    const url = normalizeString(body.url);
    const login = normalizeString(body.login);
    const password = normalizeString(body.password);
    const apiKey = normalizeString(body.apiKey);

    if (!name || !login) {
      return NextResponse.json({ error: "Name and login are required" }, { status: 400 });
    }

    const item = await prisma.registrarAccount.create({
      data: {
        name,
        url,
        login,
        password: await encryptSecret(password),
        apiKey: await encryptSecret(apiKey),
      },
      select: { id: true, name: true, url: true, login: true, createdAt: true, password: true, apiKey: true },
    });

    return NextResponse.json({
      id: item.id,
      name: item.name,
      url: item.url,
      login: item.login,
      createdAt: item.createdAt,
      hasPassword: hasStoredSecret(item.password),
      hasApiKey: hasStoredSecret(item.apiKey),
    });
  } catch (error) {
    console.error("POST /api/registrars failed", error);
    return NextResponse.json({ error: "Failed to create registrar account" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = normalizeString(body.id);
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await prisma.registrarAccount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Registrar account not found' }, { status: 404 });

    const name = normalizeString(body.name);
    const url = normalizeString(body.url);
    const login = normalizeString(body.login);
    const password = normalizeString(body.password);
    const apiKey = normalizeString(body.apiKey);
    const clearApiKey = body.clearApiKey === true;

    const updated = await prisma.registrarAccount.update({
      where: { id },
      data: {
        name: name || existing.name,
        url: body.url === '' ? null : (url ?? existing.url),
        login: login || existing.login,
        password: body.password === '' || body.password === undefined ? existing.password : await encryptSecret(password),
        apiKey: clearApiKey ? null : body.apiKey === '' || body.apiKey === undefined ? existing.apiKey : await encryptSecret(apiKey),
      },
      select: { id: true, name: true, url: true, login: true, createdAt: true, password: true, apiKey: true },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      url: updated.url,
      login: updated.login,
      createdAt: updated.createdAt,
      hasPassword: hasStoredSecret(updated.password),
      hasApiKey: hasStoredSecret(updated.apiKey),
    });
  } catch (error) {
    console.error('PATCH /api/registrars failed', error);
    return NextResponse.json({ error: 'Failed to update registrar account' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await prisma.registrarAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting registrar account:", error);
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
