import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pageRoutes from './src/routes/pageRoutes.js';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/assets', express.static(path.join(root, 'public/assets')));
app.get('/api/config.js', (req, res) => {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  };
  res.type('application/javascript').send(`window.APP_CONFIG = Object.freeze(${JSON.stringify(config)});`);
});
app.get('/sw.js', (req, res) => res.sendFile(path.join(root, 'sw.js')));
app.use('/', pageRoutes);

app.use((req, res) => res.status(404).render('pages/not-found', { title: 'Không tìm thấy trang', active: '' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('pages/error', { title: 'Có lỗi xảy ra', active: '' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Timesheets MVC listening on http://localhost:${port}`));
