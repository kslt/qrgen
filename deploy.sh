#Första gången, gör detta script körbart med sudo chmod +x deploy.sh

#!/bin/bash

# Kontrollfråga
read -p "Vill du verkligen deploya ändringar till GitHub och servern? (ja/nej): " svar
if [ "$svar" != "ja" ]; then
    echo "Avbröt deploy."
    exit 0
fi

# Gå till projektmappen
cd /var/www/html/qr_code_generator

# Skicka upp lokala ändringar till GitHub
git add .
git commit -m "Automatisk commit från servern" 2>/dev/null

# Pusha till GitHub
git push origin main 2>/dev/null

# Hämta senaste ändringar från GitHub
git pull origin main

# Installera nya beroenden om det finns
npm install --production

# Starta om PM2-processen
pm2 restart qrgen

echo "Deploy klart!"
