/**
 * Navigation utility for generating validated map deep links.
 *
 * Supported platforms:
 * 1. Google Maps (https://www.google.com/maps/dir/?api=1&destination=...)
 * 2. Apple Maps (https://maps.apple.com/?daddr=...&dirflg=d)
 * 3. Waze (https://www.waze.com/ul?ll=...&navigate=yes or https://www.waze.com/ul?q=...&navigate=yes)
 *
 * Rules:
 * - Uses exact numeric latitude & longitude if present and valid.
 * - Otherwise falls back to encoded facility name & address.
 * - Returns null if no valid destination (coordinates or address) can be determined.
 * - Requires no external API keys.
 *
 * @param {Object} location - Booking or facility object
 * @returns {Object|null}
 */
export function getNavigationLinks(location) {
  if (!location) return null;

  const rawLat = location.latitude ?? location.lat;
  const rawLng = location.longitude ?? location.lng;

  const lat = rawLat !== undefined && rawLat !== null && !isNaN(Number(rawLat))
    ? Number(rawLat)
    : null;
  const lng = rawLng !== undefined && rawLng !== null && !isNaN(Number(rawLng))
    ? Number(rawLng)
    : null;

  // Verify coordinates are realistic numbers (not null and not exactly 0,0)
  const hasCoordinates = lat !== null && lng !== null && (lat !== 0 || lng !== 0);

  // Address fallback
  const addressParts = [
    location.location_name || location.name,
    location.location_address || location.address,
    location.city
  ].filter(Boolean);

  const destinationAddress = addressParts.join(', ').trim();

  // If neither valid coordinates nor valid address text exists, return null
  if (!hasCoordinates && !destinationAddress) {
    return null;
  }

  let googleMapsUrl = '';
  let appleMapsUrl = '';
  let wazeUrl = '';

  if (hasCoordinates) {
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    wazeUrl = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  } else {
    const encodedDest = encodeURIComponent(destinationAddress);
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}`;
    appleMapsUrl = `https://maps.apple.com/?daddr=${encodedDest}&dirflg=d`;
    wazeUrl = `https://www.waze.com/ul?q=${encodedDest}&navigate=yes`;
  }

  return {
    hasCoordinates,
    latitude: lat,
    longitude: lng,
    destinationDisplay: destinationAddress,
    googleMapsUrl,
    appleMapsUrl,
    wazeUrl
  };
}
