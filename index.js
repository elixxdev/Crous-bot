require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SEEN_PATH = path.join(__dirname, 'seen.json');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS || '300000', 10);

if (!WEBHOOK_URL) {
  console.error("❌ DISCORD_WEBHOOK_URL manquant dans le fichier .env");
  process.exit(1);
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function loadSeen() {
  if (!fs.existsSync(SEEN_PATH)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, 'utf-8')));
  } catch {
    return new Set();
  }
}

function saveSeen(seenSet) {
  fs.writeFileSync(SEEN_PATH, JSON.stringify([...seenSet]), 'utf-8');
}

// --- SCRAPING D'UNE PAGE ---
// ⚠️ IMPORTANT : cette fonction se base sur des motifs génériques (liens contenant
// "/accommodations/"). Si le CROUS change son site, ou si certaines infos ne
// remontent pas bien, ouvre la page dans ton navigateur, fais clic droit > Inspecter
// sur une annonce, et ajuste les sélecteurs ci-dessous en conséquence.
function parseListingsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const listings = [];
  const seenIdsOnPage = new Set();

  $('a[href*="/accommodations/"]').each((_, el) => {
    const href = $(el).attr('href');
    const idMatch = href.match(/accommodations\/(\d+)/);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIdsOnPage.has(id)) return; // évite les doublons (parfois 2 <a> par carte)
    seenIdsOnPage.add(id);

    const fullLink = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    const name = $(el).text().trim();

    // On remonte au bloc "carte" qui contient toutes les infos de l'annonce.
    // 'li' correspond en général à un élément de la liste de résultats.
    let card = $(el).closest('li');
    if (card.length === 0) card = $(el).parent().parent().parent();
    const text = card.text().replace(/\s+/g, ' ').trim();

    const priceMatch = text.match(/(\d+(?:,\d+)?)\s*€/);
    const surfaceMatch = text.match(/(\d+(?:,\d+)?)\s*m²/);
    // Le code postal + ville est en général du type "86000 POITIERS"
    const cityMatch = text.match(/\d{5}\s+([A-ZÀ-Ÿ' -]+)/);

    listings.push({
      id,
      name,
      link: fullLink,
      price: priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : null,
      surface: surfaceMatch ? parseFloat(surfaceMatch[1].replace(',', '.')) : null,
      city: cityMatch ? cityMatch[1].trim() : null,
      type: /Colocation/i.test(text) ? 'Colocation' : (/Couple/i.test(text) ? 'Couple' : 'Individuel'),
      raw: text.slice(0, 300)
    });
  });

  return listings;
}

function matchesCriteres(listing, criteres) {
  if (criteres.prixMax != null && listing.price != null && listing.price > criteres.prixMax) return false;
  if (criteres.surfaceMin != null && listing.surface != null && listing.surface < criteres.surfaceMin) return false;
  if (criteres.villesAcceptees && criteres.villesAcceptees.length > 0 && listing.city) {
    const villeOk = criteres.villesAcceptees.some(v => listing.city.toUpperCase().includes(v.toUpperCase()));
    if (!villeOk) return false;
  }
  if (criteres.typesAcceptes && criteres.typesAcceptes.length > 0) {
    if (!criteres.typesAcceptes.includes(listing.type)) return false;
  }
  return true;
}

async function sendDiscordAlert(listing) {
  const embed = {
    title: `🏠 ${listing.name}`,
    url: listing.link,
    color: 0x2ecc71,
    fields: [
      { name: 'Prix', value: listing.price ? `${listing.price} €` : 'N/A', inline: true },
      { name: 'Surface', value: listing.surface ? `${listing.surface} m²` : 'N/A', inline: true },
      { name: 'Ville', value: listing.city || 'N/A', inline: true },
      { name: 'Type', value: listing.type, inline: true },
    ],
    footer: { text: 'CROUS - Phase complémentaire' },
    timestamp: new Date().toISOString()
  };

  try {
    await axios.post(WEBHOOK_URL, {
      content: '🔔 Nouveau logement qui pourrait te convenir !',
      embeds: [embed]
    });
    console.log(`✅ Alerte envoyée pour: ${listing.name} (id ${listing.id})`);
  } catch (err) {
    console.error('❌ Erreur envoi Discord:', err.response?.data || err.message);
  }
}

async function scanOnce() {
  const config = loadConfig();
  const seen = loadSeen();
  let newCount = 0;

  for (const url of config.searchUrls) {
    try {
      const { data: html } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrousLogementBot/1.0)' },
        timeout: 15000
      });

      const listings = parseListingsFromHtml(html, url);
      console.log(`🔎 ${listings.length} annonce(s) trouvée(s) sur ${url}`);

      for (const listing of listings) {
        if (seen.has(listing.id)) continue; // déjà notifié
        if (!matchesCriteres(listing, config.criteres)) continue;

        await sendDiscordAlert(listing);
        seen.add(listing.id);
        newCount++;
      }
    } catch (err) {
      console.error(`❌ Erreur en scannant ${url}:`, err.message);
    }
  }

  saveSeen(seen);
  console.log(newCount > 0 ? `➡️  ${newCount} nouvelle(s) alerte(s) envoyée(s).` : '➡️  Rien de nouveau ce cycle.');
}

async function main() {
  const singleRun = process.env.RUN_MODE === 'once';

  if (singleRun) {
    // Mode utilisé par GitHub Actions : une seule exécution, puis on quitte.
    console.log('🚀 Scan unique (mode GitHub Actions).');
    await scanOnce();
    process.exit(0);
  } else {
    // Mode utilisé en local : boucle infinie toutes les X minutes.
    console.log(`🚀 Bot lancé. Scan toutes les ${INTERVAL_MS / 60000} minute(s).`);
    await scanOnce();
    setInterval(scanOnce, INTERVAL_MS);
  }
}

main();
