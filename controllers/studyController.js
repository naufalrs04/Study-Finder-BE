<<<<<<< HEAD
import db from "../config/db.js";

export const add = async (req, res) => {
  const { title, userId } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO study_sessions (user_id, title, start_time) VALUES (?, ?, NOW())",
      [userId, title]
    );

    res.status(201).json({ message: "Registrasi berhasil" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getActiveSession = async (req, res) => {
  const { userId } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM study_sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1",
    [userId]
  );
  if (rows.length > 0) {
    res.json({ session: rows[0] });
  } else {
    res.json({ session: null });
  }
};

export const endSession = async (req, res) => {
  const { sessionId } = req.body;
  const [result] = await db.execute(
    `UPDATE study_sessions 
     SET end_time = NOW(), duration = TIMESTAMPDIFF(MINUTE, start_time, NOW()) 
     WHERE id = ?`,
    [sessionId]
  );
  res.json({ message: "Sesi berhasil diakhiri" });
};
=======
import db from "../config/db.js";

export const add = async (req, res) => {
  const { title, userId } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO study_sessions (user_id, title, start_time) VALUES (?, ?, NOW())",
      [userId, title]
    );

    res.status(201).json({ message: "Registrasi berhasil" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getActiveSession = async (req, res) => {
  const { userId } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM study_sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1",
    [userId]
  );
  if (rows.length > 0) {
    res.json({ session: rows[0] });
  } else {
    res.json({ session: null });
  }
};

export const endSession = async (req, res) => {
  const { sessionId } = req.body;
  const [result] = await db.execute(
    `UPDATE study_sessions 
     SET end_time = NOW(), duration = TIMESTAMPDIFF(MINUTE, start_time, NOW()) 
     WHERE id = ?`,
    [sessionId]
  );
  res.json({ message: "Sesi berhasil diakhiri" });
};
>>>>>>> 69271a58bfd2aa1811215f7da7a61e74bf2da424
