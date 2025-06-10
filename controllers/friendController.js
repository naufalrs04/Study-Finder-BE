import db from "../config/db.js";

// Get current user data (yang sudah ada - diperbaiki)
export const getUser = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, learning_style FROM users WHERE id = ?",
      [req.user.id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Search users untuk fitur pencarian teman
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query; // Ambil dari query parameter ?query=nama
    const currentUserId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        message: "Query pencarian minimal 2 karakter",
      });
    }

    // Search users berdasarkan nama, exclude user yang sedang login
    const [rows] = await db.execute(
      `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.learning_style,
        u.profile_picture,
        u.created_at,
        CASE 
          WHEN f.status = '1' THEN 'friend'
          WHEN f.status = '0' AND f.requester_id = ? THEN 'request_sent'
          WHEN f.status = '0' AND f.receiver_id = ? THEN 'request_received'
          ELSE 'not_friend'
        END as friendship_status
      FROM users u
      LEFT JOIN friendships f ON (
        (f.requester_id = ? AND f.receiver_id = u.id) OR 
        (f.receiver_id = ? AND f.requester_id = u.id)
      )
      WHERE u.name LIKE ? 
      AND u.id != ?
      ORDER BY u.name ASC
      LIMIT 20
    `,
      [
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        `%${query}%`,
        currentUserId,
      ]
    );

    res.json({
      users: rows,
      query: query,
    });
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get daftar teman yang sudah diterima
export const getFriends = async (req, res) => {
  try {
    console.log("req.user di getFriends:", req.user); // ← ini penting

    const currentUserId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_picture,
        u.learning_style,
        f.created_at as friend_since,
        '1' as status
      FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = ? AND f.receiver_id = u.id) OR 
        (f.receiver_id = ? AND f.requester_id = u.id)
      )
      WHERE f.status = '1'
      AND u.id != ?
      ORDER BY u.name ASC
    `,
      [currentUserId, currentUserId, currentUserId]
    );

    res.json({ friends: rows });
  } catch (err) {
    console.error("Error getting friends:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get friend requests yang masuk
export const getFriendRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_picture,
        u.learning_style,
        f.id as request_id,
        f.created_at as requested_at,
        '0' as status
      FROM users u
      INNER JOIN friendships f ON f.requester_id = u.id
      WHERE f.receiver_id = ? 
      AND f.status = '0'
      ORDER BY f.created_at DESC
    `,
      [currentUserId]
    );

    res.json({ requests: rows });
  } catch (err) {
    console.error("Error getting friend requests:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Send friend request
export const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({
        message: "Tidak bisa mengirim permintaan ke diri sendiri",
      });
    }

    // Cek apakah user yang dituju ada
    const [targetUser] = await db.execute("SELECT id FROM users WHERE id = ?", [
      userId,
    ]);

    if (targetUser.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // Cek apakah sudah ada friendship request
    const [existingFriendship] = await db.execute(
      `
      SELECT id, status FROM friendships 
      WHERE (requester_id = ? AND receiver_id = ?) 
      OR (requester_id = ? AND receiver_id = ?)
    `,
      [currentUserId, userId, userId, currentUserId]
    );

    if (existingFriendship.length > 0) {
      const status = existingFriendship[0].status;
      if (status === "1") {
        return res.status(400).json({ message: "Sudah berteman" });
      } else if (status === "0") {
        return res.status(400).json({ message: "Permintaan sudah dikirim" });
      }
    }

    // Insert friend request
    await db.execute(
      `
      INSERT INTO friendships (requester_id, receiver_id, status, created_at) 
      VALUES (?, ?, '0', NOW())
    `,
      [currentUserId, userId]
    );

    res.json({ message: "Permintaan pertemanan berhasil dikirim" });
  } catch (err) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Accept friend request
export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const currentUserId = req.user.id;

    // Update status menjadi 1
    const [result] = await db.execute(
      `
      UPDATE friendships 
      SET status = '1', last_edited_at = NOW()
      WHERE id = ? AND receiver_id = ? AND status = '0'
    `,
      [requestId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Permintaan pertemanan tidak ditemukan",
      });
    }

    res.json({ message: "Permintaan pertemanan diterima" });
  } catch (err) {
    console.error("Error accepting friend request:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reject friend request
export const rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const currentUserId = req.user.id;

    // Delete friendship request
    const [result] = await db.execute(
      `
      DELETE FROM friendships 
      WHERE id = ? AND receiver_id = ? AND status = '0'
    `,
      [requestId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Permintaan pertemanan tidak ditemukan",
      });
    }

    res.json({ message: "Permintaan pertemanan ditolak" });
  } catch (err) {
    console.error("Error rejecting friend request:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const unfriendUser = async (req, res) => {
  const { userId } = req.body; // ✅ Ambil userId
  const currentUserId = req.user.id;

  // Delete friendship record
  const [result] = await db.execute(
    `
    DELETE FROM friendships 
    WHERE ((requester_id = ? AND receiver_id = ?) 
    OR (requester_id = ? AND receiver_id = ?))
    AND status = '1'
  `,
    [currentUserId, userId, userId, currentUserId]
  );

  res.json({ success: true, message: "Unfriend berhasil" });
};
