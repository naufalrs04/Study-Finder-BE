// Updated roomSocket.js - mengirim duration dalam format HH:MM:SS

import jwt from "jsonwebtoken";
import db from "../config/db.js";

// Helper function to format duration from started_at to now
function formatDuration(startedAt) {
  if (!startedAt) return "00:00:00";

  const now = new Date();
  const start = new Date(startedAt);
  const diff = Math.max(0, now - start);

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

export const setupRoomSocket = (io) => {
  // Store online users per room
  const roomUsers = new Map();

  // Middleware untuk socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user info from database
      const [user] = await db.execute(
        "SELECT id, name, profile_picture, active_room_id FROM users WHERE id = ?",
        [decoded.id]
      );

      if (user.length === 0) {
        return next(new Error("User not found"));
      }

      socket.user = user[0];
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.id})`);

    // Auto-rejoin user to their active room if exists
    if (socket.user.active_room_id) {
      try {
        // Verify room still exists and not closed
        const [room] = await db.execute(
          "SELECT * FROM rooms WHERE id = ? AND closed_at IS NULL",
          [socket.user.active_room_id]
        );

        if (room.length > 0) {
          // Auto-join the room
          const roomId = socket.user.active_room_id;
          socket.join(`room_${roomId}`);
          socket.currentRoomId = roomId;

          // Add user to room tracking
          if (!roomUsers.has(roomId)) {
            roomUsers.set(roomId, new Set());
          }
          roomUsers.get(roomId).add(socket.user.id);

          console.log(`User ${socket.user.name} auto-rejoined room ${roomId}`);

          // Calculate current duration from started_at
          const currentDuration = formatDuration(room[0].started_at);

          // Send room data to user with current duration
          socket.emit("joined_room", {
            roomId: roomId,
            roomName: room[0].name,
            roomDescription: room[0].description,
            roomCode: room[0].code,
            createdBy: room[0].created_by,
            startedAt: room[0].started_at,
            duration: currentDuration, // Send calculated duration
            message: "Melanjutkan sesi room",
          });

          // Send current room members
          await sendRoomMembers(socket, roomId);

          // Notify others in room
          socket.to(`room_${roomId}`).emit("user_rejoined", {
            userId: socket.user.id,
            userName: socket.user.name,
            userAvatar: socket.user.profile_picture,
            timestamp: new Date(),
          });

          // Send online users list
          const onlineUserIds = Array.from(roomUsers.get(roomId) || []);
          io.to(`room_${roomId}`).emit("online_users_updated", onlineUserIds);
        } else {
          // Room doesn't exist or closed, clear user's active room
          await db.execute(
            "UPDATE users SET active_room_id = NULL WHERE id = ?",
            [socket.user.id]
          );
        }
      } catch (error) {
        console.error("Error auto-rejoining room:", error);
      }
    }

    // Join room
    socket.on("join_room", async (data) => {
      const { roomId } = data;

      try {
        // Verify room exists and not closed
        const [room] = await db.execute(
          "SELECT * FROM rooms WHERE id = ? AND closed_at IS NULL",
          [roomId]
        );

        if (room.length === 0) {
          socket.emit("error", {
            message: "Room tidak ditemukan atau sudah ditutup",
          });
          return;
        }

        // Leave previous room if exists
        if (socket.currentRoomId) {
          await leaveCurrentRoom(socket);
        }

        // Join socket room
        socket.join(`room_${roomId}`);
        socket.currentRoomId = roomId;

        // Add user to room tracking
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Set());
        }
        roomUsers.get(roomId).add(socket.user.id);

        console.log(`User ${socket.user.name} joined room ${roomId}`);

        // Broadcast to room that user joined
        socket.to(`room_${roomId}`).emit("user_joined", {
          userId: socket.user.id,
          userName: socket.user.name,
          userAvatar: socket.user.profile_picture,
          timestamp: new Date(),
        });

        // Calculate current duration from started_at
        const currentDuration = formatDuration(room[0].started_at);

        // Send confirmation to user with current duration
        socket.emit("joined_room", {
          roomId: roomId,
          roomName: room[0].name,
          roomDescription: room[0].description,
          roomCode: room[0].code,
          createdBy: room[0].created_by,
          startedAt: room[0].started_at,
          duration: currentDuration, // Send calculated duration
          message: "Berhasil bergabung dengan room",
        });

        // Send current room members
        await sendRoomMembers(socket, roomId);

        // Send online users list
        const onlineUserIds = Array.from(roomUsers.get(roomId) || []);
        io.to(`room_${roomId}`).emit("online_users_updated", onlineUserIds);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("error", { message: "Gagal bergabung dengan room" });
      }
    });

    // Leave room
    socket.on("leave_room", async () => {
      await leaveCurrentRoom(socket);
    });

    // Close room (only creator can close)
    socket.on("close_room", async (data) => {
      const { roomId } = data;

      try {
        // Check if user is the creator
        const [room] = await db.execute(
          "SELECT * FROM rooms WHERE id = ? AND created_by = ? AND closed_at IS NULL",
          [roomId, socket.user.id]
        );

        if (room.length === 0) {
          socket.emit("error", {
            message: "Anda tidak memiliki izin untuk menutup room ini",
          });
          return;
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

        // Notify all users in room
        io.to(`room_${roomId}`).emit("room_closed", {
          message: "Room telah ditutup oleh pembuat room",
          closedBy: socket.user.name,
          timestamp: new Date(),
        });

        // Remove room from tracking
        roomUsers.delete(roomId);

        console.log(`Room ${roomId} closed by ${socket.user.name}`);
      } catch (error) {
        console.error("Error closing room:", error);
        socket.emit("error", { message: "Gagal menutup room" });
      }
    });

    // Send chat message
    socket.on("send_message", async (data) => {
      const { roomId, message } = data;

      if (!socket.currentRoomId || socket.currentRoomId != roomId) {
        socket.emit("error", { message: "Anda tidak berada di room ini" });
        return;
      }

      try {
        // Verify room is still active
        const [room] = await db.execute(
          "SELECT id FROM rooms WHERE id = ? AND closed_at IS NULL",
          [roomId]
        );

        if (room.length === 0) {
          socket.emit("error", { message: "Room sudah ditutup" });
          return;
        }

        // Broadcast message to room
        io.to(`room_${roomId}`).emit("new_message", {
          id: Date.now(),
          userId: socket.user.id,
          userName: socket.user.name,
          userAvatar: socket.user.profile_picture,
          message: message,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Gagal mengirim pesan" });
      }
    });

    // Request room info update
    socket.on("request_room_info", async (data) => {
      const { roomId } = data;

      try {
        const [room] = await db.execute(
          `SELECT 
            r.*,
            u.name as creator_name
           FROM rooms r
           LEFT JOIN users u ON r.created_by = u.id
           WHERE r.id = ? AND r.closed_at IS NULL`,
          [roomId]
        );

        if (room.length > 0) {
          const roomData = room[0];
          const currentDuration = formatDuration(roomData.started_at);

          socket.emit("room_info_updated", {
            roomId: roomData.id,
            roomName: roomData.name,
            roomDescription: roomData.description,
            roomCode: roomData.code,
            createdBy: roomData.created_by,
            creatorName: roomData.creator_name,
            startedAt: roomData.started_at,
            duration: currentDuration, // Send calculated duration
            isPrivate: roomData.is_private === 1,
          });
        }
      } catch (error) {
        console.error("Error getting room info:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.user.id})`);

      if (socket.currentRoomId) {
        // Remove user from room tracking
        if (roomUsers.has(socket.currentRoomId)) {
          roomUsers.get(socket.currentRoomId).delete(socket.user.id);

          // Send updated online users list
          const onlineUserIds = Array.from(
            roomUsers.get(socket.currentRoomId) || []
          );
          socket
            .to(`room_${socket.currentRoomId}`)
            .emit("online_users_updated", onlineUserIds);
        }

        socket.to(`room_${socket.currentRoomId}`).emit("user_disconnected", {
          userId: socket.user.id,
          userName: socket.user.name,
          timestamp: new Date(),
        });

        // Check if user was the last one in the room after disconnect
        try {
          const [remainingMembers] = await db.execute(
            "SELECT COUNT(*) as member_count FROM users WHERE active_room_id = ?",
            [socket.currentRoomId]
          );

          // If no members left in the database, auto-close the room
          if (remainingMembers[0].member_count === 0) {
            await db.execute(
              "UPDATE rooms SET closed_at = NOW() WHERE id = ?",
              [socket.currentRoomId]
            );

            // Remove room from tracking
            roomUsers.delete(socket.currentRoomId);

            console.log(
              `Room ${socket.currentRoomId} auto-closed due to no remaining members after disconnect`
            );
          }
        } catch (error) {
          console.error("Error checking room members after disconnect:", error);
        }
      }
    });

    // Helper function to leave current room
    async function leaveCurrentRoom(socket) {
      if (socket.currentRoomId) {
        const roomId = socket.currentRoomId;

        // Remove from room tracking
        if (roomUsers.has(roomId)) {
          roomUsers.get(roomId).delete(socket.user.id);
        }

        // Broadcast to room that user left
        socket.to(`room_${roomId}`).emit("user_left", {
          userId: socket.user.id,
          userName: socket.user.name,
          timestamp: new Date(),
        });

        // Send updated online users list
        const onlineUserIds = Array.from(roomUsers.get(roomId) || []);
        socket.to(`room_${roomId}`).emit("online_users_updated", onlineUserIds);

        // Send updated member count to room
        await sendRoomMembers(socket, roomId, true);

        // Check if room should be auto-closed after user leaves
        try {
          const [remainingMembers] = await db.execute(
            "SELECT COUNT(*) as member_count FROM users WHERE active_room_id = ?",
            [roomId]
          );

          // If no members left, auto-close the room
          if (remainingMembers[0].member_count === 0) {
            await db.execute(
              "UPDATE rooms SET closed_at = NOW() WHERE id = ?",
              [roomId]
            );

            // Notify any remaining socket connections (edge case)
            io.to(`room_${roomId}`).emit("room_auto_closed", {
              message: "Room ditutup otomatis karena tidak ada anggota",
              timestamp: new Date(),
            });

            // Remove room from tracking
            roomUsers.delete(roomId);

            console.log(
              `Room ${roomId} auto-closed due to no remaining members`
            );
          }
        } catch (error) {
          console.error("Error checking room members after leave:", error);
        }

        socket.leave(`room_${roomId}`);
        console.log(`User ${socket.user.name} left room ${roomId}`);
        socket.currentRoomId = null;
      }
    }

    // Helper function to send room members
    async function sendRoomMembers(socket, roomId, broadcast = false) {
      try {
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

        const memberData = {
          roomId: roomId,
          members: members,
          memberCount: members.length,
        };

        if (broadcast) {
          io.to(`room_${roomId}`).emit("room_members_updated", memberData);
        } else {
          socket.emit("room_members", memberData.members);
        }
      } catch (error) {
        console.error("Error fetching room members:", error);
      }
    }
  });
};
