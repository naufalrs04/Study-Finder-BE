import db from "../config/db.js";
class User {
  static async findByEmail(email) {
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  }

  static async create({ name, email, password }) {
    const [result] = await db.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, password]
    );
    return result.insertId;
  }

  static async updateLastLogin(id) {
    const [result] = await db.execute(
      "UPDATE users SET last_login_at = NOW() WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }
}

export default User;
