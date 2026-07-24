# 🔥 RedFlint Server

Backend API for the **RedFlint E-Commerce Platform**.

Built with:

- Express.js
- MongoDB Atlas
- JWT Authentication
- Firebase Authentication (Client)
- Cookie-Based Authorization

---

# 👨‍💻 Developers

- **Taoshif**
- **Taufiqur**
- **Pias**

---

# 📦 Tech Stack

- Express.js
- MongoDB Atlas
- JWT
- Cookie Parser
- CORS
- Dotenv
- Nodemon

---

# 📁 Project Structure

```bash
server
├── src
│   ├── config
│   │   ├── database.js
│   │   └── mongodb.js
│   │
│   ├── controllers
│   │   ├── authController.js
│   │   └── userController.js
│   │
│   ├── middleware
│   │   └── verifyJWT.js
│   │
│   ├── routes
│   │   ├── authRoutes.js
│   │   └── userRoutes.js
│   │
│   ├── utils
│   │   └── generateToken.js
│   │
│   └── server.js
│
├── .env
├── package.json
└── README.md
```

---

# ⚙️ Installation

Clone the repository

```bash
git clone <repository-url>
```

Move into the project

```bash
cd server
```

Install dependencies

```bash
npm install
```

Create a `.env` file.

Example:

```env
PORT=3000

CLIENT_URL=http://localhost:5173

DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password

JWT_SECRET=your_super_secret_key
```

Run the development server

```bash
npm run dev
```

---

# 🌐 Server

Default

```
http://localhost:3000
```

Health Check

```
GET /
```

Response

```
🔥 RedFlint Server Running...
```

---

# 🗄 Database

Database

```
redflintdb
```

Current Collections

```
users
products
carts
orders
wishlist
```

---

# 🔐 Authentication Flow

Authentication uses **Firebase Authentication** on the frontend.

After successful Firebase login/register:

```
Firebase Login/Register
        │
        ▼
POST /api/auth/jwt
        │
        ▼
JWT Cookie Created
        │
        ▼
Protected API Access
```

JWT is stored as an **HTTP Only Cookie**.

---

# 🔑 API Endpoints

## Authentication

### Create JWT

```
POST /api/auth/jwt
```

Body

```json
{
  "email": "user@gmail.com",
  "uid": "firebase_uid"
}
```

---

### Logout

```
POST /api/auth/logout
```

Clears JWT cookie.

---

# 👤 User Routes

## Create User

```
POST /api/users
```

Body

```json
{
  "uid": "firebase_uid",
  "name": "John Doe",
  "email": "john@gmail.com",
  "photoURL": "...",
  "role": "customer"
}
```

If user already exists, no duplicate is created.

---

## Get User By Email

```
GET /api/users/:email
```

Protected Route

Requires JWT.

---

## Update User

```
PATCH /api/users/:email
```

Protected Route

Requires JWT.

Example

```json
{
  "name": "Updated Name",
  "photoURL": "..."
}
```

---

## Update Last Login

```
PATCH /api/users/login/:email
```

Protected Route

Automatically updates

```
lastLogin
```

---

# 🛡 Protected Routes

Protected routes use

```
verifyJWT
```

Middleware.

Current protected routes

- Get User
- Update User
- Update Last Login

---

# 👥 User Schema

```json
{
  "_id": "ObjectId",
  "uid": "firebase_uid",
  "name": "John Doe",
  "email": "john@gmail.com",
  "photoURL": "...",
  "role": "customer",
  "createdAt": "Date",
  "lastLogin": "Date"
}
```

---

# 🔒 Security

- HTTP Only Cookies
- JWT Authentication
- CORS Enabled
- Cookie Parser
- Environment Variables
- Protected User Routes
- Duplicate User Prevention

---

# 📌 Current Progress

## ✅ Completed

- Express Server
- MongoDB Atlas Connection
- Database Configuration
- JWT Generation
- JWT Middleware
- Cookie Authentication
- User Creation
- Get User
- Update User
- Update Last Login
- User Collections
- Route Separation
- Controller Separation
- Environment Configuration

---

## 🚧 Upcoming

- Product API
- Cart API
- Wishlist API
- Order API
- Admin Dashboard API
- Admin Middleware
- Product Search
- Category Management
- Review System
- Payment Integration

---

# 📜 Scripts

Development

```bash
npm run dev
```

Production

```bash
npm start
```

---

# 📦 Dependencies

Runtime

- express
- mongodb
- cors
- dotenv
- jsonwebtoken
- cookie-parser

Development

- nodemon

---

# 📄 License

This project is developed for the **CSE412 Software Engineering Course Project** at **East West University**.

Developed by the RedFlint Team.
