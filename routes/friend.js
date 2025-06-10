import express from "express";
import {
  searchUsers,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriendUser,
} from "../controllers/friendController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua routes butuh authentication
router.use(authenticateUser);

// GET /api/friends/search?query=nama
router.get("/search", searchUsers);

// GET /api/friends - daftar teman
router.get("/", getFriends);

// GET /api/friends/requests - friend requests yang masuk
router.get("/requests", getFriendRequests);

// POST /api/friends/request - kirim friend request
router.post("/request", sendFriendRequest);

// PUT /api/friends/accept - terima friend request
router.put("/accept", acceptFriendRequest);

// DELETE /api/friends/reject - tolak friend request
router.delete("/reject", rejectFriendRequest);

router.delete("/unfriend", unfriendUser);

export default router;
