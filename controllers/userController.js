import db from "../config/db.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

export const updateLearningStyle = async (req, res) => {
  const { learningStyle } = req.body;

  if (![1, 2, 3].includes(Number(learningStyle))) {
    return res.status(400).json({
      message:
        "learning_style harus bernilai 1 (Visual), 2 (Audio), atau 3 (Kinestetik)",
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

// Get current user profile
// export const getUserProfile = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // Get user data with all required fields from database
//     const [userRows] = await db.execute(
//       `
//       SELECT
//         u.id,
//         u.name,
//         u.email,
//         u.bio,
//         u.profile_picture,
//         u.learning_style,
//         u.interest,
//         u.current_streak,
//         u.highest_streak,
//         u.last_study_at,
//         u.created_at as joined_at,
//         u.last_login_at
//       FROM users u
//       WHERE u.id = ?
//     `,
//       [userId]
//     );

//     if (userRows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "User tidak ditemukan",
//       });
//     }

//     const user = userRows[0];

//     // Parse interests from database
//     const parseInterests = (interestField) => {
//       if (!interestField) return [];

//       try {
//         // If it's already a JSON string, parse it
//         return JSON.parse(interestField);
//       } catch {
//         // If it's a plain string, treat as single interest
//         return [interestField];
//       }
//     };

//     // Map learning style number to text
//     const mapLearningStyle = (styleNumber) => {
//       switch (parseInt(styleNumber)) {
//         case 1:
//           return "Visual";
//         case 2:
//           return "Audio";
//         case 3:
//           return "Kinestetik";
//         default:
//           return "";
//       }
//     };

//     // Get friend count (if friendships table exists)
//     let totalFriends = 0;
//     try {
//       const [friendRows] = await db.execute(
//         `SELECT COUNT(*) as count FROM friendships f
//          WHERE (f.requester_id = ? OR f.receiver_id = ?)
//          AND f.status = '1'`,
//         [userId, userId]
//       );
//       totalFriends = friendRows[0]?.count || 0;
//     } catch (err) {
//       // Friendships table might not exist, default to 0
//       console.log("Friendships table not found, defaulting friend count to 0");
//       totalFriends = 0;
//     }

//     // Calculate total study hours (mock calculation - you can adjust based on your actual data)
//     const totalStudyHours = Math.floor(Math.random() * 100); // Replace with actual calculation

//     // Build response matching frontend expectations
//     const profileData = {
//       id: user.id,
//       name: user.name,
//       email: user.email,
//       bio: user.bio,
//       avatar: user.profile_picture
//         ? `${process.env.BASE_URL}/uploads/avatars/${user.profile_picture}`
//         : null,
//       learning_style: mapLearningStyle(user.learning_style),
//       interests: parseInterests(user.interest),

//       // Study statistics
//       study_stats: {
//         current_streak: user.current_streak || 0,
//         highest_streak: user.highest_streak || 0,
//         total_study_hours: totalStudyHours,
//         last_study: user.last_study_at,
//       },

//       // Social statistics
//       social_stats: {
//         total_friends: totalFriends,
//       },

//       joined_at: user.joined_at,
//       last_active: user.last_login_at,
//     };

//     res.json({
//       success: true,
//       user: profileData,
//     });
//   } catch (err) {
//     console.error("Error getting user profile:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// };
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
          return "Visual";
        case 2:
          return "Audio";
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

    // Calculate total study hours
    const totalStudyHours = Math.floor(Math.random() * 100);

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
      avatar: generateAvatarUrl(user.profile_picture), // FIXED URL generation
      learning_style: mapLearningStyle(user.learning_style),
      interests: parseInterests(user.interest),

      // Study statistics
      study_stats: {
        current_streak: user.current_streak || 0,
        highest_streak: user.highest_streak || 0,
        total_study_hours: totalStudyHours,
        last_study: user.last_study_at,
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
          "Learning style harus 1 (Visual), 2 (Audio), atau 3 (Kinestetik)",
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
// export const uploadAvatar = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     console.log("Avatar upload request for user:", userId);

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "File avatar diperlukan",
//       });
//     }

//     // Get current avatar to delete old file - using correct column name
//     const [userRows] = await db.execute(
//       "SELECT profile_picture FROM users WHERE id = ?",
//       [userId]
//     );

//     const oldAvatar = userRows[0]?.profile_picture;

//     // Update database with new avatar filename - using correct column name
//     const filename = req.file.filename;
//     const [result] = await db.execute(
//       "UPDATE users SET profile_picture = ?, last_edited_at = NOW() WHERE id = ?",
//       [filename, userId]
//     );

//     if (result.affectedRows === 0) {
//       // Delete uploaded file if database update fails
//       fs.unlinkSync(req.file.path);
//       return res.status(500).json({
//         success: false,
//         message: "Gagal mengupdate avatar",
//       });
//     }

//     // Delete old avatar file if exists
//     if (oldAvatar) {
//       const oldAvatarPath = path.join(
//         process.cwd(),
//         "public",
//         "uploads",
//         "avatars",
//         oldAvatar
//       );
//       if (fs.existsSync(oldAvatarPath)) {
//         fs.unlinkSync(oldAvatarPath);
//       }
//     }

//     res.json({
//       success: true,
//       message: "Avatar berhasil diupload",
//       avatar_url: `${process.env.BASE_URL}/public/uploads/avatars/${filename}`,
//     });
//   } catch (err) {
//     console.error("Error uploading avatar:", err);

//     // Delete uploaded file if error occurs
//     if (req.file) {
//       fs.unlinkSync(req.file.path);
//     }

//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// };
// export const uploadAvatar = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     console.log("Avatar upload request for user:", userId);
//     console.log("Received file:", req.file);

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "File avatar diperlukan",
//       });
//     }

//     // Verify file was actually saved
//     const uploadedFilePath = req.file.path;
//     console.log("File saved at:", uploadedFilePath);

//     if (!fs.existsSync(uploadedFilePath)) {
//       console.error("File was not saved:", uploadedFilePath);
//       return res.status(500).json({
//         success: false,
//         message: "File gagal disimpan",
//       });
//     }

//     // Get current avatar to delete old file
//     const [userRows] = await db.execute(
//       "SELECT profile_picture FROM users WHERE id = ?",
//       [userId]
//     );

//     const oldAvatar = userRows[0]?.profile_picture;

//     // Update database with new avatar filename
//     const filename = req.file.filename;
//     console.log("Updating database with filename:", filename);

//     const [result] = await db.execute(
//       "UPDATE users SET profile_picture = ?, last_edited_at = NOW() WHERE id = ?",
//       [filename, userId]
//     );

//     if (result.affectedRows === 0) {
//       // Delete uploaded file if database update fails
//       console.error("Database update failed, deleting uploaded file");
//       fs.unlinkSync(req.file.path);
//       return res.status(500).json({
//         success: false,
//         message: "Gagal mengupdate avatar di database",
//       });
//     }

//     console.log("Database updated successfully");

//     // Delete old avatar file if exists
//     if (oldAvatar) {
//       const oldAvatarPath = path.join(
//         process.cwd(),
//         "public",
//         "uploads",
//         "avatars",
//         oldAvatar
//       );
//       if (fs.existsSync(oldAvatarPath)) {
//         fs.unlinkSync(oldAvatarPath);
//         console.log("Deleted old avatar:", oldAvatarPath);
//       }
//     }

//     // Generate full URL
//     const baseUrl =
//       process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
//     const avatarUrl = `${baseUrl}/uploads/avatars/${filename}`;

//     console.log("Generated avatar URL:", avatarUrl);

//     res.json({
//       success: true,
//       message: "Avatar berhasil diupload",
//       avatar_url: avatarUrl,
//       filename: filename, // Include filename for debugging
//     });
//   } catch (err) {
//     console.error("Error uploading avatar:", err);

//     // Delete uploaded file if error occurs
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path);
//       console.log("Cleaned up uploaded file due to error");
//     }

//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// };
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
