const express = require("express");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const multer = require("multer");
const sharp = require("sharp");
require("dotenv").config();

const app = express();
const PORT = 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const QR_LIFETIME = 24 * 60 * 60 * 1000; // 24 timmar

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "hemlignyckel",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 2 * 60 * 60 * 1000 },
}));

// Multer för filuppladdning
const upload = multer({ dest: "uploads/" });

// Skapa mappar om de inte finns
const qrFolder = path.join(__dirname, "qr_codes");
const uploadFolder = path.join(__dirname, "uploads");
if (!fs.existsSync(qrFolder)) fs.mkdirSync(qrFolder);
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Funktion för att rensa gamla QR-koder
function cleanOldQRCodes() {
    fs.readdir(qrFolder, (err, files) => {
        if (err) return console.error("Kunde inte läsa QR-mappen:", err);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(qrFolder, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && now - stats.mtimeMs > QR_LIFETIME) {
                    fs.unlink(filePath, () => console.log(`Borttagen gammal QR: ${file}`));
                }
            });
        });
    });
}
setInterval(cleanOldQRCodes, 6 * 60 * 60 * 1000);

// Middleware för admin-skydd
function checkAuth(req, res, next) {
    if (req.session.loggedIn) return next();
    res.redirect("/login");
}

// --- ROUTES ---

// Login
app.get("/login", (req, res) => {
    res.send(`
        <h2>Admin Login</h2>
        <form method="POST" action="/login">
            <label>Lösenord:</label>
            <input type="password" name="password" required>
            <button type="submit">Logga in</button>
        </form>
    `);
});
app.post("/login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect("/admin");
    } else {
        res.send("<h2>Fel lösenord! <a href='/login'>Försök igen</a></h2>");
    }
});

// Adminpanel
app.get("/admin", checkAuth, (req, res) => {
    fs.readdir(qrFolder, (err, files) => {
        if (err) return res.status(500).send("Kunde inte läsa QR-mappen.");
        let fileList = files.map(file => `
            <div style="margin-bottom: 15px;">
                <img src="/qr_codes/${file}" width="100"><br>
                <p>${file}</p>
                <a href="/qr_codes/${file}" download>⬇ Ladda ner</a> | 
                <a href="/delete?file=${file}" style="color: red;">❌ Ta bort</a>
            </div>
        `).join("");
        res.send(`
            <h1>Adminpanel - QR-koder</h1>
            <p><a href="/logout">Logga ut</a></p>
            <p><strong>Totalt antal QR-koder:</strong> ${files.length}</p>
            ${fileList || "<p>Inga QR-koder genererade ännu.</p>"}
        `);
    });
});

