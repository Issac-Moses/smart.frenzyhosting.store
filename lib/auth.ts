import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'emergency_session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'RESCUE_TEAM';
};

export async function setSessionCookie(session: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!cookie) return null;

  try {
    const parsed = JSON.parse(cookie) as SessionUser;
    return parsed;
  } catch {
    return null;
  }
}

export async function requireSession(allowedRoles?: SessionUser['role'][]) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect('/');
  }

  return session;
}

export async function authenticateLogin(input: {
  email: string;
  password: string;
  role: 'USER' | 'ADMIN' | 'RESCUE_TEAM';
}) {
  if (input.role === 'USER') {
    const record = await prisma.user.findUnique({ where: { email: input.email } });
    if (!record) return null;
    const valid = await bcrypt.compare(input.password, record.passwordHash);
    if (!valid) return null;
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: 'USER' as const,
    };
  }

  if (input.role === 'ADMIN') {
    const record = await prisma.admin.findUnique({ where: { email: input.email } });
    if (!record) return null;
    const valid = await bcrypt.compare(input.password, record.passwordHash);
    if (!valid) return null;
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: 'ADMIN' as const,
    };
  }

  const record = await prisma.rescueTeamAccount.findUnique({ where: { email: input.email } });
  if (!record) return null;
  const valid = await bcrypt.compare(input.password, record.passwordHash);
  if (!valid) return null;
  const team = await prisma.rescueTeam.findUnique({ where: { id: record.teamId } });
  return {
    id: record.teamId,
    email: record.email,
    name: team?.name ?? 'Rescue Team',
    role: 'RESCUE_TEAM' as const,
  };
}

export async function createUserRecord(data: {
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'USER',
    },
  });
}
