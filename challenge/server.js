const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 1337;
const JWT_SECRET = process.env.JWT_SECRET || "nexora_super_secret_key_2025";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const users = [
    {
        email: "mahesh@nexora.htb",
        password: "9b8f2c1e7a4d6b3f8e0a1c5d2b7e9f4a",
        role: "admin",
        name: "Mahesh"
    }
];

function issueToken(user) {
    return jwt.sign(
        { email: user.email, role: user.role, name: user.name || "" },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

function sendPage(res, name) {
    res.sendFile(path.join(__dirname, "views", name));
}

// Page routes (clean URLs, no .html). Raw HTML files are kept under
// challenge/views/ and never served by the static middleware so that
// directory enumeration only finds the clean paths below.
app.get("/", (req, res) => sendPage(res, "index.html"));
app.get("/about", (req, res) => sendPage(res, "about_us.html"));
app.get("/login", (req, res) => sendPage(res, "login.html"));
app.get("/signin", (req, res) => sendPage(res, "login.html"));
app.get("/signup", (req, res) => sendPage(res, "login.html"));
app.get("/register", (req, res) => sendPage(res, "login.html"));
app.get("/admin", (req, res) => {
    const token = req.cookies && req.cookies.token;
    if (token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            if (payload.email === "mahesh@nexora.htb") {
                return res.redirect("/admin/dashboard");
            }
        } catch (err) { /* fall through to admin login page */ }
    }
    sendPage(res, "admin.html");
});
app.get("/dashboard", (req, res) => {
    const token = req.cookies && req.cookies.token;
    if (token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            if (payload.email === "mahesh@nexora.htb") {
                return res.redirect("/admin/dashboard");
            }
        } catch (err) { /* fall through to user dashboard */ }
    }
    sendPage(res, "user_dashboard.html");
});

app.post("/api/register", (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
    }
    if (users.find(u => u.email === email)) {
        return res.status(409).json({ error: "user already exists" });
    }
    const newUser = { email, password, role: "user", name: (name || "").toString().trim() };
    users.push(newUser);
    const token = issueToken(newUser);
    return res.status(200).json({ message: "registered", token });
});

app.post("/api/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
    }
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ error: "invalid credentials" });
    }
    const token = issueToken(user);
    return res.status(200).json({ message: "logged in", token });
});

// Decoy admin login. Always rejects. This exists so the form on /admin
// makes a real network request and shows up cleanly in tooling like
// Burp / browser devtools, while still being a dead end.
app.post("/admin/login", (req, res) => {
    return res.status(401).json({ error: "Invalid Credentials" });
});

// VULNERABILITY: This endpoint is supposed to just check whether an email
// is already in use. When the email exists it instead leaks a freshly
// signed JWT for that user inside a 500 error response. This is the
// intended path used to obtain admin access.
app.post("/api/validate", (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ error: "email is required" });
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(200).json({ available: true });
    }

    const leakedToken = issueToken(user);
    return res.status(500).json({
        error: "Internal Server Error",
        message: "validation failed: account record corrupted",
        debug: {
            email: user.email,
            token: leakedToken
        }
    });
});

// VULNERABILITY: Authorization for the admin dashboard is decided purely
// from the `email` claim inside the JWT payload. Any valid JWT whose
// `email` equals the admin email grants access, including the one
// leaked by /api/validate.
function adminMiddleware(req, res, next) {
    const token = req.cookies && req.cookies.token;
    if (!token) {
        return res.status(401).send("Unauthorized: missing token");
    }
    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).send("Unauthorized: invalid token");
    }
    if (payload.email !== "mahesh@nexora.htb") {
        return res.status(401).send("Unauthorized");
    }
    req.user = payload;
    next();
}

app.get("/admin/dashboard", adminMiddleware, (req, res) => {
    sendPage(res, "dashboard.html");
});

app.use((req, res) => {
    res.status(404).type("text/plain").send("Not Found");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`NEXORA listening on port ${PORT}`);
});
