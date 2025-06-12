import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupRoomSocket } from "./socket/roomSocket.js";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://study-finder-self.vercel.app",
    credentials: true,
    methods: ["GET", "POST"],
  },
});

import cors from "cors";

app.use(
  cors({
    origin: "https://study-finder-self.vercel.app",
    credentials: true,
  })
);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Setup session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "rahasia",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// Routes
import authRoutes from "./routes/auth.js";
app.use("/api/auth", authRoutes);

import userRoutes from "./routes/user.js";
app.use("/api/user", userRoutes);

import studyRoutes from "./routes/study.js";
app.use("/api/study", studyRoutes);

import friendRoutes from "./routes/friend.js";
app.use("/api/friends", friendRoutes);

import roomRoutes from "./routes/room.js";
app.use("/api/rooms", roomRoutes);

// Setup Socket.IO
setupRoomSocket(io);

// Server listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
