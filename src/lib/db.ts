import mysql from 'mysql2/promise';

// Deklarasikan tipe global untuk TypeScript
declare global {
  var db: mysql.Pool | undefined;
}

// Gunakan variabel global untuk mencegah pembuatan pool koneksi berulang kali
// saat hot-reloading di lingkungan pengembangan.
const db =
  global.db ??
  mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agrosync_db',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') global.db = db;

export default db;