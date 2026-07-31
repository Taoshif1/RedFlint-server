import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} from "../controllers/cartController.js";

const router = Router();

router.get("/", verifyJWT, getCart);

router.post("/", verifyJWT, addToCart);

router.patch("/:id", verifyJWT, updateCartQuantity);

router.delete("/:id", verifyJWT, removeFromCart);

router.delete("/", verifyJWT, clearCart);

export default router;
