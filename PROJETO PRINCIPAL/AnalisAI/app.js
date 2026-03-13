const express = require('express');
const session = require('express-session');
const db = require('./db'); 
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'chave-secreta-meu-site',
  resave: false,
  saveUninitialized: true
}));

function checkAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
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
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3)',
      [nome, usuario, senha]
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
      if (senha === user.senha) {
        req.session.user = user.nome;
        return res.redirect('/dashboard');
      }
    }
    res.render('login', { erro: 'Usuário ou senha inválidos!' });
  } catch (err) {
    res.render('login', { erro: 'Erro ao conectar ao banco de dados.' });
  }
});

app.get('/dashboard', checkAuth, (req, res) => {
  res.render('dashboard/main', { user: req.session.user });
});

app.get('/dashboard/edit', checkAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM alunos ORDER BY id ASC');
        
        res.render('dashboard/edit', { alunos: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar os dados dos alunos.');
    }
});

app.post('/dashboard/update-notas', checkAuth, async (req, res) => {
    const { id, nota, presenca } = req.body;
    
    try {
        for (let i = 0; i < id.length; i++) {
            let nivel = (nota[i] >= 7 && presenca[i] >= 75) ? 'APTO' : 'INAPTO';
            if (nota[i] >= 5 && nota[i] < 7) nivel = 'EM DESENVOLVIMENTO';

            await db.query(
                'UPDATE alunos SET nota = $1, presenca = $2, nivel = $3 WHERE id = $4',
                [nota[i], presenca[i], nivel, id[i]]
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
    
    let nivel = (nota >= 7) ? 'APTO' : (nota >= 5 ? 'EM DESENVOLVIMENTO' : 'INAPTO');
    
    try {
        await db.query(
            'INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES ($1, $2, $3, $4, $5, $6)',
            [nome.toUpperCase(), ano_escolar, idade, nota || 0, 100, nivel]
        );
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard/edit');
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
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE nivel = 'APTO') as apto,
                COUNT(*) FILTER (WHERE nivel = 'INAPTO') as inapto,
                COUNT(*) FILTER (WHERE nivel = 'EM DESENVOLVIMENTO') as desenv,
                AVG(nota) FILTER (WHERE ano_escolar LIKE '%MÉDIO%') as media_medio,
                AVG(nota) FILTER (WHERE ano_escolar LIKE '%FUNDAMENTAL%') as media_fundamental
            FROM alunos
        `);

        const stats = query.rows[0];

        res.render('dashboard/graficos', {
            stats: {
                total: parseInt(stats.total) || 0,
                apto: parseInt(stats.apto) || 0,
                inapto: parseInt(stats.inapto) || 0,
                desenv: parseInt(stats.desenv) || 0,
                mediaMedio: parseFloat(stats.media_medio || 0).toFixed(1),
                mediaFundamental: parseFloat(stats.media_fundamental || 0).toFixed(1)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao processar médias.");
    }
});

app.get('/dashboard/equipe', checkAuth, (req, res) => {
  res.render('dashboard/equipe');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));