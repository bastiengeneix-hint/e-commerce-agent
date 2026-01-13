#!/usr/bin/env tsx
/**
 * Script de diagnostic pour l'authentification Google Analytics
 *
 * Ce script vérifie:
 * - Les variables d'environnement OAuth
 * - L'état de la connexion dans la base de données
 * - Les tokens et leurs dates d'expiration
 * - Les scopes accordés
 *
 * Usage: npx tsx scripts/debug-google-auth.ts [userId]
 */

import { db } from "../src/server/db";
import { accounts, users } from "../src/server/db/schema";
import { env } from "../src/env";
import { eq, and } from "drizzle-orm";

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

interface DiagnosticResult {
  category: string;
  status: "✅ OK" | "⚠️ ATTENTION" | "❌ ERREUR";
  message: string;
  details?: string;
  action?: string;
}

async function diagnoseGoogleAuth(userId?: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // 1. Vérifier les variables d'environnement
  console.log("\n🔍 Vérification des variables d'environnement...\n");

  const hasGoogleId = !!env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_ID !== "1";
  const hasGoogleSecret = !!env.AUTH_GOOGLE_SECRET && env.AUTH_GOOGLE_SECRET !== "2";

  results.push({
    category: "Configuration OAuth",
    status: hasGoogleId ? "✅ OK" : "❌ ERREUR",
    message: hasGoogleId
      ? "AUTH_GOOGLE_ID est configuré"
      : "AUTH_GOOGLE_ID est manquant ou invalide",
    details: hasGoogleId
      ? `Client ID: ${env.AUTH_GOOGLE_ID.substring(0, 20)}...`
      : "Valeur trouvée: " + env.AUTH_GOOGLE_ID,
    action: !hasGoogleId
      ? "Définissez AUTH_GOOGLE_ID dans votre fichier .env avec votre OAuth 2.0 Client ID de Google Cloud Console"
      : undefined,
  });

  results.push({
    category: "Configuration OAuth",
    status: hasGoogleSecret ? "✅ OK" : "❌ ERREUR",
    message: hasGoogleSecret
      ? "AUTH_GOOGLE_SECRET est configuré"
      : "AUTH_GOOGLE_SECRET est manquant ou invalide",
    details: hasGoogleSecret
      ? "Client Secret: ********"
      : "Valeur trouvée: " + env.AUTH_GOOGLE_SECRET,
    action: !hasGoogleSecret
      ? "Définissez AUTH_GOOGLE_SECRET dans votre fichier .env avec votre OAuth 2.0 Client Secret de Google Cloud Console"
      : undefined,
  });

  if (!hasGoogleId || !hasGoogleSecret) {
    results.push({
      category: "Configuration OAuth",
      status: "❌ ERREUR",
      message: "Configuration OAuth incomplète",
      details: "Votre application ne peut pas s'authentifier avec Google sans ces identifiants",
      action: `
📝 Comment obtenir vos identifiants OAuth:
1. Allez sur https://console.cloud.google.com/apis/credentials
2. Créez un projet si vous n'en avez pas
3. Créez des identifiants OAuth 2.0 Client ID
4. Configurez l'écran de consentement OAuth
5. Ajoutez les redirect URIs:
   - http://localhost:3000/api/auth/callback/google (dev)
   - https://your-domain.com/api/auth/callback/google (prod)
6. Copiez le Client ID et Client Secret dans votre .env
      `.trim(),
    });
  }

  // 2. Vérifier la connexion à la base de données
  console.log("\n🔍 Vérification de la base de données...\n");

  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
    }).from(users);

    results.push({
      category: "Base de données",
      status: "✅ OK",
      message: `Connexion à la base de données réussie (${allUsers.length} utilisateur(s) trouvé(s))`,
      details: allUsers.map(u => `- ${u.name || 'Sans nom'} (${u.email}) [ID: ${u.id}]`).join('\n'),
    });

    // Si aucun userId n'est fourni, utiliser le premier utilisateur trouvé
    if (!userId && allUsers.length > 0) {
      userId = allUsers[0]!.id;
      console.log(`ℹ️  Aucun userId fourni, utilisation de: ${userId}\n`);
    }

  } catch (error) {
    results.push({
      category: "Base de données",
      status: "❌ ERREUR",
      message: "Impossible de se connecter à la base de données",
      details: error instanceof Error ? error.message : String(error),
      action: "Vérifiez que votre base de données PostgreSQL est démarrée et que DATABASE_URL est correctement configuré",
    });
    return results; // Arrêter ici si la DB ne fonctionne pas
  }

  if (!userId) {
    results.push({
      category: "Utilisateur",
      status: "⚠️ ATTENTION",
      message: "Aucun utilisateur trouvé dans la base de données",
      details: "Vous devez d'abord créer un compte utilisateur en vous connectant à l'application",
      action: "Lancez l'application (npm run dev) et créez un compte",
    });
    return results;
  }

  // 3. Vérifier le compte Google de l'utilisateur
  console.log(`\n🔍 Vérification du compte Google pour l'utilisateur ${userId}...\n`);

  const googleAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "google")
      )
    );

  if (googleAccounts.length === 0) {
    results.push({
      category: "Compte Google",
      status: "⚠️ ATTENTION",
      message: "Aucun compte Google connecté pour cet utilisateur",
      details: "L'utilisateur n'a jamais connecté son compte Google",
      action: `
Pour connecter votre compte Google:
1. Lancez l'application: npm run dev
2. Connectez-vous avec votre compte utilisateur
3. Allez dans les paramètres ou cliquez sur "Connecter Google Analytics"
4. Autorisez l'accès à Google Analytics
      `.trim(),
    });
    return results;
  }

  if (googleAccounts.length > 1) {
    results.push({
      category: "Compte Google",
      status: "⚠️ ATTENTION",
      message: `${googleAccounts.length} comptes Google trouvés (problème de duplication)`,
      details: googleAccounts.map((acc, i) =>
        `Compte ${i + 1}: Provider Account ID ${acc.providerAccountId}`
      ).join('\n'),
      action: "La fonction reconcileGoogleAccount() devrait nettoyer cela automatiquement lors de la prochaine connexion",
    });
  }

  const account = googleAccounts[0]!;

  // 4. Vérifier les tokens
  console.log("\n🔍 Analyse des tokens OAuth...\n");

  const hasAccessToken = !!account.access_token;
  const hasRefreshToken = !!account.refresh_token;

  results.push({
    category: "Tokens OAuth",
    status: hasAccessToken ? "✅ OK" : "⚠️ ATTENTION",
    message: hasAccessToken
      ? "Access token présent"
      : "Access token manquant",
    details: hasAccessToken
      ? `Token: ${account.access_token?.substring(0, 20)}...`
      : undefined,
  });

  results.push({
    category: "Tokens OAuth",
    status: hasRefreshToken ? "✅ OK" : "❌ ERREUR",
    message: hasRefreshToken
      ? "Refresh token présent (connexion persistante)"
      : "Refresh token manquant (connexion perdue)",
    details: hasRefreshToken
      ? "Refresh token: ********"
      : "Sans refresh token, vous devrez reconnecter votre compte",
    action: !hasRefreshToken
      ? `
Le refresh token est manquant ou a été révoqué. Causes possibles:
- Vous avez révoqué l'accès dans https://myaccount.google.com/permissions
- Le token a expiré (après 6 mois d'inactivité)
- Il y a eu une erreur lors de l'authentification initiale

Action requise: Reconnectez votre compte Google via l'application
      `.trim()
      : undefined,
  });

  // 5. Vérifier l'expiration du token
  if (account.expires_at) {
    const expiresAt = new Date(account.expires_at * 1000);
    const now = new Date();
    const isExpired = expiresAt < now;
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    results.push({
      category: "Expiration du token",
      status: isExpired
        ? (hasRefreshToken ? "⚠️ ATTENTION" : "❌ ERREUR")
        : "✅ OK",
      message: isExpired
        ? "Access token expiré"
        : `Access token valide (expire dans ${Math.round(hoursUntilExpiry)}h)`,
      details: `Expiration: ${expiresAt.toLocaleString('fr-FR')}`,
      action: isExpired && !hasRefreshToken
        ? "Token expiré et aucun refresh token disponible. Reconnexion requise."
        : isExpired
        ? "Token expiré mais le refresh token permettra de le renouveler automatiquement"
        : undefined,
    });
  } else {
    results.push({
      category: "Expiration du token",
      status: "⚠️ ATTENTION",
      message: "Pas d'information d'expiration",
      details: "Le compte ne contient pas de date d'expiration",
    });
  }

  // 6. Vérifier les scopes
  console.log("\n🔍 Vérification des permissions (scopes)...\n");

  const grantedScopes = account.scope?.split(/\s+/).filter(Boolean) ?? [];
  const hasAllRequiredScopes = REQUIRED_SCOPES.every(scope =>
    grantedScopes.includes(scope)
  );

  const missingScopes = REQUIRED_SCOPES.filter(scope =>
    !grantedScopes.includes(scope)
  );

  results.push({
    category: "Permissions OAuth",
    status: hasAllRequiredScopes ? "✅ OK" : "❌ ERREUR",
    message: hasAllRequiredScopes
      ? "Toutes les permissions requises sont accordées"
      : "Permissions manquantes pour Google Analytics",
    details: `
Permissions accordées (${grantedScopes.length}):
${grantedScopes.map(s => `  - ${s}`).join('\n')}

${!hasAllRequiredScopes ? `
Permissions manquantes (${missingScopes.length}):
${missingScopes.map(s => `  - ${s}`).join('\n')}
` : ''}
    `.trim(),
    action: !hasAllRequiredScopes
      ? `
Les permissions Google Analytics ne sont pas accordées.
Reconnectez votre compte Google pour obtenir les permissions nécessaires.

Assurez-vous que votre configuration OAuth dans src/server/auth/config.ts
demande bien le scope: "https://www.googleapis.com/auth/analytics.readonly"
      `.trim()
      : undefined,
  });

  // 7. Vérifier les APIs Google Cloud
  results.push({
    category: "APIs Google Cloud",
    status: "⚠️ ATTENTION",
    message: "Vérification manuelle requise",
    details: "Ce script ne peut pas vérifier automatiquement si les APIs sont activées",
    action: `
Assurez-vous que ces APIs sont activées dans Google Cloud Console:
1. Allez sur https://console.cloud.google.com/apis/library
2. Sélectionnez votre projet
3. Activez ces APIs:
   - Google Analytics Admin API
   - Google Analytics Data API

Pour tester: essayez de vous connecter via l'application et vérifiez les logs
    `.trim(),
  });

  return results;
}

