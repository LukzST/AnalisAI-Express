import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'chave-secreta-senai',
    resave: false,
    saveUninitialized: false
}));


app.get('/', (req, res) => {
    res.render('landing', { title: 'Bem-vindo - SENAI CIC', layout: 'layouts/main' });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login - Sistema Pedagógico', layout: 'layouts/main' });
});

import { exibirDashboard } from './src/controllers/alunoController.js';
app.get('/dashboard', exibirDashboard);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));