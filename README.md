# Bot d'alerte logement CROUS

Scanne `trouverunlogement.lescrous.fr` toutes les 5 minutes et t'envoie une alerte
Discord dès qu'une nouvelle annonce correspond à tes critères.

## Étape 1 — Installer Node.js

Si ce n'est pas déjà fait : https://nodejs.org (version LTS).
Vérifie avec :
```bash
node -v
```

## Étape 2 — Installer les dépendances

Dans le dossier du projet :
```bash
npm install
```

## Étape 3 — Créer un webhook Discord (2 minutes, pas besoin de créer un vrai bot)

1. Ouvre ton serveur Discord.
2. Clique sur les paramètres du salon (⚙️) où tu veux recevoir les alertes.
3. Va dans **Intégrations** → **Webhooks** → **Nouveau webhook**.
4. Donne-lui un nom (ex: "Alerte CROUS"), puis clique sur **Copier l'URL du webhook**.
5. Colle cette URL dans le fichier `.env` (renomme `.env.example` en `.env` d'abord) :
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

## Étape 4 — Récupérer la bonne URL de recherche (IMPORTANT)

Ne devine pas les paramètres d'URL toi-même : laisse le site les générer.

1. Va sur https://trouverunlogement.lescrous.fr/tools/45/search
2. Applique tes filtres directement sur le site (ville "Poitiers", prix max, etc.).
3. Une fois les résultats filtrés affichés, **copie l'URL dans la barre d'adresse**
   (elle contiendra les paramètres de ton filtre).
4. Colle cette URL dans `config.json`, dans le tableau `searchUrls`.

Tu peux mettre plusieurs URLs si tu veux surveiller plusieurs villes/critères en
même temps (une par ligne).

## Étape 5 — Ajuster tes critères

Dans `config.json`, section `criteres` :
- `prixMax` : prix maximum en euros (`null` pour désactiver)
- `surfaceMin` : surface minimum en m²
- `villesAcceptees` : liste des villes (en majuscules, ex: `["POITIERS"]`)
- `typesAcceptes` : `"Individuel"`, `"Colocation"`, `"Couple"`

## Étape 6 — Tester en local

```bash
npm start
```

Tu dois voir dans le terminal :
```
🚀 Bot lancé. Scan toutes les 5 minute(s).
🔎 X annonce(s) trouvée(s) sur ...
➡️  Rien de nouveau ce cycle.
```

⚠️ **Premier lancement** : toutes les annonces existantes qui correspondent à tes
critères seront considérées comme "déjà vues" seulement APRÈS le premier scan —
donc au tout premier lancement, tu vas recevoir une alerte pour CHAQUE annonce
déjà en ligne qui correspond. C'est normal, ensuite tu ne seras alerté que pour
les nouvelles.

## Étape 7 — Vérifier/ajuster le scraping

Le site du CROUS peut changer sa structure HTML. Si tu remarques que le prix,
la surface ou la ville ne sont pas bien récupérés (`N/A` partout) :
1. Ouvre la page de recherche dans Chrome/Firefox.
2. Clic droit sur une annonce → **Inspecter**.
3. Regarde quel élément HTML contient toute la carte (souvent un `<li>` ou une
   classe du type `fr-card`), et ajuste la fonction `parseListingsFromHtml`
   dans `index.js` si besoin (les commentaires dans le code t'indiquent où).

## Étape 8 — Déployer GRATUITEMENT avec GitHub Actions (recommandé)

GitHub va exécuter ton script toutes les 5 minutes automatiquement et
gratuitement, sans avoir besoin de ton PC ni de carte bancaire.

### 1. Crée un compte GitHub (si tu n'en as pas)
https://github.com/signup

### 2. Crée un nouveau dépôt (repository)
1. Clique sur **+** en haut à droite → **New repository**.
2. Nom : `crous-bot` (ou ce que tu veux).
3. Visibilité : **Public** (important : les comptes gratuits ont des minutes
   GitHub Actions illimitées uniquement sur les dépôts publics — pas de souci
   de confidentialité, on ne mettra jamais ton webhook dans le code, il sera
   stocké séparément en "secret").
4. Clique **Create repository**.

### 3. Envoie le code sur GitHub
Dans ton terminal, à la racine du dossier `crous-bot` :
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_PSEUDO/crous-bot.git
git push -u origin main
```
(remplace `TON_PSEUDO` par ton pseudo GitHub — l'URL exacte est affichée sur la
page de ton dépôt juste après sa création)

### 4. Ajoute ton webhook comme "secret" (jamais visible publiquement)
1. Sur la page de ton dépôt GitHub : **Settings** → **Secrets and variables**
   → **Actions**.
2. **New repository secret**.
3. Nom : `DISCORD_WEBHOOK_URL`
4. Valeur : colle ton URL de webhook Discord.
5. **Add secret**.

### 5. C'est tout !
Le fichier `.github/workflows/scan.yml` est déjà inclus dans ton projet : il
dit à GitHub de lancer `node index.js` toutes les 5 minutes. Va dans l'onglet
**Actions** de ton dépôt pour voir les scans s'exécuter (le premier peut
prendre 5-10 min avant de démarrer, GitHub n'est pas toujours instantané sur
les cron gratuits).

Tu peux aussi cliquer sur **Run workflow** manuellement dans l'onglet Actions
pour tester tout de suite sans attendre.

### Pour mettre à jour tes critères ou ton URL de recherche plus tard
Modifie `config.json` en local, puis :
```bash
git add config.json
git commit -m "update config"
git push
```

### Alternatives (si tu changes d'avis)
- **Railway.app** : plus simple à surveiller mais devient payant après le
  crédit d'essai gratuit.
- **VPS (OVH, Hetzner) ou Oracle Cloud Free Tier** : plus robuste mais demande
  de savoir utiliser SSH/Linux. Dis-moi si tu veux ce guide.

## Fichiers du projet
- `index.js` : logique principale (scraping, filtrage, alerte)
- `config.json` : tes critères + URLs à surveiller
- `.env` : ton webhook Discord (à créer toi-même, jamais à partager)
- `seen.json` : généré automatiquement, mémorise les annonces déjà notifiées
