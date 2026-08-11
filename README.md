# RedFlint Server

Express + MongoDB backend for the RedFlint premium menswear e-commerce platform.

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
- Nodemon for local development

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

Default local server:

```text
http://localhost:3000
```

Health check:

```text
GET /
```

Response:

```text
🔥 RedFlint Server Running...
```

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

### Notes

- `FIREBASE_API_KEY` is the Firebase Web API key used by the server to validate submitted Firebase ID tokens through Firebase Identity Toolkit.
- `JWT_SECRET`, `DB_USER` and `DB_PASS` are server-only values and must never be placed in the frontend repository.
- `CLIENT_URL` and `LIVE_CLIENT_URL` must match browser origins exactly for credentialed CORS requests.
- In production the JWT cookie uses `secure: true` and `sameSite: "none"`.

## Authentication Flow

```text
Firebase login/register in browser
        ↓
Firebase ID token
        ↓
POST /api/auth/jwt
        ↓
Server verifies the Firebase token
        ↓
Server signs RedFlint JWT with verified email + uid
        ↓
JWT stored as HttpOnly cookie
        ↓
verifyJWT protects customer/admin APIs
        ↓
verifyAdmin checks MongoDB role for Admin APIs
```

The server does **not** trust a browser-submitted email, UID or role when creating the authenticated identity.

## User Provisioning Security

`POST /api/users` is protected by `verifyJWT`.

The authenticated Firebase identity supplies `email` and `uid` through the verified JWT. The request may provide display fields such as name, phone and photo URL, but the server always creates a new public user as:

```json
{
  "role": "customer",
  "isBlocked": false
}
```

Admin promotion is handled only through protected Admin APIs.

Blocked users are rejected by `verifyJWT` on protected API requests.

## Database

Database name:

```text
redflintdb
```

Collections:

```text
users
products
carts
orders
wishlist
settings
reviews
```

At startup the server creates unique sparse indexes for:

```text
orders.orderNumber
orders.payment.transactionId
```

These protect order references and payment transaction IDs from duplicate races.

## Product Inventory Model

Preferred product inventory structure:

```json
{
  "sizes": [
    { "size": "M", "stock": 10 },
    { "size": "L", "stock": 8 },
    { "size": "XL", "stock": 7 }
  ],
  "totalStock": 25
}
```

When object-based sizes are submitted, the backend normalizes stock values and recalculates `totalStock` from the size inventory.

Legacy string-based size documents are still supported during checkout so older products do not immediately break.

## Atomic Checkout / Concurrent Stock

Order creation uses a MongoDB transaction.

For per-size inventory the stock update is conditional on:

```text
selected size stock >= requested quantity
```

The same transaction contains:

1. Maintenance Mode check
2. Product/size validation
3. Current server-side price lookup
4. Payment transaction-ID validation
5. Atomic inventory reservation
6. Order insertion
7. Registered cart cleanup when applicable

If two customers attempt to buy the final unit concurrently, only the first successful conditional stock update can reserve it. The losing transaction is rolled back and receives a sold-out/not-enough-stock response.

If any product in a multi-product checkout fails, the entire transaction rolls back so earlier products are not partially deducted.

## Cancellation and Inventory Restoration

Stock is reserved when the order is created.

When Admin changes a non-delivered order to `Cancelled`, the backend restores the reserved stock inside a transaction and marks:

```json
{
  "inventoryReleased": true
}
```

This prevents the same cancelled order from restoring stock twice.

Cancelled orders cannot be reopened through normal order management, and delivered orders cannot be cancelled through that endpoint.

## Maintenance Mode

Store settings contain:

```json
{
  "maintenanceMode": false
}
```

When enabled, new guest and registered order creation is rejected server-side even if someone bypasses the frontend maintenance screen.

The frontend separately hides customer-facing functionality while keeping Admin login/management available.

## Orders

Customer-facing order numbers use:

```text
RF-YYYYMMDD-RANDOMHEX
```

The backend stores immutable order-time product snapshots including title, image, selected size, quantity, unit price and line total.

### Order statuses

```text
Pending
Processing
Shipped
Delivered
Cancelled
```

### Payment statuses

```text
Pending
Verified
```

Supported payment method identifiers:

```text
bkash
nagad
rocket
```

## Public Order Tracking

```text
POST /api/orders/track
```

Requires:

```json
{
  "orderNumber": "RF-...",
  "phone": "01XXXXXXXXX"
}
```

The public response intentionally excludes private delivery address, email and transaction ID data.

Old MongoDB order IDs are still accepted by tracking for backward compatibility.

## Reviews

Review submission is public and intentionally simple:

```json
{
  "productId": "...",
  "customerName": "Customer Name",
  "rating": 5,
  "comment": "Great product"
}
```

New reviews start as:

```text
pending
```

Admin can change them to:

```text
approved
rejected
```

Only approved reviews are returned publicly. Featured Home reviews are approved reviews rated 4 stars or higher.

## API Route Summary

### Authentication

```text
POST /api/auth/jwt
POST /api/auth/logout
```

### Users

```text
POST  /api/users
GET   /api/users/:email
PATCH /api/users/:email
PATCH /api/users/login/:email
```

### Products

```text
GET    /api/products
GET    /api/products/featured
GET    /api/products/special-edition
GET    /api/products/:id
POST   /api/products              Admin
PATCH  /api/products/:id          Admin
DELETE /api/products/:id          Admin
```

### Cart

```text
GET    /api/cart
POST   /api/cart
PATCH  /api/cart/:id
DELETE /api/cart/:id
DELETE /api/cart
```

### Wishlist

```text
GET    /api/wishlist
POST   /api/wishlist
DELETE /api/wishlist/:id
```

### Orders

```text
POST /api/orders/guest
POST /api/orders/track
POST /api/orders
GET  /api/orders
GET  /api/orders/:id
```

### Addresses

```text
GET    /api/addresses/:email
POST   /api/addresses/:email
DELETE /api/addresses/:email/:id
```

### Settings

```text
GET   /api/settings
PATCH /api/settings               Admin
```

### Reviews

```text
GET    /api/reviews/featured
GET    /api/reviews/product/:productId
POST   /api/reviews
GET    /api/reviews/admin/all                 Admin
PATCH  /api/reviews/admin/:id/status          Admin
DELETE /api/reviews/admin/:id                 Admin
```

### Admin

Admin routes cover order management, payment verification, user management, role updates, account blocking and Admin profile management.

## Scripts

```bash
npm run dev
npm start
```

The repository currently does not include an automated backend test suite, so production releases should include API and end-to-end testing from the client.

## Deployment Checklist

1. Configure MongoDB credentials.
2. Configure a strong `JWT_SECRET`.
3. Configure `FIREBASE_API_KEY`.
4. Set exact local/production CORS origins.
5. Ensure MongoDB Atlas connectivity is allowed from the deployment platform.
6. Confirm startup indexes are created successfully.
7. Verify the frontend uses the production server origin.
8. Test Firebase login → server JWT cookie → protected API access.
9. Test atomic stock behavior with a controlled low-stock product.
10. Test cancellation restores stock exactly once.
11. Test Maintenance Mode blocks order creation.

## Project Structure

```text
src/
├── config/
├── controllers/
├── middleware/
├── routes/
├── utils/
└── server.js
```

## Client

Frontend repository:

`Taoshif1/RedFlint-client`

## Developers

- Taoshif
- Taufiqur
- Pias

Developed as the RedFlint e-commerce project.