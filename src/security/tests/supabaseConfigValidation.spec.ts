/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * MIG-01-FIX-02 — TEST SUITE: SUPABASE BROWSER CLIENT & ZERO-TRUST CONFIG VALIDATION
 *
 * Couverture obligatoire :
 * 1. Configuration valide avec sb_publishable_
 * 2. Rejet strict de sb_secret_ (sans fuite de la clé dans l'erreur)
 * 3. Rejet d'un ancien JWT service_role (et anon JWT)
 * 4. Rejet d'une URL HTTP distante
 * 5. Rejet d'une URL malformée (chemins, query, hash, credentials, wildcards, IP brute)
 * 6. Acceptation de localhost uniquement en test local explicite (et jamais en production)
 * 7. Absence de connexion réseau au chargement initial du module (et en CI non configuré)
 * 8. Isolation du storageKey (orthogonal.pdi.supabase.auth.dev.v1) et options Auth
 * 9. Garde-fous VITE_ dans verifyProductionConfig et audit statique du scanner CI (.github/workflows/security.yml)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  SUPABASE_PUBLISHABLE_KEY_PREFIX,
  validateSupabaseBrowserUrl,
  validateSupabasePublishableKey,
  validateSupabaseBrowserConfig,
  buildSupabaseBrowserClientOptions,
  isSupabaseBrowserConfigured,
  createSupabaseBrowserClient,
  resetSupabaseBrowserClientForTesting
} from "../../lib/supabase.ts";
import { verifyProductionConfig } from "../sec01SecurityService.ts";

// Synthetic runtime-constructed fixtures so no literal secret pattern appears in repository source files
const SYNTHETIC_PUBLISHABLE_KEY = ["sb", "publishable", "dev_orthogonal_pdi_fixture_2026"].join("_");
const SYNTHETIC_SECRET_KEY = ["sb", "secret", "srv_only_fixture_do_not_expose_2026"].join("_");

function buildSyntheticLegacyServiceRoleJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role: "service_role", iss: "supabase-demo", iat: 1700000000, exp: 1900000000 })
  ).toString("base64url");
  const signature = "synthetic_hmac_sig_fixture_only";
  return [header, payload, signature].join(".");
}

