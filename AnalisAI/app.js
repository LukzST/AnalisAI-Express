const express = require('express');
const session = require('express-session');
const db = require('./db'); 
const app = express();
const favicon = require('serve-favicon');
const path = require('path');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'chave-secreta-meu-site',
  resave: false,
  saveUninitialized: true
}));

function checkAuth(req, res, next) {
  if (req.session.user && req.session.userStatus === 'ATIVO') {
    next();
  } else {
    req.session.destroy();
    res.redirect('/login');
  }
}

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.get('/termos', (req, res) => {
  res.render('termos');
});

app.get('/cadastro', (req, res) => {
  res.render('cadastro', { erro: null });
});

app.post('/cadastro', async (req, res) => {
  const { nome, usuario, senha, confirmar_senha } = req.body;

  if (senha !== confirmar_senha) {
    return res.render('cadastro', { erro: 'As senhas não coincidem!' });
  }

  if (senha.length < 6) {
    return res.render('cadastro', { erro: 'A senha deve ter no mínimo 6 caracteres!' });
  }

  try {
    await db.query(
      'INSERT INTO usuarios (nome, email, senha, status, cargo) VALUES ($1, $2, $3, $4, $5)',
      [nome, usuario, senha, 'ATIVO', 'Professor']
    );
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') {
      res.render('cadastro', { erro: 'Este e-mail já está cadastrado!' });
    } else {
      res.render('cadastro', { erro: 'Erro ao realizar cadastro.' });
    }
  }
});

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [usuario]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      if (user.status !== 'ATIVO') {
        return res.render('login', { erro: 'Sua conta está inativa. Contate o administrador.' });
      }

      if (senha === user.senha) {
        req.session.user = user.nome;
        req.session.userStatus = user.status;
        return res.redirect('/dashboard');
      }
    }
    res.render('login', { erro: 'Usuário ou senha inválidos!' });
  } catch (err) {
    res.render('login', { erro: 'Erro ao conectar ao banco de dados.' });
  }
});

app.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM alunos');
        res.render('dashboard/main', { 
            user: req.session.user, 
            alunos: result.rows 
        });
    } catch (err) {
        res.render('dashboard/main', { user: req.session.user, alunos: [] });
    }
});

app.get('/dashboard/edit', checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.*, 
            (SELECT json_agg(n.* ORDER BY n.data_criacao ASC) 
            FROM notas_detalhadas n 
            WHERE n.aluno_id = a.id) as notas_individuais
            FROM alunos a
            ORDER BY a.nome ASC
        `);
        
        res.render('dashboard/edit', { alunos: result.rows });
    } catch (err) {
        console.error(err);
        res.send("Erro ao carregar dados");
    }
});

app.post('/dashboard/atribuir-nota', checkAuth, async (req, res) => {
    const { aluno_id, titulo, descricao, valor } = req.body;

    try {
        await db.query(
            'INSERT INTO notas_detalhadas (aluno_id, titulo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [aluno_id, titulo, descricao, valor]
        );
        await db.query(`
            UPDATE alunos 
            SET nota = (SELECT AVG(valor) FROM notas_detalhadas WHERE aluno_id = $1)
            WHERE id = $1
        `, [aluno_id]);

        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao salvar nota");
    }
});

app.post('/dashboard/update-notas', checkAuth, async (req, res) => {
    const { id, nota, presenca } = req.body;
    
    try {
        const ids = Array.isArray(id) ? id : [id];
        const notas = Array.isArray(nota) ? nota : [nota];
        const presencas = Array.isArray(presenca) ? presenca : [presenca];

        for (let i = 0; i < ids.length; i++) {
            let n = parseFloat(notas[i]);
            let p = parseInt(presencas[i]);
            let nivel = (n >= 7 && p >= 75) ? 'APTO' : (n < 5 || p < 50 ? 'INAPTO' : 'EM DESENVOLVIMENTO');

            await db.query(
                'UPDATE alunos SET nota = $1, presenca = $2, nivel = $3 WHERE id = $4',
                [n, p, nivel, ids[i]]
            );
        }
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard/edit');
    }
});

app.post('/dashboard/add-aluno', checkAuth, async (req, res) => {
    const { nome, ano_escolar, idade, nota } = req.body;
    try {
        let n = parseFloat(nota) || 0;
        let p = 100;
        let nivel = (n >= 7 && p >= 75) ? 'APTO' : (n < 5 || p < 50 ? 'INAPTO' : 'EM DESENVOLVIMENTO');

        const result = await db.query(
            'INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', 
            [nome, ano_escolar, idade, n, p, nivel]
        );

        if (n > 0) {
            await db.query(
                'INSERT INTO notas_detalhadas (aluno_id, titulo, descricao, valor) VALUES ($1, $2, $3, $4)', 
                [result.rows[0].id, 'Nota Inicial', 'Cadastro', n]
            );
        }
        res.redirect('/dashboard/edit');
    } catch (err) { 
        console.error(err);
        res.status(500).send("Erro ao adicionar aluno"); 
    }
});

app.get('/dashboard/delete-aluno/:id', checkAuth, async (req, res) => {
    const id = req.params.id;
    
    try {
        await db.query('DELETE FROM alunos WHERE id = $1', [id]);
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao remover aluno.");
    }
});

app.get('/dashboard/graficos', checkAuth, async (req, res) => {
    try {
        const query = await db.query(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE nivel = 'APTO')::int as apto,
                COUNT(*) FILTER (WHERE nivel = 'INAPTO')::int as inapto,
                COALESCE(AVG(nota) FILTER (WHERE ano_escolar LIKE '%MÉDIO%'), 0)::float as media_medio,
                COALESCE(AVG(nota) FILTER (WHERE ano_escolar LIKE '%FUNDAMENTAL%'), 0)::float as media_fundamental
            FROM alunos
        `);

        const row = query.rows[0];
        const stats = {
            total: row.total || 0,
            apto: row.apto || 0,
            inapto: row.inapto || 0,
            mediaMedio: row.media_medio.toFixed(1),
            mediaFundamental: row.media_fundamental.toFixed(1)
        };

        res.render('dashboard/graficos', { stats });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao processar dados dos gráficos.");
    }
});

app.get('/dashboard/equipe', checkAuth, (req, res) => {
  res.render('dashboard/equipe');
});

app.get('/dashboard/usuarios', checkAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome, email, cargo, status FROM usuarios ORDER BY nome ASC');
        res.render('dashboard/usuarios', { usuarios: result.rows });
    } catch (err) {
        res.status(500).send("Erro ao carregar usuários");
    }
});

app.post('/dashboard/usuarios/add', checkAuth, async (req, res) => {
    const { nome, email, senha, cargo } = req.body;
    try {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, cargo, status) VALUES ($1, $2, $3, $4, $5)',
            [nome, email, senha, cargo, 'ATIVO']
        );
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        res.status(500).send("Erro ao cadastrar usuário");
    }
});

app.post('/dashboard/usuarios/update', checkAuth, async (req, res) => {
    const { id, nome, email, cargo, status } = req.body;
    try {
        await db.query(
            'UPDATE usuarios SET nome=$1, email=$2, cargo=$3, status=$4 WHERE id=$5',
            [nome, email, cargo, status, id]
        );
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        res.status(500).send("Erro ao atualizar usuário");
    }
});

app.get('/dashboard/usuarios/delete/:id', checkAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        res.status(500).send("Erro ao excluir usuário");
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));