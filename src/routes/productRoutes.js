import { Router } from "express";

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSpecialEditionProducts,
} from "../controllers/productController.js";

const router = Router();

router.get("/", getProducts);

router.get("/special-edition", getSpecialEditionProducts);

router.get("/:id", getProductById);

router.post("/", createProduct);

router.patch("/:id", updateProduct);

router.delete("/:id", deleteProduct);

export default router;
