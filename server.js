

const express = require("express");
const mysql = require("mysql2/promise");

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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.render('pages/home');
});

app.get("/get_urls", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM seo_crawls.crawls;");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

app.get("/get_links", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM seo_crawls.links LIMIT 10;");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});


app.get('/4xx', async (req, res) => {
  try {
    // Internal 404s
    const [internal404s] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE status_code LIKE '4%' AND page_scope = 'internal';"
    );

    // External 404s
    const [external404s] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE status_code LIKE '4%' AND page_scope = 'external';"
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
  try {
    const [images] = await pool.query(
      "SELECT * FROM seo_crawls.url WHERE content_type LIKE 'image/%';"
    );

    res.render('pages/images', { images });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});

app.get("/meta", async (req, res) => {
  try {
    const [urls] = await pool.query("SELECT * FROM seo_crawls.url LIMIT 10;");
    res.render("pages/meta", { urls });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});


app.get('/submit_crawl', (req, res) => {
  res.render('pages/submit_crawl');
});




// app.get("/:page", (req, res) => {
//   const page = req.params.page; // grabs whatever is after "/"
//   const filePath = path.join(__dirname, "views", `${page}.html`);

//   res.sendFile(filePath, (err) => {
//     if (err) {
//       res.status(404).send("Page not found");
//     }
//   });
// });








app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});




const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});

