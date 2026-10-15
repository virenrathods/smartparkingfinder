# Smart Parking Finder — Full Stack Minor Project

An enterprise-grade, software-managed parking discovery, slot reservation, and digital QR ticketing platform designed for a Diploma IT Minor Project.

---

## 🌟 Key Features

1. **Software-Managed Availability:** No dependencies on hardware sensors, IoT devices, or cameras. All slot availability is mathematically calculated against database records and active reservation intervals.
2. **ACID Concurrency Protection:** Employs MySQL InnoDB pessimistic row locks (`SELECT ... FOR UPDATE`) and atomic transactions to strictly prevent simultaneous double bookings on the same parking slot.
3. **Genuine QR Code Tickets:** Generates authentic Base64 PNG QR code data URLs embedded with cryptographic booking metadata. Scan tickets at the gate for immediate check-in validation.
4. **Resilient Dual-Mode Maps:** Seamlessly integrates Google Maps via `VITE_GOOGLE_MAPS_API_KEY`, with an automatic, zero-configuration **Leaflet / OpenStreetMap** interactive fallback if the API key is omitted.
5. **Role-Based Access Control (RBAC):** Secure `bcryptjs` password hashing, stateless JWT session tokens, and administrative protection guards.
6. **Administrator Portal:**
   - Real-time operations dashboard with KPI counters and revenue analytics.
   - Facility and slot provisioning with vehicle types (Car, EV, Accessible, Bike).
   - Manual slot status overrides (`available`, `occupied`, `maintenance`, `reserved`) with immutable audit logging.
   - Gate scanner and ticket code validation for vehicle check-in and check-out.

---

## 🏗️ Project Architecture

```
smart-parking-finder/
├── server/                     # Node.js + Express.js REST API
│   ├── config/                 # Unified DB adapter (MySQL + SQLite fallback)
│   ├── database/               # schema.sql, seed.sql, migrate.js
│   ├── controllers/            # Auth, Locations, Slots, Bookings, Admin
│   ├── middleware/             # JWT auth, RBAC admin guards, error handler
│   ├── routes/                 # Express API routes
│   └── utils/                  # Real QR code generator & helpers
│
└── client/                     # React 18 + Vite SPA
    ├── src/
    │   ├── components/         # SlotGrid, ParkingMap, TicketCard, Modals, Navbar
    │   ├── context/            # AuthContext, ToastContext
    │   ├── pages/              # Home, Explore, Details, Bookings, Profile, Admin
    │   └── services/           # Axios/Fetch client with token interceptors
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js:** v18 or v20+
- **NPM:** v9+

### 2. Run Database Migration & Seeds
```bash
cd server
npm run migrate
```
*Seeds 4 parking facilities, 54 diverse slots, and verified administrator & user accounts.*

### 3. Start Backend Server
```bash
cd server
npm run dev
# Server listens at http://localhost:5000
```

### 4. Start Frontend Client
```bash
cd client
npm run dev
# Client is accessible at http://localhost:5173
```

---

## 🔑 Demo Credentials for Project Evaluation

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@parkingfinder.com` | `Admin@123` | Full Admin Portal & Gate Operations |
| **Student Driver** | `user@parkingfinder.com` | `User@123` | Search, Slot Reservation & QR Passes |

*(The login screen also includes convenient **"Quick Fill"** evaluation buttons to instantly pre-populate demo credentials during viva/project presentations).*

---

## 🧪 Automated Testing & Verification

All automated test suites use mocked or isolated test transports. No real external email messages are dispatched to seeded accounts during testing.

1. **Phase 3 Email Notifications, Reminders & Lifecycle Test (New):**
   ```bash
   cd server && node test-phase3.js
   ```
   *Runs 44 automated assertions verifying booking confirmation emails, cancellation emails, graceful unconfigured SMTP fallback, transient error handling, 15-minute advance reminder scheduler, offline recovery policy, lifecycle transitions (`expired` vs `completed`), and admin notification audit access.*

