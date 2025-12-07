const express = require("express");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const QR_LIFETIME = 24 * 60 * 60 * 1000; // 24 timmar

// Middleware
app.use(express.urlencoded({ extended: true })); // För att hantera POST-data
app.use(
    session({
        secret: "hemlignyckel", // Byt ut till något säkert
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 2 * 60 * 60 * 1000 }, // Sessionen varar i 2 timmar
    })
);

// Skapa QR-kod-mappen om den inte finns
const qrFolder = path.join(__dirname, "qr_codes");
if (!fs.existsSync(qrFolder)) {
    fs.mkdirSync(qrFolder);
}

// Funktion för att rensa gamla QR-koder
function cleanOldQRCodes() {
    fs.readdir(qrFolder, (err, files) => {
        if (err) return console.error("Kunde inte läsa QR-kod-mappen:", err);

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
setInterval(cleanOldQRCodes, 6 * 60 * 60 * 1000); // Kör var 6:e timme

// Middleware för att skydda admin-routes
function checkAuth(req, res, next) {
    if (req.session.loggedIn) {
        return next();
    }
    res.redirect("/login");
}

// Inloggningssida
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

// Hantera inloggning
app.post("/login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect("/admin");
    } else {
        res.send("<h2>Fel lösenord! <a href='/login'>Försök igen</a></h2>");
    }
});

// Adminpanel (lösenordsskyddad)
app.get("/admin", checkAuth, (req, res) => {
    fs.readdir(qrFolder, (err, files) => {
        if (err) return res.status(500).send("Kunde inte läsa QR-mappen.");

        let fileList = files
            .map(file => `
                <div>
                    <img src="/qr_codes/${file}" width="100">
                    <p>${file}</p>
                    <a href="/qr_codes/${file}" download>⬇ Ladda ner</a> | 
                    <a href="/delete?file=${file}" style="color: red;">❌ Ta bort</a>
                </div>
            `)
            .join("");

        res.send(`
            <h1>Adminpanel - QR-koder</h1>
            <p><a href="/logout">Logga ut</a></p>
            <p><strong>Totalt antal QR-koder:</strong> ${files.length}</p>
            ${fileList || "<p>Inga QR-koder genererade ännu.</p>"}
        `);
    });
});

// Radera QR-kod (lösenordsskyddad)
app.get("/delete", checkAuth, (req, res) => {
    const { file } = req.query;
    const filePath = path.join(qrFolder, file);
    if (!file) return res.status(400).send("Ingen fil angiven.");

    fs.unlink(filePath, err => {
        if (err) return res.status(500).send("Kunde inte ta bort filen.");
        res.redirect("/admin");
    });
});

// Hantera utloggning
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

// Endpoint för att generera QR-koder
app.get("/generate", async (req, res) => {
    const { text } = req.query;
    if (!text) return res.status(400).json({ error: "Ange en text för QR-koden" });

    try {
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
        const sanitizedText = text.replace(/[^a-zA-Z0-9]/g, "_");
        const fileName = `${sanitizedText}_${timestamp}.png`;
        const filePath = path.join(qrFolder, fileName);

        await QRCode.toFile(filePath, text);
        res.send(`
            <h2>QR-kod för: ${text}</h2>
            <img src="/qr_codes/${fileName}" alt="QR Code">
            <p><a href="/qr_codes/${fileName}" download>⬇ Ladda ner QR-koden</a></p>
        `);
    } catch (error) {
        res.status(500).json({ error: "Kunde inte generera QR-kod" });
    }
});

// Servera QR-koder från mappen
app.use("/qr_codes", express.static(qrFolder));

app.listen(PORT, () => {
    console.log(`Servern körs på http://localhost:${PORT}`);
    cleanOldQRCodes();
});

// Startsida med formulär
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
                <form method="POST" action="/generate">
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
                        <!-- Fält för URL som standard -->
                        <label for="input1" class="form-label">Länk (URL):</label>
                        <input type="text" name="input1" class="form-control" required>
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



app.post("/generate", async (req, res) => {
    const { type, input1, input2, encryption } = req.body;
    if (!input1) return res.status(400).send("Obligatoriskt fält saknas.");

    let qrText;
    switch (type) {
        case "url":
            qrText = input1;
            break;
        case "email":
            qrText = `mailto:${input1}`;
            break;
        case "tel":
            qrText = `tel:${input1}`;
            break;
        case "sms":
            qrText = `SMSTO:${input1}:${input2 || ""}`;
            break;
        case "wifi":
            qrText = `WIFI:T:${encryption || ""};S:${input1};P:${input2 || ""};;`;
            break;
        case "text":
        default:
            qrText = input1;
            break;
    }

    try {
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
        const sanitized = qrText.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
        const fileName = `${sanitized}_${timestamp}.png`;
        const filePath = path.join(qrFolder, fileName);

        await QRCode.toFile(filePath, qrText);

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
        res.status(500).send("Kunde inte generera QR-kod.");
    }
});
