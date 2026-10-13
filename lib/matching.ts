import { prisma } from '@/lib/prisma';
import { getGeminiRecommendation } from '@/lib/gemini';
import { calculateDistanceKm, formatDistanceKm } from '@/lib/distance';
import { createNotification } from '@/lib/notification';

async function notifyAdmin(emergencyId: string, message: string) {
  const admin = await prisma.admin.findFirst();
  if (!admin) return;

  await createNotification({
    type: 'MATCHING_REVIEW_REQUIRED',
    message,
    adminId: admin.id,
    emergencyId,
  });
}

export async function matchEmergencyToTeam(emergencyId: string) {
  const emergency = await prisma.emergency.findUnique({
    where: { id: emergencyId },
    include: { user: true },
  });

  if (!emergency) return null;

  const relevantResources = await prisma.resource.findMany({
    where: {
      status: 'AVAILABLE',
      availableQuantity: { gt: 0 },
    },
  });

  const availableTeams = await prisma.rescueTeam.findMany({
    where: { availabilityStatus: 'AVAILABLE' },
  });

  const teamPayload = availableTeams.map((team) => ({
    id: team.id,
    name: team.name,
    latitude: team.latitude,
    longitude: team.longitude,
    capabilities: team.capabilities,
    equipment: team.availableEquipment,
    availabilityStatus: team.availabilityStatus,
    distanceKm: formatDistanceKm(
      calculateDistanceKm(emergency.latitude, emergency.longitude, team.latitude, team.longitude),
    ),
  }));

  const payload = {
    emergency: {
      id: emergency.id,
      type: emergency.emergencyType,
      locationLabel: emergency.locationLabel,
      latitude: emergency.latitude,
      longitude: emergency.longitude,
      description: emergency.description,
      timestamp: emergency.timestamp,
    },
    user: emergency.user
      ? {
          id: emergency.user.id,
          name: emergency.user.name,
          email: emergency.user.email,
        }
      : null,
    availableResources: relevantResources,
    availableTeams: teamPayload,
  };

  const recommendation = await getGeminiRecommendation(payload);

  const selectedTeamWasProvided = availableTeams.some(
    (team) => team.id === recommendation.recommendedTeamId,
  );

  if (!recommendation.recommendedTeamId || !selectedTeamWasProvided) {
    const reviewMessage = recommendation.recommendedTeamId
      ? 'Gemini selected a team that was not in the validated available-team list. Admin review required.'
      : recommendation.reason;
    await prisma.emergency.update({
      where: { id: emergencyId },
      data: { status: 'ANALYZING', priority: 'HIGH' },
    });
    await createNotification({
      type: 'MATCHING_REVIEW_REQUIRED',
      message: reviewMessage,
      userId: emergency.userId ?? undefined,
      emergencyId,
    });
    await notifyAdmin(emergencyId, reviewMessage);
    return { recommendation: { ...recommendation, recommendedTeamId: null, reason: reviewMessage }, assignment: null };
  }

  const candidateTeam = await prisma.rescueTeam.findUnique({
    where: { id: recommendation.recommendedTeamId },
  });

  if (!candidateTeam || candidateTeam.availabilityStatus !== 'AVAILABLE') {
    const reviewMessage = 'The recommended team is no longer available. Admin review required.';
    await prisma.emergency.update({
      where: { id: emergencyId },
      data: { status: 'ANALYZING', priority: 'HIGH' },
    });
    await createNotification({
      type: 'MATCHING_REVIEW_REQUIRED',
      message: reviewMessage,
      userId: emergency.userId ?? undefined,
      emergencyId,
    });
    await notifyAdmin(emergencyId, reviewMessage);
    return { recommendation: { ...recommendation, recommendedTeamId: null, reason: reviewMessage }, assignment: null };
  }

  const verifiedResources = relevantResources.filter((resource) =>
    recommendation.recommendedResources.includes(resource.resourceId),
  );

  const assignment = await prisma.rescueAssignment.create({
    data: {
      emergencyId: emergency.id,
      teamId: candidateTeam.id,
      status: 'PENDING',
      reason: recommendation.reason,
    },
  });

  await prisma.emergency.update({
    where: { id: emergencyId },
    data: {
      assignedTeamId: candidateTeam.id,
      status: 'TEAM_ASSIGNED',
      priority: recommendation.emergencyPriority === 'CRITICAL' ? 'CRITICAL' : recommendation.emergencyPriority === 'HIGH' ? 'HIGH' : 'MEDIUM',
    },
  });

  await prisma.rescueTeam.update({
    where: { id: candidateTeam.id },
    data: { availabilityStatus: 'BUSY' },
  });

  for (const resource of verifiedResources) {
    await prisma.resourceAssignment.create({
      data: { resourceId: resource.id, emergencyId, quantity: 1 },
    });
    await prisma.resource.update({
      where: { id: resource.id },
      data: {
        availableQuantity: { decrement: 1 },
        status: resource.availableQuantity <= 1 ? 'IN_USE' : 'AVAILABLE',
      },
    });
  }

  const teamMessage = recommendation.rescueTeamMessage;
  const userMessage = `${recommendation.userMessage} Assigned to ${candidateTeam.name}; estimated distance ${recommendation.estimatedDistance}.`;

  await createNotification({
    type: 'GEMINI_TEAM_ASSIGNMENT',
    message: teamMessage,
    teamId: candidateTeam.id,
    emergencyId,
  });
  await createNotification({
    type: 'GEMINI_USER_UPDATE',
    message: userMessage,
    userId: emergency.userId ?? undefined,
    emergencyId,
  });
  await notifyAdmin(emergencyId, `Gemini recommended ${candidateTeam.name}: ${recommendation.reason}`);

  const updatedEmergency = await prisma.emergency.findUnique({
    where: { id: emergencyId },
    include: { assignedTeam: true },
  });

  return { recommendation, assignment, emergency: updatedEmergency };
}
