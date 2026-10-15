# Smart Parking Finder — Production Deployment Guide

A step-by-step guide for deploying **Smart Parking Finder** live online using free-tier cloud providers:
- **Frontend SPA:** Vercel
- **Backend API:** Render Web Service
- **Production Database:** Free Hosted MySQL (Aiven, TiDB Serverless, or Render MySQL)
- **Email Service (Optional):** SMTP (Gmail App Password, Brevo, SendGrid, or AWS SES)

---

## 🏗️ Deployment Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │                 Vercel (Frontend SPA)                   │
  │         https://smartparkingfinder.vercel.app           │
  └────────────────────────────┬────────────────────────────┘
                               │ HTTPS API Calls
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │               Render (Node/Express API)                 │
  │     https://smart-parking-finder-api.onrender.com       │
  └──────────────┬───────────────────────────┬──────────────┘
                 │                           │
                 ▼                           ▼
  ┌─────────────────────────┐   ┌───────────────────────────┐
  │   Cloud Hosted MySQL    │   │  SMTP Mail Provider       │
  │  (Aiven / TiDB / Render)│   │  (Gmail / Brevo / SES)    │
  └─────────────────────────┘   └───────────────────────────┘
```

---

## Step A — Prepare Your GitHub Repository

1. Review and stage all uncommitted code:
   ```bash
   cd /Users/virenrathod/.gemini/antigravity-ide/scratch/smart-parking-finder
   git status
   ```
2. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: complete Phase 4 live deployment preparation"
   ```
3. Push to your GitHub repository:
   ```bash
   git push origin main
   ```
   *(Note: Ensure your branch is synced with `https://github.com/virenrathods/smartparkingfinder`).*

---

## Step B — Provision a Free Hosted MySQL Database

Smart Parking Finder uses InnoDB transactions and row-level pessimistic locks (`SELECT ... FOR UPDATE`) to prevent double-booking collisions. Use one of the following free cloud MySQL providers:

### Option 1: Aiven for MySQL (Recommended — Free Tier)
1. Sign up at [https://aiven.io](https://aiven.io).
2. Create a new service: Select **MySQL**, **Free Tier**, and your nearest region.
3. Once running, copy your service connection details from the Aiven Overview dashboard:
   - **Host** (e.g. `mysql-xxxx.aivencloud.com`)
   - **Port** (e.g. `12345`)
   - **User** (e.g. `avnadmin`)
   - **Password** (auto-generated secret)
   - **Database Name** (default: `defaultdb`)
   - **CA Certificate:** Download `ca.pem` from the Aiven console.
4. **Configuring Aiven CA Certificate on Render:**
   - **Method A (Environment Variable):** Open the downloaded `ca.pem` in a text editor, copy the entire block including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`, and paste it into the `DB_CA_CERT` environment variable in Render.
   - **Method B (Render Secret File):** In Render Dashboard under **Environment** > **Secret Files**, upload `ca.pem` as `/etc/secrets/ca.pem` and set `DB_CA_CERT_PATH=/etc/secrets/ca.pem`.
   - Certificate verification is enforced by default (`DB_SSL_REJECT_UNAUTHORIZED=true`).

### Option 2: TiDB Serverless (Free Forever MySQL 8.0 Protocol)
1. Sign up at [https://tidbcloud.com](https://tidbcloud.com).
2. Create a **Serverless Cluster** (Free).
3. Under **Connect**, select **General** / **Node.js** and copy your credentials. (TiDB uses public root CAs, so `DB_CA_CERT` can be left blank).

---

## Step C — Deploy the Backend on Render

1. Sign in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository: `virenrathods/smartparkingfinder`.
4. Configure the service parameters:
   - **Name:** `smart-parking-finder-api`
   - **Region:** Nearest to your database (e.g. Oregon or Frankfurt)
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run migrate && npm start`
   - **Instance Type:** `Free`
5. Expand **Advanced** and set **Health Check Path** to `/api/health`.

### Environment Variables on Render
Under the **Environment** tab, add the following variables:

| Key | Value / Example | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security mode, error masking, and disables demo accounts |
| `PORT` | `5000` | Express internal port (Render maps to port 443 automatically) |
| `DB_CLIENT` | `mysql` | Strictly enforces MySQL persistence in production |
| `DB_HOST` | `mysql-xxxx.aivencloud.com` | From your MySQL provider |
| `DB_PORT` | `3306` (or Aiven custom port) | Database port |
| `DB_USER` | `avnadmin` / `your_user` | Database user |
| `DB_PASSWORD` | `your_secret_password` | Database password |
| `DB_NAME` | `defaultdb` / `smart_parking_db` | Target database |
| `DB_SSL` | `true` | Required for hosted cloud MySQL |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Enforces TLS certificate verification |
| `DB_CA_CERT` | *(Paste Aiven ca.pem contents)* | Required for Aiven MySQL or private DB CAs |
| `INITIAL_ADMIN_EMAIL` | `admin@yourcollege.edu` | **Production Initial Administrator Email** |
| `INITIAL_ADMIN_PASSWORD` | *(Strong 12+ char password)* | **Strong Admin Password** (known demo passwords like `Admin@123` are rejected) |
| `JWT_SECRET` | *(Generate a 32+ character random string)* | **Mandatory** in production for signing session tokens |
| `CORS_ORIGIN` | `https://your-frontend-app.vercel.app` | Updated in Step E after Vercel deployment |
| `APP_BASE_URL` | `https://your-frontend-app.vercel.app` | Used in email pass links |
| `REMINDER_MINUTES_BEFORE` | `15` | Advance notice for automated reminder emails |
| `REMINDER_CHECK_INTERVAL_SECONDS` | `60` | Background monitor frequency |

*(Optional SMTP settings can be added now or configured in Step F).*

6. Click **Create Web Service**.
7. Render will build the backend, automatically execute `npm run migrate` (creating all tables and initial seed locations), and launch Express on `0.0.0.0:5000`.
8. Once deployed, copy your public backend URL:
   `https://smart-parking-finder-api.onrender.com`

---

## Step D — Verify Backend Health & Migrations

1. Open your browser or terminal and test the health endpoint:
   ```bash
   curl https://smart-parking-finder-api.onrender.com/api/health
   ```
2. Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-10-15T...",
     "databaseEngine": "MYSQL"
   }
   ```
3. Check Render logs to verify that `npm run migrate` seeded the initial parking facilities:
   ```
   ✅ MySQL schema applied successfully.
   ✅ Database seeded successfully! (3 users, 4 locations, 54 slots)
   ```

---

## Step E — Deploy the Frontend on Vercel

1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository: `virenrathods/smartparkingfinder`.
4. In the configuration screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `client`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
   - **Install Command:** `npm install` (default)
5. Expand **Environment Variables** and add:

| Key | Value |
| :--- | :--- |
| `VITE_API_BASE_URL` | `https://smart-parking-finder-api.onrender.com/api` |
| `VITE_GOOGLE_MAPS_API_KEY` | *(Optional: Leave empty for built-in OpenStreetMap)* |