// Delete
app.get("/delete", checkAuth, (req, res) => {
    const { file } = req.query;
    if (!file) return res.status(400).send("Ingen fil angiven.");
    fs.unlink(path.join(qrFolder, file), err => {
        if (err) return res.status(500).send("Kunde inte ta bort filen.");
        res.redirect("/admin");
    });
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

// Serve QR codes
app.use("/qr_codes", express.static(qrFolder));

// --- Startsida med formulär ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generera QR-kod</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
<div class="container mt-4">
    <h1 class="mb-4">Generera QR-kod</h1>
    <form method="POST" action="/generate" enctype="multipart/form-data">
        <div class="mb-3">
            <label for="type" class="form-label">Välj typ av QR-kod:</label>
            <select name="type" id="type" class="form-select" onchange="updateForm()">
                <option value="url">Länk (URL)</option>
                <option value="email">E-post</option>
                <option value="tel">Telefonnummer</option>
                <option value="sms">SMS</option>
                <option value="wifi">Wi-Fi</option>
                <option value="text">Valfri text</option>
            </select>
        </div>
        <div id="formFields" class="mb-3">
            <label for="input1" class="form-label">Länk (URL):</label>
            <input type="text" name="input1" class="form-control" required>
        </div>
        <div class="mb-3">
            <label for="size" class="form-label">Storlek på QR-kod:</label>
            <select name="size" id="size" class="form-select">
                <option value="300">Liten (300px)</option>
                <option value="600">Mellan (600px)</option>
                <option value="1000" selected>Stor (1000px)</option>
            </select>
        </div>
        <div class="mb-3">
            <label for="logo" class="form-label">Lägg till logga i mitten (valfritt):</label>
            <input type="file" name="logo" id="logo" class="form-control" accept="image/*">
        </div>
        <button type="submit" class="btn btn-primary">Skapa QR-kod</button>
    </form>
    <p class="mt-4"><a href="/admin">Gå till adminpanelen</a></p>
</div>

<script>
function updateForm() {
    const type = document.getElementById("type").value;
    const container = document.getElementById("formFields");
    let html = "";
    switch(type) {
        case "url":
            html = '<label for="input1" class="form-label">Länk (URL):</label><input type="text" name="input1" class="form-control" required>';
            break;
        case "email":
            html = '<label for="input1" class="form-label">E-postadress:</label><input type="email" name="input1" class="form-control" required>';
            break;
        case "tel":
            html = '<label for="input1" class="form-label">Telefonnummer:</label><input type="tel" name="input1" class="form-control" required>';
            break;
        case "sms":
            html = '<label for="input1" class="form-label">Telefonnummer:</label><input type="tel" name="input1" class="form-control" required><label for="input2" class="form-label">Meddelande:</label><input type="text" name="input2" class="form-control">';
            break;
        case "wifi":
            html = '<label for="input1" class="form-label">SSID:</label><input type="text" name="input1" class="form-control" required><label for="input2" class="form-label">Lösenord:</label><input type="text" name="input2" class="form-control"><label for="encryption" class="form-label">Kryptering:</label><select name="encryption" class="form-select"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="">Ingen</option></select>';
            break;
        case "text":
        default:
            html = '<label for="input1" class="form-label">Text:</label><textarea name="input1" rows="4" class="form-control" required></textarea>';
            break;
    }
    container.innerHTML = html;
}
</script>
</body>
</html>
    `);
});

// --- POST /generate ---
app.post("/generate", upload.single("logo"), async (req, res) => {
    const { type, input1, input2, encryption, size } = req.body;
    if (!input1) return res.status(400).send("Obligatoriskt fält saknas.");

    // Skapa QR-text
    let qrText;
    switch(type) {
        case "url": qrText = input1; break;
        case "email": qrText = `mailto:${input1}`; break;
        case "tel": qrText = `tel:${input1}`; break;
        case "sms": qrText = `SMSTO:${input1}:${input2 || ""}`; break;
        case "wifi": qrText = `WIFI:T:${encryption || ""};S:${input1};P:${input2 || ""};;`; break;
        case "text": default: qrText = input1; break;
    }

    try {
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0,14);
        const sanitized = qrText.replace(/[^a-zA-Z0-9]/g,"_").slice(0,50);
        let fileName = `${sanitized}_${timestamp}.png`;
        const filePath = path.join(qrFolder, fileName);
        const pixelSize = Number(size) || 1000;

        // Skapa QR
        await QRCode.toFile(filePath, qrText, { width: pixelSize, margin: 2 });

        // Om logga finns → lägg in
        if (req.file) {
            const logoSize = Math.floor(pixelSize * 0.2);
            const resizedLogo = await sharp(req.file.path)
                .resize(logoSize, logoSize)
                .png()
                .toBuffer();

            const finalPath = filePath.replace(".png","_final.png");
            await sharp(filePath)
                .composite([{ input: resizedLogo, gravity: "center" }])
                .png()
                .toFile(finalPath);

            fileName = path.basename(finalPath);
        }

        // Render resultat
        res.send(`
<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QR-kod skapad</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
<div class="container mt-4">
    <h2>QR-kod genererad</h2>
    <p><strong>Innehåll:</strong> ${qrText}</p>
    <img src="/qr_codes/${fileName}" alt="QR-kod" class="img-fluid mb-3">
    <a href="/qr_codes/${fileName}" download class="btn btn-success">⬇ Ladda ner QR-koden</a>
    <p class="mt-3"><a href="/">Skapa en till</a></p>
</div>
</body>
</html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send("Kunde inte generera QR-kod.");
    }
});

app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
    cleanOldQRCodes();
});
