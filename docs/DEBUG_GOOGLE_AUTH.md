# Guide de débogage : Authentification Google Analytics

Ce guide vous aide à résoudre les problèmes de connexion à Google Analytics.

## 🚀 Démarrage rapide

### Lancer le script de diagnostic

```bash
# Analyser automatiquement le premier utilisateur
npx tsx scripts/debug-google-auth.ts

# Analyser un utilisateur spécifique
npx tsx scripts/debug-google-auth.ts <userId>
```

Le script va vérifier :
- ✅ Variables d'environnement OAuth
- ✅ Connexion à la base de données
- ✅ Présence du compte Google
- ✅ État des tokens (access token, refresh token)
- ✅ Dates d'expiration
- ✅ Permissions (scopes) OAuth

## 🔍 Problèmes courants et solutions

### 1. ❌ Variables d'environnement manquantes

**Symptômes :**
- `AUTH_GOOGLE_ID est manquant ou invalide`
- `AUTH_GOOGLE_SECRET est manquant ou invalide`

**Solution :**

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Créez un projet (ou sélectionnez-en un existant)
3. Cliquez sur **"Créer des identifiants"** → **"ID client OAuth 2.0"**
4. Configurez l'écran de consentement OAuth si nécessaire
5. Ajoutez les URI de redirection autorisés :
   - `http://localhost:3000/api/auth/callback/google` (développement)
   - `https://votre-domaine.com/api/auth/callback/google` (production)
6. Copiez le **Client ID** et **Client Secret**
7. Ajoutez-les à votre fichier `.env` :

```env
AUTH_GOOGLE_ID="votre-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="votre-client-secret"
```

### 2. ❌ APIs Google Analytics non activées

**Symptômes :**
- Erreur : "Google Analytics Admin API has not been used in project"
- Erreur : "Google Analytics Data API has not been used in project"

**Solution :**

