import db from "../config/db.js";
import bcrypt from "bcrypt";

// Generate random room code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Format timestamp untuk display
function formatTimestamp(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = now - time;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, "0")} : ${String(minutes).padStart(
    2,
    "0"
  )} : ${String(seconds).padStart(2, "0")}`;
}

// Format duration from created_at to now
function formatDuration(startedAt) {
  if (!startedAt) return "00:00:00";

  const now = new Date();
  const start = new Date(startedAt);
  const diff = now - start;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

export const getPublicRooms = async (req, res) => {
  try {
    const [rooms] = await db.execute(`
      SELECT 
        r.id,
        r.name,
        r.description,
        r.is_private,
        r.code,
        r.created_by,
        r.created_at,
        r.created_at,
        u.name as creator_name,
        u.profile_picture as creator_avatar,
        COUNT(DISTINCT ur.id) as joined_count
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN users ur ON ur.active_room_id = r.id
      WHERE r.closed_at IS NULL 
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);

    // Format response sesuai frontend
    const formattedRooms = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      avatar:
        `${process.env.BASE_URL}/public/uploads/avatars/${room.creator_avatar}` ||
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      joined: room.joined_count.toString(),
      timeLast: formatTimestamp(room.created_at),
      duration: formatDuration(room.created_at),
      description: room.description || `Room created by ${room.creator_name}`,
      createdBy: room.created_by,
      isPrivate: room.is_private === 1,
      code: room.code,
      startedAt: room.created_at,
    }));

    res.json(formattedRooms);
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    res.status(500).json({ message: "Gagal mengambil data room" });
  }
};

