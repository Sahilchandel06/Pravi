# InfraLife: Assumptions

This is a hackathon prototype built in a few hours. The choices below were made to keep one workflow (BR-102) complete and believable. None of them are official standards. Each one says what we assumed, why, and what a real rollout would do instead.

---

## 1. Data

| Assumption | Why | In a real rollout |
|---|---|---|
| All data is sample data around the Ahmedabad to Vadodara corridor (NH-48, shown as NH-XX). | We have no access to live government records. | Import the department's asset register and inspection history. |
| About 15 assets (35 in the extended seed): one highway, three road segments, three bridges with five components each, one culvert, one tunnel. | Enough to show hierarchy, dependencies and priorities without hours of data entry. | Thousands of assets loaded from existing spreadsheets. |
| BR-102 is the hero asset. Its scores, age (built 2018), traffic and history are set by hand to tell the demo story. | A single story is clearer than many half-finished ones. | Values come from real inspections. |
| Maintenance costs for BR-102 are Rs 4.2L (2023), 5.1L (2024), 7.8L (2025), 10.3L (2026). Stored in rupees, shown in lakh. | Shows a rising-cost trend that triggers a review. | Costs come from the department's work-order and finance systems. |
| Coordinates are approximate and placed along the corridor. | Good enough for the map. | Surveyed GIS data. |

## 2. Condition scoring

- Each component has a score from 0 to 100. The overall score is the weighted sum of component scores.
- Bridge weights: Deck 30%, Bearings 20%, Expansion joint 25%, Drainage 15%, Guardrails 10%. These are our choice, stored in the database, not in code.
- If a component is missing, the remaining weights are rescaled so they add up to 100%.
- An inspector's rating becomes a number: Good 85, Moderate 65, Poor 40, Critical 20.
- Rating bands for a score: 80 and above Good, 60 to 79 Moderate, 40 to 59 Poor, below 40 Critical.
- Asset status is derived: Critical if condition is below 50 or risk is Critical; Attention if condition is below 70 or risk is High or Medium; Under maintenance while a repair is in progress; otherwise Healthy.

Real bridge assessment uses more detailed engineering methods (for example element-level inspection standards). Our scoring is a simple stand-in and would be aligned with the department's standards.

### Numbers to verify before the demo
The solution document says BR-102's component scores give "about 64". Checked by hand, they give **66.4**:

`82 x 0.30 + 61 x 0.20 + 43 x 0.25 + 67 x 0.15 + 88 x 0.10 = 66.4`

Likewise, rating the expansion joint Poor (43 to 40) moves the total by less than 1 point, not 3. Before presenting, either adjust the seed scores so the arithmetic really gives 64 and 61, or quote the numbers the system actually shows. Anyone on the panel can check this arithmetic, so the numbers on screen must match.

## 3. Risk and priority

- Seven factors, each scaled 0 to 100, combined with these weights: condition 28%, criticality 20%, traffic 17%, age against expected life 10%, dependency impact 10%, failure history 8%, inspection status 7%.
- Levels: below 35 Low, 35 to 59 Medium, 60 to 79 High, 80 and above Critical.
- Condition risk is `100 - condition score`. Failure history is `min(failures x 25, 100)`. Age is age divided by expected life, capped at 100.
- Criticality and traffic importance are set by hand per asset (0 to 100).
- Weights and thresholds are sensible starting values. They are not calibrated against real failures.
- Recommended action (Monitor, Repair, Rehabilitate, Replace review) comes from condition, age against life and the maintenance cost trend.

## 4. Dependency graph

- Relationship types: CONTAINS, DEPENDS_ON, DRAINS_TO, CONNECTS_TO. Each has a weight from 0 to 1, chosen by us (for example culvert drains to segment 0.6, bridge depends on drainage 0.7).
- Impact spreads outward with `impact(child) = impact(parent) x edge weight x 0.8`. The 0.8 decay per step is an assumption, not an engineering model.
- Failure simulation scales the same result by a failure level and saves nothing.
- Cycles are rejected for CONTAINS and DEPENDS_ON. Only relationships allowed for the asset types are accepted.
- The graph models physical and functional links only. It does not model traffic rerouting or detours.

## 5. Maintenance workflow

- Flow: request, manager approval, work order, in progress, completed (needs evidence), closed.
- Work order numbers start at 1042 so the demo order is #1042. This is a seeded counter.
- Estimated cost, due date and assigned team on a new order are simple defaults from priority. A manager would edit them.
- Completion evidence is a URL string. Real file upload is planned, not built.

## 6. Users and access

- Four roles: Administrator, Infrastructure Manager, Field Inspector, Maintenance Team.
- Demo accounts share one password and exist only in seed data. They are not for production.
- Login is email and password with a JWT. No single sign-on and no integration with government identity systems.
- Every change writes an audit record (who, before, after, when).

## 7. AI assistant

- Uses Google Gemini with function calling. It calls our own functions and answers only from what they return. If data is missing, it says so.
- It gives information, not safety decisions. Nothing it says counts as a structural engineering judgement.
- Answer quality depends on the model and the API key being available. A fallback message appears if the call fails.
- Image defect detection is not in this build. If added, every suggestion needs an engineer's confirmation.

## 8. Technical

- One MongoDB database (Atlas), including geospatial queries and `$graphLookup` for graph traversal, instead of a separate graph database. Chosen for time, not because it is the best graph engine.
- One Express backend, not microservices.
- Single tenant: one department, one database.
- Inspection photos are optional URL strings for now.
- No offline mode. Inspectors need a connection.
- Free-tier hosting (Render, Vercel, Atlas) can be slow on the first request after idle time.

## 9. Out of scope for this version

IoT sensors, blockchain, a citizen app, other sectors (water, buildings), real file storage, QR image generation, computer-vision defect detection, deterioration forecasting, and integration with existing government systems. Some of these are listed as planned add-ons in the project prompts.
