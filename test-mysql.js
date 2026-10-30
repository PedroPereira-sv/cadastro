const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '080979',
  database: 'tcc_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log('Testando conexão com MySQL...');

pool.query('SHOW TABLES', (err, results) => {
  if (err) {
    console.error('Erro na conexão:', err.message);
  } else {
    console.log('Tabelas no banco:', results);
  }

  pool.query('SELECT COUNT(*) as count FROM users', (err, results) => {
    if (err) {
      console.error('Erro ao contar usuários:', err.message);
    } else {
      console.log('Usuários no banco:', results);
    }

    pool.end((err) => {
      if (err) console.error('Erro ao fechar:', err);
      process.exit(0);
    });
  });
});
