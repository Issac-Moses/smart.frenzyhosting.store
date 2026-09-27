import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { testGeminiConnection } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await testGeminiConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}