import { Router } from "express";

import verifyJWT from "../middleware/verifyJWT.js";

import {
  createOrder,
  createGuestOrder,
  trackOrder,
  getMyOrders,
  getMyOrderById,
} from "../controllers/orderController.js";

const router = Router();

// ======================================
// Guest Checkout
// ======================================

// No JWT required
router.post("/guest", createGuestOrder);

// Public order tracking
router.post("/track", trackOrder);

// ======================================
// Registered Customer Checkout
// ======================================

router.post("/", verifyJWT, createOrder);

// ======================================
// Registered Customer Orders
// ======================================

router.get("/", verifyJWT, getMyOrders);

router.get("/:id", verifyJWT, getMyOrderById);

export default router;
