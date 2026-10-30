const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.user) {
    return res.sendFile(require('path').join(__dirname, '..', 'views', 'dashboard.html'));
  }
  res.sendFile(require('path').join(__dirname, '..', 'views', 'login.html'));
});

router.get('/cadastro', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'views', 'cadastro.html'));
});

router.get('/esqueci-senha', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'views', 'forgot-password.html'));
});

router.get('/redefinir-senha', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'views', 'reset-password.html'));
});

module.exports = router;
