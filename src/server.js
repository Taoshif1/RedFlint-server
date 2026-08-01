import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import client from "./config/mongodb.js";
import { usersCollection } from "./config/database.js";

import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
// import verifyJWT from "./middleware/verifyJWT.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ====================================
// Middleware
// ====================================

const allowedOrigins = [process.env.CLIENT_URL, process.env.LIVE_CLIENT_URL];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman, mobile apps, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// ====================================
// Routes
// ====================================

app.use("/api/users", userRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/products", productRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/wishlist", wishlistRoutes);

app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => {
  res.send("🔥 RedFlint Server Running...");
});

// Test Route

// app.get("/users", verifyJWT, async (req, res) => {
//   const users = await usersCollection.find().toArray();
//   res.send(users);
// });

// ====================================
// MongoDB Connection
// ====================================

async function run() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });

    console.log("✅ Connected to MongoDB Atlas");
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.error);

// ====================================
// Start Server
// ====================================

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
