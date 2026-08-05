import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getAddresses,
  addAddress,
  deleteAddress,
} from "../controllers/addressController.js";

const router = Router();

router.get("/:email", verifyJWT, getAddresses);

router.post("/:email", verifyJWT, addAddress);

router.delete("/:email/:id", verifyJWT, deleteAddress);

export default router;