2. **Phase 2 Booking Lifecycle & Navigation Test:**
   ```bash
   cd server && node test-phase2.js
   ```
   *Verifies automated expiration transitions, start/end time validations, duration limits, and Google/Apple/Waze deep-link generation.*

3. **Concurrency Protection & Double-Booking Test:**
   ```bash
   cd server && node test-concurrency.js
   ```
   *Sends simultaneous asynchronous requests for the exact same slot and time window to prove that one succeeds (`HTTP 201`) and the other is safely rejected (`HTTP 409 Conflict`).*

4. **Full Functional & Security Audit Test:**
   ```bash
   cd server && node test-comprehensive.js
   ```
   *Comprehensive 27-point end-to-end integration test across auth, RBAC, search, QR ticketing, and check-in/out workflows.*

---

## 📬 Phase 3 — Email Notifications & Reminder System

Smart Parking Finder includes an enterprise-grade notification subsystem with transactional email confirmations, advance arrival reminders, and administrative visibility.

### 📋 Booking Status Definitions

| Status | Meaning & Lifecycle Stage | Slot Availability Effect |
| :--- | :--- | :--- |
| `confirmed` | Active reservation. Start time is in the future or within active permitted window. Vehicle has either not checked in yet or is actively parked within permitted end time. | **Blocked** for overlapping reservation window. |
| `completed` | The driver checked in at the gate and completed their parking stay (either through gate operator checkout or automated end-of-window sweep). | **Released** immediately for new drivers. |
| `expired` | The reservation window elapsed without the driver ever checking in at the facility (no-show / unattended booking). | **Released** immediately for other drivers. |
| `cancelled` | The reservation was explicitly cancelled by the driver or an administrator before completion. | **Released** immediately for new reservations. |

### ⚙️ SMTP & Notification Configuration

Configure SMTP in `server/.env` using any authorized email provider (Gmail, Outlook, Amazon SES, SendGrid, Mailgun, Brevo) or test mock mode:

```env
# Optional SMTP Credentials
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM="Smart Parking Finder" <no-reply@parkingfinder.com>
APP_BASE_URL=http://localhost:5173

# Automated Advance Booking Reminders
REMINDER_MINUTES_BEFORE=15
REMINDER_CHECK_INTERVAL_SECONDS=60

# Offline / Mock Email Mode for Development & Automated Testing
MOCK_SMTP=false
```

#### 🛡️ Zero-Config Graceful Degradation
- If SMTP credentials are not configured (`SMTP_HOST` or `SMTP_USER` left empty), the application **continues working without errors**.
- Parking slot reservations and cancellations are created and saved normally.
- The system logs the notification delivery status as `skipped` in the database audit log.
- The driver UI transparently clarifies that their digital QR pass is fully active and saved in the database even without an email dispatch.

### ⏰ Automated Booking Reminders
- An automated background scheduler inspects confirmed future reservations starting within `REMINDER_MINUTES_BEFORE` (default: 15 minutes).
- **Idempotency Guarantee:** Once a reminder is delivered (or skipped), it is permanently tracked in the `notifications` table to prevent repeated sends.
- **Offline Recovery Policy:** If the server was offline and boots up after a booking's scheduled start time, the system will **never** dispatch an outdated "starts soon" reminder for past or elapsed reservations.
- **Ineligible Exclusion:** Cancelled, expired, or completed reservations never receive reminders.

### 🔒 Administrator Notification Audit Visibility
- Protected endpoint: `GET /api/admin/notifications`
- Restricted strictly to operators with `role = 'admin'` via RBAC middleware.
- Displays: notification type (`confirmation`, `cancellation`, `reminder`), booking code, delivery status (`sent`, `failed`, `skipped`), attempt count, last attempt timestamp, sanitized error details, and an automated `actionRequired` flag for failed deliveries.
- Passwords, access tokens, QR cryptographic keys, and full recipient credentials are never leaked.
