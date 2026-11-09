/**
 * ORTHOGONAL PD&I STUDIO — SEC-01-FIX-02A & FIX-01
 * Firestore Security Rules Hardening Test Suite
 *
 * Utilise le véritable Firebase Firestore Rules Emulator (@firebase/rules-unit-testing)
 * Couverture complète des 20 tests initiaux + 12 tests additionnels FR-08 à FR-13.
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import fs from "node:fs";
import path from "node:path";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

describe("SEC-01-FIX-02A & FIX-01 : Firestore Security Rules Emulator Test Suite", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");
    testEnv = await initializeTestEnvironment({
      projectId: "demo-orthogonal-rules-pdi",
      firestore: {
        rules,
        host: process.env.FIRESTORE_EMULATOR_HOST ? process.env.FIRESTORE_EMULATOR_HOST.split(":")[0] : "127.0.0.1",
        port: process.env.FIRESTORE_EMULATOR_HOST ? Number(process.env.FIRESTORE_EMULATOR_HOST.split(":")[1]) : 8080
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // =========================================================================
  // SUITE 1 : LES 20 TESTS INITIAUX DE SEC-01-FIX-02A
  // =========================================================================

  it("01. Utilisateur non authentifié : accès refusé aux collections privées", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, "profiles", "user_a")));
    await assertFails(getDoc(doc(unauthDb, "projects", "proj_1")));
    await assertFails(getDoc(doc(unauthDb, "payment_transactions", "tx_1")));
    await assertFails(getDoc(doc(unauthDb, "license_keys", "lic_1")));
  });

  it("02. Utilisateur A : lecture de son propre profil autorisée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_a"), {
        uid: "user_a",
        email: "user_a@domain.com",
        name: "User A",
        role: "client"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(userADb, "profiles", "user_a")));
  });

  it("03. Utilisateur A : lecture du profil B refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_b"), {
        uid: "user_b",
        email: "user_b@domain.com",
        name: "User B",
        role: "client"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(userADb, "profiles", "user_b")));
  });

  it("04. Utilisateur A : modification de son rôle refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_a"), {
        uid: "user_a",
        email: "user_a@domain.com",
        name: "User A",
        role: "client",
        status: "active"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "profiles", "user_a"), {
      role: "super_admin"
    }));
  });

  it("05. Utilisateur A : activation de son compte par modification Firestore refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_a"), {
        uid: "user_a",
        email: "user_a@domain.com",
        name: "User A",
        status: "pending_activation"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "profiles", "user_a"), {
      status: "active"
    }));
  });

  it("06. Utilisateur A : création d'un profil avec permissions privilégiées refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // Tentative 1: role super_admin
    await assertFails(setDoc(doc(userADb, "profiles", "user_a"), {
      uid: "user_a",
      email: "user_a@domain.com",
      name: "User A",
      role: "super_admin"
    }));

    // Tentative 2: isAdmin: true
    await assertFails(setDoc(doc(userADb, "profiles", "user_a"), {
      uid: "user_a",
      email: "user_a@domain.com",
      name: "User A",
      isAdmin: true
    }));

    // Création légitime conforme à la whitelist
    await assertSucceeds(setDoc(doc(userADb, "profiles", "user_a"), {
      uid: "user_a",
      email: "user_a@domain.com",
      name: "User A",
      status: "pending_activation"
    }));
  });

  it("07. Utilisateur A : modification de ownerId refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "tenant_org_1"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_a"), {
      ownerId: "user_b"
    }));
  });

  it("08. Utilisateur A : modification de uid refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "tenant_org_1"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_a"), {
      uid: "user_b"
    }));
  });

  it("09. Utilisateur A : modification de tenantId refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "tenant_org_1"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_a"), {
      tenantId: "tenant_org_2"
    }));
  });

  it("10. Utilisateur B : lecture et modification du projet A refusées", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "tenant_org_1"
      });
    });

    const userBDb = testEnv.authenticatedContext("user_b", { email: "user_b@domain.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(userBDb, "projects", "proj_a")));
    await assertFails(updateDoc(doc(userBDb, "projects", "proj_a"), {
      name: "Projet A piraté"
    }));
  });

  it("11. Client : lecture d'une clé de licence disponible refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "license_keys", "KEY_PDI_PRO_2026"), {
        code: "KEY_PDI_PRO_2026",
        plan: "pro",
        status: "available"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(userADb, "license_keys", "KEY_PDI_PRO_2026")));
  });

  it("12. Client : activation d'une clé de licence refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "license_keys", "KEY_PDI_PRO_2026"), {
        code: "KEY_PDI_PRO_2026",
        plan: "pro",
        status: "available"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "license_keys", "KEY_PDI_PRO_2026"), {
      status: "active",
      usedBy: "user_a"
    }));
  });

  it("13. Client : création d'une transaction de paiement refusée (Zero-Trust : exclusif backend Admin SDK)", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // Statut frauduleux "completed"
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_fraud"), {
      id: "tx_fraud",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "enterprise",
      billingCycle: "lifetime",
      amount: 15000,
      currency: "EUR",
      provider: "paddle",
      status: "completed"
    }));

    // Création même avec statut "pending" et montant catalogue : désormais refusée au client
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_valid"), {
      id: "tx_valid",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "pro",
      billingCycle: "monthly",
      amount: 49,
      currency: "EUR",
      provider: "paddle",
      status: "pending"
    }));
  });

  it("14. Client : modification du statut d'un paiement refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "payment_transactions", "tx_pending"), {
        id: "tx_pending",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        userName: "User A",
        amount: 49,
        currency: "EUR",
        status: "pending"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "payment_transactions", "tx_pending"), {
      status: "completed"
    }));
  });

  it("15. Client : lecture de system_config sensible (payment_gateways_v1) refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "system_config", "payment_gateways_v1"), {
        slickPayWebhookSecret: "secret_123",
        paddleApiKey: "secret_456"
      });
      await setDoc(doc(adminContext.firestore(), "system_config", "country_restrictions_v1"), {
        countries: []
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    // Interdit sur les secrets
    await assertFails(getDoc(doc(userADb, "system_config", "payment_gateways_v1")));
    // Autorisé sur la config non-sensible
    await assertSucceeds(getDoc(doc(userADb, "system_config", "country_restrictions_v1")));
  });

  it("16. Super Admin sans e-mail vérifié : opérations administratives refusées", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "system_config", "country_restrictions_v1"), {
        countries: []
      });
    });

    const unverifiedAdminDb = testEnv.authenticatedContext("admin_unverified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: false
    }).firestore();

    await assertFails(setDoc(doc(unverifiedAdminDb, "system_config", "country_restrictions_v1"), { countries: ["DZ"] }));
  });

  it("17. Super Admin avec Custom Claim et e-mail vérifié : opérations administratives autorisées mais élévation de rôle et création arbitraire refusées", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "system_config", "country_restrictions_v1"), {
        countries: ["DZ"]
      });
      await setDoc(doc(adminContext.firestore(), "profiles", "user_a"), {
        uid: "user_a",
        name: "User A"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    // Lecture administrative autorisée au Super Admin vérifié
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "system_config", "country_restrictions_v1")));
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "profiles", "user_a")));

    // R1-01 : Refus d'une modification directe de role par un Super Admin client (élévation interdite côté client)
    await assertFails(updateDoc(doc(verifiedAdminDb, "profiles", "user_a"), {
      role: "admin"
    }));

    // R1-01 : Refus d'une création arbitraire de profil par un Super Admin client
    await assertFails(setDoc(doc(verifiedAdminDb, "profiles", "arbitrary_user"), {
      uid: "arbitrary_user",
      email: "arb@pdi.dz",
      role: "super_admin"
    }));

    // R1-01 : La création normale du profil par son propriétaire continue de réussir
    const userBDb = testEnv.authenticatedContext("user_b", { email: "user_b@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userBDb, "profiles", "user_b"), {
      uid: "user_b",
      email: "user_b@domain.com",
      name: "User B",
      status: "pending_activation"
    }));
  });

  it("18. Utilisateur authentifié : lecture des sous-collections isométriques d'un autre refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a", "isometrics", "iso_1"), {
        id: "iso_1",
        projectId: "proj_a",
        title: "Ligne Gaz Iso"
      });
    });

    const userBDb = testEnv.authenticatedContext("user_b", { email: "user_b@domain.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(userBDb, "projects", "proj_a", "isometrics", "iso_1")));
  });

  it("19. Client : écriture et lecture dans auth_credentials refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "auth_credentials", "cred_fake"), {
      email: "fake@domain.com",
      passwordHash: "123456"
    }));
    await assertFails(getDoc(doc(userADb, "auth_credentials", "super_admin_boudjada")));
  });

  it("20. Toute collection non explicitement autorisée : accès refusé (DENY BY DEFAULT)", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(userADb, "unauthorized_collection", "doc_1")));
    await assertFails(setDoc(doc(userADb, "random_internal_data", "doc_1"), { evil: true }));
  });

  // =========================================================================
  // SUITE 2 : LES 12 TESTS SPÉCIFIQUES FR-08 À FR-13 (SEC-01-FIX-02A-FIX-01)
  // =========================================================================

  // 1. Création d'un profil avec status: "active" : refusée
  it("FR-08.1 : Création d'un profil avec status: 'active' : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "profiles", "user_a"), {
      uid: "user_a",
      email: "user_a@domain.com",
      name: "User A",
      status: "active"
    }));
  });

  // 2. Création d'un profil avec accountType ou subscriptionPlan non autorisé : refusée
  it("FR-08.2 : Création d'un profil avec accountType ou subscriptionPlan non autorisé : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // accountType "enterprise" frauduleux
    await assertFails(setDoc(doc(userADb, "profiles", "user_a"), {
      uid: "user_a",
      email: "user_a@domain.com",
      name: "User A",
      accountType: "enterprise",
      status: "pending_activation"
    }));

    // subscriptionPlan "lifetime" frauduleux
    await assertFails(setDoc(doc(userADb, "profiles", "user_a"), {
      uid: "user_a",
      email: "user_a@domain.com",
      name: "User A",
      subscriptionPlan: "lifetime",
      status: "pending_activation"
    }));
  });

  // 3. Ajout d'un champ arbitraire au profil lors d'une mise à jour : refusé
  it("FR-09.1 : Ajout d'un champ arbitraire au profil lors d'une mise à jour : refusé", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_a"), {
        uid: "user_a",
        email: "user_a@domain.com",
        name: "User A",
        status: "pending_activation"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "profiles", "user_a"), {
      customPrivilegeField: true
    }));
  });

  // 4. Modification d'un champ de profil autorisé : acceptée
  it("FR-09.2 : Modification d'un champ de profil autorisé (name, company) : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_a"), {
        uid: "user_a",
        email: "user_a@domain.com",
        name: "User A",
        company: "Ancienne Entreprise",
        status: "pending_activation"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(updateDoc(doc(userADb, "profiles", "user_a"), {
      name: "User A Renommé",
      company: "Nouvelle Entreprise SAS"
    }));
  });

  // 5. Création d'un projet avec ownerId différent de l'UID : refusée
  it("FR-10.1 : Création d'un projet avec ownerId différent de l'UID : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_invalid_owner"), {
      id: "proj_invalid_owner",
      name: "Projet Falsifié",
      ownerId: "autre_utilisateur",
      uid: "user_a"
    }));
  });

  // 6. Création d'un projet avec uid différent de l'UID : refusée
  it("FR-10.2 : Création d'un projet avec uid différent de l'UID : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_invalid_uid"), {
      id: "proj_invalid_uid",
      name: "Projet Falsifié",
      ownerId: "user_a",
      uid: "autre_utilisateur"
    }));
  });

  // 7. Lecture de payment_gateways_v1 par un Super Admin authentifié et vérifié depuis le client : refusée
  it("FR-11 : Lecture de payment_gateways_v1 par un Super Admin authentifié et vérifié depuis le client : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "system_config", "payment_gateways_v1"), {
        slickPayWebhookSecret: "secret_srv_1",
        paddleApiKey: "secret_srv_2"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    await assertFails(getDoc(doc(verifiedAdminDb, "system_config", "payment_gateways_v1")));
  });

  // 8. Création client d'une transaction avec statut completed : refusée
  it("FR-12.1 : Création client d'une transaction avec statut completed : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_attempt_completed"), {
      id: "tx_attempt_completed",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "pro",
      billingCycle: "monthly",
      amount: 49,
      currency: "EUR",
      provider: "paddle",
      status: "completed"
    }));
  });

  // 9. Création client d'une transaction avec montant ou détails de paiement non autorisés : refusée
  it("FR-12.2 : Création client d'une transaction avec montant ou détails de paiement non autorisés : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // Montant négatif ou invalide
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_negative_amount"), {
      id: "tx_negative_amount",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "pro",
      billingCycle: "monthly",
      amount: -100,
      currency: "EUR",
      provider: "paddle",
      status: "pending"
    }));

    // Tentative d'injecter une validation administrative dans les détails
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_injected_proof"), {
      id: "tx_injected_proof",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "pro",
      billingCycle: "monthly",
      amount: 49,
      currency: "EUR",
      provider: "paddle",
      status: "pending",
      verifiedByAdmin: true
    }));
  });

  // 10. Création d'une isométrie avec des champs de propriété injectés : refusée
  it("FR-13.1 : Création d'une isométrie avec des champs de propriété injectés : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_a", "isometrics", "iso_injected_owner"), {
      id: "iso_injected_owner",
      title: "Iso Test",
      projectId: "proj_a",
      ownerId: "user_a" // Injection de propriété interdite dans la sous-collection
    }));
  });

  // 11. Création d'une isométrie pour un projet inexistant : refusée
  it("FR-13.2 : Création d'une isométrie pour un projet inexistant : refusée (anti-orphan write)", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "projet_fantome", "isometrics", "iso_orpheline"), {
      id: "iso_orpheline",
      title: "Iso Orpheline",
      projectId: "projet_fantome"
    }));
  });

  // 12. Création d'une isométrie valide pour un projet appartenant à l'utilisateur : acceptée
  it("FR-13.3 : Création d'une isométrie valide pour un projet appartenant à l'utilisateur : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_a"), {
        id: "proj_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "projects", "proj_a", "isometrics", "iso_valide"), {
      id: "iso_valide",
      title: "Tuyauterie AEP DN150",
      projectId: "proj_a",
      drawingNumber: "ISO-PDI-2026-001",
      status: "draft"
    }));
  });

  // =========================================================================
  // SUITE 3 : SEC-01-FIX-02A-FIX-03 — FINAL HARDENING (FR-14 À FR-18)
  // =========================================================================

  // -------------------------------------------------------------------------
  // FR-14 : Sécurisation définitive des projets (anti-divergence & Zero-Bypass)
  // -------------------------------------------------------------------------

  it("FR-14.1 : Création de projet valide avec ownerId, uid et tenantId légitimes : acceptée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "projects", "proj_legit_14"), {
      id: "proj_legit_14",
      name: "Réseau Vapeur HP",
      ownerId: "user_a",
      uid: "user_a",
      tenantId: "user_a"
    }));
  });

  it("FR-14.2 : Création de projet avec ownerId falsifié : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_spoofed_owner"), {
      id: "proj_spoofed_owner",
      name: "Projet Usurpé",
      ownerId: "victim_user",
      uid: "user_a"
    }));
  });

  it("FR-14.3 : Création de projet avec uid falsifié : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_spoofed_uid"), {
      id: "proj_spoofed_uid",
      name: "Projet Usurpé UID",
      ownerId: "user_a",
      uid: "victim_user"
    }));
  });

  it("FR-14.4 : Création de projet avec divergence entre ownerId et uid : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_mismatched_ids"), {
      id: "proj_mismatched_ids",
      name: "Projet Incohérent",
      ownerId: "user_a",
      uid: "user_b"
    }));
  });

  it("FR-14.5 : Création de projet avec tenantId usurpé sans revendication de jeton : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_spoofed_tenant"), {
      id: "proj_spoofed_tenant",
      name: "Projet Multi-tenant Illégitime",
      ownerId: "user_a",
      uid: "user_a",
      tenantId: "corporate_enterprise_tenant"
    }));
  });

  it("FR-14.6 : Création de projet avec tenantId correspondant au claim autorisé du jeton : acceptée", async () => {
    const enterpriseUserDb = testEnv.authenticatedContext("user_ent", {
      email: "user@enterprise.dz",
      email_verified: true,
      tenantId: "enterprise_sonatrach_01"
    }).firestore();

    await assertSucceeds(setDoc(doc(enterpriseUserDb, "projects", "proj_tenant_claim"), {
      id: "proj_tenant_claim",
      name: "Pipeline Skikda Phase 3",
      ownerId: "user_ent",
      uid: "user_ent",
      tenantId: "enterprise_sonatrach_01"
    }));
  });

  it("FR-14.7 : Modification de ownerId refusée lors d'une mise à jour de projet", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_fixed_owner"), {
        id: "proj_fixed_owner",
        name: "Projet Fixe",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_fixed_owner"), {
      ownerId: "nouveau_proprietaire"
    }));
  });

  it("FR-14.8 : Modification de uid refusée lors d'une mise à jour de projet", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_fixed_uid"), {
        id: "proj_fixed_uid",
        name: "Projet Fixe UID",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_fixed_uid"), {
      uid: "autre_uid"
    }));
  });

  it("FR-14.9 : Modification de tenantId refusée lors d'une mise à jour de projet", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_fixed_tenant"), {
        id: "proj_fixed_tenant",
        name: "Projet Fixe Tenant",
        ownerId: "user_a",
        uid: "user_a",
        tenantId: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_fixed_tenant"), {
      tenantId: "nouveau_tenant"
    }));
  });

  it("FR-14.10 : Création malformée par un Super Admin (ownerId falsifié) : refusée (Zero-Bypass)", async () => {
    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    // Super Admin ne peut pas créer un projet dont le ownerId ne correspond pas à son UID
    await assertFails(setDoc(doc(verifiedAdminDb, "projects", "proj_admin_spoof"), {
      id: "proj_admin_spoof",
      name: "Projet Injecté Admin",
      ownerId: "autre_client",
      uid: "autre_client"
    }));
  });

  it("FR-14.11 : Modification des identifiants propriétaires par un Super Admin : refusée (Zero-Bypass)", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_admin_target"), {
        id: "proj_admin_target",
        name: "Projet Cible",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    // Même le Super Admin ne peut pas altérer ownerId ou uid depuis le client SDK
    await assertFails(updateDoc(doc(verifiedAdminDb, "projects", "proj_admin_target"), {
      ownerId: "admin_verified"
    }));
  });

  it("FR-14.12 : Accès en lecture (getDoc) refusé à un document dont les identifiants sont incohérents", async () => {
    // Document corrompu injecté en base avec ownerId != uid
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_divergent"), {
        id: "proj_divergent",
        name: "Projet Incohérent BDD",
        ownerId: "user_a",
        uid: "user_b"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    const userBDb = testEnv.authenticatedContext("user_b", { email: "user_b@domain.com", email_verified: true }).firestore();

    // Ni user_a ni user_b ne peuvent y accéder en tant que propriétaire légitime
    await assertFails(getDoc(doc(userADb, "projects", "proj_divergent")));
    await assertFails(getDoc(doc(userBDb, "projects", "proj_divergent")));
  });

  it("FR-14.13 : Mise à jour légitime d'un projet par son propriétaire : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_update_legit"), {
        id: "proj_update_legit",
        name: "Projet Initial",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(updateDoc(doc(userADb, "projects", "proj_update_legit"), {
      name: "Projet Mis à Jour avec Succès"
    }));
  });

  // -------------------------------------------------------------------------
  // FR-15 & FR-17 : Transactions financières Zero-Trust & Suppression Interdite
  // -------------------------------------------------------------------------

  it("FR-15.1 : Création cliente dans payment_transactions avec montant arbitraire : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_forged_amount"), {
      id: "tx_forged_amount",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "pro",
      billingCycle: "monthly",
      amount: 10,
      currency: "EUR",
      provider: "paddle",
      status: "pending"
    }));
  });

  it("FR-15.2 : Création cliente dans payment_transactions avec tarif catalogue : refusée (Zero-Trust)", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    // Même un tarif catalogue officiel (49 EUR) est refusé en écriture directe client
    await assertFails(setDoc(doc(userADb, "payment_transactions", "tx_catalog_attempt"), {
      id: "tx_catalog_attempt",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      plan: "pro",
      billingCycle: "monthly",
      amount: 49,
      currency: "EUR",
      provider: "paddle",
      status: "pending"
    }));
  });

  it("FR-15.3 : Modification cliente dans payment_transactions : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "payment_transactions", "tx_exist"), {
        id: "tx_exist",
        userId: "user_a",
        amount: 49,
        status: "pending"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "payment_transactions", "tx_exist"), {
      status: "completed"
    }));
  });

  it("FR-15.4 : Suppression physique dans payment_transactions par son propriétaire : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "payment_transactions", "tx_nodelete_client"), {
        id: "tx_nodelete_client",
        userId: "user_a",
        amount: 49,
        status: "pending"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(deleteDoc(doc(userADb, "payment_transactions", "tx_nodelete_client")));
  });

  it("FR-15.5 : Suppression physique dans payment_transactions par un Super Admin : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "payment_transactions", "tx_nodelete_admin"), {
        id: "tx_nodelete_admin",
        userId: "user_a",
        amount: 49,
        status: "pending"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();
    await assertFails(deleteDoc(doc(verifiedAdminDb, "payment_transactions", "tx_nodelete_admin")));
  });

  it("FR-15.6 : Création cliente dans pdi_payment_transactions : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "pdi_payment_transactions", "tx_backend_client_attempt"), {
      id: "tx_backend_client_attempt",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "completed",
      amount: 49000
    }));
  });

  it("FR-15.7 : Modification cliente dans pdi_payment_transactions : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "pdi_payment_transactions", "tx_backend_doc"), {
        id: "tx_backend_doc",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        status: "pending",
        amount: 49000
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "pdi_payment_transactions", "tx_backend_doc"), {
      status: "completed"
    }));
  });

  it("FR-15.8 : Suppression cliente dans pdi_payment_transactions : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "pdi_payment_transactions", "tx_backend_del"), {
        id: "tx_backend_del",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        status: "completed"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(deleteDoc(doc(userADb, "pdi_payment_transactions", "tx_backend_del")));
  });

  it("FR-15.9 : Lecture de sa propre transaction dans payment_transactions : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "payment_transactions", "tx_read_ok"), {
        id: "tx_read_ok",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        plan: "pro",
        amount: 49,
        status: "pending"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(userADb, "payment_transactions", "tx_read_ok")));
  });

  it("FR-15.10 : Lecture de transaction par un Super Admin vérifié : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "payment_transactions", "tx_read_admin"), {
        id: "tx_read_admin",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        plan: "pro",
        amount: 49,
        status: "pending"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "payment_transactions", "tx_read_admin")));
  });

  // -------------------------------------------------------------------------
  // FR-16 : Sécurisation complète des isométriques (Création & Modification)
  // -------------------------------------------------------------------------

  it("FR-16.1 : Création d'isométrie avec statut autorisé et champs conformes : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_16"), {
        id: "proj_iso_16",
        name: "Projet Iso 16",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_valid_status"), {
      id: "iso_valid_status",
      title: "Collecteur Gaz HP",
      projectId: "proj_iso_16",
      drawingNumber: "ISO-GAS-2026-001",
      status: "draft"
    }));
  });

  it("FR-16.2 : Création d'isométrie avec statut invalide : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_16"), {
        id: "proj_iso_16",
        name: "Projet Iso 16",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_bad_status"), {
      id: "iso_bad_status",
      title: "Collecteur Gaz HP",
      projectId: "proj_iso_16",
      status: "certified_by_hacker"
    }));
  });

  it("FR-16.3 : Création d'isométrie avec titre vide ou trop long (>200 caractères) : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_16"), {
        id: "proj_iso_16",
        name: "Projet Iso 16",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    // Titre vide
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_empty_title"), {
      id: "iso_empty_title",
      title: "",
      projectId: "proj_iso_16"
    }));

    // Titre trop long (>200)
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_long_title"), {
      id: "iso_long_title",
      title: "T".repeat(205),
      projectId: "proj_iso_16"
    }));
  });

  it("FR-16.4 : Création d'isométrie avec dataJson dépassant 1 000 000 caractères : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_16"), {
        id: "proj_iso_16",
        name: "Projet Iso 16",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_huge_json"), {
      id: "iso_huge_json",
      title: "Iso Enorme",
      projectId: "proj_iso_16",
      dataJson: "X".repeat(1000005)
    }));
  });

  it("FR-16.5 : Création d'isométrie avec champs de type incorrect : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_16"), {
        id: "proj_iso_16",
        name: "Projet Iso 16",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_wrong_types"), {
      id: "iso_wrong_types",
      title: 12345,
      projectId: "proj_iso_16"
    }));
  });

  it("FR-16.6 : Création d'isométrie avec drawingNumber, linePid ou fluidCode invalides : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_16"), {
        id: "proj_iso_16",
        name: "Projet Iso 16",
        ownerId: "user_a",
        uid: "user_a"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // 1. drawingNumber trop long (> 100 caractères)
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_dn_long"), {
      id: "iso_dn_long",
      title: "Iso Test DN Long",
      projectId: "proj_iso_16",
      drawingNumber: "D".repeat(105)
    }));

    // 2. drawingNumber non-string
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_dn_nonstring"), {
      id: "iso_dn_nonstring",
      title: "Iso Test DN Type",
      projectId: "proj_iso_16",
      drawingNumber: 99999 as any
    }));

    // 3. linePid trop long (> 100 caractères)
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_lp_long"), {
      id: "iso_lp_long",
      title: "Iso Test LP Long",
      projectId: "proj_iso_16",
      linePid: "L".repeat(105)
    }));

    // 4. linePid non-string
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_lp_nonstring"), {
      id: "iso_lp_nonstring",
      title: "Iso Test LP Type",
      projectId: "proj_iso_16",
      linePid: true as any
    }));

    // 5. fluidCode invalide (trop long > 50 caractères)
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_bad_fluid"), {
      id: "iso_bad_fluid",
      title: "Iso Test Fluide",
      projectId: "proj_iso_16",
      fluidCode: "F".repeat(55)
    }));

    // 6. fluidCode non-string
    await assertFails(setDoc(doc(userADb, "projects", "proj_iso_16", "isometrics", "iso_bad_fluid_type"), {
      id: "iso_bad_fluid_type",
      title: "Iso Test Fluide Type",
      projectId: "proj_iso_16",
      fluidCode: 12345 as any
    }));
  });

  it("FR-16.7 : Mise à jour d'isométrie avec champs autorisés par le propriétaire : acceptée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_ok"), {
        id: "proj_iso_ok",
        name: "Projet Iso Valid",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_ok", "isometrics", "iso_main"), {
        id: "iso_main",
        projectId: "proj_iso_ok",
        title: "Tuyauterie AEP DN100",
        drawingNumber: "ISO-001",
        status: "draft"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(updateDoc(doc(userADb, "projects", "proj_iso_ok", "isometrics", "iso_main"), {
      title: "Tuyauterie AEP DN100 Révision A",
      status: "approved",
      dataJson: '{"pipes": [{"id": 1, "length": 1500}]}'
    }));
  });

  it("FR-16.8 : Mise à jour d'isométrie avec un champ non autorisé dans la whitelist : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_test"), {
        id: "proj_iso_test",
        name: "Projet Iso Test",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_test", "isometrics", "iso_target"), {
        id: "iso_target",
        projectId: "proj_iso_test",
        title: "Tuyauterie DN80",
        status: "draft"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_iso_test", "isometrics", "iso_target"), {
      unauthorizedCustomField: "injection_payload"
    }));
  });

  it("FR-16.9 : Injection de propriété interdite (projectId, ownerId, uid) lors d'une mise à jour : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_test2"), {
        id: "proj_iso_test2",
        name: "Projet Iso Test 2",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_test2", "isometrics", "iso_target2"), {
        id: "iso_target2",
        projectId: "proj_iso_test2",
        title: "Tuyauterie DN50",
        status: "draft"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_iso_test2", "isometrics", "iso_target2"), {
      projectId: "proj_pirate",
      ownerId: "user_b"
    }));
  });

  it("FR-16.10 : Mise à jour d'isométrie par un utilisateur non-propriétaire : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_user_a"), {
        id: "proj_user_a",
        name: "Projet A",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_user_a", "isometrics", "iso_a"), {
        id: "iso_a",
        projectId: "proj_user_a",
        title: "Iso A",
        status: "draft"
      });
    });

    const userBDb = testEnv.authenticatedContext("user_b", { email: "user_b@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userBDb, "projects", "proj_user_a", "isometrics", "iso_a"), {
      title: "Iso A Piratée"
    }));
  });

  it("FR-16.11 : Tentative de contournement de la whitelist d'isométrie par un Super Admin : refusée (Zero-Bypass)", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_admin_iso"), {
        id: "proj_admin_iso",
        name: "Projet Admin Iso",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_admin_iso", "isometrics", "iso_adm"), {
        id: "iso_adm",
        projectId: "proj_admin_iso",
        title: "Iso Admin",
        status: "draft"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    // Le Super Admin ne peut pas contourner la whitelist client
    await assertFails(updateDoc(doc(verifiedAdminDb, "projects", "proj_admin_iso", "isometrics", "iso_adm"), {
      adminBackdoorField: true
    }));
  });

  it("FR-16.12 : Mise à jour d'isométrie avec updatedAt non conforme : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_time"), {
        id: "proj_iso_time",
        name: "Projet Iso Time",
        ownerId: "user_a",
        uid: "user_a"
      });
      await setDoc(doc(adminContext.firestore(), "projects", "proj_iso_time", "isometrics", "iso_t"), {
        id: "iso_t",
        projectId: "proj_iso_time",
        title: "Iso Time",
        status: "draft"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "projects", "proj_iso_time", "isometrics", "iso_t"), {
      updatedAt: 123456789
    }));
  });

  // -------------------------------------------------------------------------
  // FR-18 : Durcissement des journaux de connexion et des feedbacks
  // -------------------------------------------------------------------------

  it("FR-18.1 : Création de connection_log sans userId : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_no_user"), {
      id: "log_no_user",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.2 : Création de connection_log sans userEmail : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_no_email"), {
      id: "log_no_email",
      userId: "user_a",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.3 : Création de connection_log avec userId falsifié : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_spoofed_user"), {
      id: "log_spoofed_user",
      userId: "autre_utilisateur",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.4 : Création de connection_log avec userEmail discordant du jeton : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_spoofed_email"), {
      id: "log_spoofed_email",
      userId: "user_a",
      userEmail: "imposteur@evil.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.5 : Création de connection_log avec userName trop long (>100 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_long_name"), {
      id: "log_long_name",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "U".repeat(110),
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.6 : Création de connection_log avec userAgent trop long (>500 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_long_ua"), {
      id: "log_long_ua",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userAgent: "A".repeat(520),
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.7 : Création de connection_log avec device trop long (>100 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_long_device"), {
      id: "log_long_device",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      device: "D".repeat(105),
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.8 : Création de connection_log avec status non autorisé : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_invalid_status"), {
      id: "log_invalid_status",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "super_admin_verified",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.9 : Création de connection_log avec timestamp manquant, trop long ou non-string : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // 1. timestamp manquant
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_no_timestamp"), {
      id: "log_no_timestamp",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "success"
    }));

    // 2. timestamp trop long (> 50 caractères)
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_long_timestamp"), {
      id: "log_long_timestamp",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: "2026-11-05T12:00:00.000Z-extra-excessive-timestamp-padding-exceeding-fifty"
    }));

    // 3. timestamp non-string
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_numeric_timestamp"), {
      id: "log_numeric_timestamp",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: 1730811600000 as any
    }));
  });

  it("FR-18.10 : Création de connection_log légitime conforme : acceptée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "connection_logs", "log_legit"), {
      id: "log_legit",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      device: "Desktop",
      userAgent: "Mozilla/5.0",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.11 : Création de subscriber_usage sans module ou module trop long (>64 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_bad_module"), {
      id: "usage_bad_module",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      action: "calculate_normative",
      module: "M".repeat(70),
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.12 : Création de subscriber_usage avec details trop long (>1000 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_huge_details"), {
      id: "usage_huge_details",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      action: "calculate_normative",
      module: "isometric",
      details: "D".repeat(1005),
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.13 : Création de subscriber_usage avec action trop longue (>128 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_oversized"), {
      id: "usage_oversized",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      action: "A".repeat(130),
      module: "isometric",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.14 : Création de subscriber_usage légitime conforme : acceptée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "subscriber_usage", "usage_legit"), {
      id: "usage_legit",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      action: "export_isometric_pdf",
      module: "isometric",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.15 : Création de feedback sans identité (anonyme) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_anon"), {
      id: "feed_anon",
      title: "Retour Anonyme",
      message: "Message anonyme interdit",
      category: "general_feedback",
      rating: 5,
      status: "new"
    }));
  });

  it("FR-18.16 : Création de feedback avec catégorie invalide : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_bad_cat"), {
      id: "feed_bad_cat",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "unauthorized_category",
      title: "Titre Valide",
      message: "Message Valide",
      rating: 4,
      status: "new"
    }));
  });

  it("FR-18.17 : Création de feedback avec rating inférieur à 1 ou supérieur à 5 : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    // Rating 0
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_zero_rating"), {
      id: "feed_zero_rating",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "satisfaction",
      title: "Note Nulle",
      message: "Note inférieure à 1",
      rating: 0,
      status: "new"
    }));

    // Rating 6
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_high_rating"), {
      id: "feed_high_rating",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "satisfaction",
      title: "Note Excessif",
      message: "Note supérieure à 5",
      rating: 6,
      status: "new"
    }));
  });

  it("FR-18.18 : Création de feedback avec titre vide ou trop long (>200 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // 1. titre vide
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_empty_title"), {
      id: "feed_empty_title",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "bug_report",
      title: "",
      message: "Description du bug",
      rating: 3,
      status: "new"
    }));

    // 2. titre trop long (> 200 caractères)
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_oversized_title"), {
      id: "feed_oversized_title",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "bug_report",
      title: "T".repeat(205),
      message: "Description du bug",
      rating: 3,
      status: "new"
    }));
  });

  it("FR-18.19 : Création de feedback avec message trop long (>4000 chars) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_too_long"), {
      id: "feed_too_long",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "bug_report",
      title: "Rapport de bug détaillé",
      message: "B".repeat(4005),
      rating: 3,
      status: "new"
    }));
  });

  it("FR-18.20 : Création de feedback avec createdAt de type incorrect : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_bad_time"), {
      id: "feed_bad_time",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "general_feedback",
      title: "Feedback Horodatage",
      message: "Test horodatage",
      rating: 4,
      status: "new",
      createdAt: 99999999
    }));
  });

  it("FR-18.21 : Création de feedback valide conforme : acceptée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "feedbacks", "feed_legit"), {
      id: "feed_legit",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userName: "User A",
      category: "feature_request",
      title: "Ajout export DXF 3D",
      message: "Serait-il possible d'ajouter une exportation directe vers DXF 3D pour AutoCAD Plant 3D ?",
      rating: 5,
      status: "new",
      createdAt: new Date().toISOString()
    }));
  });

  // -------------------------------------------------------------------------
  // SEC-01-FIX-02A-FIX-04 : FR-18 AUDIT INTEGRITY HARDENING (FR-18.22 À FR-18.33)
  // -------------------------------------------------------------------------

  it("FR-18.22 : Création d'un connection_log avec un ip valide : acceptée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(userADb, "connection_logs", "log_with_valid_ip"), {
      id: "log_with_valid_ip",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      ip: "192.168.1.100",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.23 : Création d'un connection_log avec un ip non-string : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_invalid_ip_type"), {
      id: "log_invalid_ip_type",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      ip: 19216811,
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.24 : Création d'un connection_log avec un ip de plus de 64 caractères : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_oversized_ip"), {
      id: "log_oversized_ip",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra_excessive_ip_padding_exceeding_sixty_four_bytes",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.25 : Refus de adminNotes dans une création client de feedback : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_with_admin_notes"), {
      id: "feed_with_admin_notes",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "bug_report",
      title: "Bug d'affichage",
      message: "Problème sur l'isométrie",
      rating: 4,
      status: "new",
      adminNotes: "Priorité absolue - approuvé pour compensation financière"
    }));
  });

  it("FR-18.26 : Refus d'une tentative client de déclarer un événement success présenté comme audit fiable (flags serveur injectés) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    // Injection interdite de isServerAudit
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_injected_server_audit"), {
      id: "log_injected_server_audit",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: new Date().toISOString(),
      isServerAudit: true
    }));

    // Injection interdite de serverVerified
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_injected_server_verified"), {
      id: "log_injected_server_verified",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: new Date().toISOString(),
      serverVerified: true
    }));
  });

  it("FR-18.27 : Refus d'un timestamp client lorsqu'il est utilisé comme timestamp d'audit serveur : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_fake_server_timestamp"), {
      id: "log_fake_server_timestamp",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      status: "success",
      timestamp: new Date().toISOString(),
      serverTimestamp: new Date().toISOString()
    }));
  });

  it("FR-18.28 : Refus d'une falsification de userRole ou accountType dans un journal sensible : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    // Tentative d'usurpation du rôle super_admin
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_spoofed_role"), {
      id: "log_spoofed_role",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userRole: "super_admin",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // Tentative d'usurpation du type de compte enterprise
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_spoofed_account_type"), {
      id: "log_spoofed_account_type",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      accountType: "enterprise",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.29 : Refus d'une identité userId ne correspondant pas à l'utilisateur authentifié : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_spoofed_uid"), {
      id: "usage_spoofed_uid",
      userId: "autre_victime",
      userEmail: "user_a@domain.com",
      action: "export_isometric_pdf",
      module: "isometric",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR-18.30 : Refus d'un userEmail falsifié : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "user_feedbacks", "feed_spoofed_email"), {
      id: "feed_spoofed_email",
      userId: "user_a",
      userEmail: "ceo@sonatrach.dz",
      category: "general_feedback",
      title: "Email falsifié",
      message: "Tentative d'usurpation d'identité d'un tiers",
      rating: 5,
      status: "new"
    }));
  });

  it("FR-18.31 : Vérification de la politique email_verified pour les opérations qui l'exigent (subscriber_usage et feedbacks) : refusée si non vérifié", async () => {
    const unverifiedUserDb = testEnv.authenticatedContext("user_unverified", {
      email: "unverified@domain.com",
      email_verified: false
    }).firestore();

    // Refus sur subscriber_usage
    await assertFails(setDoc(doc(unverifiedUserDb, "subscriber_usage", "usage_unverified_email"), {
      id: "usage_unverified_email",
      userId: "user_unverified",
      userEmail: "unverified@domain.com",
      action: "export_dxf",
      module: "isometric",
      timestamp: new Date().toISOString()
    }));

    // Refus sur feedbacks
    await assertFails(setDoc(doc(unverifiedUserDb, "feedbacks", "feed_unverified_email"), {
      id: "feed_unverified_email",
      userId: "user_unverified",
      userEmail: "unverified@domain.com",
      category: "general_feedback",
      title: "Avis non vérifié",
      message: "Ce compte n'est pas encore vérifié",
      rating: 4,
      status: "new"
    }));
  });

  it("FR-18.32 : Vérification de la protection des champs sensibles de subscriber_usage (injection de champs de facturation) : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    // Tentative d'injection de billed / cost
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_injected_billing"), {
      id: "usage_injected_billing",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      action: "export_calculation_report",
      module: "stress_analysis",
      timestamp: new Date().toISOString(),
      billed: true,
      cost: 0
    }));

    // Tentative d'injection de invoiceId
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_injected_invoice"), {
      id: "usage_injected_invoice",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      action: "export_calculation_report",
      module: "stress_analysis",
      timestamp: new Date().toISOString(),
      invoiceId: "INV-PAID-0001"
    }));
  });

  it("FR-18.33 : Documents sensibles préinsérés par le backend : lecture Super Admin autorisée, lecture client ordinaire refusée, modification et suppression client refusées", async () => {
    // Préinsertion exclusive sans aucune assertion à l'intérieur du callback
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();

      await setDoc(doc(adminDb, "connection_logs", "srv_cert_log"), {
        id: "srv_cert_log",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        status: "success",
        isServerAudit: true,
        serverVerified: true,
        auditVerified: true,
        timestamp: new Date().toISOString()
      });

      await setDoc(doc(adminDb, "subscriber_usage", "srv_billed_usage"), {
        id: "srv_billed_usage",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        action: "cloud_pipeline_stress_calculation",
        module: "backend_engine",
        billed: true,
        cost: 25.5,
        invoiceId: "INV-2026-9999",
        timestamp: new Date().toISOString()
      });

      await setDoc(doc(adminDb, "feedbacks", "srv_admin_feed"), {
        id: "srv_admin_feed",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "bug_report",
        title: "Bug traité par le support",
        message: "Correction effectuée en prod",
        rating: 5,
        status: "resolved",
        adminNotes: "Bug reproduit et corrigé en version 4.8e"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    const userADb = testEnv.authenticatedContext("user_a", {
      email: "user_a@domain.com",
      email_verified: true
    }).firestore();

    // 1. Lecture Super Admin autorisée
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "connection_logs", "srv_cert_log")));
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "subscriber_usage", "srv_billed_usage")));
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "feedbacks", "srv_admin_feed")));

    // 2. Lecture utilisateur standard refusée
    await assertFails(getDoc(doc(userADb, "connection_logs", "srv_cert_log")));
    await assertFails(getDoc(doc(userADb, "subscriber_usage", "srv_billed_usage")));
    await assertFails(getDoc(doc(userADb, "feedbacks", "srv_admin_feed")));

    // 3. Modification cliente refusée
    await assertFails(updateDoc(doc(userADb, "connection_logs", "srv_cert_log"), { status: "failed" }));
    await assertFails(updateDoc(doc(userADb, "subscriber_usage", "srv_billed_usage"), { action: "hacked" }));

    // 4. Suppression cliente refusée (y compris Super Admin client)
    await assertFails(deleteDoc(doc(userADb, "connection_logs", "srv_cert_log")));
    await assertFails(deleteDoc(doc(userADb, "subscriber_usage", "srv_billed_usage")));
    await assertFails(deleteDoc(doc(userADb, "feedbacks", "srv_admin_feed")));
    await assertFails(deleteDoc(doc(verifiedAdminDb, "connection_logs", "srv_cert_log")));
    await assertFails(deleteDoc(doc(verifiedAdminDb, "subscriber_usage", "srv_billed_usage")));
    await assertFails(deleteDoc(doc(verifiedAdminDb, "feedbacks", "srv_admin_feed")));
  });

  // =========================================================================
  // SUITE 4 : SEC-01-FIX-02A-FIX-04-R1 — AUDIT INTEGRITY HARDENING REVISION
  // =========================================================================

  it("FR18-R1.01 : rôle client falsifié : refusée", async () => {
    // Un utilisateur standard (sans claim de rôle privilégié) tente de déclarer userRole: 'admin' ou 'super_admin'
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_r1_spoofed_role"), {
      id: "log_r1_spoofed_role",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userRole: "admin",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR18-R1.02 : claim role absent ou invalide : refusée", async () => {
    // Utilisateur avec claim role absent, null, ou type non-string
    const userNoRoleDb = testEnv.authenticatedContext("user_norole", { email: "norole@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userNoRoleDb, "connection_logs", "log_r1_no_role_claim"), {
      id: "log_r1_no_role_claim",
      userId: "user_norole",
      userEmail: "norole@domain.com",
      userRole: "super_admin",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    const userBadRoleDb = testEnv.authenticatedContext("user_badrole", {
      email: "badrole@domain.com",
      email_verified: true,
      role: 99999 as any // Claim mal typé
    }).firestore();
    await assertFails(setDoc(doc(userBadRoleDb, "connection_logs", "log_r1_bad_role_claim"), {
      id: "log_r1_bad_role_claim",
      userId: "user_badrole",
      userEmail: "badrole@domain.com",
      userRole: "99999",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR18-R1.03 : claim accountType absent ou invalide : refusée", async () => {
    // Utilisateur sans claim accountType tentant de déclarer un compte enterprise
    const userNoAccDb = testEnv.authenticatedContext("user_noacc", { email: "noacc@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userNoAccDb, "connection_logs", "log_r1_no_acc_claim"), {
      id: "log_r1_no_acc_claim",
      userId: "user_noacc",
      userEmail: "noacc@domain.com",
      accountType: "enterprise",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    const userBadAccDb = testEnv.authenticatedContext("user_badacc", {
      email: "badacc@domain.com",
      email_verified: true,
      accountType: false as any // Claim mal typé
    }).firestore();
    await assertFails(setDoc(doc(userBadAccDb, "connection_logs", "log_r1_bad_acc_claim"), {
      id: "log_r1_bad_acc_claim",
      userId: "user_badacc",
      userEmail: "badacc@domain.com",
      accountType: "false",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR18-R1.04 : journal client avec status: success non considéré comme preuve serveur : acceptée comme déclaration mais rejetée si falsifiée en preuve serveur", async () => {
    const userADb = testEnv.authenticatedContext("user_a", {
      email: "user_a@domain.com",
      email_verified: true,
      role: "client",
      accountType: "basic"
    }).firestore();
    
    // Événement déclaratif valide avec status: 'success'
    await assertSucceeds(setDoc(doc(userADb, "connection_logs", "log_r1_declarative_success"), {
      id: "log_r1_declarative_success",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userRole: "client",
      accountType: "basic",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // Tentative de transformer cet événement en preuve d'audit serveur certifiée via injection de drapeaux
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_r1_spoofed_proof"), {
      id: "log_r1_spoofed_proof",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      userRole: "client",
      status: "success",
      timestamp: new Date().toISOString(),
      isServerAudit: true
    }));
  });

  it("FR18-R1.05 : injection de champs de confiance serveur dans connection_logs : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    for (const flag of ["serverVerified", "auditVerified", "adminCertified", "serverTimestamp"]) {
      await assertFails(setDoc(doc(userADb, "connection_logs", `log_r1_flag_${flag}`), {
        id: `log_r1_flag_${flag}`,
        userId: "user_a",
        userEmail: "user_a@domain.com",
        status: "success",
        timestamp: new Date().toISOString(),
        [flag]: true
      }));
    }
  });

  it("FR18-R1.06 : modification d'un journal existant refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "connection_logs", "log_r1_immutable"), {
        id: "log_r1_immutable",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        status: "success",
        timestamp: new Date().toISOString()
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "connection_logs", "log_r1_immutable"), {
      status: "failed"
    }));
  });

  it("FR18-R1.07 : suppression d'un journal existant refusée au client", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "connection_logs", "log_r1_to_delete"), {
        id: "log_r1_to_delete",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        status: "success",
        timestamp: new Date().toISOString()
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    // Suppression cliente refusée (allow delete: if false)
    await assertFails(deleteDoc(doc(userADb, "connection_logs", "log_r1_to_delete")));

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();
    // Même un Super Admin depuis le SDK client ne peut pas supprimer de journal
    await assertFails(deleteDoc(doc(verifiedAdminDb, "connection_logs", "log_r1_to_delete")));
  });

  it("FR18-R1.08 : injection de champs de facturation dans subscriber_usage : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    for (const field of ["billed", "cost", "units", "invoiceId", "serverVerified", "auditCertified"]) {
      await assertFails(setDoc(doc(userADb, "subscriber_usage", `usage_r1_${field}`), {
        id: `usage_r1_${field}`,
        userId: "user_a",
        userEmail: "user_a@domain.com",
        action: "calculate_normative",
        module: "isometric",
        timestamp: new Date().toISOString(),
        [field]: field === "cost" || field === "units" ? 100 : "test"
      }));
    }
  });

  it("FR18-R1.09 : modification client d'un relevé d'utilisation refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "subscriber_usage", "usage_r1_fixed"), {
        id: "usage_r1_fixed",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        action: "export_pdf",
        module: "isometric",
        timestamp: new Date().toISOString()
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "subscriber_usage", "usage_r1_fixed"), {
      action: "export_dxf"
    }));
  });

  it("FR18-R1.10 : suppression client d'un relevé d'utilisation refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "subscriber_usage", "usage_r1_nodelete"), {
        id: "usage_r1_nodelete",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        action: "export_pdf",
        module: "isometric",
        timestamp: new Date().toISOString()
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    // Suppression cliente refusée (allow delete: if false)
    await assertFails(deleteDoc(doc(userADb, "subscriber_usage", "usage_r1_nodelete")));

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();
    // Même un Super Admin depuis le SDK client ne peut pas supprimer de relevé d'usage
    await assertFails(deleteDoc(doc(verifiedAdminDb, "subscriber_usage", "usage_r1_nodelete")));
  });

  it("FR18-R1.11 : adminNotes refusé à la création : refusée", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(userADb, "user_feedbacks", "feed_r1_admin_notes_create"), {
      id: "feed_r1_admin_notes_create",
      userId: "user_a",
      userEmail: "user_a@domain.com",
      category: "general_feedback",
      title: "Feedback avec notes admin",
      message: "Message utilisateur",
      rating: 5,
      status: "new",
      adminNotes: "Tentative d'injection adminNotes à la création"
    }));
  });

  it("FR18-R1.12 : utilisateur client interdit de modifier adminNotes : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "user_feedbacks", "feed_r1_client_mod"), {
        id: "feed_r1_client_mod",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "bug_report",
        title: "Bug existant",
        message: "Description du bug",
        rating: 3,
        status: "new"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    await assertFails(updateDoc(doc(userADb, "user_feedbacks", "feed_r1_client_mod"), {
      adminNotes: "Client injectant des notes administratives"
    }));
  });

  it("FR18-R1.13 : modification administrative limitée aux champs autorisés : status et adminNotes acceptés, autres champs refusés", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "feedbacks", "feed_r1_admin_target"), {
        id: "feed_r1_admin_target",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "feature_request",
        title: "Demande de module ASME B31.3",
        message: "Ajout des coudes grand rayon",
        rating: 5,
        status: "new"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    const userADb = testEnv.authenticatedContext("user_a", {
      email: "user_a@domain.com",
      email_verified: true
    }).firestore();

    // 1. Modification valide de status seul : acceptée
    await assertSucceeds(updateDoc(doc(verifiedAdminDb, "feedbacks", "feed_r1_admin_target"), {
      status: "reviewed"
    }));

    // 2. Modification valide de adminNotes seul : acceptée
    await assertSucceeds(updateDoc(doc(verifiedAdminDb, "feedbacks", "feed_r1_admin_target"), {
      adminNotes: "Note d'instruction technique seule"
    }));

    // 3. Modification simultanée de status + adminNotes : acceptée
    await assertSucceeds(updateDoc(doc(verifiedAdminDb, "feedbacks", "feed_r1_admin_target"), {
      status: "in_progress",
      adminNotes: "Demande approuvée et intégrée au backlog technique Q3"
    }));

    // 4. Modification d'un champ non autorisé (ex: message, userId) : refusée
    await assertFails(updateDoc(doc(verifiedAdminDb, "feedbacks", "feed_r1_admin_target"), {
      message: "Message falsifié par un attaquant"
    }));
    await assertFails(updateDoc(doc(verifiedAdminDb, "feedbacks", "feed_r1_admin_target"), {
      userId: "autre_victime"
    }));

    // 5. adminNotes de plus de 2000 caractères : refusée
    await assertFails(updateDoc(doc(verifiedAdminDb, "feedbacks", "feed_r1_admin_target"), {
      adminNotes: "N".repeat(2005)
    }));

    // 6. Utilisateur non Super Admin (client) : refusée
    await assertFails(updateDoc(doc(userADb, "feedbacks", "feed_r1_admin_target"), {
      status: "resolved",
      adminNotes: "Modification illégitime par un client"
    }));
  });

  it("FR18-R1.14 : email_verified absent refusé : subscriber_usage et feedbacks", async () => {
    // Contexte avec token sans email_verified
    const userNoEmailVerifiedDb = testEnv.authenticatedContext("user_no_ev", {
      email: "no_ev@domain.com"
    }).firestore();

    await assertFails(setDoc(doc(userNoEmailVerifiedDb, "subscriber_usage", "usage_r1_no_ev"), {
      id: "usage_r1_no_ev",
      userId: "user_no_ev",
      userEmail: "no_ev@domain.com",
      action: "export_pdf",
      module: "isometric",
      timestamp: new Date().toISOString()
    }));

    await assertFails(setDoc(doc(userNoEmailVerifiedDb, "feedbacks", "feed_r1_no_ev"), {
      id: "feed_r1_no_ev",
      userId: "user_no_ev",
      userEmail: "no_ev@domain.com",
      category: "general_feedback",
      title: "Sans email_verified",
      message: "Test absent claim",
      rating: 4,
      status: "new"
    }));
  });

  it("FR18-R1.15 : email_verified non booléen refusé : subscriber_usage et feedbacks", async () => {
    // Contexte avec email_verified de type string ou int
    const userStringEvDb = testEnv.authenticatedContext("user_str_ev", {
      email: "str_ev@domain.com",
      email_verified: "true" as any
    }).firestore();

    await assertFails(setDoc(doc(userStringEvDb, "subscriber_usage", "usage_r1_str_ev"), {
      id: "usage_r1_str_ev",
      userId: "user_str_ev",
      userEmail: "str_ev@domain.com",
      action: "export_pdf",
      module: "isometric",
      timestamp: new Date().toISOString()
    }));

    await assertFails(setDoc(doc(userStringEvDb, "user_feedbacks", "feed_r1_str_ev"), {
      id: "feed_r1_str_ev",
      userId: "user_str_ev",
      userEmail: "str_ev@domain.com",
      category: "bug_report",
      title: "Email verified non booléen",
      message: "Test string ev claim",
      rating: 3,
      status: "new"
    }));
  });

  it("FR18-R1.16 : email_verified: false refusé : subscriber_usage et feedbacks", async () => {
    const userUnverifiedDb = testEnv.authenticatedContext("user_unverified_r1", {
      email: "unverified_r1@domain.com",
      email_verified: false
    }).firestore();

    await assertFails(setDoc(doc(userUnverifiedDb, "subscriber_usage", "usage_r1_false_ev"), {
      id: "usage_r1_false_ev",
      userId: "user_unverified_r1",
      userEmail: "unverified_r1@domain.com",
      action: "export_dxf",
      module: "isometric",
      timestamp: new Date().toISOString()
    }));

    await assertFails(setDoc(doc(userUnverifiedDb, "feedbacks", "feed_r1_false_ev"), {
      id: "feed_r1_false_ev",
      userId: "user_unverified_r1",
      userEmail: "unverified_r1@domain.com",
      category: "satisfaction",
      title: "Email non vérifié",
      message: "Compte non encore vérifié",
      rating: 4,
      status: "new"
    }));
  });

  it("FR18-R1.17 : aucun chemin alternatif ne contourne les règles FR-18 : sous-collections et wildcards interdits", async () => {
    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    
    // Tentative d'écriture dans une sous-collection de connection_logs
    await assertFails(setDoc(doc(userADb, "connection_logs", "log_1", "bypass_sub", "item_1"), {
      dummy: true
    }));

    // Tentative d'écriture dans une sous-collection de subscriber_usage
    await assertFails(setDoc(doc(userADb, "subscriber_usage", "usage_1", "bypass_sub", "item_1"), {
      dummy: true
    }));

    // Tentative d'écriture dans une sous-collection de feedbacks
    await assertFails(setDoc(doc(userADb, "feedbacks", "feed_1", "bypass_sub", "item_1"), {
      dummy: true
    }));

    // Tentative d'écriture dans une collection racine inconnue
    await assertFails(setDoc(doc(userADb, "unknown_audit_collection", "bypass_doc"), {
      dummy: true
    }));
  });

  it("FR18-R1.18 : connection_logs exige email_verified : absent, false, mauvais type refusés, vérifié accepté", async () => {
    // 1. email_verified absent -> refusé
    const userNoEvDb = testEnv.authenticatedContext("user_cl_no_ev", {
      email: "cl_no_ev@domain.com"
    }).firestore();
    await assertFails(setDoc(doc(userNoEvDb, "connection_logs", "log_r1_no_ev"), {
      id: "log_r1_no_ev",
      userId: "user_cl_no_ev",
      userEmail: "cl_no_ev@domain.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 2. email_verified: false -> refusé
    const userFalseEvDb = testEnv.authenticatedContext("user_cl_false_ev", {
      email: "cl_false_ev@domain.com",
      email_verified: false
    }).firestore();
    await assertFails(setDoc(doc(userFalseEvDb, "connection_logs", "log_r1_false_ev"), {
      id: "log_r1_false_ev",
      userId: "user_cl_false_ev",
      userEmail: "cl_false_ev@domain.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 3. email_verified de mauvais type (ex: string "true") -> refusé
    const userStrEvDb = testEnv.authenticatedContext("user_cl_str_ev", {
      email: "cl_str_ev@domain.com",
      email_verified: "true" as any
    }).firestore();
    await assertFails(setDoc(doc(userStrEvDb, "connection_logs", "log_r1_str_ev"), {
      id: "log_r1_str_ev",
      userId: "user_cl_str_ev",
      userEmail: "cl_str_ev@domain.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 4. email_verified: true -> accepté
    const userValidEvDb = testEnv.authenticatedContext("user_cl_valid_ev", {
      email: "cl_valid_ev@domain.com",
      email_verified: true
    }).firestore();
    await assertSucceeds(setDoc(doc(userValidEvDb, "connection_logs", "log_r1_valid_ev"), {
      id: "log_r1_valid_ev",
      userId: "user_cl_valid_ev",
      userEmail: "cl_valid_ev@domain.com",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR18-R1.19 : feedbacks et user_feedbacks : refus individuel de modification de title, message, rating, userId, userEmail", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const db = adminContext.firestore();
      await setDoc(doc(db, "feedbacks", "feed_r1_immutability"), {
        id: "feed_r1_immutability",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "bug_report",
        title: "Titre Original",
        message: "Message Original",
        rating: 4,
        status: "new"
      });
      await setDoc(doc(db, "user_feedbacks", "ufeed_r1_immutability"), {
        id: "ufeed_r1_immutability",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "bug_report",
        title: "Titre Original UserFeed",
        message: "Message Original UserFeed",
        rating: 4,
        status: "new"
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    for (const coll of ["feedbacks", "user_feedbacks"]) {
      const docId = coll === "feedbacks" ? "feed_r1_immutability" : "ufeed_r1_immutability";

      // 1. Refus de modification de title
      await assertFails(updateDoc(doc(verifiedAdminDb, coll, docId), {
        title: "Titre Falsifié"
      }));

      // 2. Refus de modification de message
      await assertFails(updateDoc(doc(verifiedAdminDb, coll, docId), {
        message: "Message Falsifié"
      }));

      // 3. Refus de modification de rating
      await assertFails(updateDoc(doc(verifiedAdminDb, coll, docId), {
        rating: 1
      }));

      // 4. Refus de modification de userId
      await assertFails(updateDoc(doc(verifiedAdminDb, coll, docId), {
        userId: "autre_user"
      }));

      // 5. Refus de modification de userEmail
      await assertFails(updateDoc(doc(verifiedAdminDb, coll, docId), {
        userEmail: "falsified@domain.com"
      }));
    }
  });

  it("FR18-R1.20 : feedbacks et user_feedbacks : suppression refusée pour utilisateur client et Super Admin client", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const db = adminContext.firestore();
      await setDoc(doc(db, "feedbacks", "feed_r1_nodelete"), {
        id: "feed_r1_nodelete",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "general_feedback",
        title: "Feedback Test No Delete",
        message: "Message persistant",
        rating: 5,
        status: "new"
      });
      await setDoc(doc(db, "user_feedbacks", "ufeed_r1_nodelete"), {
        id: "ufeed_r1_nodelete",
        userId: "user_a",
        userEmail: "user_a@domain.com",
        category: "general_feedback",
        title: "User Feedback Test No Delete",
        message: "Message persistant",
        rating: 5,
        status: "new"
      });
    });

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();
    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    for (const coll of ["feedbacks", "user_feedbacks"]) {
      const docId = coll === "feedbacks" ? "feed_r1_nodelete" : "ufeed_r1_nodelete";

      // Suppression refusée pour utilisateur standard
      await assertFails(deleteDoc(doc(userADb, coll, docId)));

      // Suppression refusée pour Super Admin client (allow delete: if false)
      await assertFails(deleteDoc(doc(verifiedAdminDb, coll, docId)));
    }
  });

  it("FR18-R1.21 : commercial_visits : lecture Super Admin autorisée, lecture client refusée, toute écriture/suppression cliente interdite", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "commercial_visits", "visit_r1_sample"), {
        id: "visit_r1_sample",
        visitorEmail: "prospect@industry.dz",
        targetModule: "stress_analysis",
        timestamp: new Date().toISOString()
      });
    });

    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    const userADb = testEnv.authenticatedContext("user_a", { email: "user_a@domain.com", email_verified: true }).firestore();

    // 1. Lecture Super Admin autorisée
    await assertSucceeds(getDoc(doc(verifiedAdminDb, "commercial_visits", "visit_r1_sample")));

    // 2. Lecture utilisateur standard refusée
    await assertFails(getDoc(doc(userADb, "commercial_visits", "visit_r1_sample")));

    // 3. Création cliente refusée (standard et Super Admin)
    await assertFails(setDoc(doc(userADb, "commercial_visits", "visit_r1_user_created"), {
      id: "visit_r1_user_created",
      visitorEmail: "hacker@evil.com"
    }));
    await assertFails(setDoc(doc(verifiedAdminDb, "commercial_visits", "visit_r1_admin_created"), {
      id: "visit_r1_admin_created",
      visitorEmail: "admin_client@pdi.dz"
    }));

    // 4. Modification cliente refusée (standard et Super Admin)
    await assertFails(updateDoc(doc(userADb, "commercial_visits", "visit_r1_sample"), {
      targetModule: "tampered"
    }));
    await assertFails(updateDoc(doc(verifiedAdminDb, "commercial_visits", "visit_r1_sample"), {
      targetModule: "tampered"
    }));

    // 5. Suppression cliente refusée (standard et Super Admin)
    await assertFails(deleteDoc(doc(userADb, "commercial_visits", "visit_r1_sample")));
    await assertFails(deleteDoc(doc(verifiedAdminDb, "commercial_visits", "visit_r1_sample")));
  });

  it("FR18-R1.22 : userRole dans connection_logs : claim absent -> refusé, claim différent -> refusé, claim correspondant -> accepté", async () => {
    // 1. Champ userRole présent avec claim role absent -> refusé
    const userNoRoleDb = testEnv.authenticatedContext("user_no_role_ctx", {
      email: "no_role@domain.com",
      email_verified: true
    }).firestore();
    await assertFails(setDoc(doc(userNoRoleDb, "connection_logs", "log_role_absent_claim"), {
      id: "log_role_absent_claim",
      userId: "user_no_role_ctx",
      userEmail: "no_role@domain.com",
      userRole: "client",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 2. Champ userRole présent avec claim role différent -> refusé
    const userDiffRoleDb = testEnv.authenticatedContext("user_diff_role_ctx", {
      email: "diff_role@domain.com",
      email_verified: true,
      role: "auditor"
    }).firestore();
    await assertFails(setDoc(doc(userDiffRoleDb, "connection_logs", "log_role_diff_claim"), {
      id: "log_role_diff_claim",
      userId: "user_diff_role_ctx",
      userEmail: "diff_role@domain.com",
      userRole: "client", // "client" != "auditor"
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 3. Champ userRole présent avec claim role correspondant exactement -> accepté
    const userMatchRoleDb = testEnv.authenticatedContext("user_match_role_ctx", {
      email: "match_role@domain.com",
      email_verified: true,
      role: "client"
    }).firestore();
    await assertSucceeds(setDoc(doc(userMatchRoleDb, "connection_logs", "log_role_match_claim"), {
      id: "log_role_match_claim",
      userId: "user_match_role_ctx",
      userEmail: "match_role@domain.com",
      userRole: "client",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("FR18-R1.23 : accountType dans connection_logs : claim absent -> refusé, claim différent -> refusé, claim correspondant -> accepté", async () => {
    // 1. Champ accountType présent avec claim accountType absent -> refusé
    const userNoAccDb = testEnv.authenticatedContext("user_no_acc_ctx", {
      email: "no_acc@domain.com",
      email_verified: true
    }).firestore();
    await assertFails(setDoc(doc(userNoAccDb, "connection_logs", "log_acc_absent_claim"), {
      id: "log_acc_absent_claim",
      userId: "user_no_acc_ctx",
      userEmail: "no_acc@domain.com",
      accountType: "basic",
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 2. Champ accountType présent avec claim accountType différent -> refusé
    const userDiffAccDb = testEnv.authenticatedContext("user_diff_acc_ctx", {
      email: "diff_acc@domain.com",
      email_verified: true,
      accountType: "pro"
    }).firestore();
    await assertFails(setDoc(doc(userDiffAccDb, "connection_logs", "log_acc_diff_claim"), {
      id: "log_acc_diff_claim",
      userId: "user_diff_acc_ctx",
      userEmail: "diff_acc@domain.com",
      accountType: "basic", // "basic" != "pro"
      status: "success",
      timestamp: new Date().toISOString()
    }));

    // 3. Champ accountType présent avec claim accountType correspondant exactement -> accepté
    const userMatchAccDb = testEnv.authenticatedContext("user_match_acc_ctx", {
      email: "match_acc@domain.com",
      email_verified: true,
      accountType: "basic"
    }).firestore();
    await assertSucceeds(setDoc(doc(userMatchAccDb, "connection_logs", "log_acc_match_claim"), {
      id: "log_acc_match_claim",
      userId: "user_match_acc_ctx",
      userEmail: "match_acc@domain.com",
      accountType: "basic",
      status: "success",
      timestamp: new Date().toISOString()
    }));
  });

  it("R1-01 : Test isolé — Super Admin interdit de créer le profil d'un autre utilisateur, même avec des champs par ailleurs autorisés", async () => {
    const verifiedAdminDb = testEnv.authenticatedContext("admin_verified", {
      email: "superadmin@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    const targetUserDb = testEnv.authenticatedContext("user_target", {
      email: "user_target@domain.com",
      email_verified: true
    }).firestore();

    const profileData = {
      uid: "user_target",
      email: "user_target@domain.com",
      name: "Utilisateur Cible",
      company: "Orthogonal Test SARL",
      country: "Algeria",
      countryCode: "DZ",
      city: "Algiers",
      paymentGateway: "slickpay",
      currency: "DZD",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: new Date().toISOString()
    };

    // 1. Contre-épreuve d'intégrité : le propriétaire "user_target" crée exactement ce profil avec succès.
    // Cela prouve à 100% que TOUS les champs et valeurs respectent isValidProfileCreation.
    await assertSucceeds(setDoc(doc(targetUserDb, "profiles", "user_target"), profileData));

    // Réinitialisation du document pour isoler le test d'attaque Super Admin
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await deleteDoc(doc(adminContext.firestore(), "profiles", "user_target"));
    });

    // 2. Le Super Admin tente de créer exactement ce même profil valide pour "user_target".
    // La SEULE raison de l'échec est la divergence request.auth.uid ("admin_verified") != profileId ("user_target").
    await assertFails(setDoc(doc(verifiedAdminDb, "profiles", "user_target"), profileData));
  });

  // =========================================================================
  // SUITE 4 : SEC-01-FIX-04 — FIRESTORE PROFILE INTEGRITY (24 SCÉNARIOS OBLIGATOIRES)
  // =========================================================================

  // --- CRÉATION (1 à 8) ---

  it("SEC-01-FIX-04-01 : Création d'un profil par son propriétaire avec des champs légitimes : autorisée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_1", {
      email: "user_fix04_1@domain.com",
      email_verified: true
    }).firestore();

    await assertSucceeds(setDoc(doc(ownerDb, "profiles", "user_fix04_1"), {
      uid: "user_fix04_1",
      email: "user_fix04_1@domain.com",
      name: "Utilisateur Intègre",
      company: "Orthogonal Industrie",
      country: "Algeria",
      countryCode: "DZ",
      city: "Algiers",
      paymentGateway: "slickpay",
      currency: "DZD",
      accountType: "basic",
      subscriptionPlan: "monthly",
      status: "pending_activation",
      createdAt: "2026-04-12T10:00:00.000Z"
    }));
  });

  it("SEC-01-FIX-04-02 : Création d'un profil avec un UID différent : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_2", {
      email: "user_fix04_2@domain.com",
      email_verified: true
    }).firestore();

    // Cas 2a : data.uid différent de profileId et de request.auth.uid
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_2"), {
      uid: "spoofed_uid",
      email: "user_fix04_2@domain.com",
      name: "Utilisateur Spoof UID",
      status: "pending_activation"
    }));

    // Cas 2b : profileId différent de request.auth.uid
    await assertFails(setDoc(doc(ownerDb, "profiles", "other_user_id"), {
      uid: "other_user_id",
      email: "user_fix04_2@domain.com",
      name: "Utilisateur Cible Externe",
      status: "pending_activation"
    }));

    // Cas 2c : champ uid absent du document
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_2"), {
      email: "user_fix04_2@domain.com",
      name: "Utilisateur Sans UID",
      status: "pending_activation"
    }));
  });

  it("SEC-01-FIX-04-03 : Création avec un email différent du claim : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_3", {
      email: "real_claim@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_3"), {
      uid: "user_fix04_3",
      email: "spoofed_email@domain.com",
      name: "Utilisateur Email Falsifié",
      status: "pending_activation"
    }));
  });

  it("SEC-01-FIX-04-04 : Création sans email correspondant au claim : refusée", async () => {
    const ownerDbWithEmailClaim = testEnv.authenticatedContext("user_fix04_4a", {
      email: "user_fix04_4a@domain.com",
      email_verified: true
    }).firestore();

    // Cas 4a : champ email omis dans le document alors que le claim email est présent
    await assertFails(setDoc(doc(ownerDbWithEmailClaim, "profiles", "user_fix04_4a"), {
      uid: "user_fix04_4a",
      name: "Utilisateur Sans Champ Email",
      status: "pending_activation"
    }));

    // Cas 4b : token d'authentification dépourvu de claim email
    const ownerDbWithoutEmailClaim = testEnv.authenticatedContext("user_fix04_4b", {
      email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(ownerDbWithoutEmailClaim, "profiles", "user_fix04_4b"), {
      uid: "user_fix04_4b",
      email: "user_fix04_4b@domain.com",
      name: "Utilisateur Sans Claim Email",
      status: "pending_activation"
    }));
  });

  it("SEC-01-FIX-04-05 : Création contenant loginCount : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_5", {
      email: "user_fix04_5@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_5"), {
      uid: "user_fix04_5",
      email: "user_fix04_5@domain.com",
      name: "Utilisateur LoginCount",
      status: "pending_activation",
      loginCount: 1
    }));
  });

  it("SEC-01-FIX-04-06 : Création contenant projectsCount : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_6", {
      email: "user_fix04_6@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_6"), {
      uid: "user_fix04_6",
      email: "user_fix04_6@domain.com",
      name: "Utilisateur ProjectsCount",
      status: "pending_activation",
      projectsCount: 0
    }));
  });

  it("SEC-01-FIX-04-07 : Création contenant storageUsedKb : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_7", {
      email: "user_fix04_7@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_7"), {
      uid: "user_fix04_7",
      email: "user_fix04_7@domain.com",
      name: "Utilisateur StorageUsedKb",
      status: "pending_activation",
      storageUsedKb: 0
    }));
  });

  it("SEC-01-FIX-04-08 : Création avec role: 'super_admin' : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_fix04_8", {
      email: "user_fix04_8@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(ownerDb, "profiles", "user_fix04_8"), {
      uid: "user_fix04_8",
      email: "user_fix04_8@domain.com",
      name: "Utilisateur Role SuperAdmin",
      status: "pending_activation",
      role: "super_admin"
    }));
  });

  // --- MODIFICATION (9 à 20) ---

  it("SEC-01-FIX-04-09 : Modification du nom par le propriétaire : autorisée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_9"), {
        uid: "user_fix04_9",
        email: "user_fix04_9@domain.com",
        name: "Nom Initial",
        company: "Société Initiale",
        status: "active",
        loginCount: 5,
        projectsCount: 2,
        storageUsedKb: 128
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_9", {
      email: "user_fix04_9@domain.com",
      email_verified: true
    }).firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, "profiles", "user_fix04_9"), {
      name: "Nouveau Nom Légitime"
    }));
  });

  it("SEC-01-FIX-04-10 : Modification de la société par le propriétaire : autorisée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_10"), {
        uid: "user_fix04_10",
        email: "user_fix04_10@domain.com",
        name: "Utilisateur 10",
        company: "Ancienne Société",
        country: "Algeria",
        countryCode: "DZ",
        city: "Algiers",
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_10", {
      email: "user_fix04_10@domain.com",
      email_verified: true
    }).firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, "profiles", "user_fix04_10"), {
      company: "Nouvelle Société Ingénierie",
      country: "France",
      countryCode: "FR",
      city: "Paris"
    }));
  });

  it("SEC-01-FIX-04-11 : Modification de l'email : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_11"), {
        uid: "user_fix04_11",
        email: "user_fix04_11@domain.com",
        name: "Utilisateur 11",
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_11", {
      email: "user_fix04_11@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_11"), {
      email: "autre_email@domain.com"
    }));
  });

  it("SEC-01-FIX-04-12 : Modification de l'UID : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_12"), {
        uid: "user_fix04_12",
        email: "user_fix04_12@domain.com",
        name: "Utilisateur 12",
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_12", {
      email: "user_fix04_12@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_12"), {
      uid: "autre_uid_falsifie"
    }));
  });

  it("SEC-01-FIX-04-13 : Modification de loginCount : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_13"), {
        uid: "user_fix04_13",
        email: "user_fix04_13@domain.com",
        name: "Utilisateur 13",
        loginCount: 3,
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_13", {
      email: "user_fix04_13@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_13"), {
      loginCount: 4
    }));
  });

  it("SEC-01-FIX-04-14 : Modification de projectsCount : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_14"), {
        uid: "user_fix04_14",
        email: "user_fix04_14@domain.com",
        name: "Utilisateur 14",
        projectsCount: 2,
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_14", {
      email: "user_fix04_14@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_14"), {
      projectsCount: 0
    }));
  });

  it("SEC-01-FIX-04-15 : Modification de storageUsedKb : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_15"), {
        uid: "user_fix04_15",
        email: "user_fix04_15@domain.com",
        name: "Utilisateur 15",
        storageUsedKb: 512,
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_15", {
      email: "user_fix04_15@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_15"), {
      storageUsedKb: 0
    }));
  });

  it("SEC-01-FIX-04-16 : Modification de role : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_16"), {
        uid: "user_fix04_16",
        email: "user_fix04_16@domain.com",
        name: "Utilisateur 16",
        role: "client",
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_16", {
      email: "user_fix04_16@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_16"), {
      role: "super_admin"
    }));
  });

  it("SEC-01-FIX-04-17 : Modification de status : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_17"), {
        uid: "user_fix04_17",
        email: "user_fix04_17@domain.com",
        name: "Utilisateur 17",
        status: "pending_activation"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_17", {
      email: "user_fix04_17@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_17"), {
      status: "active"
    }));
  });

  it("SEC-01-FIX-04-18 : Modification de accountType : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_18"), {
        uid: "user_fix04_18",
        email: "user_fix04_18@domain.com",
        name: "Utilisateur 18",
        accountType: "basic",
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_18", {
      email: "user_fix04_18@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_18"), {
      accountType: "enterprise"
    }));
  });

  it("SEC-01-FIX-04-19 : Modification de subscriptionPlan : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_19"), {
        uid: "user_fix04_19",
        email: "user_fix04_19@domain.com",
        name: "Utilisateur 19",
        subscriptionPlan: "monthly",
        status: "active"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_19", {
      email: "user_fix04_19@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_fix04_19"), {
      subscriptionPlan: "lifetime"
    }));
  });

  it("SEC-01-FIX-04-20 : Modification du profil d'un autre utilisateur : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "victim_user_20"), {
        uid: "victim_user_20",
        email: "victim_user_20@domain.com",
        name: "Victime 20",
        company: "Société Victime",
        status: "active"
      });
    });

    const attackerDb = testEnv.authenticatedContext("attacker_user_20", {
      email: "attacker_user_20@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(updateDoc(doc(attackerDb, "profiles", "victim_user_20"), {
      name: "Nom Modifié Par Attaquant"
    }));
  });

  // --- CONTRE-ÉPREUVES (21 à 24) ---

  it("SEC-01-FIX-04-21 : Un document de profil créé par le contexte Admin SDK peut contenir les champs serveur et être lu", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_21"), {
        uid: "user_fix04_21",
        email: "user_fix04_21@domain.com",
        name: "Utilisateur Provisionné Serveur",
        company: "Orthogonal Corp",
        role: "client",
        status: "active",
        accountType: "enterprise",
        subscriptionPlan: "annual",
        loginCount: 42,
        projectsCount: 7,
        storageUsedKb: 2048,
        lastLoginAt: "2026-04-12T11:30:00.000Z"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_21", {
      email: "user_fix04_21@domain.com",
      email_verified: true
    }).firestore();

    const snap = await assertSucceeds(getDoc(doc(ownerDb, "profiles", "user_fix04_21")));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.loginCount).toBe(42);
    expect(snap.data()?.projectsCount).toBe(7);
    expect(snap.data()?.storageUsedKb).toBe(2048);
  });

  it("SEC-01-FIX-04-22 : Un utilisateur peut toujours lire son propre profil", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_22"), {
        uid: "user_fix04_22",
        email: "user_fix04_22@domain.com",
        name: "Utilisateur Lecture Propre"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_fix04_22", {
      email: "user_fix04_22@domain.com",
      email_verified: true
    }).firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "profiles", "user_fix04_22")));
  });

  it("SEC-01-FIX-04-23 : Un utilisateur ne peut toujours pas lire le profil d'un autre utilisateur", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_fix04_23_other"), {
        uid: "user_fix04_23_other",
        email: "other23@domain.com",
        name: "Autre Utilisateur 23"
      });
    });

    const callerDb = testEnv.authenticatedContext("user_fix04_23_caller", {
      email: "caller23@domain.com",
      email_verified: true
    }).firestore();

    await assertFails(getDoc(doc(callerDb, "profiles", "user_fix04_23_other")));
  });

  it("SEC-01-FIX-04-24 : Un Super Admin client ne peut pas contourner les restrictions sur les champs serveur", async () => {
    const superAdminDb = testEnv.authenticatedContext("super_admin_24", {
      email: "super_admin_24@pdi.dz",
      role: "super_admin",
      email_verified: true
    }).firestore();

    // 1. Le Super Admin client ne peut pas créer son propre profil avec loginCount / projectsCount / storageUsedKb / role
    await assertFails(setDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      uid: "super_admin_24",
      email: "super_admin_24@pdi.dz",
      name: "Super Admin Client",
      status: "pending_activation",
      loginCount: 100
    }));

    await assertFails(setDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      uid: "super_admin_24",
      email: "super_admin_24@pdi.dz",
      name: "Super Admin Client",
      status: "pending_activation",
      projectsCount: 50
    }));

    await assertFails(setDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      uid: "super_admin_24",
      email: "super_admin_24@pdi.dz",
      name: "Super Admin Client",
      status: "pending_activation",
      storageUsedKb: 9999
    }));

    // 2. Même si son profil (ou celui d'un tiers) existe déjà, le Super Admin client ne peut pas modifier les champs serveur
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "super_admin_24"), {
        uid: "super_admin_24",
        email: "super_admin_24@pdi.dz",
        name: "Super Admin Client",
        status: "pending_activation",
        loginCount: 1,
        projectsCount: 0,
        storageUsedKb: 0
      });
      await setDoc(doc(adminContext.firestore(), "profiles", "target_client_24"), {
        uid: "target_client_24",
        email: "target_client_24@domain.com",
        name: "Client Cible 24",
        status: "pending_activation",
        loginCount: 1,
        projectsCount: 0,
        storageUsedKb: 0
      });
    });

    await assertFails(updateDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      loginCount: 999
    }));

    await assertFails(updateDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      projectsCount: 999
    }));

    await assertFails(updateDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      storageUsedKb: 99999
    }));

    await assertFails(updateDoc(doc(superAdminDb, "profiles", "super_admin_24"), {
      status: "active"
    }));

    await assertFails(updateDoc(doc(superAdminDb, "profiles", "target_client_24"), {
      loginCount: 999,
      projectsCount: 50,
      storageUsedKb: 4096
    }));
  });

  // =========================================================================
  // SUITE 5 : SEC-01-FIX-04-R1 — VALIDATION STRICTE DES CHAMPS DE PRÉSENTATION
  // =========================================================================

  it("SEC-01-FIX-04-R1-01 : Création de profil avec champs de présentation non conformes (objet, tableau, vide, hors limites) : refusée", async () => {
    const ownerDb = testEnv.authenticatedContext("user_r1_create", {
      email: "user_r1_create@domain.com",
      email_verified: true
    }).firestore();

    // name absent
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_r1_create"), {
      uid: "user_r1_create",
      email: "user_r1_create@domain.com",
      status: "pending_activation"
    }));

    // name vide
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_r1_create"), {
      uid: "user_r1_create",
      email: "user_r1_create@domain.com",
      name: "",
      status: "pending_activation"
    }));

    // name remplacé par un objet
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_r1_create"), {
      uid: "user_r1_create",
      email: "user_r1_create@domain.com",
      name: { nested: "evil" },
      status: "pending_activation"
    }));

    // city remplacé par un tableau
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_r1_create"), {
      uid: "user_r1_create",
      email: "user_r1_create@domain.com",
      name: "Utilisateur R1",
      city: ["Algiers", "Oran"],
      status: "pending_activation"
    }));

    // countryCode non conforme (minuscules ou format invalide)
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_r1_create"), {
      uid: "user_r1_create",
      email: "user_r1_create@domain.com",
      name: "Utilisateur R1",
      countryCode: "dz-invalid",
      status: "pending_activation"
    }));

    // company dépassant la taille maximale (150 caractères)
    await assertFails(setDoc(doc(ownerDb, "profiles", "user_r1_create"), {
      uid: "user_r1_create",
      email: "user_r1_create@domain.com",
      name: "Utilisateur R1",
      company: "C".repeat(151),
      status: "pending_activation"
    }));
  });

  it("SEC-01-FIX-04-R1-02 : Modification de profil remplaçant un champ de présentation par un objet, un tableau ou une valeur hors limites : refusée", async () => {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "profiles", "user_r1_update"), {
        uid: "user_r1_update",
        email: "user_r1_update@domain.com",
        name: "Nom Initial Valide",
        company: "Société Initiale",
        country: "Algeria",
        countryCode: "DZ",
        city: "Algiers",
        status: "pending_activation"
      });
    });

    const ownerDb = testEnv.authenticatedContext("user_r1_update", {
      email: "user_r1_update@domain.com",
      email_verified: true
    }).firestore();

    // name remplacé par un objet
    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_r1_update"), {
      name: { evil: true }
    }));

    // city remplacé par un tableau
    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_r1_update"), {
      city: ["Algiers"]
    }));

    // company remplacé par un nombre
    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_r1_update"), {
      company: 12345
    }));

    // name vide
    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_r1_update"), {
      name: ""
    }));

    // name trop long (> 120 caractères)
    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_r1_update"), {
      name: "N".repeat(121)
    }));

    // countryCode invalide
    await assertFails(updateDoc(doc(ownerDb, "profiles", "user_r1_update"), {
      countryCode: "123"
    }));
  });

  it("SEC-01-FIX-04-R1-03 : Création et modification de profil avec champs de présentation conformes : autorisées", async () => {
    const ownerDb = testEnv.authenticatedContext("user_r1_valid", {
      email: "user_r1_valid@domain.com",
      email_verified: true
    }).firestore();

    await assertSucceeds(setDoc(doc(ownerDb, "profiles", "user_r1_valid"), {
      uid: "user_r1_valid",
      email: "user_r1_valid@domain.com",
      name: "Ingénieur Tuyauterie",
      company: "Orthogonal Engineering",
      country: "Algeria",
      countryCode: "DZ",
      city: "Algiers",
      status: "pending_activation",
      accountType: "basic",
      subscriptionPlan: "monthly"
    }));

    await assertSucceeds(updateDoc(doc(ownerDb, "profiles", "user_r1_valid"), {
      name: "Ingénieur Tuyauterie Senior",
      company: "Orthogonal Process SARL",
      country: "France",
      countryCode: "FR",
      city: "Lyon"
    }));
  });
});

