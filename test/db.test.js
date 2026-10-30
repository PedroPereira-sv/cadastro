const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadDbWithPath(dbPath) {
  delete require.cache[require.resolve('../db')];
  delete process.env.DB_CLIENT;
  delete process.env.MYSQL_HOST;
  delete process.env.MYSQL_PORT;
  delete process.env.MYSQL_USER;
  delete process.env.MYSQL_PASSWORD;
  delete process.env.MYSQL_DATABASE;
  process.env.SQLITE_DB_PATH = dbPath;
  return require('../db');
}

test('deve selecionar o adaptador MySQL quando a configuração estiver habilitada', () => {
  delete require.cache[require.resolve('../db')];
  process.env.DB_CLIENT = 'mysql';
  process.env.MYSQL_HOST = '127.0.0.1';
  process.env.MYSQL_PORT = '3306';
  process.env.MYSQL_USER = 'root';
  process.env.MYSQL_PASSWORD = '';
  process.env.MYSQL_DATABASE = 'tcc_auth';

  const db = require('../db');
  assert.equal(db.dbType, 'mysql');

  return new Promise((resolve) => {
    db.close(() => resolve());
  });
});

test('deve persistir um usuário em um banco SQLite configurado via variável de ambiente', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-db-'));
  const dbPath = path.join(tempDir, 'test.sqlite');
  const db = loadDbWithPath(dbPath);

  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users', (err) => {
      if (err) {
        db.close();
        return reject(err);
      }

      db.run('INSERT INTO users (nome, email, senha) VALUES (?, ?, ?)', ['Teste', 'teste@teste.com', 'hash'], (insertErr) => {
        if (insertErr) {
          db.close();
          return reject(insertErr);
        }

        db.get('SELECT nome, email FROM users WHERE email = ?', ['teste@teste.com'], (selectErr, row) => {
          db.close();
          if (selectErr) return reject(selectErr);

          assert.ok(fs.existsSync(dbPath), 'o arquivo do banco deve ser criado no caminho configurado');
          assert.deepEqual(row, { nome: 'Teste', email: 'teste@teste.com' });
          resolve();
        });
      });
    });
  });
});
