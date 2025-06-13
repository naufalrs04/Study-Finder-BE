// controllers/mlController.js
import db from "../config/db.js"; // Asumsi path ini benar
import axios from "axios"; // Impor axios untuk panggilan HTTP

// --- URL API FLASK ANDA YANG SUDAH DI-DEPLOY DI RAILWAY ---
// GANTI DENGAN URL ANDA YANG SEBENARNYA DARI RAILWAY
const NLP_API_URL =
  "https://studyfindermlapi-production.up.railway.app/predict-nlp";
const QUIZ_API_URL =
  "https://studyfindermlapi-production.up.railway.app/predict-quiz";
// ---------------------------------------------------------

// --- MAPPING LABEL (jika API Flask mengembalikan ' 'V', 'A', 'Kdan DB Anda menyimpan 1, 2, 3) ---
// Sesuaikan jika mapping Anda berbeda atau jika API Flask sudah mengembalikan angka
const STYLE_MAP_FROM_API = { V: 2, A: 1, K: 3 };
// ---------------------------------------------------------------------------------------------
// Check apakah model sudah siap
// export const getModelStatus = async (req, res) => {
//   try {
//     // Coba panggil salah satu API Flask untuk cek kesiapan
//     const nlpTestResponse = await axios.post(NLP_API_URL, {
//       narasi_pengguna: "test",
//     });

//     const quizTestResponse = await axios.post(QUIZ_API_URL, {
//       quiz_answers: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
//     });

//     // Jika kedua API merespons dengan struktur yang sesuai, asumsikan model sudah siap
//     const isNLPReady =
//       nlpTestResponse?.data?.gaya_belajar_prediksi !== undefined;
//     const isQuizReady =
//       quizTestResponse?.data?.gaya_belajar_prediksi !== undefined;

