/**
 * Geo utilities. SQLite has no native geospatial index (unlike PostGIS), so we
 * use a two-phase search: a cheap bounding-box pre-filter in SQL (indexed on
 * lat/lng), then exact Haversine distance in JS on the reduced candidate set.
 * This is the documented, deliberate substitute for PostGIS ST_DWithin in the
 * SDD (see Section 6.4) — swap this module for PostGIS queries at scale.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Returns a bounding box {minLat, maxLat, minLng, maxLng} that fully contains
 * a circle of `radiusKm` around (lat, lng). Used as a fast SQL pre-filter.
 */
function boundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32; // ~km per degree latitude
  const lngDelta = radiusKm / (111.32 * Math.cos(toRad(lat)) || 1);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

module.exports = { haversineKm, boundingBox };