describe("MIG-01-FIX-02 : Validation du Client Supabase Navigateur & Sécurité CI", () => {
  beforeEach(() => {
    resetSupabaseBrowserClientForTesting();
  });

  // =========================================================================
  // 1. CONFIGURATION VALIDE AVEC sb_publishable_
  // =========================================================================
  describe("1 — Configuration valide avec sb_publishable_", () => {
    it("Accepte une URL HTTPS Supabase valide et une clé sb_publishable_ conforme", () => {
      const env = {
        VITE_SUPABASE_URL: "https://orthogonal-pdi-dev.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_PUBLISHABLE_KEY,
        NODE_ENV: "production"
      };

      const res = validateSupabaseBrowserConfig(env);
      expect(res.isValid).toBe(true);
      expect(res.url).toBe("https://orthogonal-pdi-dev.supabase.co");
      expect(res.publishableKey).toBe(SYNTHETIC_PUBLISHABLE_KEY);
      expect(res.publishableKey?.startsWith(SUPABASE_PUBLISHABLE_KEY_PREFIX)).toBe(true);
      expect(res.error).toBeUndefined();
      expect(isSupabaseBrowserConfigured(env)).toBe(true);
    });
  });

  // =========================================================================
  // 2. REJET DE sb_secret_
  // =========================================================================
  describe("2 — Rejet strict de toute clé sb_secret_", () => {
    it("Rejette immédiatement une clé commençant par sb_secret_ sans jamais divulguer la clé dans le message d'erreur", () => {
      const keyRes = validateSupabasePublishableKey(SYNTHETIC_SECRET_KEY);
      expect(keyRes.isValid).toBe(false);
      expect(keyRes.code).toBe("FORBIDDEN_SECRET_KEY");
      expect(keyRes.error).toContain("SECURITY VIOLATION");
      expect(keyRes.error).not.toContain(SYNTHETIC_SECRET_KEY);

      const cfgRes = validateSupabaseBrowserConfig({
        VITE_SUPABASE_URL: "https://orthogonal-pdi-dev.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_SECRET_KEY
      });
      expect(cfgRes.isValid).toBe(false);
      expect(cfgRes.code).toBe("FORBIDDEN_SECRET_KEY");

      expect(() =>
        createSupabaseBrowserClient({
          VITE_SUPABASE_URL: "https://orthogonal-pdi-dev.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_SECRET_KEY
        })
      ).toThrow(/FORBIDDEN_SECRET_KEY/);
    });
  });

  // =========================================================================
  // 3. REJET D'UN ANCIEN JWT service_role
  // =========================================================================
  describe("3 — Rejet de tout JWT historique (service_role / anon)", () => {
    it("Rejette un JWT historique service_role présenté comme clé publishable", () => {
      const legacyServiceRoleJwt = buildSyntheticLegacyServiceRoleJwt();

      const keyRes = validateSupabasePublishableKey(legacyServiceRoleJwt);
      expect(keyRes.isValid).toBe(false);
      expect(keyRes.code).toBe("LEGACY_JWT_KEY_FORBIDDEN");
      expect(keyRes.error).toContain("Legacy JWT keys");
      expect(keyRes.error).not.toContain(legacyServiceRoleJwt);

      expect(() =>
        createSupabaseBrowserClient({
          VITE_SUPABASE_URL: "https://orthogonal-pdi-dev.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: legacyServiceRoleJwt
        })
      ).toThrow(/LEGACY_JWT_KEY_FORBIDDEN/);
    });

    it("Rejette toute clé ne commençant pas par sb_publishable_ ou au corps malformé", () => {
      expect(validateSupabasePublishableKey("anon_public_key_1234567890").code).toBe(
        "INVALID_PUBLISHABLE_KEY_PREFIX"
      );
      expect(validateSupabasePublishableKey("sb_publishable_short").code).toBe(
        "MALFORMED_PUBLISHABLE_KEY"
      );
      expect(validateSupabasePublishableKey("sb_publishable_invalid spaces here!").code).toBe(
        "MALFORMED_PUBLISHABLE_KEY"
      );
      expect(validateSupabasePublishableKey("").code).toBe("MISSING_PUBLISHABLE_KEY");
    });
  });

  // =========================================================================
  // 4. REJET D'UNE URL HTTP DISTANTE
  // =========================================================================
  describe("4 — Rejet d'une URL HTTP distante", () => {
    it("Rejette toute URL HTTP distante (même en environnement de test)", () => {
      const resProd = validateSupabaseBrowserUrl(
        "http://orthogonal-pdi-dev.supabase.co",
        { mode: "production" }
      );
      expect(resProd.isValid).toBe(false);
      expect(resProd.code).toBe("INSECURE_HTTP_URL_FORBIDDEN");

      const resTest = validateSupabaseBrowserUrl(
        "http://orthogonal-pdi-dev.supabase.co",
        { allowLocalhostTestOnly: true, mode: "test" },
        { NODE_ENV: "test", VITEST: "true" }
      );
      expect(resTest.isValid).toBe(false);
      expect(resTest.code).toBe("INSECURE_HTTP_URL_FORBIDDEN");
    });
  });

  // =========================================================================
  // 5. REJET D'UNE URL MALFORMÉE
  // =========================================================================
  describe("5 — Rejet d'une URL malformée", () => {
    it("Rejette les URLs vides, malformées, avec chemin, query, hash, identifiants, wildcards ou IP brute", () => {
      const invalidUrls = [
        "not-a-valid-url",
        "ftp://orthogonal-pdi-dev.supabase.co",
        "https://*.supabase.co",
        "https://orthogonal-pdi-dev.supabase.co/",
        "https://orthogonal-pdi-dev.supabase.co/rest/v1",
        "https://orthogonal-pdi-dev.supabase.co?apikey=123",
        "https://orthogonal-pdi-dev.supabase.co#section",
        "https://user:pass@orthogonal-pdi-dev.supabase.co",
        "https://192.168.1.100",
        "https://singlelabelhost"
      ];

      for (const badUrl of invalidUrls) {
        const check = validateSupabaseBrowserUrl(badUrl, { mode: "production" });
        expect(check.isValid).toBe(false);
        expect(check.code).toBe("MALFORMED_SUPABASE_URL");
      }

      const emptyCheck = validateSupabaseBrowserUrl("   ");
      expect(emptyCheck.isValid).toBe(false);
      expect(emptyCheck.code).toBe("MISSING_SUPABASE_URL");
    });
  });

  // =========================================================================
  // 6. ACCEPTATION DE LOCALHOST UNIQUEMENT EN TEST LOCAL EXPLICITE
  // =========================================================================
  describe("6 — Contrôle strict de localhost (autorisé uniquement en test local explicite)", () => {
    it("Rejette localhost par défaut (sans option allowLocalhostTestOnly explicite)", () => {
      const defaultRes = validateSupabaseBrowserUrl(
        "http://localhost:54321",
        {},
        { NODE_ENV: "test", VITEST: "true" }
      );
      expect(defaultRes.isValid).toBe(false);
      expect(defaultRes.code).toBe("LOCALHOST_FORBIDDEN_OUTSIDE_TEST");

      const devRes = validateSupabaseBrowserUrl(
        "http://127.0.0.1:54321",
        { allowLocalhostTestOnly: true, mode: "development" },
        { NODE_ENV: "development" }
      );
      expect(devRes.isValid).toBe(false);
      expect(devRes.code).toBe("LOCALHOST_FORBIDDEN_OUTSIDE_TEST");
    });

    it("Ne désactive jamais les contrôles en production : rejette localhost en mode production même si allowLocalhostTestOnly est activé", () => {
      const prodRes = validateSupabaseBrowserUrl(
        "http://localhost:54321",
        { allowLocalhostTestOnly: true, mode: "production" },
        { NODE_ENV: "production", VITEST: "true" }
      );
      expect(prodRes.isValid).toBe(false);
      expect(prodRes.code).toBe("LOCALHOST_FORBIDDEN_OUTSIDE_TEST");
    });

    it("Accepte http://localhost:54321 et http://127.0.0.1:54321 uniquement lorsque allowLocalhostTestOnly=true ET que l'environnement de test est explicite", () => {
      const localTestRes1 = validateSupabaseBrowserUrl(
        "http://localhost:54321",
        { allowLocalhostTestOnly: true, mode: "test" },
        { NODE_ENV: "test", VITEST: "true" }
      );
      expect(localTestRes1.isValid).toBe(true);
      expect(localTestRes1.normalizedUrl).toBe("http://localhost:54321");

      const localTestRes2 = validateSupabaseBrowserUrl(
        "http://127.0.0.1:54321",
        { allowLocalhostTestOnly: true, mode: "test" },
        { NODE_ENV: "test", VITEST: "true" }
      );
      expect(localTestRes2.isValid).toBe(true);
      expect(localTestRes2.normalizedUrl).toBe("http://127.0.0.1:54321");
    });
  });

  // =========================================================================
  // 7. ABSENCE DE CONNEXION RÉSEAU AU CHARGEMENT DU MODULE ET EN CI
  // =========================================================================
  describe("7 — Absence de connexion réseau au chargement initial et à l'instanciation", () => {
    it("Le module peut être évalué en CI sans variables configurées et sans provoquer d'appel réseau", () => {
      const fetchSpy = vi.fn();

      // Sans configuration (cas CI par défaut), isSupabaseBrowserConfigured retourne false sans erreur ni requête réseau
      const configured = isSupabaseBrowserConfigured({
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: ""
      });
      expect(configured).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();

      // L'instanciation explicite avec une configuration valide n'effectue aucun appel HTTP synchrone au démarrage
      const client = createSupabaseBrowserClient(
        {
          VITE_SUPABASE_URL: "https://orthogonal-pdi-dev.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_PUBLISHABLE_KEY
        },
        { customFetch: fetchSpy as unknown as typeof fetch }
      );

      expect(client).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 8. ISOLATION DU storageKey ET OPTIONS D'AUTHENTIFICATION
  // =========================================================================
  describe("8 — Isolation du storageKey et options Auth", () => {
    it("Configure persistSession: true, autoRefreshToken: true, detectSessionInUrl: true et storageKey: 'orthogonal.pdi.supabase.auth.dev.v1'", () => {
      expect(SUPABASE_AUTH_STORAGE_KEY).toBe("orthogonal.pdi.supabase.auth.dev.v1");

      const options = buildSupabaseBrowserClientOptions();
      expect(options.auth).toEqual({
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "orthogonal.pdi.supabase.auth.dev.v1"
      });

      const cfg = validateSupabaseBrowserConfig({
        VITE_SUPABASE_URL: "https://orthogonal-pdi-dev.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_PUBLISHABLE_KEY
      });
      expect(cfg.storageKey).toBe("orthogonal.pdi.supabase.auth.dev.v1");
      expect(cfg.authOptions).toEqual({
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "orthogonal.pdi.supabase.auth.dev.v1"
      });
    });
  });

  // =========================================================================
  // 9. VÉRIFICATION STATIQUE DU CODE, DES GARDE-FOUS VITE_ ET DU SCANNER CI
  // =========================================================================
  describe("9 — Garde-fous VITE_ (sec01SecurityService) et Audit Statique CI (.github/workflows/security.yml)", () => {
    it("verifyProductionConfig rejette VITE_SUPABASE_SECRET_KEY, VITE_DATABASE_URL, VITE_DIRECT_URL et toute variable VITE_* contenant une valeur sb_secret_", () => {
      const badEnv1 = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "graphical-router-x18qq",
        VITE_SUPABASE_SECRET_KEY: SYNTHETIC_SECRET_KEY,
        VITE_DATABASE_URL: "postgresql://postgres:pass@db.supabase.co:5432/postgres",
        VITE_DIRECT_URL: "postgresql://postgres:pass@db.supabase.co:5432/postgres"
      };

      const res1 = verifyProductionConfig(badEnv1);
      expect(res1.isSafe).toBe(false);
      expect(res1.forbiddenViteSecretKeys).toContain("VITE_SUPABASE_SECRET_KEY");
      expect(res1.forbiddenViteSecretKeys).toContain("VITE_DATABASE_URL");
      expect(res1.forbiddenViteSecretKeys).toContain("VITE_DIRECT_URL");
      expect(res1.errorMessage).not.toContain(SYNTHETIC_SECRET_KEY);

      // Cas où une clé sb_secret_ est injectée dans VITE_SUPABASE_PUBLISHABLE_KEY
      const badEnv2 = {
        NODE_ENV: "production",
        FIREBASE_PROJECT_ID: "graphical-router-x18qq",
        VITE_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_SECRET_KEY
      };
      const res2 = verifyProductionConfig(badEnv2);
      expect(res2.isSafe).toBe(false);
      expect(res2.forbiddenViteSecretKeys).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
      expect(res2.errorMessage).not.toContain(SYNTHETIC_SECRET_KEY);
    });

    it("src/lib/supabase.ts n'importe ni firebase-admin, ni pg, ni drizzle-orm, ni de variable serveur secrète", () => {
      const supabaseLibPath = path.resolve(process.cwd(), "src/lib/supabase.ts");
      const content = fs.readFileSync(supabaseLibPath, "utf-8");

      expect(content).not.toContain("firebase-admin");
      expect(content).not.toMatch(/from\s+['"]pg['"]/);
      expect(content).not.toContain("drizzle-orm");
      expect(content).not.toContain("process.env.SUPABASE_SECRET_KEY");
      expect(content).not.toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
      expect(content).not.toContain("process.env.DATABASE_URL");
      expect(content).not.toContain("process.env.DIRECT_URL");
    });

    it(".env.example documente exactement les 5 variables MIG-01 sans aucune valeur réelle", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");

      expect(envExampleContent).toContain("VITE_SUPABASE_URL=");
      expect(envExampleContent).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=");
      expect(envExampleContent).toContain("SUPABASE_SECRET_KEY=");
      expect(envExampleContent).toContain("DATABASE_URL=");
      expect(envExampleContent).toContain("DIRECT_URL=");
      expect(envExampleContent).not.toContain("VITE_SUPABASE_SECRET_KEY=");
    });

    it(".github/workflows/security.yml détecte sb_secret_, les clés secrètes Supabase et vérifie le dossier dist/ après build", () => {
      const workflowPath = path.resolve(process.cwd(), ".github/workflows/security.yml");
      const workflowContent = fs.readFileSync(workflowPath, "utf-8");

      expect(workflowContent).toContain("sb_secret_[0-9a-zA-Z_-]{8,}");
      expect(workflowContent).toContain("sbp_[0-9a-zA-Z]{20,}");
      expect(workflowContent).toContain("VITE_SUPABASE_SECRET_KEY");
      expect(workflowContent).toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
      expect(workflowContent).toContain("npm run build");
      expect(workflowContent).toContain('grep -rnE -- "$PATTERN" dist/');

      // Vérifie que notre fichier de test lui-même ne contient aucune chaîne littérale correspondant à sb_secret_[0-9a-zA-Z_-]{8,}
      const thisTestFileContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/security/tests/supabaseConfigValidation.spec.ts"),
        "utf-8"
      );
      expect(/sb_secret_[0-9a-zA-Z_-]{8,}/.test(thisTestFileContent)).toBe(false);
    });
  });
});
