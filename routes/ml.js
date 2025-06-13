// routes/ml.js
import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  predictFromStory,
  predictFromQuiz,
  getLearningStyleInfo,
  // getModelStatus,
} from "../controllers/mlController.js";

const router = express.Router();

// Model status check (tidak perlu auth untuk monitoring)
// router.get("/status", getModelStatus);

// Predict learning style from story (NLP) - Pure ML only
router.post("/predict/story", authenticate, predictFromStory);

// Predict learning style from quiz - Pure ML only
router.post("/predict/quiz", authenticate, predictFromQuiz);

// Get learning style information
router.get("/learning-style", authenticate, getLearningStyleInfo);

export default router;
