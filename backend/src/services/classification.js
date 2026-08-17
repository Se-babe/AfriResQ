/**
 * Emergency classification & prioritization engine.
 *
 * Design intent (see SRS FR-3.3 / SDD Section 7): this module implements a
 * deterministic, auditable rule-based baseline. It is written behind a single
 * exported function (`classify`) so a future ML-based classifier can be
 * swapped in without touching callers — the contract (input: raw report,
 * output: {severity, priorityScore, reasons}) stays fixed.
 */

// Base severity per category, before escalation adjustments.
const CATEGORY_BASE_SEVERITY = {
  medical: 'high',
  road_accident: 'high',
  fire: 'critical',
  security: 'high',
  missing_person: 'moderate',
  disaster: 'critical',
  other: 'low',
};

const SEVERITY_SCORE = { low: 25, moderate: 50, high: 75, critical: 100 };
const SCORE_SEVERITY = [
  [90, 'critical'],
  [65, 'high'],
  [40, 'moderate'],
  [0, 'low'],
];

// Keyword escalation lists (English; extend per-language as multilingual
// support matures — see SRS FR-3.9). Matching is intentionally simple and
// transparent so responses can be explained/audited.
const ESCALATION_KEYWORDS = [
  { pattern: /unconscious|not breathing|no pulse|cardiac|severe bleeding|stab|gunshot/i, weight: 25 },
  { pattern: /child|infant|baby|pregnan/i, weight: 12 },
  { pattern: /trapped|collapsed building|multiple (people|victims|casualties)/i, weight: 20 },
  { pattern: /spreading|explosion|smoke/i, weight: 15 },
  { pattern: /armed|weapon|threat/i, weight: 15 },
];

const DE_ESCALATION_KEYWORDS = [
  { pattern: /minor|small|already (safe|handled|resolved)/i, weight: -15 },
];

function scoreToSeverity(score) {
  for (const [threshold, label] of SCORE_SEVERITY) {
    if (score >= threshold) return label;
  }
  return 'low';
}

/**
 * @param {{category: string, description?: string}} report
 * @returns {{severity: string, priorityScore: number, reasons: string[]}}
 */
function classify(report) {
  const category = CATEGORY_BASE_SEVERITY.hasOwnProperty(report.category)
    ? report.category
    : 'other';

  const reasons = [];
  let score = SEVERITY_SCORE[CATEGORY_BASE_SEVERITY[category]];
  reasons.push(`Base severity for category "${category}": ${CATEGORY_BASE_SEVERITY[category]} (${score})`);

  const text = (report.description || '').toString();
  for (const { pattern, weight } of ESCALATION_KEYWORDS) {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(`Escalation keyword matched (+${weight}): ${pattern}`);
    }
  }
  for (const { pattern, weight } of DE_ESCALATION_KEYWORDS) {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(`De-escalation keyword matched (${weight}): ${pattern}`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const severity = scoreToSeverity(score);

  return { severity, priorityScore: score, reasons, category };
}

module.exports = { classify, CATEGORY_BASE_SEVERITY };
