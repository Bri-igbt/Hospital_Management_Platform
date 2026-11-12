# Medicare — Hospital Management Platform
<p align="center">
  <img
    src="https://res.cloudinary.com/dlptri1cq/image/upload/f_auto/q_auto/Screenshot_2026-11-12_at_11.37.04.png"
    alt="Project Screenshot"
    width="100%"
  />
</p>

A full-stack clinic platform. Patients book doctors and diagnostic services online, doctors manage their own appointments, and admins run the whole clinic from a separate dashboard. Payments are in Nigerian naira (NGN) through Stripe Checkout, with a pay-in-cash option.

The project is three apps that share one API:

| App | Folder | Stack | Default port |
|---|---|---|---|
| Patient website | `frontend/` | Next.js, Clerk (app: **Medicare**) | 3000 |
| Admin dashboard | `admin/` | Next.js, Clerk (app: **MediCare Admin**) | 3001 |
| API | `backend/` | Express, MongoDB, Stripe, Cloudinary | 8000 |

The doctor portal is part of the admin app and lives under `/doctor-admin/[id]`.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project mapping](#project-mapping)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Authentication and roles](#authentication-and-roles)
- [Payments](#payments)
- [API reference](#api-reference)
- [Data conventions](#data-conventions)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Security notes](#security-notes)
- [Author](#author)

---

## Features

### Patients (`frontend/`)
- Browse doctors, search by name or specialization, and see who is available
- Doctor profile with qualifications, fee, rating and a calendar of open time slots
- Book a doctor appointment: choose a date and slot, enter patient details, pay online or in cash
- Browse diagnostic services and book one the same way
- Pay with Stripe Checkout; the booking is confirmed when the patient returns from payment
- "My appointments" page showing doctor and service bookings with live status
- Contact form that opens a pre-filled WhatsApp message to the clinic
- Sign in and sign up with Clerk

### Doctors (doctor portal)
- Log in with email and password
- Personal dashboard: total appointments, completed, cancelled and earnings
- Latest appointments, with status changes (Pending, Confirmed, Completed, Cancelled)
- Reschedule appointments to a new date and time
- Full appointment list with search by patient name and a status filter

### Admins (`admin/`)
- Overview: total doctors, registered patients, appointments and earnings
- Doctors: add (photo, schedule slots, login credentials), search, filter by availability, delete
- Services: add and edit (photo, price, instructions, slots), toggle availability, delete
- Doctor appointments: view all bookings and cancel them
- Service appointments: change status, reschedule, cancel
- Service dashboard: bookings, completions, cancellations and earnings per service

### Payments
- Online payment through Stripe Checkout, in NGN
- Cash option, marked paid when the admin completes the booking
- Free (fee of 0) bookings are confirmed immediately
- Unpaid online doctor bookings release their slot after 30 minutes

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend and admin | Next.js (App Router), React, Tailwind CSS, lucide-react |
| Auth (patients and admins) | Clerk (`@clerk/nextjs`, `@clerk/express`, `@clerk/backend`) |
| Auth (doctors) | JSON Web Tokens (`jsonwebtoken`) |
| API | Node.js, Express |
| Database | MongoDB with Mongoose |
| Payments | Stripe Checkout |
| Image storage | Cloudinary (uploads handled with `multer`) |
| HTTP clients | `fetch` and `axios` |
| Notifications | `react-toastify`, `react-hot-toast` |

---

## Architecture

```
┌────────────────┐   Clerk "Medicare" token      ┌──────────────────────┐
│ Patient site   │ ────────────────────────────► │                      │
│ (frontend)     │                               │                      │
└────────────────┘                               │                      │
┌────────────────┐   Clerk "MediCare Admin"      │    Express API       │ ──► MongoDB
│ Admin dashboard│ ────────────────────────────► │    (backend)         │ ──► Cloudinary
│ (admin)        │   token                       │                      │ ──► Stripe
└────────────────┘                               │                      │
┌────────────────┐   Doctor JWT                  │                      │
│ Doctor portal  │ ────────────────────────────► │                      │
└────────────────┘                               └──────────────────────┘
```

All data lives behind the Express API. The frontend and admin never talk to each other, and neither reads the database directly. Each one sends its own kind of token to the API, and the API decides what that token may do.

---

## Project mapping

This section maps each app's folders and pages to the API endpoints they use. The folder trees show key files only. To see everything, run `tree -I node_modules -L 3` inside an app folder.

```
HOSPITAL_MANAGEMENT_PLATFORM/
├── backend/     # Express API (port 8000)
├── frontend/    # Patient website (port 3000)
└── admin/       # Admin dashboard and doctor portal (port 3001)
```

### Backend mapping

```
backend/
├── server.js                           # CORS, Clerk middleware, JSON parsing, routes, error handler
├── .env
├── configs/
│   └── db.js                           # MongoDB connection
├── controllers/
│   ├── appointmentController.js        # Doctor bookings, Stripe checkout, stats, patient count
│   ├── doctorContoller.js              # Create, list, update, delete doctors; doctor login
│   ├── serviceController.js            # Services CRUD with image upload
│   └── serviceAppointmentController.js # Service bookings, payments, stats
├── middlewares/
│   ├── adminAuth.js                    # requireAdmin, adminOr, requireUserOrAdmin
│   └── doctorAuth.js                   # doctorAuth (doctor JWT)
├── models/
│   ├── Appointment.js
│   ├── Doctor.js
│   ├── Service.js
│   └── ServiceAppointment.js
├── routes/
│   ├── doctorRoutes.js
│   ├── serviceRoutes.js
│   ├── appointmentRoutes.js
│   └── serviceAppointmentRoutes.js
└── utils/
    └── cloudinary.js                   # Upload and delete helpers
```

**How a request flows:** `CORS` then `clerkMiddleware()` then JSON parsing (1 MB limit) then the router, then the access middleware, then the controller. The controller talks to MongoDB, Stripe or Cloudinary and returns JSON. Unknown routes return a 404, and `server.js` turns upload errors and invalid JSON into clean 400 responses.

**Routes to controllers**

| Base path | Route file | Controller | Access rules |
|---|---|---|---|
| `/api/doctors` | `doctorRoutes.js` | `doctorContoller.js` | Public reads and login. `requireAdmin` to create or delete. `doctorAuth` for a doctor's own update and availability toggle |
| `/api/services` | `serviceRoutes.js` | `serviceController.js` | Public reads. `requireAdmin` to create, update or delete |
| `/api/appointments` | `appointmentRoutes.js` | `appointmentController.js` | `requireAdmin` for lists, stats and patient count. Patient (Clerk) for `/me` and booking. `doctorAuth` for `/doctor/:doctorId`. Admin, patient or doctor for update and cancel |
| `/api/service-appointments` | `serviceAppointmentRoutes.js` | `serviceAppointmentController.js` | `requireAdmin` for lists and stats. Patient (Clerk) for `/me` and booking. `requireUserOrAdmin` for read, update and cancel |

**Middleware**

| Middleware | File | What it checks |
|---|---|---|
| Patient check | Clerk `getAuth(req)` in each router | A signed-in patient from the **Medicare** Clerk app |
| `requireAdmin` | `middlewares/adminAuth.js` | A valid **MediCare Admin** token whose user has `publicMetadata.role === "admin"` |
| `adminOr(fallback)` | `middlewares/adminAuth.js` | Tries the admin check first, otherwise runs the fallback (patient or doctor) |
| `requireUserOrAdmin` | `middlewares/adminAuth.js` | An admin, or a signed-in patient |
| `doctorAuth` | `middlewares/doctorAuth.js` | A doctor JWT. Sets `req.doctor` |

**Models and relations**

| Model | Links to | Notes |
|---|---|---|
| `Doctor` | — | `schedule` holds slots keyed by date. Photo stored in Cloudinary |
| `Service` | — | `slots` are keyed by date. `available` controls booking |
| `Appointment` | `doctorId` points to `Doctor` | `createdBy` is the patient's Clerk user id. Holds payment method, status and the Stripe `sessionId` |
| `ServiceAppointment` | `serviceId` points to `Service` | `createdBy` is the patient's Clerk user id. Holds payment details |

### Frontend mapping (patient website)

```
frontend/
├── proxy.ts                         # Clerk middleware
├── next.config.js                   # Remote image hosts (Cloudinary), Turbopack
├── .env.local
├── public/
│   ├── placeholder-doctor.jpg
│   └── placeholder-service.jpg
└── app/
    ├── assets/
    │   └── dummyStyles.js           # Shared Tailwind class maps for every page
    ├── component/
    │   ├── Navbar.js
    │   ├── Footer.js
    │   └── ...                      # Home sections: doctors preview, testimonials
    ├── doctors/
    │   ├── page.js                  # All doctors
    │   └── [id]/page.js             # Doctor profile and booking
    ├── services/
    │   ├── page.js                  # All services
    │   └── [id]/page.js             # Service details and booking
    ├── appointments/page.js         # My bookings
    ├── contact/page.js              # Contact form that opens WhatsApp
    ├── appointment/
    │   ├── success/page.js          # Confirms a doctor-booking payment
    │   └── cancel/page.js
    └── service-appointment/
        ├── success/page.js          # Confirms a service-booking payment
        └── cancel/page.js
```

| Route | Page | API calls | Access |
|---|---|---|---|
| `/` | Home: doctors preview, testimonials | `GET /api/doctors` | Public |
| `/doctors` | All doctors with search | `GET /api/doctors` | Public |
| `/doctors/[id]` | Doctor profile, slots, booking form | `GET /api/doctors/:id`, `POST /api/appointments` | Public to view, patient to book |
| `/services` | All services | `GET /api/services` | Public |
| `/services/[id]` | Service details, slots, booking form | `GET /api/services/:id`, `POST /api/service-appointments` | Public to view, patient to book |
| `/appointments` | My doctor and service bookings | `GET /api/appointments/me`, `GET /api/service-appointments/me` | Patient |
| `/contact` | Contact form, opens WhatsApp | None | Public |
| `/appointment/success`, `/appointment/cancel` | Payment return for doctor bookings | `GET /api/appointments/confirm` | Public (session id) |
| `/service-appointment/success`, `/service-appointment/cancel` | Payment return for service bookings | `GET /api/service-appointments/confirm` | Public (session id) |

Patient pages send the Clerk **Medicare** token as `Authorization: Bearer <token>`.

### Admin mapping (admin dashboard and doctor portal)

```
admin/
├── proxy.ts                         # Clerk middleware
├── next.config.js                   # Remote image hosts (Cloudinary), Turbopack
├── .env.local
└── app/
    ├── assets/
    │   └── dummyStyles.js           # Shared Tailwind class maps for every page
    ├── component/
    │   └── doctor/
    │       ├── DoctorNavbar.js
    │       └── DoctorDashboard.js
    ├── (app)/                       # Admin pages (signed-in admins only)
    │   ├── home/page.js             # Dashboard
    │   ├── add/page.js              # Add doctor
    │   └── ...                      # Doctors list, appointments, services, service bookings
    └── doctor-admin/
        └── [id]/
            ├── page.js              # Doctor dashboard
            └── appointments/page.js # Doctor's full appointment list
```

**Admin pages** are wrapped in the `RequireAuth` component with `adminOnly`, and send the Clerk **MediCare Admin** token.

| Page | What it does | API calls |
|---|---|---|
| Dashboard (`/home`) | Doctors table, registered patient count, appointment and earnings totals | `GET /api/doctors?limit=200`, `GET /api/appointments/patients/count` |
| Add doctor (`/add`) | Create a doctor with photo, schedule slots and login credentials | `POST /api/doctors` |
| Doctors list | Search, filter by availability, delete | `GET /api/doctors`, `DELETE /api/doctors/:id` |
| Appointments | All doctor bookings, admin cancel | `GET /api/appointments`, `POST /api/appointments/:id/cancel` |
| Add service | Create or edit a service with photo, price, instructions, slots | `POST /api/services`, `PUT /api/services/:id`, `GET /api/services/:id` |
| Services list | Edit price, slots and availability, delete | `GET /api/services`, `PUT /api/services/:id`, `DELETE /api/services/:id` |
| Service bookings | Change status, reschedule, cancel | `GET /api/service-appointments`, `PUT /api/service-appointments/:id`, `POST /api/service-appointments/:id/cancel` |
| Service dashboard | Bookings, completions, cancellations, earnings per service | `GET /api/service-appointments/stats/summary` |

**Doctor portal** pages use the doctor's own JWT (kept in `localStorage` as `doctorToken_v1`), not Clerk.

| Page | What it does | API calls |
|---|---|---|
| Doctor login | Email and password sign-in | `POST /api/doctors/login` |
| `/doctor-admin/[id]` | Stats, latest appointments, status changes, reschedule | `GET /api/appointments/doctor/:doctorId`, `PUT /api/appointments/:id` |
| `/doctor-admin/[id]/appointments` | Full appointment list with search and status filter | `GET /api/appointments/doctor/:doctorId`, `PUT /api/appointments/:id` |

---

## Getting started

### Prerequisites

- Node.js 20 or newer and npm
- A MongoDB database (local or MongoDB Atlas)
- Two Clerk applications: **Medicare** (patients) and **MediCare Admin** (admins)
- A Stripe account (test mode is fine)
- A Cloudinary account

### 1. Clone and install

```bash
git clone <your-repo-url>
cd HOSPITAL_MANAGEMENT_PLATFORM

cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
cd admin    && npm install && cd ..
```

The backend also needs the Clerk backend SDK used for admin token verification:

```bash
cd backend && npm install @clerk/backend
```

### 2. Configure environment variables

Create `backend/.env`, `frontend/.env.local` and `admin/.env.local`. See [Environment variables](#environment-variables) for the full list.

### 3. Set up the services

1. **Clerk, patients:** in the **Medicare** app, copy the publishable and secret keys.
2. **Clerk, admins:** in the **MediCare Admin** app, copy the publishable and secret keys. Restrict sign-ups so only people you trust can create admin accounts.
3. **Admin role:** in the **MediCare Admin** app, open Users, select your user, and under **Public metadata** save:
   ```json
   { "role": "admin" }
   ```
4. **Stripe:** use test keys. In the Stripe Dashboard under Settings, Payment methods, make sure **Cards** is turned on.
5. **Cloudinary:** copy your cloud name and API credentials.

### 4. Run everything

Use three terminals:

```bash
# Terminal 1: API on http://localhost:8000
cd backend
npm start

# Terminal 2: patient site on http://localhost:3000
cd frontend
npm run dev

# Terminal 3: admin dashboard on http://localhost:3001
cd admin
npm run dev -- -p 3001
```

### 5. First run checklist

1. Open the admin dashboard and sign in with the admin user from step 3.
2. Add a doctor (photo, details, login email and password, schedule slots).
3. Add a service (photo, price, instructions, slots).
4. Open the patient site, sign up as a patient, and book the doctor with **Cash**.
5. Book again with **Online** and pay with the Stripe test card `4242 4242 4242 4242`, any future expiry date and any 3-digit CVC.
6. Log in as the doctor and open `/doctor-admin/<doctor id>` to see the dashboard.

### Developing with two Clerk apps on localhost

Browsers share cookies across ports on the same host, so the patient site (`localhost:3000`) and the admin dashboard (`localhost:3001`), which use different Clerk apps, can overwrite each other's session cookie. The symptom is being signed out, or pages that keep reloading through a Clerk redirect. To avoid it, open one of the apps in a different browser or profile. You can also open the admin at `http://127.0.0.1:3001`, in which case set `ADMIN_URL=http://127.0.0.1:3001` in `backend/.env` so CORS allows it.

---

## Environment variables

### `backend/.env`

```env
PORT=8000

# MongoDB (use the variable name read in configs/db.js)
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>

# Clerk app "Medicare" (patients)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk app "MediCare Admin" (secret key only)
ADMIN_CLERK_SECRET_KEY=sk_test_...

# Doctor login tokens (use a long random string)
JWT_SECRET=change-me

# Stripe
STRIPE_SECRET_KEY=sk_test_...
PAYMENT_CURRENCY=ngn

# Cloudinary (use the variable names read in utils/cloudinary.js)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# CORS and Stripe return URLs
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
```

| Variable | Purpose |
|---|---|
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Verify patient sessions (Medicare app) |
| `ADMIN_CLERK_SECRET_KEY` | Verify admin sessions and read the admin role (MediCare Admin app) |
| `JWT_SECRET` | Sign and verify doctor login tokens |
| `STRIPE_SECRET_KEY` | Create and read Checkout sessions |
| `PAYMENT_CURRENCY` | Three-letter Stripe currency code. Must be `ngn`, not a symbol like `₦` |
| `FRONTEND_URL` | Where Stripe sends patients after paying, and an allowed CORS origin |
| `ADMIN_URL` | An allowed CORS origin for the admin dashboard |

### `frontend/.env.local`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # Medicare app
CLERK_SECRET_KEY=sk_test_...                    # Medicare app
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `admin/.env.local`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # MediCare Admin app
CLERK_SECRET_KEY=sk_test_...                    # MediCare Admin app
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart the dev servers after changing any environment file.

### Allowing remote images

Both Next.js apps load photos from Cloudinary, so add it to `next.config.js` in `frontend/` and `admin/`:

```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "res.cloudinary.com" },
  ],
},
```

---

## Authentication and roles

The API recognises three kinds of caller. Each sends its token in the `Authorization: Bearer <token>` header.

| Role | Signs in with | Verified by | Can do |
|---|---|---|---|
| **Patient** | Clerk app *Medicare* | `clerkMiddleware()` and `getAuth(req)` | Book and manage their own appointments |
| **Admin** | Clerk app *MediCare Admin* | `middlewares/adminAuth.js` using `ADMIN_CLERK_SECRET_KEY`, then `publicMetadata.role === "admin"` | Manage doctors, services and every booking |
| **Doctor** | Email and password at `POST /api/doctors/login` | `middlewares/doctorAuth.js` (JWT, 7 day expiry, `role: "doctor"`) | View and manage their own appointments, update their profile |

Notes:

- Admin and patient tokens come from different Clerk apps, so a patient token can never act as an admin. The admin check verifies the token against the admin app's own secret key.
- The doctor portal stores its token in `localStorage` under the key `doctorToken_v1`.
- The patient count on the admin dashboard is the number of users in the **Medicare** Clerk app.

---

## Payments

1. The patient picks a slot and chooses **Online**.
2. `POST /api/appointments` (or `/api/service-appointments`) creates a **Pending** booking and a Stripe Checkout session, and returns `checkoutUrl`.
3. The patient is redirected to Stripe and pays.
4. Stripe sends them back to one of these frontend routes:

   | Booking type | On success | On cancel |
   |---|---|---|
   | Doctor | `/appointment/success?session_id=...` | `/appointment/cancel` |
   | Service | `/service-appointment/success?session_id=...` | `/service-appointment/cancel` |

5. The success page calls `GET .../confirm?session_id=...`. The API checks the session with Stripe, marks the payment **Paid** and the booking **Confirmed**, then sends the patient to **My appointments**.

Details:

- Amounts are sent to Stripe in kobo (fee x 100).
- Do not pass `payment_method_types` when creating a Checkout session. Stripe has removed it, and payment methods are managed in the Stripe Dashboard under Settings, Payment methods.
- Cash bookings stay **Pending** until an admin or doctor completes them.
- A pending online doctor booking stops blocking its slot after 30 minutes.

**Stripe test card:** `4242 4242 4242 4242`, any future expiry date, any 3-digit CVC.

---

## API reference

Base URL: `http://localhost:8000`. Responses use the shape `{ "success": true | false, "message": "...", ... }`.

### Doctors: `/api/doctors`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Public | List doctors with appointment counts and earnings |
| POST | `/login` | Public | Doctor login, returns a JWT |
| GET | `/:id` | Public | Doctor profile |
| POST | `/` | Admin | Create a doctor (multipart form, field `image`) |
| PUT | `/:id` | Doctor (self) | Update profile |
| POST | `/:id/toggle-availability` | Doctor (self) | Switch Available and Unavailable |
| DELETE | `/:id` | Admin | Delete a doctor and their photo |

### Services: `/api/services`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Public | List services |
| GET | `/:id` | Public | Service details with slots |
| POST | `/` | Admin | Create a service (multipart form, field `image`) |
| PUT | `/:id` | Admin | Update a service |
| DELETE | `/:id` | Admin | Delete a service and its photo |

### Doctor appointments: `/api/appointments`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Admin | All appointments (filters below) |
| GET | `/stats/summary` | Admin | Totals, revenue, last 7 days |
| GET | `/patients/count` | Admin | Number of registered patients |
| GET | `/me` | Patient | The signed-in patient's appointments |
| POST | `/` | Patient | Create a booking, returns `checkoutUrl` for online payment |
| GET | `/confirm?session_id=` | Public | Confirm a Stripe payment (the session id is the secret) |
| GET | `/doctor/:doctorId` | Doctor (self) | A doctor's own appointments |
| PUT | `/:id` | Admin, patient or doctor | Change status or notes, or reschedule |
| POST | `/:id/cancel` | Admin, patient or doctor | Cancel an appointment |

Filters for list endpoints: `doctorId`, `mobile`, `status`, `search`, `page`, `limit` (maximum 200).

### Service appointments: `/api/service-appointments`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Admin | All service bookings |
| GET | `/stats/summary` | Admin | Per-service bookings, completions, cancellations, earnings |
| GET | `/me` | Patient | The signed-in patient's service bookings |
| POST | `/` | Patient | Create a booking, returns `checkoutUrl` for online payment |
| GET | `/confirm?session_id=` | Public | Confirm a Stripe payment |
| GET | `/:id` | Owner or admin | One booking |
| PUT | `/:id` | Owner or admin | Owners change notes or reschedule; only admins change status |
| POST | `/:id/cancel` | Owner or admin | Cancel a booking |

---

## Data conventions

- **Dates** are strings in `YYYY-MM-DD` format.
- **Times** are strings in `hh:mm AM/PM` format, for example `09:30 AM`.
- **Doctor schedule and service slots** are objects keyed by date:
  ```json
  { "2026-11-16": ["09:00 AM", "10:30 AM"], "2026-11-17": ["02:00 PM"] }
  ```
- **Appointment status:** `Pending`, `Confirmed`, `Completed`, `Canceled`, `Rescheduled`.
- **Payment method:** `Cash` or `Online`. **Payment status:** `Pending`, `Paid`, `Failed`, `Refunded`.
- **Mobile numbers** are Nigerian numbers in local format, for example `08012345678`.
- **Currency** is always NGN. The UI formats prices with `Intl.NumberFormat("en-NG")`, for example `₦15,000`.

---

## Scripts

| Where | Command | What it does |
|---|---|---|
| `backend/` | `npm start` | Runs the API with nodemon on port 8000 |
| `frontend/` | `npm run dev` | Dev server on port 3000 |
| `admin/` | `npm run dev -- -p 3001` | Dev server on port 3001 |
| `frontend/`, `admin/` | `npm run build` then `npm start` | Production build and server |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin pages return **401** | The API cannot verify the admin token | Check `ADMIN_CLERK_SECRET_KEY` belongs to the **MediCare Admin** app and matches the admin's publishable key, then restart the API |
| Admin pages return **403** "Admin access only" | The user has no admin role | Add `{ "role": "admin" }` to the user's **Public** metadata in the MediCare Admin app, then sign out and in |
| Doctor pages return "Server Error" or 401 | Missing or old doctor token, or `JWT_SECRET` not set | Set `JWT_SECRET`, restart, and log in as the doctor again |
| Stripe error: `Invalid currency: ₦` | `PAYMENT_CURRENCY` holds a symbol | Set `PAYMENT_CURRENCY=ngn` and restart |
| Stripe error: `payment_method_types is no longer supported` | Old Checkout code | Remove `payment_method_types` from the session call and enable Cards in the Stripe Dashboard |
| `next/image` says the hostname is not configured | Cloudinary is not in `next.config.js` | Add `res.cloudinary.com` to `images.remotePatterns` and restart the dev server |
| Signed out repeatedly, or pages keep reloading in dev | Two Clerk apps share `localhost` cookies | Use separate browsers or profiles, or open the admin at `127.0.0.1` |
| CORS error in the browser | The origin is not allowed | Add it to `FRONTEND_URL` or `ADMIN_URL` in `backend/.env` |
| Paid online but still Pending | The patient never reached the success page | Make sure the four Stripe return routes exist in the frontend |
| "This slot is already booked" for a free slot | Time stored in a different format | Keep slot times in `hh:mm AM/PM` form, for example `09:00 AM` |

---

## Known limitations

- Updating or cancelling a doctor appointment checks that the caller is signed in as a patient, doctor or admin, but not that the appointment belongs to them.
- Payment confirmation happens when the patient returns from Stripe. A Stripe webhook would also catch patients who pay and then close the tab.
- Cancelling a paid online booking does not issue a refund.
- Service slots have no capacity limit, so several patients can book the same slot.
- Appointment slot checks compare exact text, so `9:00 AM` and `09:00 AM` are treated as different times.

---

## Security notes

- Never commit `.env` files or secret keys.
- Use test keys for Clerk and Stripe in development, and switch to production instances and live keys before launch.
- Keep `ADMIN_CLERK_SECRET_KEY` and `JWT_SECRET` private, and use a long random `JWT_SECRET`.
- Restrict sign-ups in the **MediCare Admin** Clerk app.
- Review public responses such as `GET /api/doctors` so they never expose private fields like email addresses.
- Serve all three apps over HTTPS in production and limit CORS to your real domains.

---

## Author

Chima Bright