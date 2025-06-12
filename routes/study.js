<<<<<<< HEAD
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
=======
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
>>>>>>> 69271a58bfd2aa1811215f7da7a61e74bf2da424
