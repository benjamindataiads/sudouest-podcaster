# Instructions de démarrage

## Prérequis

- Node.js 20+
- Docker et Docker Compose
- Une clé API OpenAI (pour la génération de scripts)
- Une clé API fal.ai (déjà configurée)

## Installation locale

### Méthode 1 : Avec Makefile (Recommandé) 🚀

**Première fois** :
```bash
# 1. Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés API

# 2. Tout lancer en une commande !
make start
```

**Lancements suivants** :
```bash
make quick-start
```

L'application sera disponible sur : http://localhost:3001

### Méthode 2 : Installation manuelle

### 1. Cloner le projet

```bash
git clone <votre-repo>
cd sudouest-podcaster
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```bash
# Copier le template
cp .env.example .env.local
```

Éditez `.env.local` et remplissez vos clés :

```env
# Database
DATABASE_URL=postgresql://podcaster:podcaster_dev@localhost:5433/sudouest_podcaster

# AI Services
FAL_KEY=27435a61-9ebb-4c76-b015-6c848897873a:c3940771e2ac2619a665457b2eec971e
OPENAI_API_KEY=sk-votre-clé-openai-ici

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 4. Lancer la base de données

```bash
docker-compose up db -d
```

Vérifier que PostgreSQL tourne :

```bash
docker ps
```

### 5. Créer les tables de la base de données

```bash
npm run db:generate
npm run db:migrate
```

### 6. Lancer l'application en développement

```bash
npm run dev
```

L'application sera disponible sur : http://localhost:3001

## Test du flux RSS

Pour tester la récupération des articles depuis le flux RSS de Sud-Ouest :

```bash
# Dans un autre terminal
curl http://localhost:3000/api/articles
```

## Structure des dossiers créés automatiquement

L'application créera automatiquement ces dossiers :

```
public/
├── uploads/     # Fichiers temporaires
├── videos/      # Vidéos générées
├── audio/       # Fichiers audio
├── thumbnails/  # Miniatures
└── captions/    # Sous-titres SRT
```

## Utilisation de l'application

### Étape 1 : Sélection des articles

1. Accédez à http://localhost:3001
2. Cliquez sur "Créer un nouveau podcast"
3. L'application récupère automatiquement les 20 derniers articles du jour
4. L'IA pré-sélectionne les 5 articles les plus intéressants
5. Vous pouvez modifier la sélection manuellement
6. Cliquez sur "Continuer"

### Étape 2 : Édition du script

1. L'IA génère un script de 3-4 minutes
2. Vous pouvez lire et éditer le script
3. Cliquez sur "Éditer" pour modifier le texte
4. Sauvegardez vos modifications
5. Cliquez sur "Continuer vers la production"

### Étape 3 : Génération audio/vidéo

1. **Audio** : Choisissez une voix parmi les options disponibles
2. **Vidéo (optionnel)** :
   - Sélectionnez un avatar
   - Activez/désactivez les sous-titres automatiques
3. Cliquez sur "Générer le podcast"
4. Attendez la génération (plusieurs minutes)
5. Téléchargez votre podcast en MP3 ou MP4

## Développement avec Docker

Pour lancer toute l'application avec Docker :

```bash
docker-compose up
```

Cela démarrera :
- PostgreSQL sur le port 5433 (pour éviter les conflits)
- L'application Next.js sur le port 3001

## Commandes utiles

### Avec Makefile (recommandé)

```bash
make help          # Affiche toutes les commandes disponibles
make start         # Lance tout (installation + DB + migrations + app)
make quick-start   # Démarrage rapide sans réinstallation
make stop          # Arrête tous les services
make db-studio     # Ouvre l'interface de la base de données
make db-reset      # Réinitialise complètement la DB
make status        # Affiche le statut de l'application
make logs          # Affiche les logs PostgreSQL
make test-rss      # Teste la connexion au flux RSS Sud-Ouest
make clean         # Nettoyage complet du projet
```

### Commandes npm classiques

```bash
# Générer les types Drizzle
npm run db:generate

# Appliquer les migrations (push vers la DB)
npm run db:push

# Ouvrir Drizzle Studio (interface DB)
npm run db:studio

# Linter
npm run lint

# Build de production
npm run build

# Démarrer en production
npm start
```

## Problèmes courants

### La base de données ne se connecte pas
```bash
# Vérifier que PostgreSQL tourne
docker ps

# Redémarrer la DB
docker-compose restart db
```

### Les articles ne se chargent pas
- Vérifier que le flux RSS de Sud-Ouest est accessible
- Tester manuellement : https://www.sudouest.fr/rss
- Vérifier les logs de l'API : `curl http://localhost:3001/api/articles`

### Erreur fal.ai
- Vérifier votre clé API sur https://fal.ai/dashboard
- Vérifier le crédit disponible
- Regarder les logs : `docker-compose logs app`

### Erreur OpenAI
- Vérifier que votre clé OpenAI est valide
- Vérifier le crédit sur votre compte OpenAI
- Les scripts utilisent GPT-4 Turbo (coût : ~$0.01/script)

## Prochaines étapes

1. **Obtenir une clé OpenAI** : https://platform.openai.com/api-keys
2. **Tester localement** : Créer un podcast complet
3. **Ajouter le logo Sud-Ouest** : Remplacer `public/logo-sudouest.png`
4. **Déployer** : Voir `DEPLOYMENT.md` pour les instructions

## URLs importantes

- Application locale : http://localhost:3001
- Drizzle Studio : http://localhost:4983 (après `npm run db:studio`)
- API Articles : http://localhost:3001/api/articles
- fal.ai Dashboard : https://fal.ai/dashboard
- OpenAI Dashboard : https://platform.openai.com/

## Support

Pour toute question ou problème :
1. Vérifier les logs : `docker-compose logs`
2. Vérifier la console du navigateur (F12)
3. Vérifier les variables d'environnement dans `.env.local`

