const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/cadastro', authController.registerUser);
router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);
router.post('/deletar-conta', authController.deleteUser);
router.post('/esqueci-senha', authController.requestPasswordReset);
router.post('/redefinir-senha', authController.resetPassword);

module.exports = router;
