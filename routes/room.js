import express from "express";
import {
  getPublicRooms,
  createRoom,
  joinRoom,
  joinRoomByCode,
  leaveRoom,
  closeRoom,
  getRoomDetails,
  getRoomMembers,
  getCurrentRoom,
} from "../controllers/roomController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua routes butuh authentication
router.use(authenticateUser);

// GET /api/rooms/current - get current user's active room
router.get("/current", getCurrentRoom);

// GET /api/rooms/public - daftar room public
router.get("/public", getPublicRooms);

// POST /api/rooms - buat room baru
router.post("/", createRoom);

// POST /api/rooms/:roomId/join - join room by ID
router.post("/:roomId/join", joinRoom);

// POST /api/rooms/join-code - join room by code
router.post("/join-code", joinRoomByCode);

// POST /api/rooms/leave - keluar dari room
router.post("/leave", leaveRoom);

// POST /api/rooms/:roomId/close - tutup room (hanya creator)
router.post("/:roomId/close", closeRoom);

// GET /api/rooms/:roomId - detail room
router.get("/:roomId", getRoomDetails);

// GET /api/rooms/:roomId/members - members room
router.get("/:roomId/members", getRoomMembers);

export default router;
