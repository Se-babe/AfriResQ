const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { haversineKm, boundingBox } = require('./geo');

// Which responder skills are relevant to each emergency category.
// A responder with ANY listed skill is considered eligible; exact/primary
// matches score higher (see weighting below).
const CATEGORY_SKILLS = {
  medical: ['medical', 'first_aid', 'nurse', 'paramedic'],
  road_accident: ['medical', 'first_aid', 'traffic', 'fire', 'paramedic'],
  fire: ['fire', 'rescue'],
  security: ['security', 'police'],
  missing_person: ['search_rescue', 'community_volunteer', 'police'],
  disaster: ['rescue', 'medical', 'fire', 'community_volunteer'],
  other: ['community_volunteer', 'first_aid'],
};

const SEARCH_RADII_KM = [3, 8, 20, 50]; // progressive widening, low-resource friendly
const MAX_CANDIDATES = 5;

// Scoring weights: distance dominates (closer = faster response), skill
// relevance and availability quality provide meaningful tie-breaks.
const WEIGHTS = { distance: 0.5, skill: 0.3, rating: 0.15, load: 0.05 };

function skillScoreFor(category, skills) {
  const relevant = CATEGORY_SKILLS[category] || CATEGORY_SKILLS.other;
  const primary = relevant[0];
  if (skills.includes(primary)) return 1.0;
  if (skills.some((s) => relevant.includes(s))) return 0.6;
  return 0.2; // generalist / community volunteer fallback
}

function distanceScore(distanceKm, radiusKm) {
  // linear falloff: 1.0 at 0km, 0 at radius edge
  return Math.max(0, 1 - distanceKm / radiusKm);
}

/**
 * Finds and ranks eligible responders for an emergency, using progressively
 * wider search radii until enough candidates are found (or radii exhausted).
 * This bounding-box + Haversine approach stands in for a PostGIS KNN query
 * (see geo.js header comment and SDD Section 6.4).
 */
function findCandidates(emergency) {
  const relevantSkills = CATEGORY_SKILLS[emergency.category] || CATEGORY_SKILLS.other;

  for (const radiusKm of SEARCH_RADII_KM) {
    const { minLat, maxLat, minLng, maxLng } = boundingBox(emergency.lat, emergency.lng, radiusKm);

    const rows = db
      .prepare(
        `SELECT rp.*, u.name, u.phone, u.is_active
         FROM responder_profiles rp
         JOIN users u ON u.id = rp.user_id
         WHERE rp.verification_status = 'verified'
           AND rp.availability_status = 'available'
           AND u.is_active = 1
           AND rp.current_lat BETWEEN ? AND ?
           AND rp.current_lng BETWEEN ? AND ?`
      )
      .all(minLat, maxLat, minLng, maxLng);

    const scored = rows
      .map((r) => {
        const skills = JSON.parse(r.skills || '[]');
        const distanceKm = haversineKm(emergency.lat, emergency.lng, r.current_lat, r.current_lng);
        if (distanceKm > radiusKm) return null; // bbox is a rectangle; enforce the circle
        if (!skills.some((s) => relevantSkills.includes(s)) && skills.length > 0 === false) {
          // no skills recorded at all -> treat as generalist, still eligible
        }
        const skillScore = skillScoreFor(emergency.category, skills);
        const ratingScore = r.rating_count > 0 ? r.rating_avg / 5 : 0.5; // neutral prior
        const loadScore = r.active_case_count === 0 ? 1 : Math.max(0, 1 - r.active_case_count * 0.3);
        const distScore = distanceScore(distanceKm, radiusKm);

        const totalScore =
          WEIGHTS.distance * distScore +
          WEIGHTS.skill * skillScore +
          WEIGHTS.rating * ratingScore +
          WEIGHTS.load * loadScore;

        return {
          responderId: r.user_id,
          name: r.name,
          phone: r.phone,
          distanceKm: Number(distanceKm.toFixed(2)),
          skillScore,
          totalScore: Number(totalScore.toFixed(4)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalScore - a.totalScore);

    if (scored.length > 0) {
      return { candidates: scored.slice(0, MAX_CANDIDATES), radiusKm };
    }
  }

  return { candidates: [], radiusKm: SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1] };
}

/**
 * Runs matching for an emergency and persists ranked `matches` rows.
 * Does not itself notify — see notification.js — keeping "who is eligible"
 * separate from "how we reach them" (SRS FR-3.5 / FR-3.6).
 */
function runMatching(emergency) {
  const { candidates, radiusKm } = findCandidates(emergency);

  const insert = db.prepare(
    `INSERT INTO matches (id, emergency_id, responder_id, distance_km, skill_score, total_score, rank, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed')`
  );

  const tx = db.transaction((cands) => {
    cands.forEach((c, i) => {
      insert.run(uuidv4(), emergency.id, c.responderId, c.distanceKm, c.skillScore, c.totalScore, i + 1);
    });
  });
  tx(candidates);

  return { candidates, searchRadiusKm: radiusKm };
}

module.exports = { runMatching, findCandidates, CATEGORY_SKILLS };
