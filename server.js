import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

import cors from "cors";

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true, // penting untuk kirim cookie
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
      secure: false, // Kalau di production + HTTPS, ubah ke true
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 hari
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

// Server listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
