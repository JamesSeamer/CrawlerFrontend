

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

app.get("/:page", (req, res) => {
  const page = req.params.page; // grabs whatever is after "/"
  const filePath = path.join(__dirname, "views", `${page}.html`);

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send("Page not found");
    }
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});


const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});

