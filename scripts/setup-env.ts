#!/usr/bin/env tsx
/**
 * Script interactif pour configurer le fichier .env
 *
 * Ce script guide l'utilisateur dans la configuration de toutes les
 * variables d'environnement nécessaires pour l'application.
 *
 * Usage: npx tsx scripts/setup-env.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { execSync } from "child_process";

const ENV_PATH = path.join(process.cwd(), ".env");
const ENV_EXAMPLE_PATH = path.join(process.cwd(), ".env.example");

interface EnvConfig {
  AUTH_SECRET?: string;
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
  DATABASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
}

// Interface readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function printHeader(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80) + "\n");
}

function printSection(title: string) {
  console.log("\n" + "─".repeat(80));
  console.log(`📋 ${title}`);
  console.log("─".repeat(80) + "\n");
}

async function confirmAction(message: string): Promise<boolean> {
  const answer = await question(`${message} (o/n) : `);
  return answer.toLowerCase() === "o" || answer.toLowerCase() === "y" || answer.toLowerCase() === "yes" || answer.toLowerCase() === "oui";
}

function generateAuthSecret(): string {
  try {
    // Essayer d'utiliser auth secret si disponible
    const secret = execSync("npx --yes auth secret", { encoding: "utf8" }).trim();
    // La sortie contient "AUTH_SECRET=xxx", on extrait la valeur
    const match = secret.match(/AUTH_SECRET=(.+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // Si ça ne fonctionne pas, générer manuellement
  }

  // Génération manuelle d'un secret sécurisé
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("base64");
}

async function setupAuthSecret(config: EnvConfig): Promise<void> {
  printSection("Configuration AUTH_SECRET");

  console.log("AUTH_SECRET est utilisé pour sécuriser les sessions NextAuth.");
  console.log("Un secret aléatoire et sécurisé va être généré pour vous.\n");

  const secret = generateAuthSecret();
  config.AUTH_SECRET = secret;

  console.log("✅ AUTH_SECRET généré avec succès !");
  console.log(`   Secret: ${secret.substring(0, 20)}...`);
}

async function setupGoogleOAuth(config: EnvConfig): Promise<void> {
  printSection("Configuration Google OAuth");

  console.log("Pour configurer Google OAuth, vous devez :");
  console.log("1. Aller sur https://console.cloud.google.com/apis/credentials");
  console.log("2. Sélectionner votre projet (ex: Hint.work)");
  console.log("3. Créer des identifiants OAuth 2.0 Client ID");
  console.log("4. Configurer les redirect URIs :");
  console.log("   - http://localhost:3000/api/auth/callback/google");
  console.log("5. Activer ces APIs :");
  console.log("   - Google Analytics Admin API");
  console.log("   - Google Analytics Data API");
  console.log("\n⚠️  Si vous ne l'avez pas encore fait, consultez docs/SETUP_CREDENTIALS.md\n");

  const hasCredentials = await confirmAction("Avez-vous vos identifiants Google OAuth prêts ?");

  if (!hasCredentials) {
    console.log("\n❌ Configuration Google OAuth annulée.");
    console.log("📖 Consultez docs/SETUP_CREDENTIALS.md pour les instructions détaillées.");
    console.log("   Puis relancez ce script.\n");
    process.exit(0);
  }

  console.log("\n");
  let googleId = await question("Entrez votre AUTH_GOOGLE_ID (xxx.apps.googleusercontent.com) : ");

  while (!googleId || googleId === "1") {
    console.log("❌ Le Client ID Google est obligatoire et ne peut pas être '1'");
    googleId = await question("Entrez votre AUTH_GOOGLE_ID : ");
  }

  config.AUTH_GOOGLE_ID = googleId;
  console.log("✅ AUTH_GOOGLE_ID configuré");

  console.log("\n");
  let googleSecret = await question("Entrez votre AUTH_GOOGLE_SECRET (GOCSPX-...) : ");

  while (!googleSecret || googleSecret === "2") {
    console.log("❌ Le Client Secret Google est obligatoire et ne peut pas être '2'");
    googleSecret = await question("Entrez votre AUTH_GOOGLE_SECRET : ");
  }

  config.AUTH_GOOGLE_SECRET = googleSecret;
  console.log("✅ AUTH_GOOGLE_SECRET configuré");
}

async function setupDatabase(config: EnvConfig): Promise<void> {
  printSection("Configuration Base de données PostgreSQL");

  console.log("Vous avez besoin d'une base de données PostgreSQL.");
  console.log("\nOptions :");
  console.log("1. Base de données locale (pour développement)");
  console.log("2. Base de données cloud (Neon, Supabase, Railway, etc.)");
  console.log("\n");

  const choice = await question("Choisissez une option (1 ou 2) : ");

  if (choice === "1") {
    console.log("\n📝 Pour une base de données locale :");
    console.log("   Assurez-vous que PostgreSQL est installé et démarré");
    console.log("\n   Commandes utiles :");
    console.log("   - macOS: brew install postgresql@16 && brew services start postgresql@16");
    console.log("   - Linux: sudo apt install postgresql && sudo systemctl start postgresql");
    console.log("\n   Puis créez la base :");
    console.log('   psql postgres -c "CREATE DATABASE \\"e-commerce-agent\\";"');
    console.log("\n");

    const defaultUrl = "postgresql://postgres:password@localhost:5432/e-commerce-agent";
    const useDefault = await confirmAction(`Utiliser la DATABASE_URL par défaut ?\n   ${defaultUrl}`);

    if (useDefault) {
      config.DATABASE_URL = defaultUrl;
    } else {
      const dbUrl = await question("\nEntrez votre DATABASE_URL : ");
      if (dbUrl) {
        config.DATABASE_URL = dbUrl;
      }
    }
  } else {
    console.log("\n📝 Pour une base de données cloud :");
    console.log("   1. Créez une base sur Neon, Supabase, Railway, etc.");
    console.log("   2. Copiez la connection string (DATABASE_URL)");
    console.log("\n");

    const dbUrl = await question("Entrez votre DATABASE_URL (postgresql://...) : ");

    while (!dbUrl || !dbUrl.startsWith("postgresql://")) {
      console.log("❌ La DATABASE_URL doit commencer par 'postgresql://'");
      const retry = await question("Entrez votre DATABASE_URL : ");
      if (retry && retry.startsWith("postgresql://")) {
        config.DATABASE_URL = retry;
        break;
      }
    }

    if (!config.DATABASE_URL) {
      config.DATABASE_URL = dbUrl;
    }
  }

  console.log("✅ DATABASE_URL configurée");
}

async function setupAnthropicAPI(config: EnvConfig): Promise<void> {
  printSection("Configuration Clé API Claude (Anthropic)");

  console.log("Pour obtenir votre clé API Claude :");
  console.log("1. Allez sur https://console.anthropic.com/");
  console.log("2. Connectez-vous avec votre compte");
  console.log("3. Créez une nouvelle clé API");
  console.log("4. Copiez la clé (commence par sk-ant-api03-...)");
  console.log("\n⚠️  Vous ne pourrez voir cette clé qu'une seule fois !\n");

  const hasKey = await confirmAction("Avez-vous votre clé API Claude ?");

  if (!hasKey) {
    console.log("\n❌ Configuration Anthropic API annulée.");
    console.log("📖 Allez sur https://console.anthropic.com/ pour créer une clé.");
    console.log("   Puis relancez ce script.\n");
    process.exit(0);
  }

  console.log("\n");
  let apiKey = await question("Entrez votre ANTHROPIC_API_KEY (sk-ant-api03-...) : ");

  while (!apiKey || !apiKey.startsWith("sk-ant-")) {
    console.log("❌ La clé API Claude doit commencer par 'sk-ant-'");
    apiKey = await question("Entrez votre ANTHROPIC_API_KEY : ");
  }

  config.ANTHROPIC_API_KEY = apiKey;
  console.log("✅ ANTHROPIC_API_KEY configurée");
}

function writeEnvFile(config: EnvConfig): void {
  const envContent = `# Configuration générée automatiquement par scripts/setup-env.ts
# Date: ${new Date().toISOString()}

# NextAuth Secret (généré automatiquement)
AUTH_SECRET="${config.AUTH_SECRET}"

# Google OAuth (depuis Google Cloud Console)
AUTH_GOOGLE_ID="${config.AUTH_GOOGLE_ID}"
AUTH_GOOGLE_SECRET="${config.AUTH_GOOGLE_SECRET}"

# Base de données PostgreSQL
DATABASE_URL="${config.DATABASE_URL}"

# Clé API Claude/Anthropic
ANTHROPIC_API_KEY="${config.ANTHROPIC_API_KEY}"
`;

  fs.writeFileSync(ENV_PATH, envContent, "utf8");
}

async function verifyConfiguration(): Promise<void> {
  printSection("Vérification de la configuration");

  console.log("Vérification des variables d'environnement...\n");

  try {
    // Charger le .env pour tester
    require("dotenv").config({ path: ENV_PATH });

    const checks = [
      { name: "AUTH_SECRET", value: process.env.AUTH_SECRET },
      { name: "AUTH_GOOGLE_ID", value: process.env.AUTH_GOOGLE_ID },
      { name: "AUTH_GOOGLE_SECRET", value: process.env.AUTH_GOOGLE_SECRET },
      { name: "DATABASE_URL", value: process.env.DATABASE_URL },
      { name: "ANTHROPIC_API_KEY", value: process.env.ANTHROPIC_API_KEY },
    ];

    let allOk = true;

    for (const check of checks) {
      if (check.value && check.value !== "1" && check.value !== "2") {
        console.log(`✅ ${check.name} : configuré`);
      } else {
        console.log(`❌ ${check.name} : manquant ou invalide`);
        allOk = false;
      }
    }

    if (allOk) {
      console.log("\n🎉 Toutes les variables d'environnement sont configurées !");
    } else {
      console.log("\n⚠️  Certaines variables sont manquantes. Vérifiez votre fichier .env");
    }

  } catch (error) {
    console.log("⚠️  Impossible de charger le .env pour vérification");
    console.log("   Erreur :", error instanceof Error ? error.message : String(error));
  }
}

async function nextSteps(): Promise<void> {
  printHeader("🚀 Prochaines étapes");

  console.log("Votre fichier .env a été créé avec succès !\n");

  console.log("Pour démarrer l'application :");
  console.log("  1. Initialisez la base de données :");
  console.log("     npm run db:push");
  console.log("\n  2. Lancez l'application :");
  console.log("     npm run dev");
  console.log("\n  3. Testez la configuration Google OAuth :");
  console.log("     npx tsx scripts/debug-google-auth.ts");
  console.log("\n  4. Ouvrez votre navigateur :");
  console.log("     http://localhost:3000");

  console.log("\n📚 Documentation utile :");
  console.log("  - Guide de configuration : docs/SETUP_CREDENTIALS.md");
  console.log("  - Guide de débogage OAuth : docs/DEBUG_GOOGLE_AUTH.md");

  console.log("\n⚠️  SÉCURITÉ :");
  console.log("  - Ne commitez JAMAIS le fichier .env dans Git");
  console.log("  - Ne partagez JAMAIS vos clés API publiquement");
  console.log("  - Le fichier .env est déjà dans .gitignore\n");
}

async function main() {
  printHeader("🔧 CONFIGURATION DE L'APPLICATION E-COMMERCE AGENT");

  console.log("Ce script va vous guider dans la configuration de votre application.\n");
  console.log("Vous aurez besoin de :");
  console.log("  - Identifiants OAuth Google (depuis Google Cloud Console)");
  console.log("  - Clé API Claude (depuis Anthropic Console)");
  console.log("  - Base de données PostgreSQL (locale ou cloud)");

  // Vérifier si .env existe déjà
  if (fs.existsSync(ENV_PATH)) {
    console.log("\n⚠️  Un fichier .env existe déjà !");
    const overwrite = await confirmAction("Voulez-vous le remplacer ?");

    if (!overwrite) {
      console.log("\n✅ Configuration annulée. Votre fichier .env actuel est préservé.");
      rl.close();
      return;
    }

    // Backup de l'ancien .env
    const backupPath = `${ENV_PATH}.backup.${Date.now()}`;
    fs.copyFileSync(ENV_PATH, backupPath);
    console.log(`\n📦 Backup créé : ${backupPath}`);
  }

  const config: EnvConfig = {};

  try {
    // Configuration étape par étape
    await setupAuthSecret(config);
    await setupGoogleOAuth(config);
    await setupDatabase(config);
    await setupAnthropicAPI(config);

    // Écrire le fichier .env
    printSection("Sauvegarde de la configuration");
    writeEnvFile(config);
    console.log(`✅ Fichier .env créé : ${ENV_PATH}\n`);

    // Vérification
    await verifyConfiguration();

    // Prochaines étapes
    await nextSteps();

  } catch (error) {
    console.error("\n❌ Erreur lors de la configuration :");
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
