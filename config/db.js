// config/db.js
import mysql from "mysql2/promise"; // Gunakan ES Module dari mysql2
import dotenv from "dotenv";

dotenv.config();
// console.log("ENV DB_USER:", process.env.DB_USER);
// console.log("ENV DB_PASSWORD:", process.env.DB_PASSWORD);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
