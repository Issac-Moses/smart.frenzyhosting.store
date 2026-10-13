import { prisma } from '@/lib/prisma';

export async function createNotification(data: {
  type: string;
  message: string;
  userId?: string;
  adminId?: string;
  teamId?: string;
  emergencyId?: string;
}) {
  return prisma.notification.create({
    data: {
      type: data.type,
      message: data.message,
      userId: data.userId,
      adminId: data.adminId,
      teamId: data.teamId,
      emergencyId: data.emergencyId,
    },
  });
}

export async function getNotificationsForRole(role: 'ADMIN' | 'USER' | 'RESCUE_TEAM', userId?: string, teamId?: string) {
  if (role === 'USER' && userId) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  if (role === 'RESCUE_TEAM' && teamId) {
    return prisma.notification.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  return prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}
