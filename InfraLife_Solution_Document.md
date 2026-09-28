# InfraLife

**A lifecycle platform for government roads and bridges**

Hackathon Solution Document

---

## 1. The problem we noticed

A state highway department can look after thousands of assets: roads, bridges, tunnels, culverts, and all the smaller things attached to them like bearings, expansion joints, guardrails and drains. Details about these assets rarely sit in one place. Some are in an asset register, some in inspection reports, some in spreadsheets, and a lot in photographs and old files that only one engineer knows how to find.

So when someone asks a simple question, the answer takes days to put together:

- Which bridges need attention right now?
- What is the actual condition of this bridge, and which part is failing?
- What has already been repaired, and what did it cost?
- If this bridge closes, what else is affected?
- Is it still worth repairing, or should we be planning a replacement?

An asset register tells you what the department owns. It doesn't tell you what is happening to those assets or what to do next. That gap is what we want to close.

## 2. What InfraLife does

InfraLife treats every asset as something that has a life: it is built, inspected, degrades, gets repaired, and eventually has to be rehabilitated or replaced. The platform keeps that whole story in one place and connects each stage to the next.

The flow we follow is:

**Asset → Location on map → Digital twin → Inspection → Condition score → Risk and priority → Maintenance → Lifecycle history → Repair, rehabilitate or replace**

The idea we keep coming back to is simple. Don't just tell the government what it has. Tell it what condition those assets are in, what has happened to them, what needs attention, and what should be done next.

## 3. Scope of the prototype

We are starting with government roads and everything that belongs to them.

**Main assets:** highways, road segments, bridges, tunnels, culverts.

**Supporting assets:** bridge decks, bearings, expansion joints, guardrails, drainage, road signs, streetlights.

Our demo follows a single bridge, BR-102 on NH-XX. A bridge is a good example because it has components, gets inspected, has a condition score, carries real traffic, and needs maintenance, all in one story.

We are deliberately not building IoT sensors, blockchain, a citizen app, or anything for other sectors in this version. We would rather show one complete workflow that works than many half-finished ones.

## 4. Main features

### 4.1 Map view
Every asset appears on a map (Leaflet with OpenStreetMap) coloured by status: green for healthy, yellow for needs attention, red for critical, blue for under maintenance. Clicking an asset opens a short summary with its condition, risk and status.

### 4.2 Asset inventory and profile
A searchable list of all assets that can be filtered by type, condition, risk and status. Each asset has a full profile: identity, owner, department, location, age, expected life, last and next inspection, and type-specific details. For a bridge that means length, width, lanes, load capacity and material. For a road it means surface type, lanes and traffic importance.

### 4.3 Digital asset twin
A bridge is not one row in a database. It is a deck, bearings, expansion joints, drainage and guardrails, and each of those has its own condition. InfraLife stores this hierarchy (Highway → Road Segment → Bridge → Components) so we can see exactly which part is weak and how that affects the whole.

### 4.4 Condition assessment
Each component gets a score, and the bridge's overall score is a weighted combination of them. The weights come from configuration, not code. For a bridge:

| Component | Weight |
|---|---|
| Deck | 30% |
| Bearings | 20% |
| Expansion joint | 25% |
| Drainage | 15% |
| Guardrails | 10% |

For BR-102 that gives Deck 82, Bearings 61, Expansion Joint 43, Drainage 67 and Guardrails 88, which comes to an overall score of about 64. Anyone can check the arithmetic, so nobody has to trust a hidden number.

### 4.5 Field inspection
Each asset has a QR code. An inspector scans it on site and lands on that asset's inspection form, rates each component (Good, Moderate, Poor, Critical), adds notes and photos, and submits. The system then updates the component score, recalculates the bridge condition (64 → 61 in our demo), recalculates risk, and raises a maintenance request if something is Poor or Critical.

### 4.6 Risk and priority
Condition alone is not enough. Two bridges can both score 60, but the one on a busy highway matters more. InfraLife combines these factors:

| Factor | Weight |
|---|---|
| Condition | 28% |
| Criticality | 20% |
| Traffic importance | 17% |
| Age against expected life | 10% |
| Failure history | 8% |
| Inspection status (overdue or not) | 7% |
| Dependency impact | 10% |

The result is LOW, MEDIUM, HIGH or CRITICAL, and it always comes with a plain-language explanation, for example: *"BR-102 is HIGH priority because of deteriorating condition (64/100), high criticality (91), high traffic importance (94), overdue inspection, and it affects several downstream assets."* The weights can be changed by an administrator.

### 4.7 Dependency graph
This is the part we are most excited about. Assets are not independent. A culvert drains water away from a road segment. A road segment contains a bridge. A bridge depends on its drainage. Segments connect to each other along the highway.

We store these links as a graph and use them to answer questions a normal register can't:

- **Impact analysis:** if BR-102 fails, which assets are affected, how many steps away, and how badly?
- **Failure simulation:** pick an asset, set how badly it fails, and see the knock-on effect on the network without changing any real data.
- **Single points of failure:** which assets have the most other assets depending on them?
- **Cascade risk:** how much of an asset's risk comes from what depends on it. This feeds back into the risk score.

The graph checks itself too. Relationships that would create a loop (A depends on B depends on A) are rejected, and only relationships that make sense for the asset types are allowed, for example a culvert can drain to a road segment but a streetlight cannot.

### 4.8 Maintenance workflow
Inspection findings turn into action:

Request → Manager approval → Work order → Assignment → Repair → Completion evidence → Closure

