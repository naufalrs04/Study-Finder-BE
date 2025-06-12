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

// ✅ NEW: Get rekomendasi teman berdasarkan learning style yang sama
export const getRecommendedFriends = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get current user's learning style
    const [currentUserData] = await db.execute(
      "SELECT learning_style FROM users WHERE id = ?",
      [currentUserId]
    );

    if (currentUserData.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const userLearningStyle = currentUserData[0].learning_style;

    // Get recommended users with same learning style
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
      WHERE u.learning_style = ? 
      AND u.id != ?
      AND (f.status IS NULL OR f.status != '1')
      ORDER BY u.created_at DESC
      LIMIT 10
    `,
      [
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        userLearningStyle,
        currentUserId,
      ]
    );

    res.json({
      recommendations: rows,
      learning_style: userLearningStyle,
    });
  } catch (err) {
    console.error("Error getting recommended friends:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get daftar teman yang sudah diterima dengan aktivitas study session
export const getFriends = async (req, res) => {
  try {
    console.log("req.user di getFriends:", req.user);

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
        '1' as status,
        ss.title as current_study_title,
        ss.start_time as study_start_time,
        ss.end_time as study_end_time,
        CASE 
          WHEN ss.end_time IS NULL AND ss.start_time IS NOT NULL THEN 1
          ELSE 0
        END as is_currently_studying
      FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = ? AND f.receiver_id = u.id) OR 
        (f.receiver_id = ? AND f.requester_id = u.id)
      )
      LEFT JOIN study_sessions ss ON (
        ss.user_id = u.id 
        AND ss.end_time IS NULL 
        AND ss.start_time > DATE_SUB(NOW(), INTERVAL 1 DAY)
      )
      WHERE f.status = '1'
      AND u.id != ?
      ORDER BY is_currently_studying DESC, u.name ASC
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

// ✅ NEW: Get sent friend requests (yang kita kirim ke orang lain)
export const getSentFriendRequests = async (req, res) => {
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
      INNER JOIN friendships f ON f.receiver_id = u.id
      WHERE f.requester_id = ? 
      AND f.status = '0'
      ORDER BY f.created_at DESC
    `,
      [currentUserId]
    );

    res.json({ sent_requests: rows });
  } catch (err) {
    console.error("Error getting sent friend requests:", err);
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

// ✅ NEW: Cancel/batalkan friend request yang sudah dikirim
export const cancelFriendRequest = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    // Delete friendship request yang kita kirim
    const [result] = await db.execute(
      `
      DELETE FROM friendships 
      WHERE requester_id = ? AND receiver_id = ? AND status = '0'
    `,
      [currentUserId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Permintaan pertemanan tidak ditemukan atau sudah diproses",
      });
    }

    res.json({ message: "Permintaan pertemanan berhasil dibatalkan" });
  } catch (err) {
    console.error("Error canceling friend request:", err);
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
  try {
    const { userId } = req.body;
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

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Pertemanan tidak ditemukan",
      });
    }

    res.json({ success: true, message: "Unfriend berhasil" });
  } catch (err) {
    console.error("Error unfriending user:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: Get friend detail dengan study statistics
export const getFriendDetail = async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.user.id;

    // Cek apakah mereka berteman
    const [friendshipCheck] = await db.execute(
      `
      SELECT f.status FROM friendships f
      WHERE ((f.requester_id = ? AND f.receiver_id = ?) 
      OR (f.receiver_id = ? AND f.requester_id = ?))
      AND f.status = '1'
    `,
      [currentUserId, friendId, currentUserId, friendId]
    );

    if (friendshipCheck.length === 0) {
      return res.status(403).json({
        message: "Anda tidak berteman dengan user ini",
      });
    }

    // Get friend detail
    const [friendData] = await db.execute(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_picture,
        u.learning_style,
        u.bio,
        u.interest,
        u.created_at as joined_date,
        f.created_at as friend_since
      FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = ? AND f.receiver_id = u.id) OR 
        (f.receiver_id = ? AND f.requester_id = u.id)
      )
      WHERE u.id = ? AND f.status = '1'
    `,
      [currentUserId, currentUserId, friendId]
    );

    if (friendData.length === 0) {
      return res.status(404).json({ message: "Teman tidak ditemukan" });
    }

    // Get study statistics
    const [studyStats] = await db.execute(
      `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE 
          WHEN end_time IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, start_time, end_time) 
          ELSE 0 
        END) as total_study_minutes,
        COUNT(CASE WHEN DATE(start_time) = CURDATE() THEN 1 END) as today_sessions,
        COUNT(CASE WHEN start_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as week_sessions
      FROM study_sessions 
      WHERE user_id = ?
    `,
      [friendId]
    );

    // Get recent study sessions
    const [recentSessions] = await db.execute(
      `
      SELECT 
        title,
        start_time,
        end_time,
        CASE 
          WHEN end_time IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, start_time, end_time) 
          ELSE NULL 
        END as duration_minutes
      FROM study_sessions 
      WHERE user_id = ?
      ORDER BY start_time DESC
      LIMIT 5
    `,
      [friendId]
    );

    // Get current study session (if any)
    const [currentStudy] = await db.execute(
      `
      SELECT 
        title,
        start_time,
        TIMESTAMPDIFF(MINUTE, start_time, NOW()) as current_duration_minutes
      FROM study_sessions 
      WHERE user_id = ? AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `,
      [friendId]
    );

    const friend = friendData[0];
    const stats = studyStats[0];

    res.json({
      friend: {
        ...friend,
        study_stats: {
          total_sessions: stats.total_sessions || 0,
          total_study_hours:
            Math.round(((stats.total_study_minutes || 0) / 60) * 100) / 100,
          today_sessions: stats.today_sessions || 0,
          week_sessions: stats.week_sessions || 0,
        },
        current_study: currentStudy.length > 0 ? currentStudy[0] : null,
        recent_sessions: recentSessions,
      },
    });
  } catch (err) {
    console.error("Error getting friend detail:", err);
    res.status(500).json({ message: "Server error" });
  }
};
