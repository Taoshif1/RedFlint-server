# RedFlint Server

Backend API for **RedFlint**, a production-style menswear e-commerce project in **Gazi Taoshif's commercial development portfolio**.

**Frontend:** https://github.com/Taoshif1/RedFlint-client  
**Live storefront:** https://red-flint-client.vercel.app/  
**Taoshiflex Studio:** https://taoshiflexstudio.me

## Core Responsibilities

- Firebase-verified authentication sessions
- HttpOnly JWT authorization
- Customer/Admin role enforcement
- Blocked-user enforcement
- Product catalog and search APIs
- Per-size inventory management
- Guest and registered carts/orders
- Atomic checkout and stock reservation
- Order tracking
- Payment verification workflow
- Customer address management
- Wishlist APIs
- Store settings and Maintenance Mode
- Review submission and Admin moderation

## Tech Stack

- Node.js
- Express 5
- MongoDB Atlas / MongoDB Node Driver
- JSON Web Token
- Cookie Parser
- CORS
- Dotenv

## Local Setup

```bash
git clone https://github.com/Taoshif1/RedFlint-server.git
cd RedFlint-server
npm install
```

Create `.env` from `.env.example`, then run:

```bash
npm run dev
```

Default local server: `http://localhost:3000`

## Environment Variables

```env
PORT=3000
DB_USER=
DB_PASS=
JWT_SECRET=
FIREBASE_API_KEY=
CLIENT_URL=http://localhost:5173
LIVE_CLIENT_URL=https://your-production-client.vercel.app
```

`JWT_SECRET`, `DB_USER` and `DB_PASS` are server-only values and must never be placed in the frontend repository. Production cookies use `secure: true` and `sameSite: "none"`.

## Authentication Flow

```text
Firebase login/register in browser
        ↓
Firebase ID token
        ↓
POST /api/auth/jwt
        ↓
Server verifies Firebase identity
        ↓
Server signs RedFlint JWT
        ↓
JWT stored as HttpOnly cookie
        ↓
Protected API access
```

The server does not trust a browser-submitted role when creating authenticated identity.

## Database

Database name: `redflintdb`

Collections include:

```text
users
products
carts
orders
wishlist
settings
reviews
```

Unique sparse indexes protect `orders.orderNumber` and `orders.payment.transactionId` against duplicate races.

## Atomic Checkout and Inventory

Order creation uses a MongoDB transaction. The transaction includes:

1. Maintenance Mode check
2. Product and size validation
3. Current server-side price lookup
4. Payment transaction-ID validation
5. Atomic inventory reservation
6. Order insertion
7. Registered cart cleanup when applicable

If two customers attempt to buy the final unit concurrently, only one conditional stock update can reserve it. If any product in a multi-product checkout fails, the entire transaction rolls back.

When Admin cancels a non-delivered order, the backend restores reserved stock transactionally and prevents duplicate inventory restoration.

## Public Order Tracking

`POST /api/orders/track`

Requires an order number and checkout phone number. The public response excludes private delivery address, email, and transaction-ID data.

## Reviews

New public reviews start as `pending`. Admin can approve or reject them. Only approved reviews are returned publicly.

## API Areas

The API provides routes for:

- Authentication
- Users
- Products
- Cart
- Wishlist
- Orders and tracking
- Addresses
- Settings
- Reviews
- Admin order/payment/user management

## Scripts

```bash
npm run dev
npm start
```

## Deployment Checklist

1. Configure MongoDB credentials.
2. Configure a strong `JWT_SECRET`.
3. Configure Firebase verification settings.
4. Set exact local and production CORS origins.
5. Ensure MongoDB Atlas connectivity is allowed from the deployment platform.
6. Verify frontend production origin and server integration.
7. Test authentication, stock behavior, cancellation restoration, tracking and Maintenance Mode.

## Contributors

- Gazi Taoshif
- Taufiqur
- Pias

## Work With Gazi Taoshif

For e-commerce systems, business websites, and custom web applications, visit **[Taoshiflex Studio](https://taoshiflexstudio.me)**.
