import { Router } from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

import {
  createReview,
  getProductReviews,
  getFeaturedReviews,
  getAllReviews,
  updateReviewStatus,
  deleteReview,
} from "../controllers/reviewController.js";

const router = Router();

// ======================================
// Public
// ======================================

router.get("/featured", getFeaturedReviews);

router.get("/product/:productId", getProductReviews);

// Verified purchase,
// but login is not required because
// guest customers must also be able to review.
router.post("/", createReview);

// ======================================
// Admin
// ======================================

router.get("/admin/all", verifyJWT, verifyAdmin, getAllReviews);

router.patch("/admin/:id/status", verifyJWT, verifyAdmin, updateReviewStatus);

router.delete("/admin/:id", verifyJWT, verifyAdmin, deleteReview);

export default router;
