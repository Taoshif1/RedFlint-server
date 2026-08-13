import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { ensureDatabaseReady } from "./config/databaseReady.js";

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

app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.LIVE_CLIENT_URL,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

const createLimiter = (max, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).send({
        success: false,
        message,
      }),
  });

const apiLimiter = createLimiter(
  300,
  "Too many requests. Please wait a few minutes and try again.",
);
const authLimiter = createLimiter(
  30,
  "Too many authentication attempts. Please try again later.",
);
const orderLimiter = createLimiter(
  60,
  "Too many order requests. Please wait and try again.",
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin?.replace(/\/$/, "");

      if (!origin || allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.send({ success: true, service: "redflint-server" });
});

app.use("/api", async (req, res, next) => {
  try {
    await ensureDatabaseReady();
    return next();
  } catch (error) {
    console.error("Database unavailable:", error);

    return res.status(503).send({
      success: false,
      message: "Service temporarily unavailable.",
    });
  }
});

app.use("/api/users", userRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderLimiter, orderRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reviews", reviewRoutes);

app.get("/", (req, res) => {
  res.send("🔥 RedFlint Server Running...");
});

app.use((req, res) => {
  res.status(404).send({
    success: false,
    message: "Route not found.",
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled request error:", error.message);

  if (res.headersSent) return next(error);

  return res.status(error.type === "entity.too.large" ? 413 : 400).send({
    success: false,
    message:
      error.type === "entity.too.large"
        ? "Request body is too large."
        : "Invalid request.",
  });
});

ensureDatabaseReady()
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
    console.log("✅ Production indexes ready");
  })
  .catch((error) => {
    console.error("MongoDB startup error:", error);
  });

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
