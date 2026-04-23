import { NextResponse } from 'next/server';
import { createSessionToken, getSessionCookieName, getSessionTtlSeconds } from '@/lib/auth-session';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (!correctPassword) {
      console.error('[AUTH] ADMIN_PASSWORD is not configured');
      return NextResponse.json({ error: 'Пароль не настроен на сервере (см. логи)' }, { status: 500 });
    }

    if (password !== correctPassword) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
    }

    const token = await createSessionToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set({
      name: getSessionCookieName(),
      value: token,
      path: '/',
      maxAge: getSessionTtlSeconds(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error) {
    console.error('[AUTH] Failed to login', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: getSessionCookieName(),
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
