const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/users', (req, res) => {
  db.all('SELECT id, nome, email FROM users', (err, rows) => {
    if (err) {
      return res.status(500).send('Erro ao listar usuários');
    }
    let html = '<!doctype html><html><head><meta charset="utf-8"><title>Usuários</title><style>body{font-family:Arial,sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:8px;text-align:left;}th{background:#f4f4f4;}</style></head><body><h2>Usuários cadastrados</h2><table><thead><tr><th>Id</th><th>Nome</th><th>Email</th></tr></thead><tbody>';
    html += rows.map(r => `<tr><td>${r.id}</td><td>${r.nome}</td><td>${r.email}</td></tr>`).join('');
    html += '</tbody></table></body></html>';
    res.send(html);
  });
});

module.exports = router;
