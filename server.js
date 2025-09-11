

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
      external404s,
      message: null
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
    res.render('pages/images', { images, message: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});
app.get('/client', (req, res) => {
  res.render('pages/client', { message: null });
});

app.get("/meta", async (req, res) => {
  const crawlId = req.session.activeCrawlId;

  if (!crawlId) {
    return res.render("pages/meta", {
      // titles
      over80: [], under30: [], missing: [], duplicates: [],
      // descriptions
      over300desc: [], under150desc: [], missingdesc: [], duplicatedesc: [],
      message: "No crawl selected"
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, url, title, meta_description
         FROM seo_crawls.url
        WHERE crawl_id = ?`,
      [crawlId]
    );

    const trim = (s) => (s ?? "").toString().trim();

    // ----- Title buckets -----
    const over80 = [], under30 = [], missing = [];
    const titleMap = new Map(); // key = normalized title, val = [{id,url,title}]

    for (const r of rows) {
      const t = trim(r.title);
      const len = t.length;

      if (len === 0) {
        missing.push(r);
      } else {
        if (len > 80) over80.push(r);
        if (len < 30) under30.push(r);

        const key = t.toLowerCase();
        if (!titleMap.has(key)) titleMap.set(key, []);
        titleMap.get(key).push({ id: r.id, url: r.url, title: t });
      }
    }

    const duplicates = [];
    for (const [, list] of titleMap) {
      if (list.length > 1) {
        duplicates.push({
          title: list[0].title,
          pages: list.map(p => ({ id: p.id, url: p.url }))
        });
      }
    }

    // ----- Description buckets -----
    const over300desc = [], under150desc = [], missingdesc = [];
    const descMap = new Map(); // key = normalized description, val = [{id,url,description}]

    for (const r of rows) {
      const d = trim(r.meta_description);
      const dlen = d.length;

      if (dlen === 0) {
        missingdesc.push(r);
      } else {
        if (dlen > 300) over300desc.push(r);
        if (dlen < 150) under150desc.push(r);

        const key = d.toLowerCase();
        if (!descMap.has(key)) descMap.set(key, []);
        descMap.get(key).push({ id: r.id, url: r.url, description: d });
      }
    }

    const duplicatedesc = [];
    for (const [, list] of descMap) {
      if (list.length > 1) {
        duplicatedesc.push({
          description: list[0].description,
          pages: list.map(p => ({ id: p.id, url: p.url }))
        });
      }
    }

    //sorts
    over80.sort((a,b) => a.title.localeCompare(b.title));
    under30.sort((a,b) => a.title.localeCompare(b.title));
    missing.sort((a,b) => a.url.localeCompare(b.url));
    duplicates.sort((a,b) => a.title.localeCompare(b.title));

    over300desc.sort((a,b) => trim(b.meta_description).length - trim(a.meta_description).length);
    under150desc.sort((a,b) => trim(a.meta_description).length - trim(b.meta_description).length);
    missingdesc.sort((a,b) => a.url.localeCompare(b.url));
    duplicatedesc.sort((a,b) => a.description.localeCompare(b.description));

    res.render("pages/meta", {
      //title
      over80, under30, missing, duplicates,
      //descriptions
      over300desc, under150desc, missingdesc, duplicatedesc,
      message: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});

app.get('/redirect_chains', async (req, res) => {
  const crawlId = req.session.activeCrawlId;
  if (!crawlId) {
    return res.render('pages/redirect_chains', { redirects: [], message: "No crawl selected" });
  }

  try {
    //fetch urls
    const [urls] = await pool.query(
      "SELECT id, url, status_code FROM url WHERE crawl_id = ?",
      [crawlId]
    );

    const urlMap = {};
    urls.forEach(u => {
      urlMap[u.url] = { id: u.id, status_code: u.status_code };
    });

    //fetch links
    const [links] = await pool.query(
      "SELECT from_page_id, to_url FROM links WHERE crawl_id = ?",
      [crawlId]
    );

    const linksMap = {};
    links.forEach(l => {
      if (!linksMap[l.from_page_id]) linksMap[l.from_page_id] = [];
      linksMap[l.from_page_id].push(l.to_url);
    });

  
    const redirects = [];

    urls.forEach(u => {
      //start for non redirect pages
      if (u.status_code && ![301, 302].includes(u.status_code)) {
        const fromPageUrl = u.url;
        const chains = [];

        const visited = new Set();

        const startLinks = linksMap[u.id] || [];
        startLinks.forEach(link => {
          let chain = [];
          let current = link;

          while (current && !visited.has(current)) {
            visited.add(current);
            chain.push(current);

            const info = urlMap[current];
            if (!info || ![301,302].includes(info.status_code)) break; //stop at none redirect
            //follows the redirect
            const nextLinks = linksMap[info.id] || [];
            current = nextLinks[0]; //follow first link in chain
          }

          if (chain.length > 0) {
            chains.push(chain);
          }
        });

        //flatten chain
        chains.forEach(chain => {
          if (chain.length > 2) { 
            const row = { start_url: fromPageUrl, number_of_redirects: chain.length };
            chain.forEach((url, idx) => {
              row[`URL_${idx + 1}`] = url;
            });
            redirects.push(row);
          }
        });
      }
    });

    res.render('pages/redirect_chains', { redirects });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to build redirect chains");
  }
});


app.get('/submit_crawl', (req, res) => {
  res.render('pages/submit_crawl');
});

//for crawl selector
app.post('/set-crawl', async (req, res) => {
  const { crawlId } = req.body;

  //stores session
  req.session.activeCrawlId = crawlId;

  res.redirect(req.headers.referer || '/'); //go back to previous page
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});

