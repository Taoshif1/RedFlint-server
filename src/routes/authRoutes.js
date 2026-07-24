import { Router } from "express";
import { createJWT, logout } from "../controllers/authController.js";

const router = Router();

router.post("/jwt", createJWT);
router.post("/logout", logout);

export default router;
