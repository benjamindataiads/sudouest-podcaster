# Sud-Ouest Podcaster

Générateur automatique de podcasts audio et vidéo basé sur les articles du journal Sud-Ouest.

## Fonctionnalités

### Étape 1 : Sélection des articles
- Récupération automatique des 20 derniers articles du jour
- Organisation par thèmes
- Sélection automatique des 5 articles les plus intéressants (IA)
- Modification manuelle possible

### Étape 2 : Génération du script
- Génération automatique d'un script audio de 3-4 minutes
- Édition et modification du script
- Validation avant génération

### Étape 3 : Production du contenu
- **Audio** : Choix de voix et génération via fal.ai
- **Vidéo** (optionnel) :
  - Choix d'un avatar
  - Lip-sync automatique
  - Logo Sud-Ouest et date en overlay
  - Génération automatique de sous-titres
- Export en MP3 ou MP4

## Stack Technique

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Base de données**: PostgreSQL avec Drizzle ORM
- **IA**: fal.ai pour TTS, avatars et lip-sync
- **Traitement vidéo**: ffmpeg
- **Styling**: Tailwind CSS + shadcn/ui
- **Déploiement**: Railway ou Vercel

## Installation

### Prérequis
- Node.js 20+
- Docker et Docker Compose
- Compte fal.ai avec clé API

### Installation rapide avec Makefile 🚀

**Première utilisation** (installe tout et lance l'app) :
```bash
make start
```

**Lancements suivants** (démarrage rapide) :
```bash
make quick-start
```

L'application sera accessible sur http://localhost:3001

### Installation manuelle

1. Cloner le repository
```bash
git clone <repo-url>
cd sudouest-podcaster
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env.local
# Éditer .env.local avec vos clés API
```

4. Lancer la base de données
```bash
docker-compose up db -d
```

5. Créer les tables de la base de données
```bash
npm run db:generate
npm run db:push
```

6. Lancer le serveur de développement
```bash
npm run dev
```

L'application sera accessible sur http://localhost:3001

### Commandes Makefile disponibles

```bash
make help          # Affiche toutes les commandes disponibles
make start         # Lance tout (installation + DB + migrations + app)
make quick-start   # Démarrage rapide (sans réinstaller)
make stop          # Arrête tous les services
make db-studio     # Ouvre l'interface de la base de données
make status        # Affiche le statut de l'application
make logs          # Affiche les logs
```

### Lancement avec Docker

```bash
docker-compose up
```

## Déploiement

### Railway

1. Créer un nouveau projet sur Railway
2. Ajouter PostgreSQL depuis les services
3. Connecter votre repository GitHub
4. Configurer les variables d'environnement
5. Déployer

### Vercel

1. Installer Vercel CLI
```bash
npm i -g vercel
```

2. Déployer
```bash
vercel
```

3. Configurer PostgreSQL (Neon ou Supabase recommandés)
4. Ajouter les variables d'environnement dans le dashboard Vercel

## Structure du projet

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (routes)/          # Pages
│   └── layout.tsx         # Layout principal
├── components/            # Composants React
│   ├── ui/               # Composants UI (shadcn)
│   └── features/         # Composants métier
├── lib/                   # Utilities et configurations
│   ├── db/               # Configuration DB et schémas
│   ├── services/         # Services (scraping, IA, etc.)
│   └── utils/            # Fonctions utilitaires
└── types/                # Types TypeScript
```

## Licence

Projet personnel/professionnel

