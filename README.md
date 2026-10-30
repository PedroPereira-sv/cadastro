# Projeto de Login com SQLite

Aplicação de exemplo com cadastro, login e exclusão de usuário usando Node.js, Express e SQLite.

## Estrutura
- `server.js`: configuração do servidor Express
- `db/index.js`: inicialização do banco SQLite
- `controllers/authController.js`: lógica de cadastro, login, logout e exclusão
- `routes/authRoutes.js`: rotas de autenticação
- `routes/viewRoutes.js`: rotas das páginas de login e cadastro
- `routes/userRoutes.js`: rota que lista usuários em HTML
- `views/`: páginas HTML do site
- `db/database.sqlite`: arquivo do banco de dados

## Como rodar

1. Instale dependências:
```bash
npm install
```

2. Execute o servidor:
```bash
npm start
```

3. Acesse no navegador:
```
http://localhost:3000
```

## Rotas úteis
- `GET /` — página de login
- `GET /cadastro` — página de cadastro
- `POST /cadastro` — envia cadastro
- `POST /login` — envia login
- `POST /logout` — faz logout
- `POST /deletar-conta` — exclui a conta do usuário logado
- `GET /users` — lista de usuários cadastrados
- `GET /esqueci-senha` e `POST /esqueci-senha` — solicitam um link de recuperação
- `GET /redefinir-senha?token=...` e `POST /redefinir-senha` — permitem cadastrar uma nova senha

As rotas de cadastro e login aceitam formulários (`application/x-www-form-urlencoded`) e JSON (`application/json`). Envie os campos `nome`, `email` e `senha` para `POST /cadastro`; para `POST /login`, envie `email` e `senha`.

## Recuperação de senha

Configure estas variáveis no ambiente local (`.env`) e na hospedagem:

```env
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-usuario
SMTP_PASS=sua-senha-ou-senha-de-aplicativo
SMTP_FROM=conta-remetente@seudominio.com
APP_URL=https://seu-backend.vercel.app
FRONTEND_URL=https://seu-site.com
FRONTEND_RESET_URL=https://seu-site.com/pages/redefinirsenha.html
```

O token enviado por e-mail expira em 30 minutos, só pode ser usado uma vez e é armazenado no banco apenas como hash. Para Gmail, use uma senha de app em `SMTP_PASS`, não a senha normal da conta. A tabela `password_reset_tokens` é criada automaticamente junto com a tabela de usuários.

`FRONTEND_URL` deve ser a origem publicada do site e autoriza as chamadas do navegador ao backend. `FRONTEND_RESET_URL` deve apontar para a página de redefinição no front-end. Em desenvolvimento, sirva o front-end em `http://localhost:5500` (por exemplo, com Live Server); o backend já permite essa origem.

## Observações
- As senhas são armazenadas com hash usando `bcryptjs`.
- O banco SQLite fica em `db/database.sqlite`.

## Alterações feitas
-Alterações realizadas no Back-end e Banco de Dados

Durante o desenvolvimento e publicação do sistema, foi necessário realizar algumas alterações no back-end para garantir seu funcionamento no ambiente de produção da Vercel.

Inicialmente, o sistema utilizava o SQLite como banco de dados, armazenando as informações dos usuários em um arquivo database.sqlite. Apesar de funcionar no ambiente local, essa solução apresentou problemas quando o projeto foi publicado na Vercel, principalmente por depender de um banco armazenado diretamente nos arquivos do servidor.

Por esse motivo, foi realizada a migração do banco de dados de SQLite para MySQL. Para hospedar o banco MySQL foi utilizado o serviço Aiven, permitindo que o banco ficasse disponível externamente e pudesse ser acessado tanto durante o desenvolvimento local quanto pelo sistema publicado na Vercel.

No projeto Node.js, a biblioteca sqlite3 deixou de ser utilizada para as operações do sistema e foi adotada a biblioteca mysql2, responsável pela comunicação entre o back-end e o banco MySQL. O arquivo db/index.js foi modificado para criar uma conexão com o banco através de um pool de conexões e também para garantir a criação da tabela users, utilizada para armazenar nome, e-mail e senha dos usuários.

O authController.js também precisou ser adaptado. Os métodos específicos do SQLite, como db.run() e db.get(), foram substituídos por consultas utilizando db.query(). Dessa forma, as funcionalidades de cadastro, login e exclusão de usuários passaram a funcionar utilizando o MySQL. O sistema continua utilizando o bcryptjs para armazenar as senhas dos usuários de forma criptografada por hash.

Também foram configuradas variáveis de ambiente para evitar que informações sensíveis do banco fossem colocadas diretamente no código. Foram utilizadas as variáveis DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME. No desenvolvimento local essas informações são armazenadas no arquivo .env, enquanto na versão publicada elas foram configuradas como variáveis de ambiente da Vercel.

O arquivo .gitignore também foi configurado para impedir o envio do .env, arquivos SQLite e node_modules para o repositório. Isso ajuda a evitar principalmente a exposição de informações privadas, como a senha de acesso ao banco.

Após as alterações, o funcionamento do MySQL foi testado localmente. Em seguida, as modificações foram registradas utilizando Git, enviadas para o repositório no GitHub e, através da integração do repositório com a Vercel, uma nova versão do sistema foi publicada.

Com essas mudanças, a arquitetura passou a funcionar da seguinte maneira:

Usuário → Aplicação hospedada na Vercel → Back-end Node.js/Express → Banco MySQL hospedado na Aiven

A migração resolveu o problema relacionado ao uso do SQLite no ambiente de hospedagem e permitiu que os dados dos usuários fossem armazenados em um banco externo, permanecendo disponíveis independentemente das novas publicações realizadas na Vercel.