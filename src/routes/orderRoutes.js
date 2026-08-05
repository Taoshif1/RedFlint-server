import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  createOrder,
  getMyOrders,
  getSingleOrder,
  getMyOrderById,
} from "../controllers/orderController.js";

const router = Router();

router.post("/", verifyJWT, createOrder);

router.get("/", verifyJWT, getMyOrders);

// router.get("/admin", verifyJWT, getAllOrders);

router.get("/:id", verifyJWT, getMyOrderById);

// router.patch("/:id/payment", verifyJWT, verifyPayment);

// router.patch("/:id/status", verifyJWT, updateOrderStatus);

export default router;
