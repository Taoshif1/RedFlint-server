import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  createOrder,
  getMyOrders,
  getAllOrders,
  verifyPayment,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = Router();

router.post("/", verifyJWT, createOrder);

router.get("/", verifyJWT, getMyOrders);

router.get("/admin", verifyJWT, getAllOrders);

router.patch("/:id/payment", verifyJWT, verifyPayment);

router.patch("/:id/status", verifyJWT, updateOrderStatus);

export default router;
