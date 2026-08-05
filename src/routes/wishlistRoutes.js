import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  addToWishlist,
  getWishlist,
  removeWishlist,
} from "../controllers/wishlistController.js";

const router = Router();

router.get("/", verifyJWT, getWishlist);

router.post("/", verifyJWT, addToWishlist);

router.delete("/:id", verifyJWT, removeWishlist);

export default router;
