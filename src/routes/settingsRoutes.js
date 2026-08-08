import { Router } from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

import {
  getSettings,
  updateSettings,
} from "../controllers/settingsController.js";

const router = Router();

router.get("/", getSettings);

router.patch("/", verifyJWT, verifyAdmin, updateSettings);

export default router;
