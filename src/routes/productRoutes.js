import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSpecialEditionProducts,
  getFeaturedProducts,
} from "../controllers/productController.js";

const router = Router();

router.get("/", getProducts);

// Specific routes must stay above /:id
router.get("/featured", getFeaturedProducts);
router.get("/special", getSpecialEditionProducts);
router.get("/special-edition", getSpecialEditionProducts);

router.get("/:id", getProductById);

router.post("/", verifyJWT, verifyAdmin, createProduct);
router.patch("/:id", verifyJWT, verifyAdmin, updateProduct);
router.delete("/:id", verifyJWT, verifyAdmin, deleteProduct);

export default router;
