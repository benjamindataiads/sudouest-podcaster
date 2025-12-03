# Guide de Déploiement

## Option 1 : Railway (Recommandé pour Docker)

Railway est parfait pour ce projet car il supporte nativement Docker et PostgreSQL.

### Étapes de déploiement sur Railway

1. **Créer un compte sur Railway**
   - Aller sur https://railway.app
   - Se connecter avec GitHub

2. **Créer un nouveau projet**
   - Cliquer sur "New Project"
   - Choisir "Deploy from GitHub repo"
   - Sélectionner votre repository

3. **Ajouter PostgreSQL**
   - Dans votre projet, cliquer sur "+ New"
   - Choisir "Database" → "PostgreSQL"
   - Railway créera automatiquement une base de données

4. **Configurer les variables d'environnement**
   - Cliquer sur votre service
   - Aller dans l'onglet "Variables"
   - Ajouter :
     ```
     FAL_KEY=27435a61-9ebb-4c76-b015-6c848897873a:c3940771e2ac2619a665457b2eec971e
     OPENAI_API_KEY=votre_clé_openai
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     ```

5. **Déployer**
   - Railway détectera automatiquement le Dockerfile
   - Le déploiement se fera automatiquement
   - Vous obtiendrez une URL publique

### Coût Railway
- Plan gratuit : 500 heures/mois (suffisant pour commencer)
- Plan Hobby : $5/mois

## Option 2 : Vercel (Pour Next.js uniquement)

Vercel est excellent pour Next.js mais ne supporte pas Docker ni ffmpeg nativement.

### Limitations sur Vercel
⚠️ **Attention** : La génération vidéo avec ffmpeg ne fonctionnera PAS sur Vercel car :
- Pas de système de fichiers persistant
- Pas de support ffmpeg
- Limite de temps d'exécution (10s gratuit, 60s Pro)

**Solution** : Utiliser uniquement la partie audio sur Vercel, ou déployer sur Railway.

### Étapes si vous choisissez Vercel

1. **Installer Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Configurer la base de données**
   - Utiliser Neon (https://neon.tech) ou Supabase (https://supabase.com)
   - Récupérer l'URL de connexion PostgreSQL

3. **Déployer**
   ```bash
   vercel
   ```

4. **Configurer les variables d'environnement**
   - Dans le dashboard Vercel, aller dans Settings → Environment Variables
   - Ajouter :
     ```
     FAL_KEY=27435a61-9ebb-4c76-b015-6c848897873a:c3940771e2ac2619a665457b2eec971e
     OPENAI_API_KEY=votre_clé_openai
     DATABASE_URL=postgresql://...
     ```

5. **Redéployer**
   ```bash
   vercel --prod
   ```

## Option 3 : Render

Alternative gratuite à Railway avec support Docker.

### Étapes pour Render

1. **Créer un compte sur Render**
   - Aller sur https://render.com
   - Se connecter avec GitHub

2. **Créer un nouveau Web Service**
   - "New +" → "Web Service"
   - Connecter votre repository GitHub
   - Choisir "Docker" comme environnement

3. **Ajouter PostgreSQL**
   - "New +" → "PostgreSQL"
   - Créer la base de données
   - Copier l'Internal Database URL

4. **Configurer les variables d'environnement**
   ```
   FAL_KEY=27435a61-9ebb-4c76-b015-6c848897873a:c3940771e2ac2619a665457b2eec971e
   OPENAI_API_KEY=votre_clé_openai
   DATABASE_URL=postgresql://...
   ```

5. **Déployer**
   - Render détectera le Dockerfile
   - Le premier déploiement prend 10-15 minutes

### Coût Render
- Plan gratuit : Service se met en veille après 15 min d'inactivité
- Plan Starter : $7/mois

## Recommandation

**Pour ce projet, utilisez Railway** car :
- ✅ Support natif Docker
- ✅ PostgreSQL inclus
- ✅ ffmpeg fonctionne
- ✅ Système de fichiers persistant
- ✅ Déploiement simple
- ✅ Prix raisonnable

## Après le déploiement

1. **Migrer la base de données**
   ```bash
   # Si Railway CLI installé
   railway run npm run db:migrate
   
   # Sinon, connectez-vous à la DB et exécutez les migrations manuellement
   ```

2. **Tester l'application**
   - Aller sur l'URL fournie par Railway
   - Créer un podcast test
   - Vérifier que tout fonctionne

3. **Ajouter le logo Sud-Ouest**
   - Remplacer `public/logo-sudouest.png` par le vrai logo

4. **Configurer le domaine personnalisé** (optionnel)
   - Dans Railway : Settings → Domains
   - Ajouter votre domaine et configurer le DNS

## Troubleshooting

### Erreur de connexion DB
- Vérifier que DATABASE_URL est correctement configuré
- S'assurer que les migrations ont été exécutées

### Erreur fal.ai
- Vérifier que FAL_KEY est correctement configuré
- Tester sur https://fal.ai/dashboard

### Erreur OpenAI
- Vérifier que OPENAI_API_KEY est valide
- Vérifier le crédit disponible sur votre compte OpenAI

### Génération vidéo échoue
- Vérifier que ffmpeg est installé (dans le Dockerfile)
- Vérifier les logs du service
- S'assurer que le dossier public/videos est accessible

