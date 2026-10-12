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

## 🧪 Testing Concurrency Protection

Run the automated concurrency verification script:
```bash
cd server
node test-concurrency.js
```
*Triggers simultaneous asynchronous booking requests for the exact same slot and time window to prove that one succeeds (`HTTP 201`) and the other is safely rejected (`HTTP 409 Conflict`).*
