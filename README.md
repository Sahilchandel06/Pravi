# InfraLife

InfraLife is a GIS government infrastructure asset lifecycle platform. The current demo is seeded around roads and the Ahmedabad-Vadodara NH-48 corridor, with BR-102 as the hero asset.

## Stack

- Server: Node 20, Express, MongoDB, Mongoose, Zod, JWT
- Client: React, Vite, Tailwind CSS, Leaflet, React Flow, Recharts
- Deployment: Render API, Vercel SPA, MongoDB Atlas

## Environment

### Server

| Variable                | Required           | Description                                |
| ----------------------- | ------------------ | ------------------------------------------ |
| `PORT`                  | No                 | API port. Defaults to `4000`.              |
| `MONGODB_URI`           | Yes for deployment | MongoDB or Atlas connection string.        |
| `JWT_SECRET`            | Yes for deployment | Secret used to sign auth tokens.           |
| `CLIENT_URL`            | Yes for deployment | Deployed Vercel URL allowed by CORS.       |
| `GEMINI_API_KEY`        | No                 | Enables Gemini assistant function calling. |
| `CLOUDINARY_CLOUD_NAME` | Yes for uploads    | Cloudinary cloud name.                     |
| `CLOUDINARY_API_KEY`    | Yes for uploads    | Cloudinary API key.                        |
| `CLOUDINARY_API_SECRET` | Yes for uploads    | Cloudinary API secret.                     |

Copy `server/.env.example` to `server/.env` for local development. Never commit real secrets.

### Client

| Variable       | Required           | Description                                                                             |
| -------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `VITE_API_URL` | Yes for deployment | Public API URL, including `/api`, for example `https://infralife-api.onrender.com/api`. |

Copy `client/.env.example` to `client/.env` for local development.

## Local setup

Prerequisites: Node 20 and a running MongoDB instance.

```powershell
npm run install:all
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
npm run seed
npm run dev
```

The API runs at `http://localhost:4000` and the Vite client at `http://localhost:5173`.

To seed Atlas instead of local MongoDB, set `MONGODB_URI` in `server/.env` to the Atlas connection string and run:

```powershell
npm run seed
```

The seed is idempotent and prints the seeded collection counts and demo users.

## Deployment

### 1. MongoDB Atlas

1. Create an Atlas cluster.
2. Create a database user with read/write access to the InfraLife database.
3. In Network Access, add `0.0.0.0/0` so Render can connect. For production, narrow this range when your hosting network policy allows it.
4. Copy the generated connection string for Render's `MONGODB_URI`.

### 2. Render API

1. Create a Web Service from the repository. Set the service root directory to `server`.
2. Use build command `npm install` and start command `npm start`.
3. Set these environment variables in Render:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `CLIENT_URL` (set after Vercel deployment)
   - `GEMINI_API_KEY` (optional)
4. Render uses `/api/health` as the health check. The blueprint is also available at `server/render.yaml`.

After deployment, verify `https://YOUR-RENDER-HOST/api/health`.

### 3. Vercel client

1. Import the same repository into Vercel.
2. Set the project root directory to `client`.
3. Set `VITE_API_URL` to the Render API URL ending in `/api`.
4. Deploy. `client/vercel.json` rewrites SPA routes to `index.html`.

### 4. Connect CORS and seed

1. Copy the deployed Vercel URL into Render's `CLIENT_URL` environment variable.
2. Redeploy the Render service.
3. Run the seed against Atlas with `MONGODB_URI` configured. Locally, from the repository root:

```powershell
$env:MONGODB_URI = "mongodb+srv://USER:PASSWORD@CLUSTER/infralife"
npm run seed
```

## Demo credentials

All seeded users use password `Passw0rd!`:

- `admin@infralife.gov`
- `manager@infralife.gov`
- `inspector@infralife.gov`
- `maintenance@infralife.gov`

## BR-102 demo path

1. Sign in and open Dashboard.
2. Open Map and select BR-102.
3. Open the asset profile and view Digital Twin.
4. Start an inspection, set Expansion Joint to `POOR`, and submit.
5. Review the condition/risk result and approve the generated request from Maintenance as a manager.
6. Start, complete with evidence, and close Work Order `1042` using the seeded demo roles.
7. Review Maintenance and Lifecycle tabs.
8. Ask the Assistant: `Why is BR-102 high priority?`
9. Open Dependencies, simulate failure, and review affected assets and impact scores.

## Admin asset type example

Sign in as `admin@infralife.gov`, open `/admin/asset-types`, and create a `water_pipeline` type with the form. The equivalent API payload is:

```json
{
  "key": "water_pipeline",
  "label": "Water pipeline",
  "sector": "water",
  "isComponent": false,
  "attributeSchema": [
    {
      "key": "diameterMm",
      "label": "Diameter",
      "type": "number",
      "unit": "mm"
    },
    { "key": "material", "label": "Material", "type": "string" }
  ],
  "componentTemplates": [],
  "defaultUsefulLifeYears": 50,
  "inspectionIntervalMonths": 12,
  "allowedRelationships": []
}
```

Then create an asset with `typeKey: "water_pipeline"` through `POST /api/assets`:

```json
{
  "assetId": "WP-001",
  "name": "North district water pipeline",
  "typeKey": "water_pipeline",
  "sector": "water",
  "location": { "type": "Point", "coordinates": [72.9, 22.6] },
  "attributes": { "diameterMm": 600, "material": "Ductile iron" },
  "criticality": 72,
  "trafficImportance": 0,
  "failureHistoryCount": 0
}
```

Reset demo data from the admin page or with `POST /api/admin/reset-demo`. This restores the seeded roads dataset and removes custom records.

## Verification

```powershell
npm run build --prefix client
npm run seed
```

The deployed demo depends on a reachable MongoDB/Atlas URI and the configured Render/Vercel environment variables.
