import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bcrypt from "bcrypt";
import session from "express-session";
import rateLimit from "express-rate-limit";

const app = express();

const seedUsers = [
    { email: "test1@test.com", password: "123456" },
    { email: "test2@test.com", password: "123456" },
    { email: "admin@test.com", password: "admin123" }
];


app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: "secreto",
    resave: false,
    saveUninitialized: false
}));


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Demasiados intentos, intenta más tarde"
});

app.use("/login", limiter);


const db = await open({
    filename: "./database.db",
    driver: sqlite3.Database
});


await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
        )
`);

for (const user of seedUsers) {
    const existing = await db.get(
        "SELECT * FROM users WHERE email = ?",
        [user.email]
    );

    if (!existing) {
        const hash = await bcrypt.hash(user.password, 10);

        await db.run(
        "INSERT INTO users (email, password) VALUES (?, ?)",
        [user.email, hash]
        );

        console.log(`Usuario creado: ${user.email}`);
    }
}



app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await db.get(
        "SELECT * FROM users WHERE email = ?",
        [email]
    ); 

    if (!user) {
        return res.status(401).send("Usuario no registrado");
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
        return res.status(401).send("Credenciales incorrectas");
    }

    req.session.userId = user.id;

    res.send("Usuario logueado satisfactoriamente");
});

// Esta es una version vulnerable a SQL Injection, no usar en producción
/* app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  
  const query = `
    SELECT * FROM users 
    WHERE email = '${email}' AND password = '${password}'
  `;

  try {
    const user = await db.get(query);

    if (user) {
      res.send("Usuario logueado (VULNERABLE)");
    } else {
      res.status(401).send("Credenciales incorrectas");
    }
  } catch (err) {
    res.status(500).send("Error en el servidor");
  }
});
 */
app.get("/welcome", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("No autorizado");
    }

    res.send("Usuario logueado satisfactoriamente");
});

app.listen(3000, () => {
    console.log("Servidor corriendo en http://localhost:3000");
});