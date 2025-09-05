

const express = require("express");
const mysql = require("mysql2/promise");
const session = require('express-session');

require("dotenv").config();

const dbConfig = {
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  port: process.env.port, 
};
const pool = mysql.createPool(dbConfig);
const path = require("path");


const app = express();

app.use(session({
  secret: 'dev-secret',
  resave: false,
  saveUninitialized: true
}));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap')));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Middleware for the crawl selector
app.use(async (req, res, next) => {
  try {
    // Fetch crawls with URL counts
    const [crawls] = await pool.query(`
      SELECT c.id, c.start_url, c.start_time, COUNT(u.id) AS url_count
      FROM seo_crawls.crawls c
      LEFT JOIN seo_crawls.url u ON u.crawl_id = c.id
      GROUP BY c.id
      ORDER BY c.start_time DESC
    `);

    res.locals.crawls = crawls;
    res.locals.activeCrawlId = req.session.activeCrawlId || null;
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('pages/home');
});


app.get('/4xx', async (req, res) => {
  const crawlId = req.session.activeCrawlId;
  if (!crawlId) {
    return res.render('pages/4xx', { internal404s: [], external404s: [], message: "No crawl selected" });
  }

  try {
    // Internal 404s
    const [internal404s] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE status_code LIKE '4%' AND page_scope = 'internal' AND crawl_id = ?",
      [crawlId]
    );

    // External 404s
    const [external404s] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE status_code LIKE '4%' AND page_scope = 'external' AND crawl_id = ?",
      [crawlId]
    );

    res.render('pages/4xx', {
      internal404s,
      external404s
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});

app.get('/images', async (req, res) => {
  const crawlId = req.session.activeCrawlId;
  if (!crawlId) {
    return res.render('pages/images', { images: [], message: "No crawl selected" });
  }

  try {
    const [images] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE content_type LIKE 'image/%' AND crawl_id = ?",
      [crawlId]
    );
    res.render('pages/images', { images });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});

app.get("/meta", async (req, res) => {
  const crawlId = req.session.activeCrawlId;
  if (!crawlId) {
    return res.render('pages/meta', { urls: [], message: "No crawl selected" });
  }

  try {
    const [urls] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE crawl_id  = ?",
      [crawlId]
    );
    res.render("pages/meta", { urls });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});


app.get('/submit_crawl', (req, res) => {
  res.render('pages/submit_crawl');
});

// For crawl selector
app.post('/set-crawl', async (req, res) => {
  const { crawlId } = req.body;

  // Store selected crawl in session
  req.session.activeCrawlId = crawlId;

  res.redirect(req.headers.referer || '/'); // go back to previous page
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});

