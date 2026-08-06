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
router.get("/special-edition", getSpecialEditionProducts);

router.get("/:id", getProductById);

router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;