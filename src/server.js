import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import client from "./config/mongodb.js";
import { ordersCollection, productsCollection } from "./config/database.js";

import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.LIVE_CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reviews", reviewRoutes);

app.get("/", (req, res) => {
  res.send("🔥 RedFlint Server Running...");
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    await Promise.all([
      ordersCollection.createIndex(
        { orderNumber: 1 },
        { unique: true, sparse: true },
      ),
      ordersCollection.createIndex(
        { "payment.transactionId": 1 },
        { unique: true, sparse: true },
      ),
      productsCollection.createIndex({ createdAt: -1, _id: -1 }),
      productsCollection.createIndex({
        isFeatured: 1,
        createdAt: -1,
        _id: -1,
      }),
      productsCollection.createIndex({
        isSpecial: 1,
        createdAt: -1,
        _id: -1,
      }),
    ]);

    console.log("✅ Connected to MongoDB Atlas");
    console.log("✅ Production indexes ready");
  } catch (error) {
    console.error("MongoDB startup error:", error);
  }
}

run().catch(console.error);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
