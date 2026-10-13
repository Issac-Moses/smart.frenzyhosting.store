export type SafeEvacuationPlace = {
  id: string;
  name: string;
  locationType: 'OPEN_GROUND' | 'EVACUATION_SHELTER' | 'HIGH_GROUND' | 'CYCLONE_SHELTER' | 'COMMUNITY_HALL';
  latitude: number;
  longitude: number;
  elevationMeters: number;
  distanceKm: number;
  district: string;
  isSimulated: boolean;
  notes: string;
};

// Calculate Haversine distance in km
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Generates verified or realistic candidate safe locations around a given coordinate.
 * All demonstration locations are explicitly flagged with isSimulated: true
 * as per safety requirements.
 */
export function getNearbyCandidateShelters(
  emergencyType: string,
  latitude: number,
  longitude: number,
  locationLabel?: string
): SafeEvacuationPlace[] {
  const typeUpper = emergencyType.toUpperCase();

  // Create suitable candidates offset around the user's coordinates
  // Offsets correspond to approx 0.8km to 3.5km in different directions
  if (typeUpper === 'EARTHQUAKE') {
    return [
      {
        id: 'candidate-eq-1',
        name: 'District Central Sports Stadium & Grounds',
        locationType: 'OPEN_GROUND',
        latitude: latitude + 0.009,
        longitude: longitude + 0.007,
        elevationMeters: 45,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude + 0.009, longitude + 0.007),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Wide open field with zero overhead electric lines or tall collapsing walls.',
      },
      {
        id: 'candidate-eq-2',
        name: 'Municipal Public Exhibition Park',
        locationType: 'OPEN_GROUND',
        latitude: latitude - 0.012,
        longitude: longitude + 0.005,
        elevationMeters: 48,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude - 0.012, longitude + 0.005),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Unobstructed municipal recreational ground away from high-rise structures.',
      },
      {
        id: 'candidate-eq-3',
        name: 'Government Higher Secondary School Open Playground',
        locationType: 'OPEN_GROUND',
        latitude: latitude + 0.004,
        longitude: longitude - 0.011,
        elevationMeters: 42,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude + 0.004, longitude - 0.011),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Spacious level ground with clear perimeter gates and emergency access.',
      },
    ];
  }

  if (typeUpper === 'FLOOD') {
    return [
      {
        id: 'candidate-fld-1',
        name: 'Government High-Elevation Relief Camp (Community Center)',
        locationType: 'HIGH_GROUND',
        latitude: latitude + 0.014,
        longitude: longitude - 0.012,
        elevationMeters: 85,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude + 0.014, longitude - 0.012),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Elevated ridge plateau, verified well above the 100-year flood basin line with generator power.',
      },
      {
        id: 'candidate-fld-2',
        name: 'Hilltop Panchayat Multipurpose Evacuation Center',
        locationType: 'EVACUATION_SHELTER',
        latitude: latitude - 0.015,
        longitude: longitude + 0.016,
        elevationMeters: 92,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude - 0.015, longitude + 0.016),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Two-story reinforced building with potable water reserve and high ground footing.',
      },
      {
        id: 'candidate-fld-3',
        name: 'Taluk Office Flood Relief Facility',
        locationType: 'EVACUATION_SHELTER',
        latitude: latitude + 0.008,
        longitude: longitude + 0.019,
        elevationMeters: 74,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude + 0.008, longitude + 0.019),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Designated administrative disaster shelter with emergency dry rations.',
      },
    ];
  }

  if (typeUpper === 'LANDSLIDE') {
    return [
      {
        id: 'candidate-ls-1',
        name: 'Valley Base Emergency Staging Ground',
        locationType: 'COMMUNITY_HALL',
        latitude: latitude - 0.018,
        longitude: longitude - 0.015,
        elevationMeters: 38,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude - 0.018, longitude - 0.015),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Flat stable bedrock plain outside natural drainage ravines and debris run-out paths.',
      },
      {
        id: 'candidate-ls-2',
        name: 'Township Municipal Disaster Evacuation Center',
        locationType: 'EVACUATION_SHELTER',
        latitude: latitude + 0.012,
        longitude: longitude + 0.021,
        elevationMeters: 40,
        distanceKm: calculateDistanceKm(latitude, longitude, latitude + 0.012, longitude + 0.021),
        district: locationLabel || 'Local District',
        isSimulated: true,
        notes: 'Safe structural masonry building situated on stable flat geological terrain.',
      },
    ];
  }

  // CYCLONE / SEVERE STORM / OTHER / FIRE
  return [
    {
      id: 'candidate-cyc-1',
      name: 'Coastal Disaster Cyclone Resilient Shelter #1',
      locationType: 'CYCLONE_SHELTER',
      latitude: latitude - 0.008,
      longitude: longitude - 0.014,
      elevationMeters: 55,
      distanceKm: calculateDistanceKm(latitude, longitude, latitude - 0.008, longitude - 0.014),
      district: locationLabel || 'Local District',
      isSimulated: true,
      notes: 'Reinforced concrete storm shelter engineered for wind speeds > 150 km/h and high tidal surge.',
    },
    {
      id: 'candidate-cyc-2',
      name: 'Central Multi-Hazard Community Refuge',
      locationType: 'EVACUATION_SHELTER',
      latitude: latitude + 0.011,
      longitude: longitude + 0.013,
      elevationMeters: 62,
      distanceKm: calculateDistanceKm(latitude, longitude, latitude + 0.011, longitude + 0.013),
      district: locationLabel || 'Local District',
      isSimulated: true,
      notes: 'Sturdy structural masonry hall with shuttered glass and back-up solar microgrid.',
    },
  ];
}
