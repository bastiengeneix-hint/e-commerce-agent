# 🚀 Guide de Démarrage Rapide

## ⚡ Configuration Express (5 minutes)

### Option 1 : Script Interactif (Recommandé)

Lancez simplement ce script et suivez les instructions :

```bash
npx tsx scripts/setup-env.ts
```

Le script va :
1. ✅ Générer automatiquement votre `AUTH_SECRET`
2. ✅ Vous demander vos identifiants Google OAuth
3. ✅ Configurer votre base de données
4. ✅ Enregistrer votre clé API Claude
5. ✅ Créer automatiquement votre fichier `.env`

### Option 2 : Configuration Manuelle

1. **Copiez le fichier d'exemple :**
   ```bash
   cp .env.example .env
   ```

2. **Obtenez vos identifiants :**
   - Google OAuth : [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
   - Clé Claude : [console.anthropic.com](https://console.anthropic.com/)

3. **Éditez `.env` avec vos valeurs**

## 📋 Ce dont vous avez besoin

### 1. Google Cloud OAuth (Projet Hint.work)

Rendez-vous sur [Google Cloud Console](https://console.cloud.google.com/) :

#### A. Activez les APIs (2 min)
- ✅ Google Analytics Admin API
- ✅ Google Analytics Data API
- ✅ People API

#### B. Créez vos identifiants OAuth (3 min)
1. Allez dans **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID**
3. Type : **Web application**
4. Redirect URI : `http://localhost:3000/api/auth/callback/google`
5. Copiez votre **Client ID** et **Client Secret**

### 2. Clé API Claude

Sur [Anthropic Console](https://console.anthropic.com/) :
1. Créez une nouvelle clé API
2. Nommez-la "E-commerce Agent"
3. Copiez la clé (commence par `sk-ant-api03-...`)

### 3. Base de données PostgreSQL

**Option A - Locale (Dev) :**
```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
psql postgres -c "CREATE DATABASE \"e-commerce-agent\";"

# Linux
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE \"e-commerce-agent\";"
```

**Option B - Cloud (Prod) :**
- [Neon](https://neon.tech) - Gratuit ✨
- [Supabase](https://supabase.com) - Gratuit ✨
- [Railway](https://railway.app)

## 🎯 Lancer l'Application

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement (si pas déjà fait)
npx tsx scripts/setup-env.ts

# 3. Initialiser la base de données
npm run db:push

# 4. Lancer l'application
npm run dev
```

Ouvrez http://localhost:3000 🎉

## ✅ Vérifier la Configuration

```bash
# Diagnostic complet
npx tsx scripts/debug-google-auth.ts
```

Ce script vérifie :
- ✅ Variables d'environnement
- ✅ Connexion base de données
- ✅ Configuration OAuth
- ✅ Tokens et permissions

## 🆘 Problèmes ?

| Problème | Solution |
|----------|----------|
| ❌ Variables manquantes | Lancez `npx tsx scripts/setup-env.ts` |
| ❌ OAuth ne fonctionne pas | Consultez [docs/DEBUG_GOOGLE_AUTH.md](docs/DEBUG_GOOGLE_AUTH.md) |
| ❌ Base de données | Vérifiez que PostgreSQL est démarré |
| ❌ Clé API Claude invalide | Vérifiez sur console.anthropic.com |

## 📚 Documentation Complète

- **Configuration détaillée** : [docs/SETUP_CREDENTIALS.md](docs/SETUP_CREDENTIALS.md)
- **Débogage OAuth** : [docs/DEBUG_GOOGLE_AUTH.md](docs/DEBUG_GOOGLE_AUTH.md)

## 🔐 Sécurité

⚠️ **IMPORTANT** :
- Ne commitez JAMAIS le fichier `.env`
- Ne partagez JAMAIS vos clés API
- Le `.env` est déjà dans `.gitignore` ✅

## 🎊 Prêt à démarrer !

Une fois configuré, vous pourrez :
- 🔐 Vous authentifier avec Google
- 📊 Connecter vos comptes Google Analytics
- 🤖 Utiliser Claude AI pour analyser vos données
- 💬 Interagir avec votre agent e-commerce intelligent

**Bon développement ! 🚀**
