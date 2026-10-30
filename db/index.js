require('dotenv').config();

const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('Erro ao conectar/criar tabela:', err);
    return;
  }

  db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX password_reset_tokens_user_id (user_id),
      CONSTRAINT password_reset_tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (tokenTableError) => {
    if (tokenTableError) {
      console.error('Erro ao criar tabela de recuperação de senha:', tokenTableError);
      return;
    }

    console.log('Banco MySQL conectado e tabelas prontas.');
  });
});

module.exports = db;