6. Click **Deploy**.
7. In ~45 seconds, your site will be live at a public URL:
   `https://smart-parking-finder.vercel.app`

### Link CORS on Render
Now return to **Render Dashboard** > `smart-parking-finder-api` > **Environment**:
Update `CORS_ORIGIN` and `APP_BASE_URL` with your actual Vercel domain:
```env
CORS_ORIGIN=https://smart-parking-finder.vercel.app
APP_BASE_URL=https://smart-parking-finder.vercel.app
```
Click **Save Changes** (Render will automatically redeploy with the updated origin).

---

## Step F — Configure Transactional Email (Optional)

If you want real emails delivered to user inboxes:
1. Generate an **App Password** from your Google Account (or use Brevo/SendGrid API SMTP).
2. In Render Environment settings, add:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_character_app_password
   EMAIL_FROM="Smart Parking Finder" <your_email@gmail.com>
   MOCK_SMTP=false
   ```
3. *If you skip this step:* Smart Parking Finder continues working seamlessly in zero-config mode. All reservations succeed, QR passes display instantly, and notifications are safely tracked as `skipped`.

---

## Step G — End-to-End Live Verification Checklist

Once both services are deployed, test your live deployment:

1. **User Registration & Login:**
   - Go to `https://smart-parking-finder.vercel.app/register`.
   - Register a new driver account.
   - Or click **"Demo Driver"** to log in with `user@parkingfinder.com` / `User@123`.
2. **Search & Dynamic Floorplan:**
   - Browse the 4 parking facilities in Metropolis.
   - Filter by vehicle type (EV Charging, Accessible, Car, Bike).
   - Select arrival time and duration. Notice that reserved bays are dynamically greyed out.
3. **Slot Reservation & Instant QR Ticket:**
   - Book an available bay.
   - Verify celebratory confetti and authentic QR ticket generation.
   - Review confirmation feedback badge (Email sent or digital pass saved).
4. **Direct Route Navigation & Page Refresh:**
   - Navigate directly to `/my-bookings` and press Browser Refresh (`Cmd+R` / `F5`).
   - Verify that Vercel SPA rewrites keep you on the ticket wallet without 404 errors.
5. **Turn-by-Turn Navigation:**
   - Click "Google Maps", "Apple Maps", or "Waze" on your ticket to test real GPS coordinates.
6. **Cancellation & Real-Time Slot Release:**
   - Cancel the reservation.
   - Return to the facility floorplan and confirm the slot immediately restored to Available.
7. **Administrator Portal:**
   - Log out and log in as `admin@parkingfinder.com` / `Admin@123`.
   - Check real-time KPI metrics, revenue counters, and facility occupancy bars.
   - Test Gate Scanner check-in and check-out.
   - Inspect Notification Delivery Audit Logs at `/api/admin/notifications`.

---

## Step H — Diagnostics & Troubleshooting

| Symptom | Probable Cause | Resolution |
| :--- | :--- | :--- |
| **Render Web Service Fails to Start** | Missing `JWT_SECRET` in production | In Render Dashboard, ensure `JWT_SECRET` is set to a custom string (not the default dev key). |
| **`Production MySQL connection failed`** | Incorrect DB host, port, or SSL setting | Ensure `DB_SSL=true` for cloud providers (Aiven/TiDB). Verify credentials in Render Environment tab. |
| **Browser shows CORS error** | Mismatched origin | Ensure `CORS_ORIGIN` on Render exactly matches your Vercel URL without a trailing slash (e.g. `https://smart-parking-finder.vercel.app`). |
| **Page refresh shows 404 on Vercel** | Missing SPA rewrite | Verify that `client/vercel.json` exists with `"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]`. |
| **Initial request takes 30-50s** | Render Free Tier cold start | Render free instances spin down after 15 minutes of inactivity. The first request wakes the container; subsequent requests are fast. |