The first work order in our demo is #1042 for BR-102's expansion joint. Steps can't be skipped; a work order can't be closed without completion evidence. We also track yearly maintenance spend. BR-102 went from ₹4.2 lakh in 2023 to ₹10.3 lakh in 2026, and the system flags that rising cost as a reason to review rehabilitation or replacement.

### 4.9 Lifecycle timeline
Every asset has a timeline: construction, commissioning, inspections, repairs, assessments, and a projected future step (rehabilitation or replacement). It shows how the asset got to its current state, not only where it is now.

### 4.10 AI assistant
Managers can ask questions in plain language, such as "Which bridges need attention?", "Why is BR-102 high risk?" or "What happens if BR-102 fails?" The assistant doesn't answer from general knowledge. It looks up the answer in our own database through a fixed set of functions (asset details, risk explanation, impact analysis, work orders and so on) and explains what it found. If the data isn't there, it says so.

### 4.11 Roles and audit trail
There are four roles: Administrator, Infrastructure Manager, Field Inspector and Maintenance Team. Each sees and does only what their job needs. Every change is logged with who made it, what it was before and what it is now, so records can be traced.

## 5. Built to grow beyond roads

We built for roads first, but we did not want to hardcode roads into the system. There is no special "bridge code" or "road code" in the core. Everything that makes a bridge a bridge lives in configuration stored in the database:

- what attributes it has,
- which components it contains and how much each is worth,
- how long it should last and how often to inspect it,
- which relationships it is allowed to have.

To add water pipelines later, for instance, we would add a new asset type with its own attributes, components and relationship rules, and then load the assets. The map, inventory, condition scoring, risk engine and dependency graph would work on them without changes to the core code. This is how the same product can eventually serve buildings, water, drainage and other government infrastructure.

## 6. Technology

| Layer | Choice |
|---|---|
| Frontend | React (Vite), Tailwind CSS, React Query |
| Maps | Leaflet, OpenStreetMap |
| Graph visualisation | React Flow with automatic layout |
| Charts | Recharts |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) with GeoJSON and geospatial indexes |
| Graph queries | MongoDB `$graphLookup` |
| AI | Google Gemini with function calling |
| File storage | Cloudinary |
| Deployment | MongoDB Atlas, Render (API), Vercel (web app) |

**Why MongoDB and not a graph database?** We are working under time limits. `$graphLookup` lets us traverse relationships inside the same database we already use for everything else, and GeoJSON support covers the map needs. That means one database to set up, run and deploy instead of two.

**Why a single backend instead of microservices?** For a prototype, one Express app with clear layers (routes, controllers, services, models) is faster to build and easier to debug, and it can be split later if it ever needs to be.

## 7. How the system fits together

```
        React web app (Vercel)
                 │
                 ▼
      Express API (Render)
   ┌─────────────┼─────────────┐
   ▼             ▼             ▼
 Assets &     Inspection &   Dependency
 Condition     Maintenance     Graph
   └─────────────┼─────────────┘
                 ▼
         MongoDB Atlas
   (assets, relationships, inspections,
    risk, work orders, audit logs)
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Cloudinary        Gemini (AI)
   (photos, files)   (reads our data
                      through tools)
```

## 8. Demo walkthrough

We will follow one asset from start to finish:

1. **Dashboard.** The overall state of the network: totals, critical assets, overdue inspections, open work orders and the top priority assets.
2. **Map.** Select BR-102 from the map.
3. **Digital twin.** Open the bridge and see its five components and their scores.
4. **Inspection.** Scan the QR, mark the expansion joint as Poor and submit.
5. **Condition change.** Overall condition moves from 64 to 61.
6. **Risk.** BR-102 shows HIGH priority, with the reasons written out.
7. **Dependency graph.** Simulate the bridge failing and see which road segments and assets are hit.
8. **Maintenance.** Approve the request and generate Work Order #1042.
9. **Lifecycle.** Show the asset's history from 2018 and the projected next step.
10. **AI assistant.** Ask "Why is BR-102 high priority?" and get an answer built from the data.
11. **Scalability.** Show that asset types are configuration and explain how water or buildings could be added.

## 9. What we are not claiming

To be straightforward about the prototype:

- The data is sample data around the Ahmedabad to Vadodara corridor, not live government records.
- The AI assists with information. It doesn't decide on structural safety. Any defect suggestions from photos would need an engineer's confirmation before being recorded.
- Risk weights and thresholds are sensible starting values. A real deployment would tune them with the department's engineers and standards.
- Condition scores come from inspector ratings mapped to numbers. Real bridge assessment involves more detailed engineering methods, and we would align with those in a real rollout.

## 10. Where this could go next

- Import of existing asset registers and spreadsheets so departments don't start from zero
- Computer-vision defect detection on inspection photos, with engineer verification
- Offline mode for inspectors in areas with poor network
- Deterioration forecasting from inspection history
- Additional sectors: water, buildings, drainage, street lighting
- Integration with existing government systems and reporting formats

## 11. Summary

**Problem.** Information about roads, bridges and their components is scattered across records and reports, so authorities struggle to see infrastructure health and decide what to fix first.

**Solution.** InfraLife is a GIS-based platform that brings location, asset hierarchy, inspection, condition, risk, maintenance and lifecycle history into one workflow, and adds a dependency graph so the effect of a failure can be understood before it happens.

**Result.** A department can move from simply recording assets to actively managing their condition and lifecycle.

> InfraLife is not just an asset registry. It is a digital lifecycle twin that shows authorities where their infrastructure is, what condition it is in, what needs attention, and what should happen next.
