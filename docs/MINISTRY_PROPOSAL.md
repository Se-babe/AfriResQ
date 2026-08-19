# AfriResQ Uganda

## A Proposal for National Digital Emergency Coordination Infrastructure

**Prepared for:** Ministry of ICT and National Guidance, Republic of Uganda
**Prepared by:** [Your name / organisation]
**Date:** [Submission date]
**Contact:** [Phone] · emudukoben585@gmail.com

---

## 1. Executive Summary

When someone in Uganda faces a medical emergency, a fire, or an accident, help is often only as fast as the right phone number, remembered correctly, answered in time, by someone who happens to be free and nearby. There is no single system today that connects a person in distress to the closest available, verified responder — police, ambulance, a nearby clinic, a trained volunteer, or a Red Cross team — automatically and in real time.

**AfriResQ** is a working digital coordination platform that closes this gap. A citizen reports an emergency in a few taps — by app or web, with GPS or a landmark. The system classifies its severity, searches outward from 3 km to 50 km for the nearest verified, available responder with the right skills, and notifies them immediately. Coordinators get a live dashboard of every active case, response times, and coverage gaps.

We are proposing that the **Ministry of ICT and National Guidance** adopt, fund, and govern AfriResQ as a piece of national digital public infrastructure — the way roads or the electricity grid are public infrastructure. **Citizens, community responders, health facilities, NGOs, and local governments would use it entirely free of charge**, with the government as the sole paying customer, funding hosting, operations, and national rollout.

This is not a concept pitch. AfriResQ is built, tested, and running today as a self-funded pilot centered on Kampala. This document describes what exists, what a national partnership would look like, and what we are asking of the Ministry.

---

## 2. The Problem

- **Fragmentation.** Emergency contacts, responders, health facilities, and community volunteers exist, but are scattered across personal phone contacts, informal WhatsApp groups, and organisational silos. Nobody has one place to see who is nearby and available right now.
- **Delay and information loss.** Phone calls and word-of-mouth are slow and lossy — the wrong number, a call that isn't answered, a location that's hard to describe over the phone.
- **No shared picture.** District officials and health authorities have no live view of where emergencies are happening, how long responders take to arrive, or where coverage is weakest.
- **Connectivity and cost barriers.** Any solution for Uganda has to work on a basic smartphone, on an intermittent connection, without assuming everyone has a data plan or a bank card.

## 3. The Solution: AfriResQ

AfriResQ is a location-aware coordination layer that sits **alongside** — not instead of — Uganda Police, fire services, ambulances, and hospitals. It routes community reports to the nearest suitable help and gives official responders and coordinators a live operating picture.

**The pipeline: Report → Classify → Match → Notify → Resolve**

1. **Report.** A citizen submits an emergency in three steps: category, optional description, location. GPS is used when available; a landmark works when it isn't. Anonymous reports need only a phone number. Reports made while offline are queued on the device and sent automatically once connectivity returns.
2. **Classify.** A deterministic, auditable rule engine assigns a severity (critical/high/moderate/low) and a 0–100 priority score with explainable reasons — not a black box.
3. **Match.** The system searches for verified, available responders in widening radii — 3 km, then 8 km, 20 km, and 50 km — ranked by distance, skill match, rating, and current caseload.
4. **Notify.** Matched responders are alerted in real time (in-app, web push, and SMS for high-severity cases). The first to accept owns the case until resolution.
5. **Resolve & audit.** Every status change — notified, accepted, in progress, resolved — is logged, giving coordinators and district health/security officials a full, auditable trail and the data to measure response times and coverage gaps.

## 4. Current Status: This Already Works

AfriResQ is not a prototype on paper — it is a running system today:

