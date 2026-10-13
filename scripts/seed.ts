import { prisma } from '@/lib/prisma';
import { tamilNaduLocations } from '@/lib/tamil-nadu-locations';
import type { RescueTeam } from '@prisma/client';
import bcrypt from 'bcryptjs';

const emergencyTypes = ['FLOOD', 'EARTHQUAKE', 'LANDSLIDE', 'FIRE', 'ACCIDENT', 'CYCLONE', 'BUILDING_COLLAPSE', 'MEDICAL_EMERGENCY', 'OTHER'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const emergencyStatuses = ['NEW', 'ANALYZING', 'TEAM_ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const;
const resourceCatalog = [
  { name: 'Rescue Boat', category: 'Water Rescue' },
  { name: 'Life Jackets', category: 'Water Safety' },
  { name: 'First Aid Kits', category: 'Medical' },
  { name: 'Ambulance', category: 'Medical' },
  { name: 'Rescue Drone', category: 'Aerial Support' },
  { name: 'Rescue Rope', category: 'Structural Rescue' },
  { name: 'Fire Extinguisher', category: 'Fire Response' },
  { name: 'Emergency Vehicle', category: 'Transport' },
  { name: 'Communication Radio', category: 'Communications' },
] as const;
const teamBases = ['Chennai', 'Tambaram', 'Avadi', 'Vellore', 'Cuddalore', 'Salem', 'Erode', 'Coimbatore', 'Ooty', 'Tiruchirappalli', 'Thanjavur', 'Madurai', 'Ramanathapuram', 'Tirunelveli', 'Nagercoil'] as const;
const responseDescriptions = [
  'Residents need assistance after heavy rain and rising water.',
  'Local responders requested support and evacuation assistance.',
  'Road access is limited; coordinate a safe response.',
  'Multiple residents reported an urgent incident in this area.',
  'Emergency services requested additional rescue resources.',
  'Possible hazard reported by a nearby resident; verify on arrival.',
  'The caller reports immediate assistance is required.',
] as const;

function locationFor(index: number) {
  const place = tamilNaduLocations[index % tamilNaduLocations.length];
  return {
    ...place,
    latitude: Number((place.latitude + ((((index * 17) % 101) - 50) / 1400)).toFixed(6)),
    longitude: Number((place.longitude + ((((index * 29) % 101) - 50) / 1400)).toFixed(6)),
  };
}

function statusFor(index: number) {
  const slot = index % 100;
  if (slot < 40) return emergencyStatuses[4];
  if (slot < 57) return emergencyStatuses[3];
  if (slot < 74) return emergencyStatuses[2];
  if (slot < 91) return emergencyStatuses[1];
  if (slot < 98) return emergencyStatuses[0];
  return emergencyStatuses[5];
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.resourceAssignment.deleteMany();
  await prisma.rescueAssignment.deleteMany();
  await prisma.emergency.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.rescueTeamAccount.deleteMany();
  await prisma.rescueTeam.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();

  const userPasswordHash = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: {
      id: 'DEMO-USER-001',
      name: 'Aisha Kumar',
      email: 'user@example.com',
      passwordHash: userPasswordHash,
      role: 'USER',
    },
  });
  await prisma.user.createMany({
    data: Array.from({ length: 35 }, (_, index) => ({
      id: `DEMO-USER-${String(index + 2).padStart(3, '0')}`,
      name: `Tamil Nadu Resident ${String(index + 2).padStart(2, '0')}`,
      email: `resident${String(index + 2).padStart(2, '0')}@example.com`,
      passwordHash: userPasswordHash,
      role: 'USER' as const,
    })),
  });

  await prisma.admin.create({
    data: {
      id: 'DEMO-ADMIN-001',
      name: 'Tamil Nadu Control Room',
      email: 'admin@rescue.com',
      passwordHash: await bcrypt.hash('admin123', 10),
    },
  });

  const teamPasswordHash = await bcrypt.hash('team123', 10);
  const teams: RescueTeam[] = [];
  for (let index = 0; index < teamBases.length; index += 1) {
    const base = teamBases[index];
    const place = tamilNaduLocations.find((item) => item.city === base) ?? tamilNaduLocations[index];
    const team = await prisma.rescueTeam.create({
      data: {
        teamCode: `TN-TEAM-${String(index + 1).padStart(3, '0')}`,
        name: `Tamil Nadu Rescue Team ${String(index + 1).padStart(2, '0')} · ${base}`,
        membersCount: 6 + (index % 7),
        latitude: place.latitude,
        longitude: place.longitude,
        baseLocation: `${base}, Tamil Nadu`,
        availabilityStatus: index < 7 ? 'AVAILABLE' : index < 11 ? 'BUSY' : 'OFFLINE',
        contactInfo: `+91 9${String(810000000 + index * 17391).slice(0, 9)}`,
        capabilities: index % 2 === 0
          ? 'Flood rescue, boat rescue, evacuation, and first aid'
          : 'Medical response, fire support, landslide rescue, and evacuation',
        availableEquipment: 'Rescue Boat, Life Jackets, First Aid Kit, Drone, Radio',
        currentAssignment: index >= 7 && index < 11 ? 'Active regional response' : 'On standby',
      },
    });
    teams.push(team);
    await prisma.rescueTeamAccount.create({
      data: {
        email: index === 0 ? 'team-a@rescue.com' : `team-${String(index + 1).padStart(2, '0')}@rescue.com`,
        passwordHash: teamPasswordHash,
        teamId: team.id,
      },
    });
  }

  const baseResources = [
    { resourceId: 'RES-101', name: 'Rescue Boats', category: 'Water Rescue', quantity: 6, availableQuantity: 3, latitude: 13.0827, longitude: 80.2707, status: 'AVAILABLE' as const, description: 'Flood response boats' },
    { resourceId: 'RES-102', name: 'Life Jackets', category: 'Water Safety', quantity: 25, availableQuantity: 18, latitude: 13.0827, longitude: 80.2707, status: 'AVAILABLE' as const, description: 'Life safety equipment' },
    { resourceId: 'RES-103', name: 'Drones', category: 'Aerial Support', quantity: 8, availableQuantity: 5, latitude: 13.115, longitude: 80.0967, status: 'AVAILABLE' as const, description: 'Disaster scouting' },
    { resourceId: 'RES-104', name: 'First Aid Kits', category: 'Medical', quantity: 20, availableQuantity: 12, latitude: 12.925, longitude: 80.1167, status: 'IN_USE' as const, description: 'Medical kits' },
    { resourceId: 'RES-105', name: 'Ambulances', category: 'Medical', quantity: 5, availableQuantity: 2, latitude: 12.925, longitude: 80.1167, status: 'AVAILABLE' as const, description: 'Ambulance service' },
  ];
  const extraResources = Array.from({ length: 115 }, (_, index) => {
    const place = locationFor(index * 3 + 11);
    const kind = resourceCatalog[index % resourceCatalog.length];
    const quantity = 4 + ((index * 7) % 35);
    const status = index % 17 === 0 ? 'MAINTENANCE' as const : index % 11 === 0 ? 'IN_USE' as const : index % 23 === 0 ? 'UNAVAILABLE' as const : 'AVAILABLE' as const;
    return {
      resourceId: `TN-RES-${String(index + 6).padStart(4, '0')}`,
      name: `${kind.name} · ${place.city} ${String(index + 1).padStart(3, '0')}`,
      category: kind.category,
      quantity,
      availableQuantity: status === 'AVAILABLE' ? Math.max(1, quantity - (index % 4)) : 0,
      latitude: place.latitude,
      longitude: place.longitude,
      status,
      description: `${kind.name} at the ${place.city} response depot, ${place.district} district, Tamil Nadu.`,
    };
  });
  await prisma.resource.createMany({ data: [...baseResources, ...extraResources] });

  const emergencyRows = Array.from({ length: 650 }, (_, index) => {
    const place = locationFor(index * 5 + 3);
    const status = statusFor(index);
    const assignedTeam = ['TEAM_ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED'].includes(status)
      ? teams[(index * 7) % teams.length]
      : null;
    const createdAt = new Date(Date.now() - ((index * 7919) % (120 * 24 * 60 * 60 * 1000)));
    return {
      id: `TN-EMG-${String(index + 1).padStart(4, '0')}`,
      userId: `DEMO-USER-${String((index % 36) + 1).padStart(3, '0')}`,
      emergencyType: emergencyTypes[(index * 5 + Math.floor(index / 7)) % emergencyTypes.length],
      locationLabel: `${place.city}, ${place.district} district, Tamil Nadu`,
      latitude: place.latitude,
      longitude: place.longitude,
      description: responseDescriptions[index % responseDescriptions.length],
      status,
      priority: priorities[(index * 3 + Math.floor(index / 5)) % priorities.length],
      assignedTeamId: assignedTeam?.id ?? null,
      timestamp: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await prisma.emergency.createMany({ data: emergencyRows });

  const assignmentRows = emergencyRows.flatMap((emergency, index) => {
    if (!emergency.assignedTeamId) return [];
    const status = emergency.status === 'RESOLVED'
      ? 'COMPLETED' as const
      : emergency.status === 'RESCUE_IN_PROGRESS'
        ? 'IN_PROGRESS' as const
        : 'PENDING' as const;
    return [{
      id: `TN-ASG-${String(index + 1).padStart(4, '0')}`,
      emergencyId: emergency.id,
      teamId: emergency.assignedTeamId,
      status,
      reason: 'Demo dispatch record for Tamil Nadu district coverage.',
      assignedAt: emergency.createdAt,
      acceptedAt: status === 'PENDING' ? null : emergency.createdAt,
      completedAt: status === 'COMPLETED' ? emergency.createdAt : null,
      createdAt: emergency.createdAt,
      updatedAt: emergency.createdAt,
    }];
  });
  await prisma.rescueAssignment.createMany({ data: assignmentRows });

  await prisma.notification.createMany({
    data: emergencyRows.slice(0, 100).map((emergency, index) => ({
      id: `TN-NOTIF-${String(index + 1).padStart(4, '0')}`,
      type: emergency.assignedTeamId ? 'DEMO_TEAM_DISPATCH' : 'DEMO_EMERGENCY_ALERT',
      message: emergency.assignedTeamId
        ? `${emergency.emergencyType.replaceAll('_', ' ')} response in ${emergency.locationLabel}; demo team dispatched.`
        : `${emergency.emergencyType.replaceAll('_', ' ')} in ${emergency.locationLabel}; awaiting coordination.`,
      adminId: 'DEMO-ADMIN-001',
      emergencyId: emergency.id,
      isRead: false,
      createdAt: emergency.createdAt,
    })),
  });

  console.log(`Seed complete: ${emergencyRows.length} emergencies across Tamil Nadu, 36 users, ${teams.length} teams, ${baseResources.length + extraResources.length} resources, ${assignmentRows.length} assignments.`);
  console.log('Demo logins: user@example.com / password123; admin@rescue.com / admin123; team-a@rescue.com / team123.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
