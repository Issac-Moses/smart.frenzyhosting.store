import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createUserRecord, setSessionCookie } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    const existing = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'USER', email: data.email, password: data.password }),
    }).catch(() => null);

    if (existing && existing.ok) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    const user = await createUserRecord({
      name: data.name,
      email: data.email,
      password: data.password,
    });

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'USER',
    });

    return NextResponse.json({ ok: true, redirect: '/dashboard/user' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create account' }, { status: 400 });
  }
}
