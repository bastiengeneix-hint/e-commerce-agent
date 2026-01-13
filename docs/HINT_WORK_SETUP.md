# 🏢 Configuration pour le Projet Hint.work

Ce guide est spécifiquement adapté pour configurer l'application e-commerce-agent avec vos identifiants **Hint.work**.

## 🎯 Vue d'ensemble

Vous allez configurer :
1. **Google Cloud OAuth** (projet Hint.work)
2. **Clé API Claude** (compte Anthropic Hint.work)
3. **Base de données PostgreSQL**

## ⚡ Méthode Rapide (Recommandée)

```bash
# Lancez le script de configuration interactif
npx tsx scripts/setup-env.ts
```

Le script vous guidera étape par étape et créera automatiquement votre fichier `.env`.

## 📝 Configuration Manuelle

### Étape 1 : Google Cloud Console (Projet Hint.work)

#### A. Accéder au projet

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. En haut à gauche, cliquez sur le sélecteur de projet
3. Sélectionnez **"Hint.work"** (ou le nom exact de votre projet)

#### B. Activer les APIs requises

Allez sur [API Library](https://console.cloud.google.com/apis/library) et activez :

1. **Google Analytics Admin API**
   ```
   https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com
   ```
   → Cliquez sur "ENABLE" / "ACTIVER"

2. **Google Analytics Data API**
   ```
   https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com
   ```
   → Cliquez sur "ENABLE" / "ACTIVER"

3. **People API** (pour l'authentification)
   ```
   https://console.cloud.google.com/apis/library/people.googleapis.com
   ```
   → Cliquez sur "ENABLE" / "ACTIVER"

#### C. Configurer l'écran de consentement OAuth

1. Allez sur [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)

2. Si ce n'est pas déjà fait, configurez :
   - **Type d'utilisateur** : External (ou Internal si Google Workspace)
   - **Nom de l'application** : E-commerce Agent Hint
   - **Email de support** : votre email Hint.work
   - **Email du développeur** : votre email Hint.work

3. **Scopes (Autorisations)** - Ajoutez ces scopes :
   - `.../auth/analytics.readonly` ← **IMPORTANT pour Google Analytics**
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`

4. **Test users** (si en mode Testing) :
   - Ajoutez votre adresse email Google
   - Ajoutez les emails des autres utilisateurs qui doivent tester

5. **⚠️ Mode Production** :
   - Si vous voulez utiliser l'app avec plus de 100 utilisateurs
   - Si vous voulez que les tokens ne expirent pas après 7 jours
   - **Publiez votre application** pour passer en mode "Production"

#### D. Créer les identifiants OAuth 2.0

1. Allez sur [Credentials](https://console.cloud.google.com/apis/credentials)

2. Cliquez sur **"CREATE CREDENTIALS"** → **"OAuth 2.0 Client ID"**

3. Configurez :
   - **Type** : Web application
   - **Nom** : E-commerce Agent Hint (ou votre choix)

4. **Authorized JavaScript origins** :
   ```
   http://localhost:3000
   https://your-production-domain.com
   ```

5. **Authorized redirect URIs** :
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-production-domain.com/api/auth/callback/google
   ```

6. Cliquez sur **"CREATE"**

7. **📋 SAUVEGARDEZ** :
   - **Client ID** : `123456789.apps.googleusercontent.com`
   - **Client Secret** : `GOCSPX-xxxxxxxxxxxxxxxx`

### Étape 2 : Anthropic Console (Clé API Claude)

#### A. Accéder à la console

1. Allez sur [Anthropic Console](https://console.anthropic.com/)
2. Connectez-vous avec votre compte Hint.work

#### B. Créer une clé API

1. Dans le menu, allez sur **"API Keys"**

2. Cliquez sur **"Create Key"**

3. Donnez un nom : **"E-commerce Agent Hint"**

4. **📋 COPIEZ immédiatement la clé** (vous ne la verrez qu'une fois !)
   - Format : `sk-ant-api03-xxxxx...`

5. Sauvegardez-la en sécurité

#### C. Vérifier vos crédits

- Allez dans **"Billing"** ou **"Usage"**
- Assurez-vous d'avoir des crédits disponibles
- Configurez une limite de dépenses si souhaité

### Étape 3 : Base de données PostgreSQL

Vous avez plusieurs options selon votre environnement.

#### Option A : Base locale (Développement)

**Sur macOS :**
```bash
brew install postgresql@16
brew services start postgresql@16

# Créer la base de données
psql postgres -c "CREATE DATABASE \"e-commerce-agent\";"
```

**Sur Linux (Ubuntu/Debian) :**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Créer la base de données
sudo -u postgres psql -c "CREATE DATABASE \"e-commerce-agent\";"
```

**URL de connexion locale :**
```
postgresql://postgres:password@localhost:5432/e-commerce-agent
```

#### Option B : Neon (Cloud - Recommandé)

1. Allez sur [neon.tech](https://neon.tech)
2. Créez un compte (gratuit pour commencer)
3. Créez un nouveau projet : **"hint-ecommerce-agent"**
4. Copiez la **Connection String** fournie

**Avantages Neon :**
- ✅ Gratuit jusqu'à 10 Go
- ✅ Serverless (pas de gestion)
- ✅ Backups automatiques
- ✅ Branches de base de données

#### Option C : Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un projet
3. Dans Settings → Database, copiez la **Connection String**

### Étape 4 : Créer le fichier .env

#### Méthode 1 : Script automatique (Recommandé)

```bash
npx tsx scripts/setup-env.ts
```

Suivez les instructions, entrez vos identifiants, et le script créera automatiquement votre `.env`.

#### Méthode 2 : Copie manuelle

```bash
cp .env.template .env
```

Puis éditez `.env` :

```env
# Générez avec: npx auth secret
AUTH_SECRET="votre-secret-aleatoire-genere"

# Depuis Google Cloud Console (projet Hint.work)
AUTH_GOOGLE_ID="123456789.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-xxxxxxxxxxxxxxxx"

# Votre base de données
DATABASE_URL="postgresql://user:password@host:5432/database"

# Depuis Anthropic Console (compte Hint.work)
ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Étape 5 : Générer AUTH_SECRET

Le secret d'authentification doit être aléatoire et sécurisé :

```bash
# Méthode 1 (recommandée)
npx auth secret

# Méthode 2
openssl rand -base64 32

# Méthode 3 (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copiez le résultat dans votre `.env` :
```env
AUTH_SECRET="le-secret-genere-ici"
```

## ✅ Vérification de la configuration

### 1. Lancer le diagnostic

```bash
npx tsx scripts/debug-google-auth.ts
```

Le script va vérifier :
- ✅ Toutes les variables d'environnement
- ✅ Connexion à la base de données
- ✅ Format des identifiants

### 2. Initialiser la base de données

```bash
# Générer le schéma Drizzle
npm run db:generate

# Créer les tables
npm run db:push

# (Optionnel) Visualiser avec Drizzle Studio
npm run db:studio
```

### 3. Démarrer l'application

```bash
npm run dev
```

Ouvrez http://localhost:3000

### 4. Tester Google OAuth

1. Sur la page d'accueil, cliquez sur **"Sign in"**
2. Connectez-vous avec votre email
3. Allez dans les paramètres
4. Cliquez sur **"Connect Google Analytics"**
5. Autorisez l'accès à Google Analytics
6. Vérifiez que la connexion fonctionne

## 🔍 Diagnostic des problèmes

### Erreur : "AUTH_GOOGLE_ID is missing"

**Solution :**
1. Vérifiez que votre fichier `.env` existe à la racine du projet
2. Vérifiez que `AUTH_GOOGLE_ID` est bien renseigné (pas "1")
3. Redémarrez l'application après modification du `.env`

### Erreur : "OAuth client configuration error"

**Solution :**
1. Vérifiez que vos identifiants Google Cloud sont corrects
2. Assurez-vous d'avoir sélectionné le bon projet (Hint.work)
3. Vérifiez les redirect URIs dans Google Cloud Console

### Erreur : "Missing required Google Analytics scopes"

**Solution :**
1. Dans Google Cloud Console, vérifiez les scopes de l'écran de consentement
2. Assurez-vous que `.../auth/analytics.readonly` est inclus
3. Reconnectez votre compte Google dans l'application

### Erreur : "Database connection failed"

**Solution :**
1. Vérifiez que PostgreSQL est démarré (si local)
2. Testez la connexion : `psql $DATABASE_URL`
3. Vérifiez que la `DATABASE_URL` est correcte dans `.env`

### Erreur : "Anthropic API key invalid"

**Solution :**
1. Vérifiez que votre clé commence par `sk-ant-api03-`
2. Vérifiez que vous avez des crédits sur Anthropic Console
3. Créez une nouvelle clé si nécessaire

## 🔐 Bonnes pratiques de sécurité

### ✅ À FAIRE :

- Gardez votre `.env` local uniquement (jamais dans Git)
- Utilisez des variables d'environnement différentes pour dev/prod
- Renouvelez vos clés API régulièrement
- Configurez des limites de dépenses sur Anthropic
- Restreignez les redirect URIs dans Google Cloud
- Utilisez des mots de passe forts pour la base de données

### ❌ À NE JAMAIS FAIRE :

- Committer le `.env` dans Git
- Partager vos clés API publiquement (Slack, email, etc.)
- Utiliser les mêmes identifiants en dev et prod
- Laisser vos clés API sans limite de dépenses

## 📊 Environnements multiples

Si vous avez plusieurs environnements (dev, staging, prod), créez des fichiers séparés :

```
.env.development.local
.env.staging.local
.env.production.local
```

Et utilisez des projets Google Cloud séparés pour chaque environnement.

## 🆘 Besoin d'aide ?

1. **Documentation complète** : [docs/SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md)
2. **Guide de débogage OAuth** : [docs/DEBUG_GOOGLE_AUTH.md](./DEBUG_GOOGLE_AUTH.md)
3. **Diagnostic automatique** : `npx tsx scripts/debug-google-auth.ts`

## 📚 Ressources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Anthropic Console](https://console.anthropic.com/)
- [Neon Database](https://neon.tech)
- [NextAuth.js Documentation](https://next-auth.js.org/)

---

**✨ Une fois configuré, vous aurez le contrôle total de l'application avec vos identifiants Hint.work !**
