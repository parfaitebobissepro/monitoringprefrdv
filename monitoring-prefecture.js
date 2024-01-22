const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const http = require('http');
const nodemailer = require('nodemailer');

// Constantes
const app = express();
const PORT = process.env.PORT || 3000;
const tempsExecution = 100 * 1000; // Temps d'attente en millisecondes (15 minutes par défaut)

// Charger les informations sensibles depuis un fichier de configuration
const config = require('./config');

// Configuration du transporteur (transporter) pour Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.gmail.user,
    pass: config.gmail.password,
  },
});

// Définition des informations de l'e-mail
const optionsEmail = {
  from: config.gmail.user,
  to: config.emailRecipient,
  subject: 'Test d\'envoi de courriel',
  text: 'Ceci est un test d\'envoi de courriel via Node.js et Gmail.',
};

// Fonction pour écrire des journaux dans un fichier
function logToFile(message) {
  const logFilePath = 'log.txt';
  fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${message}\n`);
}

// Fonction principale pour exécuter le script
async function runScript() {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  const url = 'https://url-rendez-vous.com';

  await page.goto(url, {
    waitUntil: 'networkidle0'
  });

  const content = await page.content();

  const targetPhrase = "Plus de créneaux disponibles selon vos filtres. Des créneaux peuvent se libérer bientôt, reconnectez-vous plus tard";
  if (content.includes(targetPhrase)) {
    const logMessage = 'La phrase est présente. Ne sauvegarde pas le contenu.';
    console.log(logMessage);
    logToFile(logMessage);
  } else {
    fs.writeFileSync('available/creneau.html', content);
    const logMessage = 'Le contenu est stocké dans available/creneau.html.';
    console.log(logMessage);
    logToFile(logMessage);

    // Envoi de l'e-mail
    transporter.sendMail(optionsEmail, (erreur, info) => {
      if (erreur) {
        console.error(erreur.message);
      } else {
        console.log('E-mail envoyé avec succès!', info.response);
      }

      // Fermeture du transporteur (transporter)
      transporter.close();
    });

    const requestData = {
      user: config.sms.user,
      password: config.sms.password,
      senderid: 'Sender',
      sms: 'test message creneau',
      mobiles: config.smsRecipient
    };

    const postData = JSON.stringify(requestData);

    const options = {
      hostname: 'smsvas.com',
      path: '/bulk/public/index.php/api/v1/sendsms',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('Response:', responseData);
        // Ajouter une entrée de journal pour l'envoi réussi du SMS
        const logRequestMessage = 'SMS envoyé avec succès.';
        logToFile(logRequestMessage);
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error.message);
      // Ajouter une entrée de journal pour l'erreur d'envoi de SMS
      const logErrorMessage = `Erreur lors de l'envoi du SMS: ${error.message}`;
      logToFile(logErrorMessage);
    });

    req.write(postData);
    req.end();
  }

  await browser.close();
}

// Point d'entrée principal
setInterval(async () => {
  console.log('Exécution du script...');
  await runScript();
}, tempsExecution);

// Démarrer le serveur Express
app.listen(PORT, () => {
  console.log(`Serveur Express en cours d'exécution sur le port ${PORT}`);
});