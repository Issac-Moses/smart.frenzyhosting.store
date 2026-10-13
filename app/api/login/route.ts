import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSessionCookie, authenticateLogin } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['USER', 'ADMIN', 'RESCUE_TEAM']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    const user = await authenticateLogin(parsed);

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await setSessionCookie(user);

    const redirectMap = {
      USER: '/dashboard/user',
      ADMIN: '/dashboard/admin',
      RESCUE_TEAM: '/dashboard/rescue-team',
    } as const;

    return NextResponse.json({ ok: true, redirect: redirectMap[user.role] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bad request' }, { status: 400 });
  }
}
