// Haversine formula calculation for distance between coordinates in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateTotalTrailDistance(places: { latitude: number; longitude: number }[]): number {
  if (!places || places.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < places.length - 1; i++) {
    total += calculateDistanceKm(
      places[i].latitude,
      places[i].longitude,
      places[i + 1].latitude,
      places[i + 1].longitude
    );
  }
  return total;
}
