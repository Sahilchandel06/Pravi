# InfraLife: Architecture

A short, honest description of how InfraLife is put together. It covers what is built in this prototype and marks what is only planned.

---

## 1. Overview

InfraLife is a three-layer web application: a React front end, one Express API, and one MongoDB database. The API also calls Google Gemini for the assistant. Cloudinary for file uploads is planned but not built.

```
        React web app (Vercel)
        Vite, Tailwind, React Query
                 |
                 |  REST + JWT
                 v
        Express API (Render)
  +--------------+---------------+
  |              |               |
Assets &     Inspection &    Graph &
condition     repair          risk
  |              |               |
  +--------------+---------------+
                 |
        auth by role, Zod validation,
        audit log on every change
                 |
        +--------+---------+----------------+
        v                  v                v
  MongoDB Atlas        Gemini (AI)     Cloudinary (planned)
  all app data         answers via     photo / evidence
                       tool calls      uploads
```

## 2. Layers

### Front end (`/client`)
- React (Vite), Tailwind CSS, React Query for server state, react-router for pages.
- Leaflet + OpenStreetMap for the map, React Flow + dagre for the dependency graph, Recharts for charts.
- Organised by feature: `dashboard`, `map`, `assets`, `graph`, `inspection`, `maintenance`, `assistant`. Shared UI components live separately.
- The JWT is attached to every request by an axios interceptor. A 401 sends the user back to login.

### API (`/server`)
One Express app with clear layers:

`routes -> controllers -> services -> models`

- **routes** map URLs and check roles.
- **controllers** handle the request and response, with Zod validation.
- **services** hold the real logic (condition, risk, graph, inspection, maintenance, assistant).
- **models** are Mongoose schemas.

Responses always have the shape `{ success, data, error }`. Errors go through one async error middleware that hides stack traces in production. Configuration comes from environment variables only.

### Database
MongoDB Atlas holds everything: assets, relationships, inspections, risk results, work orders, lifecycle events, audit logs and users. Location data uses GeoJSON with a 2dsphere index. The dependency graph is traversed with `$graphLookup`.

## 3. Services

| Service | What it does |
|---|---|
| `conditionService` | Weighted component scores into an overall score, roll-up to parents, rating and status. |
| `riskService` | Seven weighted factors into a score, level, plain-language reasons and a recommended action. |
| `graphService` | Add and validate relationships, downstream impact, failure simulation, single points of failure, cascade risk. |
| `inspectionService` | Save an inspection, update scores, recompute risk, raise a maintenance request. |
| `maintenanceService` | Approve requests, create work orders, enforce status transitions, record cost. |
| `lifecycleService` | Record and return the timeline of events for an asset. |
| `assistantService` | Gemini function calling over our own services. |
| `auditService` | Write who changed what, before and after. |

## 4. Data model

Main collections:

- **AssetType**: configuration for a type (attribute schema, component templates and weights, useful life, inspection interval, allowed relationships).
- **Asset**: identity, type, parent, GeoJSON location, type-specific attributes, condition, criticality, traffic, status, inspection dates.
- **AssetRelationship**: `from`, `to`, `type` (CONTAINS, DEPENDS_ON, CONNECTS_TO, DRAINS_TO), `weight`. Unique on from + to + type.
- **Inspection**, **RiskAssessment**, **MaintenanceRequest**, **WorkOrder**, **MaintenanceRecord**, **LifecycleEvent**, **AuditLog**, **User**.

### Why the core has no "bridge code"
What makes a bridge a bridge lives in an `AssetType` document. Core code reads that configuration. Adding a new type (for example a water pipeline) means adding an `AssetType` and loading assets. The map, inventory, condition, risk and graph work without core changes.

## 5. Key flows

### Inspection (the main demo flow)
```
Inspector submits ratings
   -> save inspection
   -> update component scores (rating -> number)
   -> recompute parent condition
   -> recompute risk (with reasons)
   -> if any component is Poor or Critical: create maintenance request
   -> set last and next inspection dates
   -> add lifecycle event, write audit log
   -> return before/after condition, risk, recommended action
```

### Maintenance
```
Request (pending) -> manager approves -> work order (#1042 first)
   -> in progress -> completed (needs evidence) -> closed
   -> on completion: record cost, lifecycle event, recompute condition and risk
```
Invalid transitions return 409.

### Failure simulation
```
Pick asset + failure level
   -> traverse dependents with $graphLookup
   -> impact(child) = impact(parent) x edge weight x 0.8
   -> return affected assets, hops, scores, summary
   -> nothing is saved
```

### AI assistant
```
Manager asks a question
   -> Gemini chooses a tool (asset details, risk explanation, impact, work orders...)
   -> API runs the tool against MongoDB
   -> Gemini writes the answer from the result only
   -> returns { answer, sources }
```

## 6. Security and roles

- JWT authentication. Passwords hashed with bcrypt.
- Roles: `ADMIN`, `MANAGER`, `INSPECTOR`, `MAINTENANCE`. Routes check the role with an `authorize(...)` middleware.
- `helmet`, CORS limited to `CLIENT_URL`, compression, request logging.
- Every mutation writes an audit log entry.
- Not built yet: rate limiting, secrets rotation, single sign-on.

## 7. Deployment

| Part | Where |
|---|---|
| Database | MongoDB Atlas |
| API | Render (`render.yaml`, health check at `/api/health`) |
| Web app | Vercel (`vercel.json` rewrites to `index.html`) |

Environment variables:

- Server: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `GEMINI_API_KEY`
- Client: `VITE_API_URL`

Seed with `npm run seed`. It is safe to run again.

## 8. Design decisions

- **MongoDB instead of a graph database.** `$graphLookup` and GeoJSON cover our needs in one database. It is not as strong as a real graph engine for large or deep graphs. We accepted that for the time limit.
- **One backend instead of microservices.** Faster to build and debug. The service layer means it can be split later.
- **Weights in configuration.** Condition and risk weights are not scattered through code, so they can be tuned.
- **Reasons on every score.** Condition and risk always return a `reasons[]` list so nobody has to trust a hidden number.
- **The AI only reads.** It calls fixed functions and cannot change data.

## 9. Built vs planned

| Built | Planned |
|---|---|
| Map, inventory, asset profile | File uploads (Cloudinary) |
| Digital twin with weighted condition | QR code generation |
| Inspection, risk with reasons | Add-dependency UI and network-wide graph page |
| Dependency graph, impact, simulation | Kanban board for work orders |
| Maintenance workflow, lifecycle timeline | Audit trail screen, editable risk weights |
| AI assistant (tool calling) | AI image defect detection |
| Roles and audit logging | Rate limiting, hardening, offline mode |

## 10. Folder layout

```
/client
  src/features/{dashboard,map,assets,graph,inspection,maintenance,assistant}
  src/components   shared UI
  src/lib          api client, formatters
/server
  config/  models/  controllers/  services/  routes/  middleware/  seed/
```
