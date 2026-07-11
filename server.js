require('dotenv').config();
const express = require('express');
const { scanOnce } = require('./scanner');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple protection : si tu définis SCAN_SECRET, seules les requêtes qui
// connaissent ce secret peuvent déclencher un scan (évite que n'importe qui
// sur internet fasse tourner ton bot en boucle en devinant l'URL).
const SECRET = process.env.SCAN_SECRET || null;

let lastRun = null;
let isScanning = false;

app.get('/', (req, res) => {
  res.send('🏠 CROUS logement bot - en ligne. Utilise /scan pour déclencher un scan.');
});

app.get('/scan', async (req, res) => {
  if (SECRET && req.query.secret !== SECRET) {
    return res.status(403).send('Secret invalide.');
  }

  if (isScanning) {
    return res.status(200).send('Un scan est déjà en cours, on ignore cette requête.');
  }

  isScanning = true;
  try {
    const result = await scanOnce();
    lastRun = new Date().toISOString();
    res.status(200).json({ ok: true, lastRun, ...result });
  } catch (err) {
    console.error('❌ Erreur pendant le scan:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    isScanning = false;
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}. Route /scan prête à être appelée.`);
});