function printResults(results: DiagnosticResult[]) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 RÉSULTATS DU DIAGNOSTIC");
  console.log("=".repeat(80) + "\n");

  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    console.log(`\n📁 ${category}`);
    console.log("─".repeat(80));

    const categoryResults = results.filter(r => r.category === category);

    for (const result of categoryResults) {
      console.log(`\n${result.status} ${result.message}`);

      if (result.details) {
        console.log(`   ${result.details.split('\n').join('\n   ')}`);
      }

      if (result.action) {
        console.log(`\n   🔧 ACTION RECOMMANDÉE:`);
        console.log(`   ${result.action.split('\n').join('\n   ')}`);
      }
    }
  }

  // Résumé
  const errors = results.filter(r => r.status === "❌ ERREUR").length;
  const warnings = results.filter(r => r.status === "⚠️ ATTENTION").length;
  const oks = results.filter(r => r.status === "✅ OK").length;

  console.log("\n" + "=".repeat(80));
  console.log("📈 RÉSUMÉ");
  console.log("=".repeat(80));
  console.log(`✅ OK: ${oks}`);
  console.log(`⚠️  Avertissements: ${warnings}`);
  console.log(`❌ Erreurs: ${errors}`);

  if (errors > 0) {
    console.log("\n🔴 Des erreurs critiques ont été détectées. Suivez les actions recommandées ci-dessus.");
  } else if (warnings > 0) {
    console.log("\n🟡 Votre configuration nécessite de l'attention. Vérifiez les avertissements ci-dessus.");
  } else {
    console.log("\n🟢 Tout semble correct ! Si vous rencontrez toujours des problèmes, vérifiez les logs de l'application.");
  }

  console.log("\n");
}

// Main
async function main() {
  const userId = process.argv[2];

  console.log("🔍 DIAGNOSTIC D'AUTHENTIFICATION GOOGLE ANALYTICS");
  console.log("=".repeat(80));

  if (userId) {
    console.log(`\n👤 Utilisateur cible: ${userId}`);
  } else {
    console.log("\n👤 Aucun userId fourni, analyse du premier utilisateur trouvé");
    console.log("   Usage: npx tsx scripts/debug-google-auth.ts <userId>");
  }

  try {
    const results = await diagnoseGoogleAuth(userId);
    printResults(results);

    // Exit code basé sur les résultats
    const hasErrors = results.some(r => r.status === "❌ ERREUR");
    process.exit(hasErrors ? 1 : 0);

  } catch (error) {
    console.error("\n❌ Erreur fatale lors du diagnostic:");
    console.error(error);
    process.exit(1);
  }
}

main();
