import express from "express";
import {
  searchUsers,
  getFriends,
  getFriendRequests,
  getSentFriendRequests,
  getRecommendedFriends,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriendUser,
  getFriendDetail,
} from "../controllers/friendController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua routes butuh authentication
router.use(authenticateUser);

// GET /api/friends/search?query=nama
router.get("/search", searchUsers);

// ✅ NEW: GET /api/friends/recommendations - rekomendasi teman
router.get("/recommendations", getRecommendedFriends);

// GET /api/friends - daftar teman
router.get("/", getFriends);

// GET /api/friends/requests - friend requests yang masuk
router.get("/requests", getFriendRequests);

// ✅ NEW: GET /api/friends/sent-requests - friend requests yang dikirim
router.get("/sent-requests", getSentFriendRequests);

// ✅ NEW: GET /api/friends/:friendId - detail teman
router.get("/:friendId", getFriendDetail);

// POST /api/friends/request - kirim friend request
router.post("/request", sendFriendRequest);

// ✅ NEW: DELETE /api/friends/cancel-request - batalkan friend request
router.delete("/cancel-request", cancelFriendRequest);

// PUT /api/friends/accept - terima friend request
router.put("/accept", acceptFriendRequest);

// DELETE /api/friends/reject - tolak friend request
router.delete("/reject", rejectFriendRequest);

// DELETE /api/friends/unfriend - unfriend user
router.delete("/unfriend", unfriendUser);

export default router;