export const createRoom = async (req, res) => {
  const { name, description, isPrivate, password } = req.body;
  const userId = req.user.id;

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "Nama room tidak boleh kosong" });
  }

  if (isPrivate && (!password || password.trim() === "")) {
    return res
      .status(400)
      .json({ message: "Password diperlukan untuk room privat" });
  }

  try {
    let roomCode;
    let isCodeUnique = false;

    // Generate unique room code
    while (!isCodeUnique) {
      roomCode = generateRoomCode();
      const [existingRoom] = await db.execute(
        "SELECT id FROM rooms WHERE code = ?",
        [roomCode]
      );
      if (existingRoom.length === 0) {
        isCodeUnique = true;
      }
    }

    // Hash password if room is private
    let hashedPassword = null;
    if (isPrivate && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create room with created_at timestamp
    const [result] = await db.execute(
      `
      INSERT INTO rooms (name, description, is_private, password, code, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        name,
        description || "",
        isPrivate ? 1 : 0,
        hashedPassword,
        roomCode,
        userId,
      ]
    );

    const roomId = result.insertId;

    // Update user's active room
    await db.execute("UPDATE users SET active_room_id = ? WHERE id = ?", [
      roomId,
      userId,
    ]);

    res.status(201).json({
      message: "Room berhasil dibuat",
      room: {
        id: roomId,
        name: name,
        description: description || "",
        isPrivate: isPrivate,
        roomCode: roomCode,
        createdBy: userId,
        createdAt: new Date(),
        startedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Gagal membuat room" });
  }
};

export const joinRoom = async (req, res) => {
  const { roomId } = req.params;
  const { password } = req.body;
  const userId = req.user.id;

  try {
    // Check if room exists
    const [room] = await db.execute(
      "SELECT * FROM rooms WHERE id = ? AND closed_at IS NULL",
      [roomId]
    );

    if (room.length === 0) {
      return res
        .status(404)
        .json({ message: "Room tidak ditemukan atau sudah ditutup" });
    }

    const roomData = room[0];

    // Check if room is private and validate password
    if (roomData.is_private && roomData.password) {
      if (!password) {
        return res
          .status(400)
          .json({ message: "Password diperlukan untuk room privat" });
      }

      const isPasswordValid = await bcrypt.compare(password, roomData.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Password salah" });
      }
    }

    // Update user's active room
    await db.execute("UPDATE users SET active_room_id = ? WHERE id = ?", [
      roomId,
      userId,
    ]);

    res.json({
      message: "Berhasil bergabung dengan room",
      roomId: roomId,
      roomName: roomData.name,
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ message: "Gagal bergabung dengan room" });
  }
};

export const joinRoomByCode = async (req, res) => {
  const { roomCode, password } = req.body;
  const userId = req.user.id;

  if (!roomCode || roomCode.trim() === "") {
    return res.status(400).json({ message: "Kode room tidak boleh kosong" });
  }

  if (roomCode.length < 6) {
    return res
      .status(400)
      .json({ message: "Kode room harus minimal 6 karakter" });
  }

  try {
    // Find room by code
    const [room] = await db.execute(
      "SELECT * FROM rooms WHERE code = ? AND closed_at IS NULL",
      [roomCode.toUpperCase()]
    );

    if (room.length === 0) {
      return res.status(404).json({
        message:
          "Room tidak ditemukan atau sudah ditutup. Periksa kembali kode yang dimasukkan.",
      });
    }

    const roomData = room[0];

    // Check if room is private and validate password
    if (roomData.is_private && roomData.password) {
      if (!password) {
        return res.status(400).json({
          message: "Password diperlukan untuk room privat",
          requirePassword: true,
        });
      }

      const isPasswordValid = await bcrypt.compare(password, roomData.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Password salah" });
      }
    }

    // Update user's active room
    await db.execute("UPDATE users SET active_room_id = ? WHERE id = ?", [
      roomData.id,
      userId,
    ]);

    res.json({
      message: "Berhasil bergabung dengan room",
      roomId: roomData.id,
      roomName: roomData.name,
      roomCode: roomData.code,
    });
  } catch (error) {
    console.error("Error joining room with code:", error);
    res.status(500).json({ message: "Gagal bergabung dengan room" });
  }
};

export const leaveRoom = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get current room
    const [user] = await db.execute(
      "SELECT active_room_id FROM users WHERE id = ?",
      [userId]
    );

    const currentRoomId = user[0].active_room_id;

    if (!currentRoomId) {
      return res
        .status(400)
        .json({ message: "Anda tidak sedang dalam room apapun" });
    }

    // Update user's active room to null
    await db.execute("UPDATE users SET active_room_id = NULL WHERE id = ?", [
      userId,
    ]);

    // Check if room is now empty after user leaves
    const [remainingMembers] = await db.execute(
      "SELECT COUNT(*) as member_count FROM users WHERE active_room_id = ?",
      [currentRoomId]
    );

    // If no members left, close the room
    if (remainingMembers[0].member_count === 0) {
      await db.execute("UPDATE rooms SET closed_at = NOW() WHERE id = ?", [
        currentRoomId,
      ]);

      console.log(
        `Room ${currentRoomId} auto-closed due to no remaining members`
      );
    }

    res.json({
      message: "Berhasil keluar dari room",
      leftRoomId: currentRoomId,
      roomClosed: remainingMembers[0].member_count === 0,
    });
  } catch (error) {
    console.error("Error leaving room:", error);
    res.status(500).json({ message: "Gagal keluar dari room" });
  }
};

export const closeRoom = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    // Check if user is the creator of the room
    const [room] = await db.execute(
      "SELECT * FROM rooms WHERE id = ? AND created_by = ? AND closed_at IS NULL",
      [roomId, userId]
    );

    if (room.length === 0) {
      return res.status(403).json({
        message:
          "Anda tidak memiliki izin untuk menutup room ini atau room sudah ditutup",
      });
    }

    // Close the room
    await db.execute("UPDATE rooms SET closed_at = NOW() WHERE id = ?", [
      roomId,
    ]);

    // Remove all users from the room
    await db.execute(
      "UPDATE users SET active_room_id = NULL WHERE active_room_id = ?",
      [roomId]
    );

    res.json({
      message: "Room berhasil ditutup",
      roomId: roomId,
    });
  } catch (error) {
    console.error("Error closing room:", error);
    res.status(500).json({ message: "Gagal menutup room" });
  }
};

export const getRoomDetails = async (req, res) => {
  const { roomId } = req.params;

  try {
    const [room] = await db.execute(
      `
      SELECT 
        r.*,
        u.name as creator_name,
        u.profile_picture as creator_avatar,
        COUNT(DISTINCT ur.id) as member_count
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN users ur ON ur.active_room_id = r.id
      WHERE r.id = ? AND r.closed_at IS NULL
      GROUP BY r.id
    `,
      [roomId]
    );

    if (room.length === 0) {
      return res
        .status(404)
        .json({ message: "Room tidak ditemukan atau sudah ditutup" });
    }

    const roomData = room[0];
    res.json({
      id: roomData.id,
      name: roomData.name,
      description: roomData.description,
      isPrivate: roomData.is_private === 1,
      roomCode: roomData.code,
      createdBy: roomData.created_by,
      creatorName: roomData.creator_name,
      creatorAvatar: roomData.creator_avatar,
      memberCount: roomData.member_count,
      createdAt: roomData.created_at,
      startedAt: roomData.created_at,
      duration: formatDuration(roomData.created_at),
    });
  } catch (error) {
    console.error("Error fetching room details:", error);
    res.status(500).json({ message: "Gagal mengambil detail room" });
  }
};

export const getRoomMembers = async (req, res) => {
  const { roomId } = req.params;

  try {
    // Get room members
    const [members] = await db.execute(
      `
      SELECT 
        u.id,
        u.name,
        u.profile_picture,
        u.last_login_at
      FROM users u
      WHERE u.active_room_id = ?
      ORDER BY u.last_login_at DESC
    `,
      [roomId]
    );

    res.json(members);
  } catch (error) {
    console.error("Error fetching room members:", error);
    res.status(500).json({ message: "Gagal mengambil data member room" });
  }
};

export const getCurrentRoom = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get user's current room
    const [user] = await db.execute(
      `
      SELECT 
        u.active_room_id,
        r.id,
        r.name,
        r.description,
        r.code,
        r.is_private,
        r.created_by,
        r.created_at,
        r.created_at,
        creator.name as creator_name
      FROM users u
      LEFT JOIN rooms r ON u.active_room_id = r.id AND r.closed_at IS NULL
      LEFT JOIN users creator ON r.created_by = creator.id
      WHERE u.id = ?
    `,
      [userId]
    );

    if (user.length === 0 || !user[0].active_room_id) {
      return res.json({ currentRoom: null });
    }

    const roomData = user[0];
    res.json({
      currentRoom: {
        roomId: roomData.id,
        roomName: roomData.name,
        roomDescription: roomData.description,
        roomCode: roomData.code,
        isPrivate: roomData.is_private === 1,
        createdBy: roomData.created_by,
        creatorName: roomData.creator_name,
        startedAt: roomData.created_at,
        duration: formatDuration(roomData.created_at),
      },
    });
  } catch (error) {
    console.error("Error getting current room:", error);
    res.status(500).json({ message: "Gagal mengambil data room saat ini" });
  }
};
