import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  resourceId: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  quantity: z.number().min(1),
  availableQuantity: z.number().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE']),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const resource = await prisma.resource.create({
      data: {
        resourceId: data.resourceId,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        availableQuantity: data.availableQuantity,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status,
        description: data.description ?? 'Resource managed by admin',
      },
    });

    return NextResponse.json({ ok: true, resource });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bad request' }, { status: 400 });
  }
}
