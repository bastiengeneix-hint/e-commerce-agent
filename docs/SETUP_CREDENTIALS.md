# 🔐 Guide de Configuration des Identifiants

Ce guide vous aide à configurer l'application avec vos propres identifiants Google Cloud et Claude API.

## 📋 Prérequis

Vous aurez besoin de :
1. ✅ Un compte Google Cloud (avec projet Hint.work)
2. ✅ Votre clé API Claude (Anthropic)
3. ✅ Une base de données PostgreSQL

## 🚀 Configuration en 3 étapes

### Étape 1 : Configurer Google Cloud OAuth

#### 1.1 Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet **Hint.work** (ou créez-le s'il n'existe pas)

#### 1.2 Activer les APIs nécessaires

Allez sur [API Library](https://console.cloud.google.com/apis/library) et activez ces 3 APIs :

- ✅ **Google Analytics Admin API**
  - URL : https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com
  - Cliquez sur "ACTIVER"

- ✅ **Google Analytics Data API**
  - URL : https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com
  - Cliquez sur "ACTIVER"

- ✅ **People API** (pour l'authentification)
  - URL : https://console.cloud.google.com/apis/library/people.googleapis.com
  - Cliquez sur "ACTIVER"

#### 1.3 Configurer l'écran de consentement OAuth

1. Allez sur [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Sélectionnez **"External"** (ou Internal si vous utilisez Google Workspace)
3. Remplissez les informations obligatoires :
   - **Nom de l'application** : `E-commerce Agent` (ou votre choix)
   - **Adresse e-mail de l'assistance utilisateur** : votre email
   - **Adresse e-mail du développeur** : votre email
4. Cliquez sur **"Enregistrer et continuer"**

5. Sur la page **"Scopes"** (Portées) :
   - Cliquez sur **"ADD OR REMOVE SCOPES"**
   - Ajoutez ces scopes :
     - `../auth/analytics.readonly` (Google Analytics - lecture seule)
     - `../auth/userinfo.email`
     - `../auth/userinfo.profile`
     - `openid`
   - Cliquez sur **"UPDATE"** puis **"SAVE AND CONTINUE"**

6. Sur la page **"Test users"** (si mode Testing) :
   - Ajoutez votre adresse email Google
   - Cliquez sur **"SAVE AND CONTINUE"**

7. Vérifiez le résumé et cliquez sur **"BACK TO DASHBOARD"**

⚠️ **Important** : Si vous voulez que l'app soit utilisable par plus de 100 utilisateurs et sans expiration des tokens après 7 jours, vous devez **publier l'application** en passant du mode "Testing" au mode "In production".

#### 1.4 Créer les identifiants OAuth 2.0

1. Allez sur [Credentials](https://console.cloud.google.com/apis/credentials)
2. Cliquez sur **"CREATE CREDENTIALS"** → **"OAuth 2.0 Client ID"**
3. Choisissez le type : **"Web application"**
4. Configurez :
   - **Nom** : `E-commerce Agent Web Client`
   - **Authorized JavaScript origins** :
     - `http://localhost:3000` (pour développement)
     - `https://votre-domaine-prod.com` (pour production)
   - **Authorized redirect URIs** :
     - `http://localhost:3000/api/auth/callback/google`
     - `https://votre-domaine-prod.com/api/auth/callback/google`
5. Cliquez sur **"CREATE"**

6. 📋 **COPIEZ ET SAUVEGARDEZ** :
   - **Client ID** : commence par `xxxxx.apps.googleusercontent.com`
   - **Client Secret** : une chaîne alphanumérique

⚠️ **Ne partagez JAMAIS ces identifiants publiquement !**

### Étape 2 : Obtenir votre clé API Claude

#### 2.1 Console Anthropic

1. Allez sur [Anthropic Console](https://console.anthropic.com/)
2. Connectez-vous avec votre compte
3. Allez dans **"API Keys"**
4. Cliquez sur **"Create Key"**
5. Donnez-lui un nom : `E-commerce Agent`
6. 📋 **COPIEZ ET SAUVEGARDEZ** votre clé API

La clé commence par `sk-ant-api03-...`

⚠️ **Important** : Vous ne pourrez voir cette clé qu'une seule fois. Sauvegardez-la en sécurité !

#### 2.2 Vérifier vos crédits

- Vérifiez que vous avez des crédits API sur votre compte Anthropic
- Configurez une limite de dépenses si nécessaire

### Étape 3 : Configurer la base de données PostgreSQL

#### Option A : Base de données locale (Développement)

Si vous n'avez pas PostgreSQL installé :

```bash
# Sur macOS avec Homebrew
brew install postgresql@16
brew services start postgresql@16

# Sur Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Sur Windows
# Téléchargez depuis : https://www.postgresql.org/download/windows/
```

Créer la base de données :

```bash
# Se connecter à PostgreSQL
psql postgres

# Dans le shell PostgreSQL, exécuter :
CREATE DATABASE "e-commerce-agent";
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE "e-commerce-agent" TO postgres;
\q
```

Votre `DATABASE_URL` sera :
```
postgresql://postgres:password@localhost:5432/e-commerce-agent
```

#### Option B : Base de données cloud (Production)

Services recommandés :
- **Neon** (https://neon.tech) - Gratuit pour commencer
- **Supabase** (https://supabase.com) - Gratuit pour commencer
- **Railway** (https://railway.app) - Payant
- **Vercel Postgres** (https://vercel.com/storage/postgres) - Payant

Une fois votre base créée, copiez la `DATABASE_URL` fournie par le service.

## 🔧 Configuration du fichier .env

### Méthode 1 : Script interactif (Recommandé)

Utilisez le script de configuration interactif :

```bash
npx tsx scripts/setup-env.ts
```

Le script vous guidera et créera automatiquement votre fichier `.env`.

### Méthode 2 : Configuration manuelle

1. Copiez le fichier d'exemple :
```bash
cp .env.example .env
```

2. Éditez le fichier `.env` :
```bash
nano .env  # ou votre éditeur préféré
```

3. Remplissez avec vos identifiants :

```env
# NextAuth Secret - Générer avec : npx auth secret
AUTH_SECRET="votre-secret-genere-aleatoire"

# Google OAuth (depuis Google Cloud Console)
AUTH_GOOGLE_ID="123456789.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-votre-secret"

# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@host:5432/database"

# Clé API Claude/Anthropic
ANTHROPIC_API_KEY="sk-ant-api03-..."
```

4. Générez un `AUTH_SECRET` sécurisé :
```bash
npx auth secret
```

Copiez la valeur générée et remplacez `AUTH_SECRET` dans votre `.env`.

## ✅ Vérification de la configuration

### 1. Tester votre configuration

```bash
# Lancer le script de diagnostic
npx tsx scripts/debug-google-auth.ts
```

Le script vérifiera :
- ✅ Toutes les variables d'environnement sont présentes
- ✅ La connexion à la base de données fonctionne
- ✅ Les identifiants sont valides

### 2. Initialiser la base de données

```bash
# Générer les migrations
npm run db:generate

# Appliquer les migrations
npm run db:push

# Ou utiliser Drizzle Studio pour visualiser
npm run db:studio
```

### 3. Lancer l'application

```bash
npm run dev
```

L'application devrait démarrer sur http://localhost:3000

### 4. Tester la connexion Google

1. Ouvrez http://localhost:3000
2. Créez un compte / Connectez-vous
3. Essayez de connecter Google Analytics
4. Vérifiez que vous pouvez autoriser l'accès

## 🔒 Sécurité

### ⚠️ NE JAMAIS :
- ❌ Committer le fichier `.env` dans Git
- ❌ Partager vos clés API publiquement
- ❌ Utiliser les mêmes identifiants pour dev et production

### ✅ TOUJOURS :
- ✅ Garder `.env` dans `.gitignore`
- ✅ Utiliser des variables d'environnement différentes par environnement
- ✅ Renouveler vos clés régulièrement
- ✅ Configurer des limites de dépenses sur vos APIs

## 🐛 Résolution de problèmes

### Erreur : "AUTH_GOOGLE_ID is missing"
➡️ Vérifiez que votre fichier `.env` existe et contient `AUTH_GOOGLE_ID`
➡️ Redémarrez votre application après modification du `.env`

### Erreur : "Database connection failed"
➡️ Vérifiez que PostgreSQL est démarré
➡️ Vérifiez votre `DATABASE_URL`
➡️ Testez la connexion : `psql $DATABASE_URL`

### Erreur : "Invalid OAuth client"
➡️ Vérifiez que vos identifiants Google Cloud sont corrects
➡️ Vérifiez que les redirect URIs sont configurés
➡️ Vérifiez que les APIs sont activées

### Erreur : "Anthropic API key invalid"
➡️ Vérifiez que votre clé commence par `sk-ant-api03-`
➡️ Vérifiez que vous avez des crédits sur votre compte

## 📚 Ressources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Anthropic Console](https://console.anthropic.com/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Guide de débogage OAuth](./DEBUG_GOOGLE_AUTH.md)

## 🆘 Besoin d'aide ?

1. Lancez le diagnostic : `npx tsx scripts/debug-google-auth.ts`
2. Consultez le [guide de débogage](./DEBUG_GOOGLE_AUTH.md)
3. Vérifiez les logs dans la console pendant l'exécution

---

**✨ Une fois configuré, votre application sera prête à utiliser Google Analytics et Claude AI !**
