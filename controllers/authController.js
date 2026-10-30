const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');

const RESET_TOKEN_TTL_MINUTES = 30;
const PASSWORD_MIN_LENGTH = 8;

function query(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
}

function getConnection() {
  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(connection);
    });
  });
}

function beginTransaction(connection) {
  return new Promise((resolve, reject) => {
    connection.beginTransaction((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function commit(connection) {
  return new Promise((resolve, reject) => {
    connection.commit((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function rollback(connection) {
  await new Promise((resolve, reject) => {
    connection.rollback((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function createMailTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM e uma porta SMTP válida são necessários.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

function getAppUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
}

function sendResetError(res, message, status = 500) {
  res.status(status).send(
    `<!DOCTYPE html><html lang="pt-BR"><meta charset="UTF-8"><title>Recuperação de senha</title>` +
    `<p>${message}</p><a href="/esqueci-senha">Tentar novamente</a></html>`
  );
}

function sendApiResult(req, res, status, mensagem) {
  if (req.is('application/json')) {
    return res.status(status).json({ mensagem });
  }

  return null;
}

function getPasswordResetUrl(token) {
  if (!process.env.FRONTEND_RESET_URL) {
    return `${getAppUrl()}/redefinir-senha?token=${token}`;
  }

  const resetUrl = new URL(process.env.FRONTEND_RESET_URL);
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
}

function registerUser(req, res) {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    const apiResponse = sendApiResult(req, res, 400, 'Preencha todos os campos.');
    if (apiResponse) return apiResponse;
    return res.send('Preencha todos os campos.');
  }

  const hash = bcrypt.hashSync(senha, 10);

  db.query(
    'INSERT INTO users (nome, email, senha) VALUES (?, ?, ?)',
    [nome, email, hash],
    (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          const apiResponse = sendApiResult(req, res, 409, 'Este e-mail já está cadastrado.');
          if (apiResponse) return apiResponse;
          return res.send('Este e-mail já está cadastrado.');
        }

        console.error(err);
        const apiResponse = sendApiResult(req, res, 500, 'Erro ao cadastrar usuário.');
        if (apiResponse) return apiResponse;
        return res.send('Erro ao cadastrar usuário.');
      }

      const apiResponse = sendApiResult(req, res, 201, 'Cadastro realizado com sucesso.');
      if (apiResponse) return apiResponse;
      res.redirect('/');
    }
  );
}

function loginUser(req, res) {
  const { email, senha } = req.body;

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    (err, rows) => {
      if (err) {
        console.error('Erro ao consultar usuário no login:', err);
        const apiResponse = sendApiResult(req, res, 500, 'Não foi possível fazer login agora.');
        if (apiResponse) return apiResponse;
        return res.status(500).send('Não foi possível fazer login agora.');
      }

      if (rows.length === 0) {
        const apiResponse = sendApiResult(req, res, 401, 'E-mail ou senha incorretos.');
        if (apiResponse) return apiResponse;
        return res.send('Usuário não encontrado.');
      }

      const row = rows[0];

      const senhaValida = bcrypt.compareSync(senha, row.senha);

      if (!senhaValida) {
        const apiResponse = sendApiResult(req, res, 401, 'E-mail ou senha incorretos.');
        if (apiResponse) return apiResponse;
        return res.send('Senha incorreta.');
      }

      req.session.user = {
        id: row.id,
        nome: row.nome,
        email: row.email
      };

      const apiResponse = sendApiResult(req, res, 200, 'Login realizado com sucesso.');
      if (apiResponse) return apiResponse;
      res.redirect('/');
    }
  );
}

function logoutUser(req, res) {
  req.session.destroy(() => {
    res.redirect('/');
  });
}

function deleteUser(req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const userId = req.session.user.id;

  db.query(
    'DELETE FROM users WHERE id = ?',
    [userId],
    (err) => {
      if (err) {
        console.error(err);
        return res.send('Erro ao excluir conta.');
      }

      req.session.destroy(() => {
        res.redirect('/');
      });
    }
  );
}

async function requestPasswordReset(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  let mailTransport;

  try {
    mailTransport = createMailTransport();
  } catch (err) {
    console.error('Configuração de e-mail para recuperação inválida:', err.message);
    if (req.is('application/json')) {
      return res.status(503).json({ mensagem: 'A recuperação de senha não está configurada. Tente novamente mais tarde.' });
    }
    return sendResetError(res, 'A recuperação de senha não está configurada. Tente novamente mais tarde.', 503);
  }

  let connection;
  let tokenHash;
  let transactionStarted = false;
  let userFound = false;

  try {
    connection = await getConnection();
    await beginTransaction(connection);
    transactionStarted = true;

    const users = await query(
      connection,
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      await commit(connection);
      transactionStarted = false;
      if (req.is('application/json')) {
        return res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
      }
      return res.redirect('/esqueci-senha?enviado=1');
    }

    userFound = true;
    const token = crypto.randomBytes(32).toString('hex');
    tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await query(connection, 'DELETE FROM password_reset_tokens WHERE user_id = ?', [users[0].id]);
    await query(
      connection,
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${RESET_TOKEN_TTL_MINUTES} MINUTE))`,
      [users[0].id, tokenHash]
    );
    await commit(connection);
    transactionStarted = false;
    connection.release();
    connection = null;

    const resetUrl = getPasswordResetUrl(token);
    await mailTransport.sendMail({
      from: process.env.SMTP_FROM,
      to: users[0].email,
      subject: 'Redefinição de senha',
      text: `Use este link para cadastrar uma nova senha. O link expira em ${RESET_TOKEN_TTL_MINUTES} minutos:\n\n${resetUrl}`,
      html: `<p>Você solicitou a redefinição da sua senha.</p><p><a href="${resetUrl}">Cadastrar nova senha</a></p><p>O link expira em ${RESET_TOKEN_TTL_MINUTES} minutos. Se você não fez essa solicitação, ignore este e-mail.</p>`
    });

    if (req.is('application/json')) {
      return res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
    }

    return res.redirect('/esqueci-senha?enviado=1');
  } catch (err) {
    console.error('Erro ao solicitar redefinição de senha:', err);

    if (connection && transactionStarted) {
      try {
        await rollback(connection);
      } catch (rollbackError) {
        console.error('Erro ao cancelar solicitação de redefinição:', rollbackError);
      }
    }

    if (tokenHash) {
      db.query('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash], (deleteError) => {
        if (deleteError) {
          console.error('Erro ao invalidar token após falha no envio:', deleteError);
        }
      });
    }

    if (userFound) {
      if (req.is('application/json')) {
        return res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' });
      }
      return res.redirect('/esqueci-senha?enviado=1');
    }

    if (req.is('application/json')) {
      return res.status(500).json({ mensagem: 'Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.' });
    }

    return sendResetError(res, 'Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function resetPassword(req, res) {
  const { token, senha, confirmarSenha } = req.body;

  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    if (req.is('application/json')) {
      return res.status(400).json({ mensagem: 'Link inválido ou expirado. Solicite uma nova recuperação.' });
    }
    return sendResetError(res, 'Link inválido ou expirado. Solicite uma nova recuperação.', 400);
  }

  if (typeof senha !== 'string' || senha.length < PASSWORD_MIN_LENGTH) {
    if (req.is('application/json')) {
      return res.status(400).json({ mensagem: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` });
    }
    return sendResetError(res, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`, 400);
  }

  if (senha !== confirmarSenha) {
    if (req.is('application/json')) {
      return res.status(400).json({ mensagem: 'As senhas não coincidem.' });
    }
    return sendResetError(res, 'As senhas não coincidem.', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let connection;
  let transactionStarted = false;

  try {
    const passwordHash = await bcrypt.hash(senha, 10);
    connection = await getConnection();
    await beginTransaction(connection);
    transactionStarted = true;

    const tokens = await query(
      connection,
      'SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
      [tokenHash]
    );

    if (tokens.length === 0) {
      await rollback(connection);
      transactionStarted = false;
      if (req.is('application/json')) {
        return res.status(400).json({ mensagem: 'Link inválido ou expirado. Solicite uma nova recuperação.' });
      }
      return sendResetError(res, 'Link inválido ou expirado. Solicite uma nova recuperação.', 400);
    }

    await query(connection, 'UPDATE users SET senha = ? WHERE id = ?', [passwordHash, tokens[0].user_id]);
    await query(connection, 'DELETE FROM password_reset_tokens WHERE user_id = ?', [tokens[0].user_id]);
    await commit(connection);
    transactionStarted = false;
    connection.release();
    connection = null;

    if (req.is('application/json')) {
      return res.json({ mensagem: 'Senha redefinida com sucesso.' });
    }

    return res.redirect('/?senhaAtualizada=1');
  } catch (err) {
    console.error('Erro ao redefinir senha:', err);

    if (connection && transactionStarted) {
      try {
        await rollback(connection);
      } catch (rollbackError) {
        console.error('Erro ao cancelar redefinição de senha:', rollbackError);
      }
    }

    if (req.is('application/json')) {
      return res.status(500).json({ mensagem: 'Não foi possível redefinir a senha. Tente novamente mais tarde.' });
    }

    return sendResetError(res, 'Não foi possível redefinir a senha. Tente novamente mais tarde.');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  deleteUser,
  requestPasswordReset,
  resetPassword
};