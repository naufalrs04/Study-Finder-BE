import express from "express";
import { sign_in, sign_up, getMe } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/sign_in
router.post("/sign_in", sign_in);

// POST /api/auth/sign_up
router.post("/sign_up", sign_up);

// GET /api/auth/me
router.get("/me", authenticate, getMe); // Pastikan baris ini tersedia

export default router;
