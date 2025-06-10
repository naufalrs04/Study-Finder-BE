import express from "express";
import {
  add,
  getActiveSession,
  endSession,
} from "../controllers/studyController.js";

const router = express.Router();

router.post("/add", add); // Mulai sesi baru
router.get("/active/:userId", getActiveSession); // Cek sesi aktif
router.post("/end", endSession); // Akhiri sesi

export default router;
