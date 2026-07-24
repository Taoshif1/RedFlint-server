import { Router } from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  createUser,
  getUserByEmail,
  updateUser,
  updateLastLogin,
} from "../controllers/userController.js";

const router = Router();

router.post("/", createUser);

router.get("/:email", verifyJWT, getUserByEmail);

router.patch("/:email", verifyJWT, updateUser);

router.patch("/login/:email", verifyJWT, updateLastLogin);

export default router;
