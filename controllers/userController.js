import db from "../config/db.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

export const updateLearningStyle = async (req, res) => {
  const { learningStyle } = req.body;

  if (![1, 2, 3].includes(Number(learningStyle))) {
    return res.status(400).json({
      message:
        "learning_style harus bernilai 1 (Auditori), 2 (Visual), atau 3 (Kinestetik)",
    });
  }

  const userId = req.user.id;

  try {
    await db.execute("UPDATE users SET learning_style = ? WHERE id = ?", [
      learningStyle,
      userId,
    ]);

    res.json({ message: "Gaya belajar berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menyimpan gaya belajar" });
  }
};

// Get current user profile with enhanced data
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data with all required fields from database
    const [userRows] = await db.execute(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.bio,
        u.profile_picture,
        u.learning_style,
        u.interest,
        u.current_streak,
        u.highest_streak,
        u.last_study_at,
        u.created_at as joined_at,
        u.last_login_at
      FROM users u
      WHERE u.id = ?
    `,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const user = userRows[0];

    // Parse interests from database
    const parseInterests = (interestField) => {
      if (!interestField) return [];

      try {
        return JSON.parse(interestField);
      } catch {
        return [interestField];
      }
    };

    // Map learning style number to text
    const mapLearningStyle = (styleNumber) => {
      switch (parseInt(styleNumber)) {
        case 1:
          return "Auditori";
        case 2:
          return "Visual";
        case 3:
          return "Kinestetik";
        default:
          return "";
      }
    };

    // Get friend count
    let totalFriends = 0;
    try {
      const [friendRows] = await db.execute(
        `SELECT COUNT(*) as count FROM friendships f 
         WHERE (f.requester_id = ? OR f.receiver_id = ?) 
         AND f.status = '1'`,
        [userId, userId]
      );
      totalFriends = friendRows[0]?.count || 0;
    } catch (err) {
      console.log("Friendships table not found, defaulting friend count to 0");
      totalFriends = 0;
    }

    // Calculate total study hours from study_sessions
    let totalStudyHours = 0;
    try {
      const [studyRows] = await db.execute(
        `SELECT SUM(duration) as total_minutes FROM study_sessions 
         WHERE user_id = ? AND end_time IS NOT NULL`,
        [userId]
      );
      totalStudyHours = Math.floor((studyRows[0]?.total_minutes || 0) / 60);
    } catch (err) {
      console.log(
        "Study sessions table not found, defaulting study hours to 0"
      );
      totalStudyHours = 0;
    }

    // Update streak based on last study date
    await updateUserStreak(userId);

    // Re-fetch user data after streak update
    const [updatedUserRows] = await db.execute(
      `SELECT current_streak, highest_streak, last_study_at FROM users WHERE id = ?`,
      [userId]
    );

    const updatedUser = updatedUserRows[0] || user;

    // FIXED: Proper URL generation
    const generateAvatarUrl = (filename) => {
      if (!filename) return null;

      // Get base URL with fallback
      const baseUrl =
        process.env.BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        `http://localhost:${process.env.PORT || 3001}`;

      // Remove /api if present in base URL for file serving
      const cleanBaseUrl = baseUrl.replace("/api", "");

      return `${cleanBaseUrl}/uploads/avatars/${filename}`;
    };

    // Build response matching frontend expectations
    const profileData = {
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatar: generateAvatarUrl(user.profile_picture),
      learning_style: mapLearningStyle(user.learning_style),
      interests: parseInterests(user.interest),

      // Study statistics
      study_stats: {
        current_streak: updatedUser.current_streak || 0,
        highest_streak: updatedUser.highest_streak || 0,
        total_study_hours: totalStudyHours,
        last_study: updatedUser.last_study_at,
      },

      // Social statistics
      social_stats: {
        total_friends: totalFriends,
      },

      joined_at: user.joined_at,
      last_active: user.last_login_at,
    };

    res.json({
      success: true,
      user: profileData,
    });
  } catch (err) {
    console.error("Error getting user profile:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Helper function to update user streak
const updateUserStreak = async (userId) => {
  try {
    // Get user's last study date and current streak
    const [userRows] = await db.execute(
      `SELECT last_study_at, current_streak, highest_streak FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) return;

    const user = userRows[0];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    let newStreak = user.current_streak || 0;
    let newHighestStreak = user.highest_streak || 0;

    if (user.last_study_at) {
      const lastStudyDate = new Date(user.last_study_at);
      const lastStudyStr = lastStudyDate.toISOString().split("T")[0];

      // Calculate days difference
      const daysDiff = Math.floor(
        (today - lastStudyDate) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 1) {
        // Streak broken - reset to 0
        newStreak = 0;
      }
      // If daysDiff === 1, streak continues
      // If daysDiff === 0, same day - streak remains the same
    }

    // Update user streak
    await db.execute(
      `UPDATE users SET current_streak = ?, highest_streak = ? WHERE id = ?`,
      [newStreak, Math.max(newStreak, newHighestStreak), userId]
    );
  } catch (err) {
    console.error("Error updating user streak:", err);
  }
};

// Get user's friends list
export const getUserFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const [friendRows] = await db.execute(
      `SELECT 
        u.id,
        u.name,
        u.profile_picture,
        f.created_at as friendship_date
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.requester_id = ? THEN u.id = f.receiver_id
          ELSE u.id = f.requester_id
        END
      )
      WHERE (f.requester_id = ? OR f.receiver_id = ?) 
      AND f.status = '1'
      ORDER BY f.created_at DESC`,
      [userId, userId, userId]
    );

    // Generate avatar URLs for friends
    const generateAvatarUrl = (filename) => {
      if (!filename) return null;

      const baseUrl =
        process.env.BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        `http://localhost:${process.env.PORT || 3001}`;

      const cleanBaseUrl = baseUrl.replace("/api", "");
      return `${cleanBaseUrl}/uploads/avatars/${filename}`;
    };

    const friends = friendRows.map((friend) => ({
      id: friend.id,
      name: friend.name,
      avatar: generateAvatarUrl(friend.profile_picture),
      friendship_date: friend.friendship_date,
    }));

    res.json({
      success: true,
      friends: friends,
    });
  } catch (err) {
    console.error("Error getting user friends:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get study statistics for charts
export const getStudyStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get monthly study statistics for the last 6 months
    const [statsRows] = await db.execute(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        DATE_FORMAT(created_at, '%b') as month_name,
        COUNT(*) as sessions,
        SUM(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as total_minutes
      FROM study_sessions 
      WHERE user_id = ? 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
      ORDER BY month DESC
      LIMIT 6`,
      [userId]
    );

    // Transform data for chart
    const stats = statsRows
      .map((stat, index) => ({
        month: stat.month_name,
        sessions: stat.sessions,
        hours: Math.floor(stat.total_minutes / 60),
        value: stat.sessions, // Use sessions for chart value
        color: index % 2 === 0 ? "#B8E6F0" : "#0798C5",
      }))
      .reverse(); // Reverse to show chronological order

    res.json({
      success: true,
      stats: stats,
    });
  } catch (err) {
    console.error("Error getting study stats:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get active study session
export const getActiveSession = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;

    const [sessionRows] = await db.execute(
      `SELECT id, title, start_time, created_at
       FROM study_sessions 
       WHERE user_id = ? AND end_time IS NULL 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (sessionRows.length > 0) {
      res.json({
        success: true,
        session: sessionRows[0],
      });
    } else {
      res.json({
        success: true,
        session: null,
      });
    }
  } catch (err) {
    console.error("Error getting active session:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Start new study session
export const startStudySession = async (req, res) => {
  try {
    const { title, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({
        success: false,
        message: "Title dan userId diperlukan",
      });
    }

    // Check if user has active session
    const [activeSession] = await db.execute(
      `SELECT id FROM study_sessions WHERE user_id = ? AND end_time IS NULL`,
      [userId]
    );

    if (activeSession.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Anda masih memiliki sesi belajar aktif",
      });
    }

    // Create new study session
    const [result] = await db.execute(
      `INSERT INTO study_sessions (user_id, title, start_time, created_at) 
       VALUES (?, ?, NOW(), NOW())`,
      [userId, title]
    );

    res.json({
      success: true,
      message: "Sesi belajar dimulai",
      sessionId: result.insertId,
    });
  } catch (err) {
    console.error("Error starting study session:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// End study session
export const endStudySession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID diperlukan",
      });
    }

    // Get session details
    const [sessionRows] = await db.execute(
      `SELECT user_id, start_time FROM study_sessions WHERE id = ?`,
      [sessionId]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sesi tidak ditemukan",
      });
    }

    const session = sessionRows[0];
    const startTime = new Date(session.start_time);
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / (1000 * 60)); // Duration in minutes

    // End the session
    await db.execute(
      `UPDATE study_sessions 
       SET end_time = NOW(), duration = ? 
       WHERE id = ?`,
      [duration, sessionId]
    );

    // Update user's last study date and streak
    const today = new Date().toISOString().split("T")[0];

    // Get user's last study date
    const [userRows] = await db.execute(
      `SELECT last_study_at, current_streak, highest_streak FROM users WHERE id = ?`,
      [session.user_id]
    );

    if (userRows.length > 0) {
      const user = userRows[0];
      let newStreak = user.current_streak || 0;
      let newHighestStreak = user.highest_streak || 0;

      // Check if this is a new day for studying
      if (
        !user.last_study_at ||
        user.last_study_at.toISOString().split("T")[0] !== today
      ) {
        if (user.last_study_at) {
          const lastStudyDate = new Date(user.last_study_at);
          const daysDiff = Math.floor(
            (new Date(today) - lastStudyDate) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff === 1) {
            // Consecutive day - increment streak
            newStreak += 1;
          } else if (daysDiff > 1) {
            // Gap in days - reset streak to 1
            newStreak = 1;
          }
          // Same day - keep same streak
        } else {
          // First time studying
          newStreak = 1;
        }

        newHighestStreak = Math.max(newStreak, newHighestStreak);

        // Update user
        await db.execute(
          `UPDATE users 
           SET last_study_at = ?, current_streak = ?, highest_streak = ? 
           WHERE id = ?`,
          [today, newStreak, newHighestStreak, session.user_id]
        );
      }
    }

    res.json({
      success: true,
      message: "Sesi belajar selesai",
      duration: duration,
    });
  } catch (err) {
    console.error("Error ending study session:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, interests, learning_style } = req.body;

    console.log("Updating profile for user:", userId, req.body);

    // Validation
    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Bio maksimal 500 karakter",
      });
    }

    if (interests && (!Array.isArray(interests) || interests.length > 10)) {
      return res.status(400).json({
        success: false,
        message: "Maksimal 10 topik favorit",
      });
    }

    if (interests && interests.some((interest) => interest.length > 20)) {
      return res.status(400).json({
        success: false,
        message: "Setiap topik maksimal 20 karakter",
      });
    }

    if (learning_style && ![1, 2, 3].includes(Number(learning_style))) {
      return res.status(400).json({
        success: false,
        message:
          "Learning style harus 1 (Auditori), 2 (Visual), atau 3 (Kinestetik)",
      });
    }

    // Build update query dynamically based on database structure
    const updates = [];
    const values = [];

    if (bio !== undefined) {
      updates.push("bio = ?");
      values.push(bio);
    }

    // Handle interests - store as JSON in 'interest' column
    if (interests !== undefined) {
      updates.push("interest = ?");
      values.push(JSON.stringify(interests));
    }

    if (learning_style !== undefined) {
      updates.push("learning_style = ?");
      values.push(Number(learning_style));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada data yang diupdate",
      });
    }

    // Add last_edited_at (based on database structure)
    updates.push("last_edited_at = NOW()");
    values.push(userId);

    // Execute update
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    const [result] = await db.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    res.json({
      success: true,
      message: "Profil berhasil diupdate",
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Update password
export const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log("Password update request for user:", userId);

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Password saat ini dan password baru diperlukan",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal 6 karakter",
      });
    }

    // Get current password hash
    const [userRows] = await db.execute(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      userRows[0].password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Password saat ini salah",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password - using last_edited_at instead of updated_at
    const [result] = await db.execute(
      "UPDATE users SET password = ?, last_edited_at = NOW() WHERE id = ?",
      [hashedNewPassword, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: "Gagal mengupdate password",
      });
    }

    res.json({
      success: true,
      message: "Password berhasil diubah",
    });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Upload avatar
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("Avatar upload request for user:", userId);
    console.log("Received file:", req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File avatar diperlukan",
      });
    }

    // Verify file was actually saved
    const uploadedFilePath = req.file.path;
    console.log("File saved at:", uploadedFilePath);

    if (!fs.existsSync(uploadedFilePath)) {
      console.error("File was not saved:", uploadedFilePath);
      return res.status(500).json({
        success: false,
        message: "File gagal disimpan",
      });
    }

    // Get current avatar to delete old file
    const [userRows] = await db.execute(
      "SELECT profile_picture FROM users WHERE id = ?",
      [userId]
    );

    const oldAvatar = userRows[0]?.profile_picture;

    // Update database with new avatar filename
    const filename = req.file.filename;
    console.log("Updating database with filename:", filename);

    const [result] = await db.execute(
      "UPDATE users SET profile_picture = ?, last_edited_at = NOW() WHERE id = ?",
      [filename, userId]
    );

    if (result.affectedRows === 0) {
      // Delete uploaded file if database update fails
      console.error("Database update failed, deleting uploaded file");
      fs.unlinkSync(req.file.path);
      return res.status(500).json({
        success: false,
        message: "Gagal mengupdate avatar di database",
      });
    }

    console.log("Database updated successfully");

    // Delete old avatar file if exists
    if (oldAvatar) {
      const oldAvatarPath = path.join(
        process.cwd(),
        "public",
        "uploads",
        "avatars",
        oldAvatar
      );
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
        console.log("Deleted old avatar:", oldAvatarPath);
      }
    }

    // FIXED: Proper URL generation with fallbacks
    const generateAvatarUrl = (filename) => {
      // Multiple fallback options for base URL
      const baseUrl =
        process.env.BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        `http://localhost:${process.env.PORT || 3001}`;

      // Remove /api if present for file serving
      const cleanBaseUrl = baseUrl.replace("/api", "");

      console.log("Base URL used:", cleanBaseUrl);
      return `${cleanBaseUrl}/uploads/avatars/${filename}`;
    };

    const avatarUrl = generateAvatarUrl(filename);
    console.log("Generated avatar URL:", avatarUrl);

    res.json({
      success: true,
      message: "Avatar berhasil diupload",
      avatar_url: avatarUrl,
      filename: filename,
      debug: {
        BASE_URL: process.env.BASE_URL,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        PORT: process.env.PORT,
      },
    });
  } catch (err) {
    console.error("Error uploading avatar:", err);

    // Delete uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log("Cleaned up uploaded file due to error");
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Delete avatar
export const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("Avatar delete request for user:", userId);

    // Get current avatar - using correct column name
    const [userRows] = await db.execute(
      "SELECT profile_picture FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const currentAvatar = userRows[0].profile_picture;

    if (!currentAvatar) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada avatar untuk dihapus",
      });
    }

    // Update database to remove avatar - using correct column name
    const [result] = await db.execute(
      "UPDATE users SET profile_picture = NULL, last_edited_at = NOW() WHERE id = ?",
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: "Gagal menghapus avatar",
      });
    }

    // Delete avatar file
    const avatarPath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "avatars",
      currentAvatar
    );
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    res.json({
      success: true,
      message: "Avatar berhasil dihapus",
    });
  } catch (err) {
    console.error("Error deleting avatar:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