1. Allez sur [Google Cloud Console - API Library](https://console.cloud.google.com/apis/library)
2. Recherchez et activez ces deux APIs :
   - **Google Analytics Admin API**
   - **Google Analytics Data API**
3. Attendez quelques minutes que les APIs soient activées
4. Reconnectez votre compte Google dans l'application

### 3. ⚠️ Aucun compte Google connecté

**Symptômes :**
- `Aucun compte Google connecté pour cet utilisateur`
- Le banner demande de connecter Google Analytics

**Solution :**

1. Lancez l'application : `npm run dev`
2. Connectez-vous avec votre compte utilisateur
3. Cliquez sur le bouton **"Connecter Google Analytics"** ou allez dans les paramètres
4. Autorisez l'accès à Google Analytics quand Google vous le demande
5. Vérifiez que vous accordez bien la permission **"Google Analytics"**

### 4. ❌ Refresh token manquant ou révoqué

**Symptômes :**
- `Refresh token manquant (connexion perdue)`
- Erreur : "Your Google connection has expired"
- Erreur : "Token revoked"

**Causes possibles :**
- Vous avez révoqué l'accès dans [Google Account Permissions](https://myaccount.google.com/permissions)
- Le token a expiré (après 6 mois d'inactivité pour les apps en test)
- Votre application a dépassé la limite d'utilisateurs en mode test
- Problème lors de l'authentification initiale

**Solution :**

1. **Reconnectez votre compte** dans l'application
2. Si le problème persiste, vérifiez l'état de publication de votre app OAuth :
   - Allez sur [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
   - Si votre app est en mode **"Testing"**, elle a des limitations :
     - Max 100 utilisateurs
     - Tokens expirent après 7 jours
   - **Passez en "Production"** pour une utilisation normale
3. Assurez-vous que vous n'avez pas révoqué l'accès dans vos [permissions Google](https://myaccount.google.com/permissions)

### 5. ❌ Permissions (scopes) manquantes

**Symptômes :**
- `Permissions manquantes pour Google Analytics`
- Erreur : "Missing required Google Analytics scopes"

**Solution :**

1. Vérifiez que votre configuration OAuth demande le bon scope
2. Dans `src/server/auth/config.ts`, assurez-vous que cette ligne est présente :
   ```typescript
   scope: [
     "openid",
     "email",
     "profile",
     "https://www.googleapis.com/auth/analytics.readonly",
   ].join(" "),
   ```
3. **Reconnectez votre compte** pour obtenir les nouvelles permissions
4. Lors de la connexion, vérifiez que Google demande l'accès à **"Google Analytics"**

### 6. ❌ Access token expiré

**Symptômes :**
- `Access token expiré`
- Mais **LE SYSTÈME FONCTIONNE QUAND MÊME** si vous avez un refresh token

**Explication :**

Les access tokens expirent **toutes les heures**. C'est **NORMAL** !

- ✅ Si vous avez un **refresh token** : l'application va automatiquement rafraîchir le token
- ❌ Si vous **n'avez pas** de refresh token : vous devez reconnecter votre compte

**Aucune action requise** si vous avez un refresh token.

### 7. 🔐 Erreur "invalid_client"

**Symptômes :**
- Erreur : "OAuth client configuration error"
- Log : "CRITICAL: Invalid OAuth client credentials"

**Causes :**
- Le Client ID ou Client Secret est incorrect
- Les identifiants ne correspondent pas au projet Google Cloud
- Les identifiants ont été révoqués ou supprimés

**Solution :**

1. Vérifiez vos identifiants dans `.env`
2. Comparez-les avec ceux dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Si nécessaire, créez de nouveaux identifiants
4. Redémarrez votre application après modification de `.env`

### 8. 🚫 Erreur 403 - Permission refusée

**Symptômes :**
- Erreur : "Account lacks permission to access Analytics properties"
- Code HTTP 403

**Solution :**

1. Assurez-vous que le compte Google connecté a **accès à Google Analytics**
2. Le compte doit avoir au minimum le rôle **"Lecteur"** sur la propriété Analytics
3. Vérifiez dans [Google Analytics](https://analytics.google.com/) → Admin → Accès à la propriété
4. Si nécessaire, ajoutez le compte avec les permissions appropriées

## 🔧 Logs de débogage

Avec les nouvelles améliorations, vous verrez des logs détaillés dans la console :

```
[GoogleAuth] Found Google account for user abc123 {
  hasAccessToken: true,
  hasRefreshToken: true,
  expiresAt: '2026-01-13T15:30:00.000Z',
  scopes: 4
}
```

Ces logs vous aident à comprendre l'état exact de la connexion.

### Activer les logs détaillés

Les logs sont maintenant automatiquement activés. Pour voir tous les logs :

```bash
npm run dev
```

Puis surveillez la console pour les messages `[GoogleAuth]`.

## 📊 Vérifier l'état de la connexion

### Dans l'application

1. Allez dans les **Paramètres** (Settings)
2. Section **"Google Analytics Connection"**
3. Vous verrez :
   - État de la connexion
   - Date d'expiration du token
   - Permissions accordées
   - Boutons : Test Connection / Reconnect / Disconnect

### Via le script de diagnostic

```bash
npx tsx scripts/debug-google-auth.ts
```

Le script affiche un rapport complet avec :
- ✅ Ce qui fonctionne
- ⚠️ Ce qui nécessite attention
- ❌ Les erreurs critiques
- 🔧 Actions recommandées pour chaque problème

## 🔄 Processus de reconnexion

Si vous devez reconnecter votre compte :

1. Dans l'application, cliquez sur **"Reconnect"** ou **"Connect Google Analytics"**
2. Vous serez redirigé vers Google
3. Sélectionnez votre compte Google
4. **IMPORTANT** : Cliquez sur **"Afficher les détails"** pour voir les permissions
5. Assurez-vous que **"Google Analytics"** est inclus dans les permissions
6. Cliquez sur **"Continuer"** ou **"Autoriser"**
7. Vous serez redirigé vers l'application
8. L'application vérifiera automatiquement la connexion

### Si la reconnexion échoue

1. Vérifiez les logs de la console
2. Lancez le script de diagnostic : `npx tsx scripts/debug-google-auth.ts`
3. Suivez les actions recommandées dans le rapport
4. Essayez de vous déconnecter puis reconnecter :
   - Cliquez sur **"Disconnect"**
   - Puis **"Connect Google Analytics"**

## 🆘 Obtenir de l'aide

Si le problème persiste après avoir suivi ce guide :

1. **Lancez le script de diagnostic** et sauvegardez le résultat :
   ```bash
   npx tsx scripts/debug-google-auth.ts > diagnostic.txt
   ```

2. **Vérifiez les logs de l'application** pendant la tentative de connexion

3. **Informations à fournir** :
   - Résultat du script de diagnostic
   - Logs de la console
   - Captures d'écran de l'erreur
   - Étapes pour reproduire le problème

## 📚 Ressources supplémentaires

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Analytics Admin API](https://developers.google.com/analytics/devguides/config/admin/v1)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)

## ✅ Checklist de vérification rapide

Avant de demander de l'aide, vérifiez que :

- [ ] Les variables `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET` sont configurées
- [ ] Les APIs Google Analytics Admin et Data sont activées
- [ ] Les URI de redirection sont correctement configurés dans Google Cloud
- [ ] Votre app OAuth est en mode "Production" (pas "Testing" pour usage prolongé)
- [ ] Le compte Google a accès à la propriété Google Analytics
- [ ] La base de données est accessible
- [ ] Vous avez essayé de déconnecter puis reconnecter
- [ ] Vous avez redémarré l'application après modification de `.env`