//     res.json({
//       success: true,
//       models_loaded: isNLPReady && isQuizReady,
//       nlp_ready: isNLPReady,
//       quiz_ready: isQuizReady,
//     });
//   } catch (error) {
//     console.error("[Node.js] Error checking model status:", error.message);
//     res.status(503).json({
//       success: false,
//       models_loaded: false,
//       message: "Model belum siap atau layanan tidak tersedia.",
//     });
//   }
// };
// Predict learning style from story (NLP) - MENGGUNAKAN API FLASK
export const predictFromStory = async (req, res) => {
  try {
    const { story } = req.body;
    // Asumsi userId didapatkan dari middleware otentikasi dan tersedia di req.user.id
    // Jika tidak, Anda perlu cara lain untuk mendapatkan userId
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User tidak terautentikasi." });
    }

    if (!story || story.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Cerita terlalu pendek. Minimal 10 karakter.",
      });
    }

    console.log(
      `[Node.js] Processing story prediction for user ${userId} via Flask API`
    );
    console.log(`[Node.js] Story length: ${story.length} characters`);

    let learningStylePrediction;
    let predictionConfidence; // Default confidence
    let apiResponseData = null;

    try {
      const flaskApiResponse = await axios.post(NLP_API_URL, {
        narasi_pengguna: story, // Sesuai dengan payload yang diharapkan API Flask
      });

      if (
        flaskApiResponse.data &&
        flaskApiResponse.data.gaya_belajar_prediksi
      ) {
        apiResponseData = flaskApiResponse.data;
        const predictedApiLabel = apiResponseData.gaya_belajar_prediksi; // Misal 'V', 'A', atau 'K'

        learningStylePrediction = STYLE_MAP_FROM_API[predictedApiLabel];
        if (learningStylePrediction === undefined) {
          console.error(
            `[Node.js] Label tidak dikenal dari API NLP: ${predictedApiLabel}`
          );
          // Anda bisa set default atau mengembalikan error spesifik
          learningStylePrediction = null; // Atau nilai default
        }

        if (apiResponseData.probabilitas) {
          predictionConfidence = Math.max(...apiResponseData.probabilitas);
        }
        console.log(
          `[Node.js] User ${userId} - Flask API (NLP) prediction: ${predictedApiLabel}, Mapped to DB: ${learningStylePrediction}, Confidence: ${predictionConfidence.toFixed(
            2
          )}`
        );
      } else {
        console.error(
          "[Node.js] Invalid response from Flask NLP API:",
          flaskApiResponse.data
        );
        // Opsi: Implementasikan fallback ke rule-based di sini jika mau
      }
    } catch (apiError) {
      console.error(
        "[Node.js] Error calling Flask NLP API:",
        apiError.response ? apiError.response.data : apiError.message
      );
      // Opsi: Implementasikan fallback ke rule-based di sini jika mau
      return res.status(503).json({
        // Service Unavailable
        success: false,
        message: "Layanan prediksi gaya belajar (NLP) sedang tidak tersedia.",
        // error: process.env.NODE_ENV === "development" ? (apiError.response ? apiError.response.data : apiError.message) : undefined,
      });
    }

    if (
      learningStylePrediction === undefined ||
      learningStylePrediction === null
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Tidak dapat menentukan gaya belajar dari cerita setelah menghubungi layanan.",
      });
    }

    // Save to database
    await db.execute("UPDATE users SET learning_style = ? WHERE id = ?", [
      learningStylePrediction, // Ini harus angka 1, 2, atau 3
      userId,
    ]);

    res.json({
      success: true,
      learning_style: learningStylePrediction, // Kirim angka ke frontend jika frontend mengharapkannya
      learning_style_label: apiResponseData
        ? apiResponseData.gaya_belajar_prediksi
        : null, // Kirim juga label VAK
      confidence: predictionConfidence,
      prediction_type: "story_ml_api",
      message: "Prediksi berhasil menggunakan Model ML (NLP)",
      // debug_api_response: process.env.NODE_ENV === "development" ? apiResponseData : undefined // Untuk debugging
    });
  } catch (error) {
    console.error(
      "[Node.js] Error in predictFromStory (main try-catch):",
      error
    );
    res.status(500).json({
      success: false,
      message: "Gagal memproses cerita di server utama",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Predict learning style from quiz answers - MENGGUNAKAN API FLASK
export const predictFromQuiz = async (req, res) => {
  try {
    const { answers } = req.body; // Ekspektasi dari frontend: objek {"1":"3", "2":"1", ...}
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User tidak terautentikasi." });
    }

    const expectedAnswerCount = 12; // Jumlah pertanyaan kuesioner Anda
    if (
      !answers ||
      typeof answers !== "object" ||
      Object.keys(answers).length !== expectedAnswerCount
    ) {
      return res.status(400).json({
        success: false,
        message: `Jawaban kuesioner tidak valid atau tidak lengkap. Harap jawab semua ${expectedAnswerCount} pertanyaan.`,
      });
    }

    // Ubah format answers dari objek ke array angka sesuai urutan pertanyaan 1-12
    const quizAnswersArray = [];
    for (let i = 1; i <= expectedAnswerCount; i++) {
      const answer = answers[i.toString()];
      if (answer === undefined || answer === null || isNaN(parseInt(answer))) {
        return res.status(400).json({
          success: false,
          message: `Jawaban untuk pertanyaan ${i} tidak valid atau tidak ditemukan.`,
        });
      }
      quizAnswersArray.push(parseInt(answer));
    }

    console.log(
      `[Node.js] Processing quiz prediction for user ${userId} via Flask API`
    );
    console.log(
      `[Node.js] Quiz answers (array): ${quizAnswersArray.join(", ")}`
    );

    let learningStylePredictionQuiz;
    let predictionConfidenceQuiz;
    let apiResponseDataQuiz = null;

    try {
      const flaskApiResponseQuiz = await axios.post(QUIZ_API_URL, {
        quiz_answers: quizAnswersArray, // Kirim sebagai array angka
      });

      if (
        flaskApiResponseQuiz.data &&
        flaskApiResponseQuiz.data.gaya_belajar_prediksi
      ) {
        apiResponseDataQuiz = flaskApiResponseQuiz.data;
        const predictedApiLabelQuiz = apiResponseDataQuiz.gaya_belajar_prediksi; // Misal 'V', 'A', atau 'K'

        learningStylePredictionQuiz = STYLE_MAP_FROM_API[predictedApiLabelQuiz];
        if (learningStylePredictionQuiz === undefined) {
          console.error(
            `[Node.js] Label tidak dikenal dari API Kuesioner: ${predictedApiLabelQuiz}`
          );
          learningStylePredictionQuiz = null;
        }

        predictionConfidenceQuiz = Math.max(
          ...apiResponseDataQuiz.probabilitas
        );

        // if (apiResponseDataQuiz.probabilitas) {
        //   predictionConfidenceQuiz = Math.max(
        //     ...apiResponseDataQuiz.probabilitas
        //   );
        // }
        console.log(
          `[Node.js] User ${userId} - Flask API (Quiz) prediction: ${predictedApiLabelQuiz}, Mapped to DB: ${learningStylePredictionQuiz}, Confidence: ${predictionConfidenceQuiz.toFixed(
            2
          )}`
        );
      } else {
        console.error(
          "[Node.js] Invalid response from Flask Quiz API:",
          flaskApiResponseQuiz.data
        );
      }
    } catch (apiError) {
      console.error(
        "[Node.js] Error calling Flask Quiz API:",
        apiError.response ? apiError.response.data : apiError.message
      );
      return res.status(503).json({
        success: false,
        message:
          "Layanan prediksi gaya belajar (kuesioner) sedang tidak tersedia.",
        // error: process.env.NODE_ENV === "development" ? (apiError.response ? apiError.response.data : apiError.message) : undefined,
      });
    }

    if (
      learningStylePredictionQuiz === undefined ||
      learningStylePredictionQuiz === null
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Tidak dapat menentukan gaya belajar dari kuesioner setelah menghubungi layanan.",
      });
    }

    // Save to database
    await db.execute("UPDATE users SET learning_style = ? WHERE id = ?", [
      learningStylePredictionQuiz, // Angka 1, 2, atau 3
      userId,
    ]);

    res.json({
      success: true,
      learning_style: learningStylePredictionQuiz, // Kirim angka
      learning_style_label: apiResponseDataQuiz
        ? apiResponseDataQuiz.gaya_belajar_prediksi
        : null, // Kirim juga label VAK
      confidence: predictionConfidenceQuiz,
      prediction_type: "quiz_ml_api",
      // answers_processed: quizAnswersArray, // Untuk debugging jika perlu
      // debug_api_response: process.env.NODE_ENV === "development" ? apiResponseDataQuiz : undefined,
      message: "Prediksi berhasil menggunakan Model ML (Kuesioner)",
    });
  } catch (error) {
    console.error(
      "[Node.js] Error in predictFromQuiz (main try-catch):",
      error
    );
    res.status(500).json({
      success: false,
      message: "Gagal memproses jawaban quiz di server utama",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get learning style info (Fungsi ini tetap sama, hanya mengambil dari DB)
export const getLearningStyleInfo = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User tidak terautentikasi." });
    }

    const [userRows] = await db.execute(
      "SELECT learning_style FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan atau belum melakukan tes gaya belajar.",
        learning_style: null, // Tambahkan ini agar frontend tahu
        style_info: null,
      });
    }

    const learningStyleDBValue = userRows[0].learning_style; // Ini adalah angka 1, 2, atau 3

    // Mapping dari angka di DB ke nama gaya belajar dan detailnya
    const styleInfoMap = {
      1: {
        name: "Visual",
        description:
          "Pembelajar visual adalah individu yang lebih mudah menyerap dan mengingat informasi ketika disajikan dalam bentuk visual, seperti diagram, bagan, peta, grafik, dan gambar.",
        characteristics: [
          "Lebih suka belajar dengan melihat",
          "Mudah mengingat informasi visual",
          "Suka membuat catatan berwarna",
          "Berpikir dalam bentuk gambar",
        ],
        tips: [
          "Gunakan mind map dan diagram",
          "Buat catatan dengan warna-warna berbeda",
          "Manfaatkan video pembelajaran",
          "Visualisasikan konsep yang abstrak",
        ],
      },
      2: {
        name: "Auditory",
        description:
          "Pembelajar auditori adalah individu yang lebih mudah memahami dan mengingat informasi melalui pendengaran.",
        characteristics: [
          "Lebih suka mendengar penjelasan",
          "Mudah belajar melalui diskusi",
          "Suka belajar dengan musik",
          "Mengingat melalui suara dan ritme",
        ],
        tips: [
          "Dengarkan podcast dan audiobook",
          "Ikuti diskusi kelompok",
          "Baca materi dengan suara keras",
          "Gunakan musik untuk membantu konsentrasi",
        ],
      },
      3: {
        name: "Kinestetik",
        description:
          "Pembelajar kinestetik adalah individu yang belajar paling baik melalui pengalaman langsung dan aktivitas fisik.",
        characteristics: [
          "Suka belajar sambil bergerak",
          "Lebih suka praktik langsung",
          "Mudah bosan jika hanya mendengar",
          "Belajar melalui sentuhan dan manipulasi objek",
        ],
        tips: [
          "Lakukan eksperimen dan praktikum",
          "Gunakan metode learning by doing",
          "Belajar sambil berjalan atau bergerak",
          "Buat model atau prototype fisik",
        ],
      },
    };

    const selectedStyleInfo = styleInfoMap[learningStyleDBValue] || null;

    if (!selectedStyleInfo) {
      return res.status(404).json({
        success: false,
        message:
          "Informasi gaya belajar tidak ditemukan untuk nilai yang tersimpan.",
        learning_style: learningStyleDBValue,
        style_info: null,
      });
    }

    res.json({
      success: true,
      learning_style: learningStyleDBValue, // Kirim nilai angka dari DB
      learning_style_label: selectedStyleInfo.name, // Kirim label V, A, K
      style_info: selectedStyleInfo,
    });
  } catch (error) {
    console.error("[Node.js] Error getting learning style info:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil informasi gaya belajar",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