- A **Node.js API** with a tested classification, matching, and coordination engine (automated test suite covering registration, authentication, the full report-to-resolve pipeline, and responder verification).
- A **React web application** for citizens, responders, and coordinators, deployable as an installable Progressive Web App.
- A **native Android app** (Flutter), already built, signed, and installable, so field responders and citizens without reliable browser access have a first-class experience.
- Live in a **Kampala-based pilot deployment**, ready for a live demonstration at any time.
- **Security groundwork already in place**: hashed credentials (no plaintext passwords, ever), short-lived access tokens with rotating refresh tokens, brute-force lockout on login, rate limiting on public endpoints, and role-based access control so only verified, authorised users see coordination data.

We can walk the Ministry through a live end-to-end case — citizen reports, responder accepts, coordinator dashboard updates in real time — in a single meeting.

## 5. Proposed National Operating Model

| Party | Role |
|---|---|
| **Ministry of ICT and National Guidance** | Proposed contracting authority. Funds national hosting, operations, and rollout. Governs data policy and platform priorities. |
| **Citizens** | Report emergencies and track their case — free, no subscription, no fee. |
| **Responders, health facilities, NGOs (e.g. Uganda Red Cross), local governments** | Use matching, alerts, and dashboards — free of charge. |
| **Uganda Police, fire brigade, ambulance services, hospitals** | Remain the official responders. AfriResQ routes and surfaces community reports to them faster; it does not replace their mandate or authority. |

This mirrors how public infrastructure works elsewhere: the state funds it once at the centre; every citizen and frontline organisation benefits without individually paying.

## 6. Why This Matters for Government

- **One national coordination layer** instead of fragmented, informal, ad hoc systems across districts and organisations.
- **Evidence, not guesswork.** Response-time analytics and coverage-gap data support the Ministry of ICT, Ministry of Health, Office of the Prime Minister (disaster response), and local governments in planning resource placement.
- **Built for Uganda's real conditions**: phone-number-first identity (no email required), GPS with landmark fallback, and a design that keeps working when connectivity is poor.
- **Local and homegrown.** Designed and built for Uganda's context from the ground up, not adapted from a foreign system.
- **Fast to pilot, low risk.** The system already runs. A district-level government pilot can start from existing, tested software rather than a multi-year build.

## 7. Rollout Plan

- **Phase 1 — Government-backed district pilot.** Formal pilot in Kampala (or a district of the Ministry's choosing), with real responders (police, ambulance, Red Cross, health facilities) onboarded and verified, running alongside existing emergency channels. Target: validate response times and matching accuracy under real government oversight.
- **Phase 2 — Regional expansion.** Extend to additional districts, add SMS/USSD reporting for citizens without smartphones (the system's data model already supports this without backend redesign), and integrate with district health and security structures.
- **Phase 3 — National scale.** Full national coverage, with the Ministry as permanent operator/funder, potential integration points with national emergency dispatch and health information systems, and ongoing investment in reliability (persistent, redundant hosting; formal SLAs; 24/7 operations).

## 8. What We Are Asking For

1. **A meeting to demonstrate the live system** to the Ministry of ICT and relevant stakeholders (Ministry of Health, Office of the Prime Minister, Uganda Police, Uganda Red Cross).
2. **Sponsorship of a formal government-backed pilot** in one district, including funding for reliable, persistent hosting infrastructure (the current pilot runs on free-tier infrastructure, sufficient for a demo but not for real deployments where losing data is unacceptable).
3. **Introductions to responder organisations** (Uganda Police, ambulance services, Uganda Red Cross, district health facilities) to onboard the first cohort of verified responders for a supervised pilot.
4. **A named point of contact** within the Ministry to define data governance, hosting requirements (including any data residency requirements), and success criteria for the pilot.

[Placeholder: specific budget ask / commercial terms — to be scoped jointly once pilot district and infrastructure requirements are agreed.]

## 9. About

[Placeholder: brief background on the team/organisation behind AfriResQ — who built it, relevant experience, and why.]

**Contact:** [Name] · [Phone] · emudukoben585@gmail.com

---

*AfriResQ does not replace Uganda Police, fire services, ambulances, or hospitals. It is a coordination layer that helps citizens reach them, and helps them reach citizens, faster.*
