import { Router } from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

import {
  getAllOrders,
  verifyPayment,
  updateOrderStatus,
} from "../controllers/adminController.js";

const router = Router();

router.use(verifyJWT, verifyAdmin);

router.get("/orders", getAllOrders);

router.patch("/orders/:id/payment", verifyPayment);

router.patch("/orders/:id/status", updateOrderStatus);

export default router;
