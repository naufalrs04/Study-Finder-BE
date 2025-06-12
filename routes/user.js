<<<<<<< HEAD
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  updateLearningStyle,
  getUserProfile,
  updateUserProfile,
  updatePassword,
  uploadAvatar,
  deleteAvatar,
} from "../controllers/userController.js";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = "public/uploads/avatars/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Created upload directory:", uploadDir);
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename =
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
    console.log("Generated filename:", filename);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("File filter - mimetype:", file.mimetype);
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Error handling middleware for multer
const handleUpload = (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File terlalu besar. Maksimal 5MB",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Error uploading file: " + err.message,
      });
    } else if (err) {
      console.error("Upload error:", err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    console.log("File uploaded successfully:", req.file);
    next();
  });
};

// Profile Routes
router.get("/profile", authenticate, getUserProfile);
router.put("/profile", authenticate, updateUserProfile);
router.put("/password", authenticate, updatePassword);
router.post("/avatar", authenticate, handleUpload, uploadAvatar); // Updated with error handling
router.delete("/avatar", authenticate, deleteAvatar);
router.put("/learning-style", authenticate, updateLearningStyle);

export default router;
=======
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  updateLearningStyle,
  getUserProfile,
  updateUserProfile,
  updatePassword,
  uploadAvatar,
  deleteAvatar,
} from "../controllers/userController.js";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = "public/uploads/avatars/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Created upload directory:", uploadDir);
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename =
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
    console.log("Generated filename:", filename);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("File filter - mimetype:", file.mimetype);
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Error handling middleware for multer
const handleUpload = (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File terlalu besar. Maksimal 5MB",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Error uploading file: " + err.message,
      });
    } else if (err) {
      console.error("Upload error:", err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    console.log("File uploaded successfully:", req.file);
    next();
  });
};

// Profile Routes
router.get("/profile", authenticate, getUserProfile);
router.put("/profile", authenticate, updateUserProfile);
router.put("/password", authenticate, updatePassword);
router.post("/avatar", authenticate, handleUpload, uploadAvatar); // Updated with error handling
router.delete("/avatar", authenticate, deleteAvatar);
router.put("/learning-style", authenticate, updateLearningStyle);

export default router;
>>>>>>> 69271a58bfd2aa1811215f7da7a61e74bf2da424
