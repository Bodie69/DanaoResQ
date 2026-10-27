# DanaoResQ

Mobile Alert System for Disaster Preparedness in Brgy. Danao. Barangay staff register residents, send disaster alerts by SMS, receive SOS requests, and manage evacuation centers. Residents get an offline safety toolkit on their phones. Built with Node.js, Express and MongoDB.

## Features

| Feature | Where | What it does |
|---|---|---|
| **Dashboard** | Admin → Dashboard | Active SOS, households and people covered, shelter occupancy, alerts sent, SMS delivery, vulnerable households, residents per purok, and a situation map. Refreshes every 30 s. |
| **Emergency Distress SOS** | Admin → SOS | Inbox of SOS requests from the toolkit (web), SMS (`SOS <details>`) or manual entry. Shows location, number of people and vulnerable flags. Status: pending → acknowledged → responding → resolved, and the requester can be texted at each step. A new SOS shows a badge and plays a beep on any admin tab. |
| **Shelters & Safe Zones** | Admin → Shelters | Evacuation centers and safe zones with capacity, live occupancy (+/− buttons), facilities, contact person and a location picked on a map. Open shelters switch to *full* at capacity and back to *open* when space frees up. |
| **Emergency Actions** | Admin → Emergency Actions | Before / during / after guides for each disaster type (21 default guides are added on first run). "Use in alert" turns a guide into an SMS alert draft. |
| **Hotlines** | Admin → Hotlines | Emergency numbers shown in the toolkit (911 and Red Cross 143 are added by default). |
| **Offline Safety Toolkit** | `/toolkit.html` (for residents) | SOS button, hotlines with tap-to-call, disaster guides, shelters sorted by distance, go-bag checklist, siren, screen light, "I'm safe" text to family. Works without internet after the first visit. |
| **Residents & Alerts** | Admin → Residents / Alerts | Resident registry and SMS alert sending (see below). |

### How the toolkit works offline
- On the first online visit, the page is cached by a service worker and the barangay info (guides, hotlines, shelters) is saved on the phone.
- When offline, **SOS** turns into a pre-filled text message to `BARANGAY_SOS_NUMBER`, with location and number of people included, plus a *Call 911* button. Texting works over the cellular network without data.
- Residents can add it to their home screen (it's a PWA).
- **Service workers require HTTPS** (or `localhost`). Deploy behind HTTPS so residents' phones can use the toolkit offline.

## Setup

1. Install [Node.js 18+](https://nodejs.org) and [MongoDB Community Server](https://www.mongodb.com/try/download/community), or use a free MongoDB Atlas cluster.
2. Install and configure:
   ```bash
   npm install
   cp .env.example .env   # then edit .env
   ```
3. Run:
   ```bash
   npm start      # or: npm run dev  (restarts on file changes)
   ```
   Admin: `http://localhost:3000` · Toolkit: `http://localhost:3000/toolkit.html`

### Settings (`.env`)
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SMS_PROVIDER` | `console` (prints to the terminal, default), `semaphore` or `twilio` |
| `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER_NAME` | [Semaphore](https://semaphore.co) (PH SMS gateway); the sender name must be approved by Semaphore |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Twilio |
| `BARANGAY_SOS_NUMBER` | Number residents text or call for SOS from the offline toolkit |
| `MAP_CENTER` | `lat,lng` to open the maps zoomed in on (e.g. the barangay hall). Leave blank to show the whole `MAP_BOUNDS` area. |
| `MAP_BOUNDS` | `south,west,north,east` area the maps are limited to. Default: Sibuyan Island, Romblon. |

To add another SMS gateway, add a function to `providers` in `src/services/sms.js`.

## Two-way SMS (incoming texts)

Set your gateway's inbound/webhook URL to `POST https://<your-server>/api/sms/inbound`. It accepts Twilio (`From`, `Body`) and generic (`from`/`number`, `message`/`text`) fields.

| Resident texts | Result |
|---|---|
| `SOS <details>` (also `HELP`, `TULONG`) | Creates an SOS request and replies with a confirmation. `3 pax` and `loc 10.52,124.03` in the text are read as the number of people and the location. |
| `SHELTER` (or `EVAC`) | Replies with open evacuation centers, the resident's own purok first |
| `STOP` / `START` | Turns alerts off / on for a registered number |
| anything else | Replies with the list of keywords |

## API

All admin routes support full CRUD: `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

| Base path | Extra routes / filters |
|---|---|
| `/api/residents` | `?purok=`, `?subscribed=`, `?q=`; `GET /puroks` |
| `/api/alerts` | `?status=`, `?disasterType=`, `?severity=`; `POST /?send=true`, `POST /:id/send`, `GET /:id/logs`, `GET /meta`. Only drafts can be edited. |
| `/api/sos` | `?status=`, `?active=true`. `PUT` body `{ status, note, notify }` changes status and can text the requester. |
| `/api/shelters` | `?status=`, `?type=`, `?purok=` |
| `/api/emergency-actions` | `?disasterType=`, `?phase=` |
| `/api/hotlines` | `?category=` |
| `/api/dashboard` | `GET` summary for the dashboard |

Public routes used by the toolkit (no login):
- `GET /api/public/toolkit`: guides, hotlines, non-closed shelters and the SOS number
- `POST /api/public/sos`: submit an SOS (limited to 5 per 10 minutes per IP)
- `GET /api/public/sos/:id`: status of a submitted SOS

## Project structure
```
src/
  server.js                    App entry, route wiring
  seed.js                      Default emergency guides and hotlines (first run only)
  models/                      Resident, Alert, SmsLog, SosRequest, Shelter, EmergencyAction, Hotline
  routes/                      residents, alerts, sos, dashboard, smsInbound, public, crudRouter
  services/sms.js              SMS providers (console / semaphore / twilio)
  services/alertDispatcher.js  Sends alerts to targeted residents and logs each SMS
  services/sosService.js       Creates SOS requests, status changes and SMS replies
public/
  index.html, app.js, js/      Admin page (dashboard, SOS, alerts, shelters, residents, guides, hotlines)
  toolkit.html/.js/.css, sw.js Offline safety toolkit (PWA)
```

## Before production
- The admin page and admin API have **no login yet**. Add authentication before deploying publicly. Only `/api/public/*` and `/api/sms/inbound` are meant to be public.
- Serve over HTTPS so the offline toolkit works on residents' phones.
- Add your barangay hall and MDRRMO numbers in **Hotlines**, and set `BARANGAY_SOS_NUMBER`.
