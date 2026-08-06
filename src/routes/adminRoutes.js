import { Router } from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

import {
  getAllOrders,
  verifyPayment,
  updateOrderStatus,
  getAllUsers,
  updateUserRole,
  toggleUserBlock,
} from "../controllers/adminController.js";

const router = Router();

router.use(verifyJWT, verifyAdmin);

router.get("/orders", getAllOrders);

router.get("/users", getAllUsers);

router.patch("/users/:id/role", updateUserRole);

router.patch("/users/:id/block", toggleUserBlock);

router.patch("/orders/:id/payment", verifyPayment);

router.patch("/orders/:id/status", updateOrderStatus);

export default router;
