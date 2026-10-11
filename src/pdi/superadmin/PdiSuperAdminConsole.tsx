import React, { useState, useEffect, useMemo } from "react";
import {
  PdiUserProfile,
  PdiConnectionLog,
  PdiCommercialVisit,
  PdiUserFeedback,
  PdiSubscriberUsage,
  PdiLicenseKey,
  getFirebaseProfiles,
  saveFirebaseProfile,
  deleteFirebaseProfile,
  getConnectionLogsFromFirebase,
  getCommercialVisitsFromFirebase,
  getUserFeedbacksFromFirebase,
  updateFeedbackStatusInFirebase,
  getSubscriberUsageFromFirebase,
  getFirebaseLicenseKeys,
  saveFirebaseLicenseKey,
  revokeFirebaseLicenseKey,
  saveAuthCredentialsSecure,
  getCountryRestrictionsFromFirebase,
  saveCountryRestrictionsToFirebase,
  toggleCountryAllowedStatus,
  getPaymentTransactionsFromFirebase,
  savePaymentTransactionToFirebase,
  updatePaymentTransactionStatus,
  approveAndActivateTransaction,
  getPaymentGatewayConfigFromFirebase,
  savePaymentGatewayConfigToFirebase,
  PdiPaymentGatewayConfig
} from "../../lib/firebase";
import { PdiCountryConfig, PDI_DEFAULT_COUNTRIES } from "../data/pdiGeoData";
import {
  PdiPaymentTransaction,
  getPaymentConfigForCountry,
  generateTransactionId,
  PDI_PRICING_DZD,
  PDI_PRICING_INTERNATIONAL
} from "../payment/pdiPaymentGateway";
import { PDI_PATCH_VERSION } from "../pdiVersion";
import { pdiAlert } from "../ui/PdiNotice";
import { pdiConfirm } from "../ui/PdiConfirm";
import { getSanityAnnouncements, SanityAnnouncement, SANITY_PROJECT_ID, SANITY_DATASET } from "../../lib/sanity";
import { CLARITY_PROJECT_ID, initClarity } from "../../lib/clarity";

type SuperAdminTab =
  | "overview"
  | "accounts"
  | "geo_restrictions"
  | "payments"
  | "license_keys"
  | "connections"
  | "commercial_visits"
  | "subscriber_usage"
  | "feedbacks"
  | "clarity_ux"
  | "sanity_cms";

export function PdiSuperAdminConsole({
  currentUserEmail,
  onSwitchModule
}: {
  currentUserEmail?: string;
  onSwitchModule?: (mod: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>("overview");
  const [loading, setLoading] = useState(false);

  // States
  const [profiles, setProfiles] = useState<PdiUserProfile[]>([]);
  const [connectionLogs, setConnectionLogs] = useState<PdiConnectionLog[]>([]);
  const [commercialVisits, setCommercialVisits] = useState<PdiCommercialVisit[]>([]);
  const [subscriberUsages, setSubscriberUsages] = useState<PdiSubscriberUsage[]>([]);
  const [feedbacks, setFeedbacks] = useState<PdiUserFeedback[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<PdiLicenseKey[]>([]);

  // Geo / Country Restrictions state
  const [countries, setCountries] = useState<PdiCountryConfig[]>(PDI_DEFAULT_COUNTRIES);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryTabFilter, setCountryTabFilter] = useState<"all" | "allowed" | "excluded">("all");
  const [showAddCountryModal, setShowAddCountryModal] = useState(false);
  const [newCountryDraft, setNewCountryDraft] = useState({
    code: "",
    name: "",
    flag: "🌍",
    currency: "EUR",
    paymentGateway: "paddle" as "slickpay_baridimob" | "paddle",
    defaultCities: ""
  });

  // Payments and Transactions state
  const [paymentTransactions, setPaymentTransactions] = useState<PdiPaymentTransaction[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState<PdiPaymentGatewayConfig | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState(false);

  // Sanity CMS & Microsoft Clarity state
  const [sanityAnnouncements, setSanityAnnouncements] = useState<SanityAnnouncement[]>([]);
  const [isSanityConfigured, setIsSanityConfigured] = useState(false);
  const [sanityLoading, setSanityLoading] = useState(false);
  const [clarityId, setClarityId] = useState<string>(
    localStorage.getItem("pdi_clarity_id") || CLARITY_PROJECT_ID || ""
  );
  const [clarityEmbedUrl, setClarityEmbedUrl] = useState<string>(
    localStorage.getItem("pdi_clarity_embed") || (CLARITY_PROJECT_ID ? `https://clarity.microsoft.com/embed/${CLARITY_PROJECT_ID}` : "")
  );
  const [isEditingClarity, setIsEditingClarity] = useState(false);
  const [simDraft, setSimDraft] = useState<{
    email: string;
    name: string;
    company: string;
    countryCode: string;
    city: string;
    plan: "basic" | "pro" | "team" | "enterprise";
    billingCycle: "monthly" | "yearly";
  }>({
    email: "client.test@domaine.dz",
    name: "Mohamed Amine",
    company: "Bureau Piping Alger",
    countryCode: "DZ",
    city: "16 - Alger",
    plan: "pro",
    billingCycle: "monthly"
  });
  const [simulatedTx, setSimulatedTx] = useState<PdiPaymentTransaction | null>(null);

  // Account creation form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountDraft, setNewAccountDraft] = useState<{
    name: string;
    email: string;
    company: string;
    password?: string;
    role: "client" | "admin" | "super_admin";
    accountType: "basic" | "pro" | "team" | "enterprise";
    subscriptionPlan: "monthly" | "yearly" | "trial" | "lifetime";
    status: "active" | "pending_activation" | "suspended";
  }>({
    name: "",
    email: "",
    company: "",
    password: "",
    role: "client",
    accountType: "pro",
    subscriptionPlan: "monthly",
    status: "active"
  });

  // License Generator Draft
  const [licenseKeyDraft, setLicenseKeyDraft] = useState({
    type: "PRO_YEAR",
    plan: "pro",
    assignedTo: ""
  });

  // Load data
  const refreshAllData = async () => {
    setLoading(true);
    try {
      const [pList, cLogs, cVisits, sUsages, fBacks, lKeys, cRestrictions, pTxList, gConfig] = await Promise.all([
        getFirebaseProfiles(),
        getConnectionLogsFromFirebase(100),
        getCommercialVisitsFromFirebase(100),
        getSubscriberUsageFromFirebase(100),
        getUserFeedbacksFromFirebase(100),
        getFirebaseLicenseKeys(),
        getCountryRestrictionsFromFirebase(),
        getPaymentTransactionsFromFirebase(100),
        getPaymentGatewayConfigFromFirebase()
      ]);

      setLicenseKeys(lKeys);
      setCountries(cRestrictions);
      setGatewayConfig(gConfig);

      // Seed sample transactions if none exists
      if (pTxList.length === 0) {
        const sampleTxDZ: PdiPaymentTransaction = {
          id: "TX_SLICKPAY_DZ_DEMO_01",
          userEmail: "engineering.skikda@sonatrach.dz",
          userName: "Ingénierie Tuyauterie Skikda",
          company: "Sonatrach RTO",
          country: "Algérie",
          countryCode: "DZ",
          city: "21 - Skikda",
          plan: "pro",
          billingCycle: "yearly",
          amount: 49000,
          currency: "DZD",
          provider: "slickpay_baridimob",
          status: "pending",
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          slickPayDetails: {
            invoiceId: "INV-SLICKPAY-DZ-2026-0089",
            baridiMobRip: "00799999000123456789",
            slickPayUrl: "https://pay.slick-pay.com/invoice/pdi-sonatrach-skikda",
            transferReference: "CCP-VIR-998822"
          }
        };
        const sampleTxIntl: PdiPaymentTransaction = {
          id: "TX_PADDLE_FR_DEMO_02",
          userEmail: "pierre.valentin@technip-energies.com",
          userName: "Pierre Valentin",
          company: "Technip Energies Paris",
          country: "France",
          countryCode: "FR",
          city: "Paris",
          plan: "team",
          billingCycle: "yearly",
          amount: 1200,
          currency: "EUR",
          provider: "paddle",
          status: "completed",
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          paddleDetails: {
            checkoutId: "chk_paddle_99182312",
            paddleOrderId: "ord_pdl_7781290",
            customerEmail: "pierre.valentin@technip-energies.com",
            subscriptionId: "sub_paddle_live_001"
          }
        };
        await savePaymentTransactionToFirebase(sampleTxDZ);
        await savePaymentTransactionToFirebase(sampleTxIntl);
        setPaymentTransactions([sampleTxDZ, sampleTxIntl]);
      } else {
        setPaymentTransactions(pTxList);
      }

      // If profiles in Firebase is empty, seed with Super Admin Youcef and default sample accounts
      if (pList.length === 0) {
        const defaultSuperAdmin: PdiUserProfile = {
          uid: "superadmin-youcef-boudjada",
          name: "Youcef Seif Eddine Boudjada",
          email: "boudjada.youcef@gmail.com",
          company: "PD&I Vision DZ",
          country: "Algérie",
          countryCode: "DZ",
          city: "16 - Alger",
          paymentGateway: "slickpay_baridimob",
          currency: "DZD",
          role: "super_admin",
          accountType: "enterprise",
          subscriptionPlan: "lifetime",
          status: "active",
          createdAt: "2026-08-01T08:00:00.000Z",
          lastLoginAt: new Date().toISOString(),
          loginCount: 84,
          projectsCount: 16
        };
        const samplePro: PdiUserProfile = {
          uid: "client-sonatrach-01",
          name: "Ingénierie Tuyauterie Skikda",
          email: "engineering.skikda@sonatrach.dz",
          company: "Sonatrach RTO",
          country: "Algérie",
          countryCode: "DZ",
          city: "21 - Skikda",
          paymentGateway: "slickpay_baridimob",
          currency: "DZD",
          role: "client",
          accountType: "pro",
          subscriptionPlan: "yearly",
          status: "active",
          createdAt: "2026-08-15T10:00:00.000Z",
          lastLoginAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          loginCount: 32,
          projectsCount: 8
        };
        const sampleBasic: PdiUserProfile = {
          uid: "client-bureau-etudes-02",
          name: "Cabinet Études Mécaniques Alger",
          email: "contact@etudes-alger.dz",
          company: "BET Al-Handasa",
          country: "Algérie",
          countryCode: "DZ",
          city: "16 - Alger",
          paymentGateway: "slickpay_baridimob",
          currency: "DZD",
          role: "client",
          accountType: "basic",
          subscriptionPlan: "monthly",
          status: "active",
          createdAt: "2026-08-22T14:30:00.000Z",
          lastLoginAt: new Date(Date.now() - 3600000 * 18).toISOString(),
          loginCount: 12,
          projectsCount: 3
        };

        await saveFirebaseProfile(defaultSuperAdmin);
        await saveFirebaseProfile(samplePro);
        await saveFirebaseProfile(sampleBasic);
        setProfiles([defaultSuperAdmin, samplePro, sampleBasic]);
      } else {
        setProfiles(pList);
      }

      setConnectionLogs(cLogs);
      setCommercialVisits(cVisits);
      setSubscriberUsages(sUsages);
      setFeedbacks(fBacks);

      // Load Sanity announcements
      setSanityLoading(true);
      getSanityAnnouncements().then((res) => {
        setSanityAnnouncements(res.announcements);
        setIsSanityConfigured(res.isConfigured);
      }).catch((e) => {
        console.warn("Sanity fetch error:", e);
      }).finally(() => {
        setSanityLoading(false);
      });
    } catch (err) {
      console.error("Failed to load super admin data from Firebase:", err);
    } finally {
      setLoading(false);
    }
  };

  // Geo / Country Restrictions Handlers
  const handleToggleCountry = async (countryCode: string, currentAllowed: boolean) => {
    try {
      const nextAllowed = !currentAllowed;
      const updated = await toggleCountryAllowedStatus(countryCode, nextAllowed);
      setCountries(updated);
      const c = updated.find(x => x.code === countryCode);
      await pdiAlert(`Le pays ${c?.name || countryCode} est maintenant ${nextAllowed ? "AUTORISÉ (affiché dans le formulaire client)" : "EXCLU (masqué de l'inscription client)"}.`);
    } catch (err: any) {
      await pdiAlert("Erreur lors de la mise à jour des restrictions pays : " + err.message);
    }
  };

  const handleAddNewCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCountryDraft.code.trim().toUpperCase();
    const name = newCountryDraft.name.trim();
    if (!code || !name) {
      await pdiAlert("Veuillez renseigner le code ISO et le nom du pays.");
      return;
    }

    if (countries.some(c => c.code.toUpperCase() === code)) {
      await pdiAlert(`Le pays avec le code ${code} existe déjà dans la liste.`);
      return;
    }

    const citiesArray = newCountryDraft.defaultCities
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const newCountry: PdiCountryConfig = {
      code,
      name,
      flag: newCountryDraft.flag.trim() || "🌍",
      phoneCode: "+00",
      currency: newCountryDraft.currency as "DZD" | "EUR" | "USD",
      currencySymbol: newCountryDraft.currency === "DZD" ? "DZD" : newCountryDraft.currency === "EUR" ? "€" : "$",
      paymentGateway: newCountryDraft.paymentGateway,
      allowed: true,
      defaultCities: citiesArray.length > 0 ? citiesArray : [name]
    };

    const updated = [...countries, newCountry];
    try {
      await saveCountryRestrictionsToFirebase(updated);
      setCountries(updated);
      setShowAddCountryModal(false);
      setNewCountryDraft({
        code: "",
        name: "",
        flag: "🌍",
        currency: "EUR",
        paymentGateway: "paddle",
        defaultCities: ""
      });
      await pdiAlert(`Le pays ${name} (${code}) a été ajouté avec succès avec statut AUTORISÉ.`);
    } catch (err: any) {
      await pdiAlert("Erreur lors de l'enregistrement du nouveau pays : " + err.message);
    }
  };

  // Payments & Transactions Handlers
  const handleApproveTransaction = async (txId: string) => {
    const ok = await pdiConfirm({
      title: "Valider et Activer la souscription",
      message: "Confirmez-vous la réception du paiement ? Le compte utilisateur associé sera immédiatement activé avec la formule choisie.",
      confirmLabel: "Valider le paiement"
    });
    if (!ok) return;

    try {
      const activatedUser = await approveAndActivateTransaction(txId);
      const updatedTx = paymentTransactions.map(tx => tx.id === txId ? { ...tx, status: "completed" as const } : tx);
      setPaymentTransactions(updatedTx);
      if (activatedUser) {
        setProfiles(profiles.map(p => p.uid === activatedUser.uid ? activatedUser : p));
        await pdiAlert(`Paiement validé avec succès !\nLe compte de ${activatedUser.name} (${activatedUser.email}) est désormais ACTIF (${activatedUser.accountType.toUpperCase()}).`);
      } else {
        await pdiAlert("Transaction validée avec succès.");
      }
    } catch (err: any) {
      await pdiAlert("Erreur de validation : " + err.message);
    }
  };

  const handleRejectTransaction = async (txId: string) => {
    const ok = await pdiConfirm({
      title: "Rejeter la transaction",
      message: "Voulez-vous marquer cette transaction comme échouée / rejetée ?",
      confirmLabel: "Rejeter",
      destructive: true
    });
    if (!ok) return;

    try {
      await updatePaymentTransactionStatus(txId, "failed");
      setPaymentTransactions(paymentTransactions.map(tx => tx.id === txId ? { ...tx, status: "failed" as const } : tx));
      await pdiAlert("Transaction marquée comme échouée.");
    } catch (err: any) {
      await pdiAlert("Erreur : " + err.message);
    }
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayConfig) return;
    try {
      await savePaymentGatewayConfigToFirebase(gatewayConfig);
      await pdiAlert("Configuration des passerelles Slick-Pay (BaridiMob) & Paddle enregistrée avec succès !");
    } catch (err: any) {
      await pdiAlert("Erreur lors de la sauvegarde : " + err.message);
    }
  };

  const handleRunPaymentSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    const config = getPaymentConfigForCountry(simDraft.countryCode);
    const pricing = config.pricingTable[simDraft.plan];
    const amount = simDraft.billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;
    const txId = generateTransactionId(config.provider);
    const countryObj = countries.find(c => c.code === simDraft.countryCode) || PDI_DEFAULT_COUNTRIES[0];

    const newTx: PdiPaymentTransaction = {
      id: txId,
      userEmail: simDraft.email.trim().toLowerCase(),
      userName: simDraft.name.trim(),
      company: simDraft.company.trim(),
      country: countryObj.name,
      countryCode: simDraft.countryCode,
      city: simDraft.city,
      plan: simDraft.plan,
      billingCycle: simDraft.billingCycle,
      amount,
      currency: config.currency,
      provider: config.provider,
      status: "pending",
      createdAt: new Date().toISOString(),
      slickPayDetails: config.provider === "slickpay_baridimob" ? {
        invoiceId: `INV-SLICKPAY-${Date.now().toString(36).toUpperCase()}`,
        baridiMobRip: gatewayConfig?.slickPayAccountId || "00799999000123456789",
        slickPayUrl: `https://pay.slick-pay.com/checkout/${(txId || "").toLowerCase()}`,
        transferReference: `VIR-BMOB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      } : undefined,
      paddleDetails: config.provider === "paddle" ? {
        checkoutId: `chk_pdl_${Date.now().toString(36)}`,
        customerEmail: simDraft.email ? simDraft.email.trim().toLowerCase() : "",
        paddleOrderId: `ord_pdl_${Math.random().toString(36).slice(2, 8)}`
      } : undefined
    };

    try {
      await savePaymentTransactionToFirebase(newTx);
      setPaymentTransactions([newTx, ...paymentTransactions]);
      setSimulatedTx(newTx);
      await pdiAlert(`Simulation réussie !\nUne transaction ${config.provider === "slickpay_baridimob" ? "Slick-Pay BaridiMob (DZD)" : "Paddle Checkout (EUR)"} a été générée avec l'ID ${newTx.id}.`);
    } catch (err: any) {
      await pdiAlert("Erreur de simulation : " + err.message);
    }
  };

  // Filtered countries for display
  const filteredCountries = useMemo(() => {
    let list = countries;
    if (countryTabFilter === "allowed") {
      list = list.filter(c => c.allowed);
    } else if (countryTabFilter === "excluded") {
      list = list.filter(c => !c.allowed);
    }

    if (countrySearch.trim()) {
      const q = countrySearch.toLowerCase().trim();
      list = list.filter(c => (c.name || "").toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q));
    }
    return list;
  }, [countries, countryTabFilter, countrySearch]);

  const excludedCountriesCount = useMemo(() => {
    return countries.filter(c => !c.allowed).length;
  }, [countries]);

  const allowedCountriesCount = useMemo(() => {
    return countries.filter(c => c.allowed).length;
  }, [countries]);

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountDraft.email || !newAccountDraft.name) {
      await pdiAlert("Veuillez remplir au moins le nom et l'adresse email.");
      return;
    }

    try {
      const uid = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const { password, ...profileData } = newAccountDraft;
      const newProfile: PdiUserProfile = {
        uid,
        ...profileData,
        createdAt: new Date().toISOString(),
        loginCount: 0,
        projectsCount: 0
      };

      await saveFirebaseProfile(newProfile);

      // If a password was provided by super admin, save credentials hash in Firestore
      if (password && password.trim().length >= 6) {
        await saveAuthCredentialsSecure(newProfile.email, password.trim(), newProfile.role);
      }

      setShowCreateModal(false);
      setNewAccountDraft({
        name: "",
        email: "",
        company: "",
        password: "",
        role: "client",
        accountType: "pro",
        subscriptionPlan: "monthly",
        status: "active"
      });
      await pdiAlert(`Compte créé avec succès pour ${newProfile.name} (${newProfile.accountType.toUpperCase()} - ${newProfile.subscriptionPlan})`);
      refreshAllData();
    } catch (err: any) {
      await pdiAlert(`Erreur de création de compte : ${err.message || err}`);
    }
  };

  const handleGenerateLicenseKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = `lic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const randHex = Math.random().toString(36).slice(2, 6).toUpperCase();
      const code = `PDI-${licenseKeyDraft.plan.toUpperCase()}-${randHex}-${Date.now().toString(36).toUpperCase()}`;
      
      let days = 365;
      if (licenseKeyDraft.type.includes("30")) days = 30;
      else if (licenseKeyDraft.type.includes("7")) days = 7;
      else if (licenseKeyDraft.type.includes("LIFE")) days = 3650;

      const newKey: PdiLicenseKey = {
        id,
        code,
        type: licenseKeyDraft.type,
        plan: licenseKeyDraft.plan,
        status: "generated",
        assignedTo: licenseKeyDraft.assignedTo.trim() || undefined,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + days * 86400000).toISOString()
      };

      await saveFirebaseLicenseKey(newKey);
      setLicenseKeys([newKey, ...licenseKeys]);
      await pdiAlert(`Nouvelle clé générée avec succès :\n\n${newKey.code}\n(Valable pour la formule ${newKey.plan.toUpperCase()})`);
      setLicenseKeyDraft({ type: "PRO_YEAR", plan: "pro", assignedTo: "" });
    } catch (err: any) {
      await pdiAlert("Erreur lors de la génération de la clé : " + (err.message || err));
    }
  };

  const handleRevokeLicense = async (keyId: string) => {
    const ok = await pdiConfirm({
      title: "Révoquer la clé de licence",
      message: "Êtes-vous sûr de vouloir révoquer cette clé ? Les utilisateurs ne pourront plus l'activer.",
      confirmLabel: "Révoquer",
      destructive: true
    });
    if (!ok) return;

    try {
      await revokeFirebaseLicenseKey(keyId);
      setLicenseKeys(licenseKeys.map(k => k.id === keyId ? { ...k, status: "revoked" } : k));
      await pdiAlert("Clé de licence révoquée.");
    } catch (err: any) {
      await pdiAlert("Erreur lors de la révocation : " + err.message);
    }
  };

  const handleToggleAccountStatus = async (profile: PdiUserProfile) => {
    const nextStatus = profile.status === "active" ? "suspended" : "active";
    const ok = await pdiConfirm({
      title: `${nextStatus === "suspended" ? "Suspendre" : "Activer"} le compte`,
      message: `Voulez-vous modifier le statut du compte de ${profile.name} (${profile.email}) vers "${nextStatus.toUpperCase()}" ?`,
      confirmLabel: nextStatus === "suspended" ? "Suspendre" : "Activer",
      destructive: nextStatus === "suspended"
    });
    if (!ok) return;

    try {
      const updated: PdiUserProfile = { ...profile, status: nextStatus };
      await saveFirebaseProfile(updated);
      setProfiles(profiles.map(p => p.uid === profile.uid ? updated : p));
    } catch (err: any) {
      await pdiAlert("Erreur de mise à jour du profil : " + err.message);
    }
  };

  const handleDeleteAccount = async (profile: PdiUserProfile) => {
    if (profile.role === "super_admin" && (profile.email || "").toLowerCase().includes("boudjada")) {
      await pdiAlert("Action interdite : Le compte Super Administrateur principal ne peut pas être supprimé.");
      return;
    }

    const ok = await pdiConfirm({
      title: "Supprimer définitivement le compte",
      message: `Êtes-vous certain de vouloir supprimer le compte de ${profile.name} (${profile.email}) de Firebase ? Cette action est irréversible.`,
      confirmLabel: "Supprimer le compte",
      destructive: true
    });
    if (!ok) return;

    try {
      await deleteFirebaseProfile(profile.uid);
      setProfiles(profiles.filter(p => p.uid !== profile.uid));
      await pdiAlert("Compte supprimé de Firestore.");
    } catch (err: any) {
      await pdiAlert("Erreur lors de la suppression : " + err.message);
    }
  };

  const handleFeedbackStatus = async (feedbackId: string, status: PdiUserFeedback["status"]) => {
    try {
      await updateFeedbackStatusInFirebase(feedbackId, status);
      setFeedbacks(feedbacks.map(f => f.id === feedbackId ? { ...f, status } : f));
    } catch (err: any) {
      await pdiAlert("Erreur de mise à jour du statut du retour : " + err.message);
    }
  };

  // KPIs
  const totalUsers = profiles.length;
  const basicUsers = profiles.filter(p => p.accountType === "basic").length;
  const proUsers = profiles.filter(p => p.accountType === "pro" || p.accountType === "team" || p.accountType === "enterprise").length;
  const monthlySubs = profiles.filter(p => p.subscriptionPlan === "monthly").length;
  const yearlySubs = profiles.filter(p => p.subscriptionPlan === "yearly" || p.subscriptionPlan === "lifetime").length;
  const activeSubs = profiles.filter(p => p.status === "active").length;
  const totalConnections = connectionLogs.length;
  const totalVisits = commercialVisits.length;
  const totalUsageEvents = subscriberUsages.length;
  const totalFeedbacks = feedbacks.length;
  const avgRating = totalFeedbacks > 0 
    ? (feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / totalFeedbacks).toFixed(1)
    : "5.0";

  return (
    <div className="pdi-super-admin-wrapper" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER SUPER ADMIN */}
      <div style={{
        background: "linear-gradient(180deg, #131F30, #0B131E)",
        border: "1px solid rgba(103,232,249,0.35)",
        borderRadius: 20,
        padding: "20px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        boxShadow: "0 12px 36px rgba(0,0,0,0.35)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #0284C7, #22D3EE)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            fontWeight: 900,
            color: "white"
          }}>
            ⚡
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: "#F8FAFC", letterSpacing: "-0.02em" }}>
                Console Super Administrateur
              </h2>
              <span style={{
                background: "rgba(103,232,249,0.15)",
                color: "#67E8F9",
                border: "1px solid rgba(103,232,249,0.4)",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontFamily: "monospace",
                fontWeight: 900
              }}>
                Patch {PDI_PATCH_VERSION}
              </span>
              <span style={{
                background: "rgba(16,185,129,0.15)",
                color: "#34D399",
                border: "1px solid rgba(16,185,129,0.4)",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 900
              }}>
                Firebase Firestore Connecté
              </span>
            </div>
            <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: 13, fontWeight: 600 }}>
              Privilèges de gestion : Comptes Basic &amp; Pro, Abonnements Mensuels &amp; Annuels, Logs Connexions, Visites Site Vitrine, Usages Abonnés &amp; Retours Clients.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={refreshAllData}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#0E1B2C",
              border: "1px solid rgba(148,163,184,0.3)",
              color: "#E2E8F0",
              borderRadius: 10,
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            <span>{loading ? "Chargement..." : "🔄 Actualiser"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, #0284C7, #22D3EE)",
              border: 0,
              color: "white",
              borderRadius: 10,
              padding: "9px 16px",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(14,165,233,0.3)"
            }}
          >
            <span>+ Créer un compte abonné</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{
        display: "flex",
        gap: 8,
        borderBottom: "1px solid rgba(148,163,184,0.18)",
        paddingBottom: 4,
        overflowX: "auto"
      }}>
        {[
          { id: "overview", label: "Tableau de bord & KPIs", icon: "📊" },
          { id: "accounts", label: `Gestion des comptes (${totalUsers})`, icon: "👥" },
          { id: "geo_restrictions", label: `Restrictions Pays & Villes (${allowedCountriesCount} aut. / ${excludedCountriesCount} excl.)`, icon: "🌍" },
          { id: "payments", label: `Passerelles & Souscriptions (${paymentTransactions.length})`, icon: "💳" },
          { id: "license_keys", label: `Clés d'activation (${licenseKeys.length})`, icon: "🔐" },
          { id: "connections", label: `Analyse des connexions (${totalConnections})`, icon: "🔑" },
          { id: "commercial_visits", label: `Visites site commercial (${totalVisits})`, icon: "🌐" },
          { id: "subscriber_usage", label: `Utilisation abonnés (${totalUsageEvents})`, icon: "⚡" },
          { id: "feedbacks", label: `Retours d'expérience (${totalFeedbacks})`, icon: "💬" },
          { id: "clarity_ux", label: "Analytics UX (Clarity)", icon: "📊" },
          { id: "sanity_cms", label: `Contenus CMS (${sanityAnnouncements.length})`, icon: "📝" }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as SuperAdminTab)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 10,
              border: activeTab === tab.id ? "1px solid #67E8F9" : "1px solid transparent",
              background: activeTab === tab.id ? "linear-gradient(180deg, #162B3F, #0E1F30)" : "transparent",
              color: activeTab === tab.id ? "#67E8F9" : "#94A3B8",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {[
              { title: "Comptes Abonnés", value: totalUsers, sub: `${activeSubs} actifs`, color: "#38BDF8", icon: "👤" },
              { title: "Comptes Basic", value: basicUsers, sub: "Formule découverte", color: "#A78BFA", icon: "🌱" },
              { title: "Comptes Pros & Team", value: proUsers, sub: "Ingénierie avancée", color: "#34D399", icon: "⭐" },
              { title: "Abonnements Mensuels", value: monthlySubs, sub: "Facturation 30j", color: "#FBBF24", icon: "📅" },
              { title: "Abonnements Annuels", value: yearlySubs, sub: "Engagement annuel", color: "#F472B6", icon: "🏆" },
              { title: "Connexions Loggées", value: totalConnections, sub: "Sessions sécurisées", color: "#60A5FA", icon: "🔒" },
              { title: "Trafic Site Vitrine", value: totalVisits, sub: "Visites commerciales", color: "#2DD4BF", icon: "📈" },
              { title: "Satisfaction Moyenne", value: `${avgRating} / 5`, sub: `${totalFeedbacks} retours clients`, color: "#F59E0B", icon: "💬" }
            ].map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  background: "linear-gradient(180deg, #111A27, #0A111A)",
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{kpi.title}</span>
                  <span style={{ fontSize: 18 }}>{kpi.icon}</span>
                </div>
                <div style={{ color: kpi.color, fontSize: 26, fontWeight: 900 }}>{kpi.value}</div>
                <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* DUAL PANELS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
            {/* DERNIERES CONNEXIONS */}
            <div style={{
              background: "linear-gradient(180deg, #111A27, #0A111A)",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: 16,
              padding: 18
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "#E2E8F0" }}>Dernières Connexions Abonnés</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("connections")}
                  style={{ background: "transparent", border: 0, color: "#38BDF8", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                >
                  Voir tout →
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {connectionLogs.slice(0, 5).map(log => (
                  <div key={log.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#070E17",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.12)",
                    fontSize: 12
                  }}>
                    <div>
                      <div style={{ color: "#F1F5F9", fontWeight: 800 }}>{log.userName || log.userEmail}</div>
                      <div style={{ color: "#64748B", fontSize: 10 }}>{log.userEmail} • {log.userRole}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        background: log.status === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                        color: log.status === "success" ? "#34D399" : "#F87171"
                      }}>
                        {log.status === "success" ? "Réussi" : "Échoué"}
                      </span>
                      <div style={{ color: "#94A3B8", fontSize: 10, marginTop: 2 }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {connectionLogs.length === 0 && <span style={{ color: "#64748B", fontSize: 12 }}>Aucun journal de connexion récent.</span>}
              </div>
            </div>

            {/* DERNIERS RETOURS CLIENTS */}
            <div style={{
              background: "linear-gradient(180deg, #111A27, #0A111A)",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: 16,
              padding: 18
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "#E2E8F0" }}>Derniers Retours d'Expérience</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("feedbacks")}
                  style={{ background: "transparent", border: 0, color: "#38BDF8", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                >
                  Gérer les retours →
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feedbacks.slice(0, 4).map(fb => (
                  <div key={fb.id} style={{
                    padding: "10px 12px",
                    background: "#070E17",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.12)",
                    fontSize: 12
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ color: "#F8FAFC", fontWeight: 800 }}>{fb.title}</span>
                      <span style={{ color: "#F59E0B" }}>{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>
                    </div>
                    <p style={{ margin: 0, color: "#94A3B8", fontSize: 11, lineHeight: 1.4 }}>{fb.message}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 10, color: "#64748B" }}>
                      <span>{fb.userName || fb.userEmail}</span>
                      <span style={{
                        textTransform: "uppercase",
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: fb.status === "resolved" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                        color: fb.status === "resolved" ? "#34D399" : "#FBBF24",
                        fontWeight: 900
                      }}>
                        {fb.status}
                      </span>
                    </div>
                  </div>
                ))}
                {feedbacks.length === 0 && <span style={{ color: "#64748B", fontSize: 12 }}>Aucun retour utilisateur soumis pour le moment.</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ACCOUNTS MANAGEMENT */}
      {activeTab === "accounts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>Annuaire &amp; Privilèges Utilisateurs</h3>
              <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
                Création et gestion des comptes abonnés : Basic, Pro, Team, Enterprise avec abonnements Mensuels et Annuels.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                border: 0,
                color: "white",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              + Nouveau compte
            </button>
          </div>

          {/* TABLE OF PROFILES */}
          <div style={{
            overflowX: "auto",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0A111A"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                  <th style={{ padding: "12px 14px" }}>Utilisateur / Société</th>
                  <th style={{ padding: "12px 14px" }}>Rôle</th>
                  <th style={{ padding: "12px 14px" }}>Type de compte</th>
                  <th style={{ padding: "12px 14px" }}>Abonnement</th>
                  <th style={{ padding: "12px 14px" }}>Statut</th>
                  <th style={{ padding: "12px 14px" }}>Activité</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.uid} style={{ borderBottom: "1px solid rgba(148,163,184,0.1)", color: "#E2E8F0" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{p.name}</div>
                      <div style={{ color: "#67E8F9", fontSize: 11 }}>{p.email}</div>
                      {p.company && <div style={{ color: "#64748B", fontSize: 10 }}>{p.company}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        background: p.role === "super_admin" ? "rgba(239,68,68,0.18)" : p.role === "admin" ? "rgba(245,158,11,0.18)" : "rgba(14,165,233,0.18)",
                        color: p.role === "super_admin" ? "#FCA5A5" : p.role === "admin" ? "#FDE047" : "#7DD3FC",
                        border: "1px solid rgba(255,255,255,0.1)"
                      }}>
                        {p.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background: p.accountType === "enterprise" ? "rgba(168,85,247,0.18)" : p.accountType === "pro" ? "rgba(34,197,94,0.18)" : "rgba(100,116,139,0.18)",
                        color: p.accountType === "enterprise" ? "#D8B4FE" : p.accountType === "pro" ? "#86EFAC" : "#CBD5E1"
                      }}>
                        {p.accountType}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        background: p.subscriptionPlan === "yearly" ? "rgba(245,158,11,0.18)" : "rgba(14,165,233,0.15)",
                        color: p.subscriptionPlan === "yearly" ? "#FCD34D" : "#38BDF8"
                      }}>
                        {p.subscriptionPlan === "yearly" ? "Annuel" : p.subscriptionPlan === "monthly" ? "Mensuel" : p.subscriptionPlan === "lifetime" ? "À vie" : "Essai"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        background: p.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                        color: p.status === "active" ? "#34D399" : "#F87171"
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#94A3B8" }}>
                      <div>Connexions: <b>{p.loginCount || 0}</b></div>
                      <div>Projets: <b>{p.projectsCount || 0}</b></div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleAccountStatus(p)}
                          style={{
                            background: "#162B3F",
                            border: "1px solid rgba(148,163,184,0.25)",
                            color: p.status === "active" ? "#FCA5A5" : "#86EFAC",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: "pointer"
                          }}
                        >
                          {p.status === "active" ? "Suspendre" : "Activer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(p)}
                          style={{
                            background: "#2D1515",
                            border: "1px solid rgba(239,68,68,0.3)",
                            color: "#F87171",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: "pointer"
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: GEO & COUNTRY RESTRICTIONS */}
      {activeTab === "geo_restrictions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🌍 Restrictions Géographiques &amp; Whitelist / Blacklist Pays</span>
              </h3>
              <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: 12, maxWidth: 800, lineHeight: 1.5 }}>
                Définissez précisément les pays autorisés à créer un compte sur la plateforme PD&amp;I.
                <strong style={{ color: "#F87171", marginLeft: 4 }}>
                  Les pays exclus ne seront pas affichés dans la liste déroulante lors de l'inscription client.
                </strong>
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddCountryModal(true)}
                style={{
                  background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                  border: 0,
                  color: "white",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>+ Ajouter un pays</span>
              </button>
            </div>
          </div>

          {/* DEDICATED EXCLUDED COUNTRIES SECTION */}
          <div style={{
            background: "linear-gradient(180deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 14,
            padding: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🚫</span>
                <div>
                  <h4 style={{ margin: 0, color: "#FCA5A5", fontSize: 14, fontWeight: 900 }}>
                    Section Pays Exclus ({excludedCountriesCount} pays masqués)
                  </h4>
                  <p style={{ margin: 0, color: "#94A3B8", fontSize: 11 }}>
                    Ces pays sont actuellement bloqués et n'apparaissent pas dans le formulaire d'inscription client.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {countries.filter(c => !c.allowed).map(c => (
                <div
                  key={c.code}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#0E1520",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12
                  }}
                >
                  <span style={{ fontSize: 14 }}>{c.flag}</span>
                  <span style={{ color: "#F8FAFC", fontWeight: 800 }}>{c.name}</span>
                  <span style={{ color: "#64748B", fontSize: 10, fontFamily: "monospace" }}>({c.code})</span>
                  <button
                    type="button"
                    onClick={() => handleToggleCountry(c.code, false)}
                    style={{
                      background: "rgba(16,185,129,0.2)",
                      border: "1px solid rgba(16,185,129,0.4)",
                      color: "#34D399",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: "pointer",
                      marginLeft: 4
                    }}
                  >
                    ✓ Autoriser
                  </button>
                </div>
              ))}
              {excludedCountriesCount === 0 && (
                <span style={{ color: "#64748B", fontSize: 12 }}>
                  Aucun pays n'est actuellement exclu (tous les pays configurés sont visibles).
                </span>
              )}
            </div>
          </div>

          {/* FILTER & SEARCH BAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "all", label: `Tous les pays (${countries.length})` },
                { id: "allowed", label: `Autorisés (${allowedCountriesCount})` },
                { id: "excluded", label: `Exclus (${excludedCountriesCount})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCountryTabFilter(f.id as any)}
                  style={{
                    background: countryTabFilter === f.id ? "#1E293B" : "#0A111A",
                    border: countryTabFilter === f.id ? "1px solid #38BDF8" : "1px solid rgba(148,163,184,0.18)",
                    color: countryTabFilter === f.id ? "#38BDF8" : "#94A3B8",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ width: "min(300px, 100%)" }}>
              <input
                type="text"
                placeholder="🔍 Rechercher par nom ou code ISO..."
                value={countrySearch}
                onChange={e => setCountrySearch(e.target.value)}
                style={{
                  width: "100%",
                  height: 34,
                  background: "#070E17",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 8,
                  color: "white",
                  padding: "0 10px",
                  fontSize: 12
                }}
              />
            </div>
          </div>

          {/* TABLE OF COUNTRIES */}
          <div style={{
            overflowX: "auto",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0A111A"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                  <th style={{ padding: "12px 14px" }}>Pays / Drapeau</th>
                  <th style={{ padding: "12px 14px" }}>Code ISO</th>
                  <th style={{ padding: "12px 14px" }}>Devise</th>
                  <th style={{ padding: "12px 14px" }}>Passerelle de Paiement</th>
                  <th style={{ padding: "12px 14px" }}>Villes / Wilayas</th>
                  <th style={{ padding: "12px 14px" }}>Statut d'Accès</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCountries.map(c => (
                  <tr key={c.code} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", color: "#E2E8F0" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{c.flag}</span>
                        <div>
                          <span style={{ fontWeight: 800, color: c.allowed ? "#F8FAFC" : "#94A3B8" }}>{c.name}</span>
                          {!c.allowed && <span style={{ color: "#F87171", fontSize: 10, marginLeft: 6 }}>(Masqué de l'inscription)</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <code style={{ background: "#050911", padding: "3px 6px", borderRadius: 4, color: "#38BDF8", fontWeight: 800, fontFamily: "monospace" }}>
                        {c.code}
                      </code>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 800, color: "#F59E0B" }}>{c.currency}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {c.paymentGateway === "slickpay_baridimob" ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          background: "rgba(16,185,129,0.15)",
                          color: "#34D399",
                          border: "1px solid rgba(16,185,129,0.3)"
                        }}>
                          🇩🇿 Slick-Pay (BaridiMob)
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          background: "rgba(56,189,248,0.15)",
                          color: "#38BDF8",
                          border: "1px solid rgba(56,189,248,0.3)"
                        }}>
                          🌐 Paddle (International)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#94A3B8", fontSize: 11, maxWidth: 220 }}>
                      <span style={{ fontWeight: 800, color: "#F8FAFC" }}>{c.defaultCities.length} villes</span>
                      <span style={{ color: "#64748B", marginLeft: 4, fontSize: 10 }}>
                        ({c.defaultCities.slice(0, 2).join(", ")}{c.defaultCities.length > 2 ? "..." : ""})
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        background: c.allowed ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                        color: c.allowed ? "#34D399" : "#F87171",
                        border: c.allowed ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)"
                      }}>
                        {c.allowed ? "✓ Autorisé (Visible)" : "✕ Exclu (Masqué)"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleCountry(c.code, c.allowed)}
                        style={{
                          background: c.allowed ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                          border: c.allowed ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(16,185,129,0.35)",
                          color: c.allowed ? "#FCA5A5" : "#86EFAC",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer"
                        }}
                      >
                        {c.allowed ? "🚫 Exclure ce pays" : "✓ Autoriser ce pays"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCountries.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                      Aucun pays ne correspond à votre recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS & SUBSCRIPTIONS */}
      {activeTab === "payments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>
                💳 Passerelles de Paiement &amp; Souscriptions Abonnés
              </h3>
              <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: 12, maxWidth: 800, lineHeight: 1.5 }}>
                Architecture multi-devises intégrée : <strong>Algérie</strong> (BaridiMob via Slick-Pay en DZD) &amp; <strong>International</strong> (Paddle en EUR/USD).
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowSimulateModal(true)}
                style={{
                  background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                  border: 0,
                  color: "white",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>🧪 Simuler une transaction</span>
              </button>
            </div>
          </div>

          {/* GATEWAYS OVERVIEW CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
            {/* ALGERIA SLICK-PAY / BARIDIMOB */}
            <div style={{
              background: "linear-gradient(180deg, #101E1C, #091312)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 16,
              padding: 18,
              position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🇩🇿</span>
                  <div>
                    <h4 style={{ margin: 0, color: "#34D399", fontSize: 15, fontWeight: 900 }}>Slick-Pay (BaridiMob / Edahabia)</h4>
                    <span style={{ color: "#6EE7B7", fontSize: 11 }}>Passerelle Algérie • Devise DZD</span>
                  </div>
                </div>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 900,
                  background: "rgba(16,185,129,0.2)",
                  color: "#34D399"
                }}>
                  {gatewayConfig?.slickPayEnabled ? "EN SERVICE" : "DÉSACTIVÉ"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#CBD5E1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(16,185,129,0.15)", paddingBottom: 4 }}>
                  <span style={{ color: "#94A3B8" }}>Site Passerelle :</span>
                  <a href="https://www.slick-pay.com/" target="_blank" rel="noreferrer" style={{ color: "#38BDF8", fontWeight: 800 }}>slick-pay.com ↗</a>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(16,185,129,0.15)", paddingBottom: 4 }}>
                  <span style={{ color: "#94A3B8" }}>RIP BaridiMob Bénéficiaire :</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#67E8F9" }}>
                    {gatewayConfig?.slickPayAccountId || "00799999000123456789"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94A3B8" }}>Tarification Pro Annuelle :</span>
                  <span style={{ fontWeight: 800, color: "#34D399" }}>49 000 DZD / an</span>
                </div>
              </div>
            </div>

            {/* INTERNATIONAL PADDLE */}
            <div style={{
              background: "linear-gradient(180deg, #111C2B, #09101A)",
              border: "1px solid rgba(56,189,248,0.3)",
              borderRadius: 16,
              padding: 18,
              position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🌐</span>
                  <div>
                    <h4 style={{ margin: 0, color: "#38BDF8", fontSize: 15, fontWeight: 900 }}>Paddle Payments</h4>
                    <span style={{ color: "#7DD3FC", fontSize: 11 }}>Passerelle Internationale • Devises EUR &amp; USD</span>
                  </div>
                </div>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 900,
                  background: "rgba(56,189,248,0.2)",
                  color: "#38BDF8"
                }}>
                  {gatewayConfig?.paddleSandbox ? "SANDBOX / TEST" : "EN SERVICE"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#CBD5E1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(56,189,248,0.15)", paddingBottom: 4 }}>
                  <span style={{ color: "#94A3B8" }}>Site Passerelle :</span>
                  <a href="https://www.paddle.com/" target="_blank" rel="noreferrer" style={{ color: "#38BDF8", fontWeight: 800 }}>paddle.com ↗</a>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(56,189,248,0.15)", paddingBottom: 4 }}>
                  <span style={{ color: "#94A3B8" }}>Paddle Vendor ID :</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#67E8F9" }}>
                    {gatewayConfig?.paddleVendorId || "vendor_pdi_intl_2026"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94A3B8" }}>Tarification Pro Annuelle :</span>
                  <span style={{ fontWeight: 800, color: "#38BDF8" }}>490 € / an</span>
                </div>
              </div>
            </div>
          </div>

          {/* GATEWAY SETTINGS FORM */}
          {gatewayConfig && (
            <div style={{
              background: "linear-gradient(180deg, #111A27, #0A111A)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 14,
              padding: 18
            }}>
              <h4 style={{ margin: "0 0 12px", color: "#67E8F9", fontSize: 14, fontWeight: 900 }}>
                ⚙️ Configuration des Clés &amp; Paramètres API des Passerelles
              </h4>
              <form onSubmit={handleSaveGatewayConfig} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Slick-Pay Public API Key</label>
                  <input
                    type="text"
                    value={gatewayConfig.slickPayPublicKey || ""}
                    onChange={e => setGatewayConfig({ ...gatewayConfig, slickPayPublicKey: e.target.value })}
                    style={{ width: "100%", height: 36, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, color: "white", padding: "0 10px", fontSize: 11 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>RIP / Compte BaridiMob Bénéficiaire</label>
                  <input
                    type="text"
                    value={gatewayConfig.slickPayAccountId || ""}
                    onChange={e => setGatewayConfig({ ...gatewayConfig, slickPayAccountId: e.target.value })}
                    style={{ width: "100%", height: 36, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, color: "white", padding: "0 10px", fontSize: 11 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Paddle API Key / Client Token</label>
                  <input
                    type="text"
                    value={gatewayConfig.paddleApiKey || ""}
                    onChange={e => setGatewayConfig({ ...gatewayConfig, paddleApiKey: e.target.value })}
                    style={{ width: "100%", height: 36, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, color: "white", padding: "0 10px", fontSize: 11 }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      height: 36,
                      background: "linear-gradient(135deg, #10B981, #059669)",
                      border: 0,
                      color: "white",
                      borderRadius: 6,
                      fontWeight: 900,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    💾 Enregistrer la configuration
                  </button>
                </div>
              </form>

              {/* Webhook URLs for Slick-Pay & Paddle */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.15)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                <div style={{ background: "#070E17", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#34D399" }}>⚡ Webhook URL Slick-Pay (BaridiMob IPN)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/api/webhooks/slickpay`;
                        navigator.clipboard.writeText(url);
                        pdiAlert(`URL Webhook copiée :\n${url}`);
                      }}
                      style={{ background: "#10B981", color: "white", border: 0, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                    >
                      Copier
                    </button>
                  </div>
                  <code style={{ fontSize: 10, color: "#94A3B8", wordBreak: "break-all" }}>
                    {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/slickpay` : "/api/webhooks/slickpay"}
                  </code>
                </div>

                <div style={{ background: "#070E17", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(56,189,248,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#38BDF8" }}>🌐 Webhook URL Paddle (International IPN)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/api/webhooks/paddle`;
                        navigator.clipboard.writeText(url);
                        pdiAlert(`URL Webhook copiée :\n${url}`);
                      }}
                      style={{ background: "#0284C7", color: "white", border: 0, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                    >
                      Copier
                    </button>
                  </div>
                  <code style={{ fontSize: 10, color: "#94A3B8", wordBreak: "break-all" }}>
                    {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/paddle` : "/api/webhooks/paddle"}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* TABLE OF TRANSACTIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h4 style={{ margin: 0, color: "#F8FAFC", fontSize: 15, fontWeight: 800 }}>
              📋 Journal des Transactions de Souscription ({paymentTransactions.length})
            </h4>

            <div style={{
              overflowX: "auto",
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "#0A111A"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                    <th style={{ padding: "12px 14px" }}>ID Transaction</th>
                    <th style={{ padding: "12px 14px" }}>Abonné / Société</th>
                    <th style={{ padding: "12px 14px" }}>Pays / Ville</th>
                    <th style={{ padding: "12px 14px" }}>Formule &amp; Cycle</th>
                    <th style={{ padding: "12px 14px" }}>Montant</th>
                    <th style={{ padding: "12px 14px" }}>Passerelle</th>
                    <th style={{ padding: "12px 14px" }}>Statut</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTransactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", color: "#E2E8F0" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <code style={{ background: "#050911", padding: "3px 6px", borderRadius: 4, color: "#38BDF8", fontWeight: 800, fontFamily: "monospace", fontSize: 11 }}>
                          {tx.id}
                        </code>
                        <div style={{ color: "#64748B", fontSize: 10, marginTop: 2 }}>
                          {new Date(tx.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{tx.userName || tx.userEmail}</div>
                        <div style={{ color: "#67E8F9", fontSize: 11 }}>{tx.userEmail}</div>
                        {tx.company && <div style={{ color: "#64748B", fontSize: 10 }}>{tx.company}</div>}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#E2E8F0" }}>
                        <div style={{ fontWeight: 800 }}>{tx.country}</div>
                        <div style={{ color: "#94A3B8", fontSize: 11 }}>{tx.city}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontWeight: 800, color: "#F8FAFC" }}>{tx.plan.toUpperCase()}</span>
                        <span style={{ color: "#94A3B8", fontSize: 11, marginLeft: 6 }}>
                          ({tx.billingCycle === "yearly" ? "Annuel" : "Mensuel"})
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontWeight: 900, color: "#34D399", fontSize: 13 }}>
                          {tx.amount.toLocaleString()} {tx.currency}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 900,
                          background: tx.provider === "slickpay_baridimob" ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.15)",
                          color: tx.provider === "slickpay_baridimob" ? "#34D399" : "#38BDF8"
                        }}>
                          {tx.provider === "slickpay_baridimob" ? "🇩🇿 Slick-Pay" : "🌐 Paddle"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          background: tx.status === "completed" ? "rgba(16,185,129,0.18)" : tx.status === "failed" ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)",
                          color: tx.status === "completed" ? "#34D399" : tx.status === "failed" ? "#F87171" : "#FBBF24",
                          border: tx.status === "completed" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(245,158,11,0.3)"
                        }}>
                          {tx.status === "completed" ? "✓ Payé & Activé" : tx.status === "failed" ? "✕ Échoué" : "⏳ En attente"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("accounts");
                              pdiAlert(`Redirection vers la Gestion des Comptes.\nRecherchez l'abonné : ${tx.userEmail}`);
                            }}
                            title={`Voir le profil utilisateur ${tx.userEmail}`}
                            style={{
                              background: "#0E1B2C",
                              border: "1px solid rgba(56,189,248,0.35)",
                              color: "#38BDF8",
                              borderRadius: 6,
                              padding: "5px 9px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <span>👥 Compte</span>
                          </button>
                          {tx.status !== "completed" && (
                            <button
                              type="button"
                              onClick={() => handleApproveTransaction(tx.id)}
                              style={{
                                background: "linear-gradient(135deg, #10B981, #059669)",
                                border: 0,
                                color: "white",
                                borderRadius: 6,
                                padding: "5px 10px",
                                fontSize: 11,
                                fontWeight: 900,
                                cursor: "pointer",
                                boxShadow: "0 2px 8px rgba(16,185,129,0.3)"
                              }}
                            >
                              ✓ Valider &amp; Activer
                            </button>
                          )}
                          {tx.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleRejectTransaction(tx.id)}
                              style={{
                                background: "rgba(239,68,68,0.15)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                color: "#F87171",
                                borderRadius: 6,
                                padding: "5px 8px",
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: "pointer"
                              }}
                            >
                              Rejeter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paymentTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                        Aucune transaction de paiement pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CONNECTIONS ANALYSIS */}
      {activeTab === "connections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>Analyse des Connexions &amp; Authentifications</h3>
            <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
              Traçabilité en temps réel des accès abonnés et invités sur la plateforme PD&amp;I.
            </p>
          </div>

          <div style={{
            overflowX: "auto",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0A111A"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                  <th style={{ padding: "12px 14px" }}>Date &amp; Heure</th>
                  <th style={{ padding: "12px 14px" }}>Utilisateur</th>
                  <th style={{ padding: "12px 14px" }}>Rôle / Plan</th>
                  <th style={{ padding: "12px 14px" }}>Appareil / Navigateur</th>
                  <th style={{ padding: "12px 14px" }}>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {connectionLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", color: "#E2E8F0" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#67E8F9" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{log.userName || "Abonné"}</div>
                      <div style={{ color: "#94A3B8", fontSize: 11 }}>{log.userEmail}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ color: "#CBD5E1", fontWeight: 700 }}>{log.userRole}</span>
                      {log.accountType && <span style={{ color: "#38BDF8", marginLeft: 6 }}>({log.accountType})</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 11 }}>
                      {log.device || log.userAgent || "Navigateur Web"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        background: log.status === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                        color: log.status === "success" ? "#34D399" : "#F87171"
                      }}>
                        {log.status === "success" ? "Authentifié" : "Échoué"}
                      </span>
                    </td>
                  </tr>
                ))}
                {connectionLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                      Aucune connexion enregistrée dans Firestore pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: COMMERCIAL SITE VISITS */}
      {activeTab === "commercial_visits" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>Trafic &amp; Visites du Site Commercial</h3>
            <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
              Analyse de l'intérêt des prospects, sections consultées (Landing, Bento, Tarifs, Démos) et clics d'action.
            </p>
          </div>

          <div style={{
            overflowX: "auto",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0A111A"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                  <th style={{ padding: "12px 14px" }}>Date &amp; Heure</th>
                  <th style={{ padding: "12px 14px" }}>Page / Section</th>
                  <th style={{ padding: "12px 14px" }}>Action Prospect</th>
                  <th style={{ padding: "12px 14px" }}>Provenance</th>
                  <th style={{ padding: "12px 14px" }}>Appareil</th>
                </tr>
              </thead>
              <tbody>
                {commercialVisits.map(visit => (
                  <tr key={visit.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", color: "#E2E8F0" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#38BDF8" }}>
                      {new Date(visit.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 800, color: "#F8FAFC" }}>
                      {visit.section || visit.path || "Accueil Commercial"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        background: "rgba(103,232,249,0.15)",
                        color: "#67E8F9"
                      }}>
                        {visit.action || "Consultation page"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 11 }}>
                      {visit.referrer || "Accès Direct / Campagne"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#64748B", fontSize: 11 }}>
                      {visit.device || "Desktop"}
                    </td>
                  </tr>
                ))}
                {commercialVisits.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                      Aucune visite commerciale enregistrée dans Firestore pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: SUBSCRIBER USAGE */}
      {activeTab === "subscriber_usage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>Utilisation Réelle par les Abonnés</h3>
            <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
              Suivi des modules actifs (Dessin ISO, Vision, Croquis, CAO, Exports BOM, Google Drive) par utilisateur.
            </p>
          </div>

          <div style={{
            overflowX: "auto",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0A111A"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                  <th style={{ padding: "12px 14px" }}>Date &amp; Heure</th>
                  <th style={{ padding: "12px 14px" }}>Abonné</th>
                  <th style={{ padding: "12px 14px" }}>Module PD&amp;I</th>
                  <th style={{ padding: "12px 14px" }}>Action Réalisée</th>
                  <th style={{ padding: "12px 14px" }}>Détails de l'opération</th>
                </tr>
              </thead>
              <tbody>
                {subscriberUsages.map(usage => (
                  <tr key={usage.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", color: "#E2E8F0" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#A7F3D0" }}>
                      {new Date(usage.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{usage.userEmail}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        background: "rgba(14,165,233,0.15)",
                        color: "#38BDF8"
                      }}>
                        {usage.module}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#F1F5F9", fontWeight: 700 }}>
                      {usage.action}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 11 }}>
                      {usage.details || "Opération standard"}
                    </td>
                  </tr>
                ))}
                {subscriberUsages.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                      Aucun historique d'utilisation d'abonné enregistré pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: USER FEEDBACKS */}
      {activeTab === "feedbacks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>Volet Retours d'Expérience &amp; Avis Clients</h3>
            <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
              Avis, suggestions fonctionnelles et rapports d'anomalies envoyés par les abonnés.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {feedbacks.map(fb => (
              <div
                key={fb.id}
                style={{
                  background: "linear-gradient(180deg, #111C2B, #0B121C)",
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, color: "#F8FAFC", fontSize: 14 }}>{fb.title}</h4>
                    <span style={{ color: "#67E8F9", fontSize: 11 }}>{fb.userEmail}</span>
                  </div>
                  <div style={{ color: "#F59E0B", fontSize: 14 }}>
                    {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    background: "rgba(103,232,249,0.15)",
                    color: "#67E8F9",
                    textTransform: "uppercase"
                  }}>
                    {fb.category}
                  </span>
                  <span style={{ color: "#64748B", fontSize: 10 }}>
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p style={{ margin: 0, color: "#CBD5E1", fontSize: 12, lineHeight: 1.5, background: "#060A10", padding: 10, borderRadius: 8 }}>
                  {fb.message}
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid rgba(148,163,184,0.1)" }}>
                  <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 700 }}>Statut :</span>
                  <select
                    value={fb.status}
                    onChange={(e) => handleFeedbackStatus(fb.id, e.target.value as any)}
                    style={{
                      background: "#0E1B2C",
                      color: "#E2E8F0",
                      border: "1px solid rgba(103,232,249,0.3)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 800
                    }}
                  >
                    <option value="new">Nouveau</option>
                    <option value="reviewed">Consulté</option>
                    <option value="in_progress">En cours</option>
                    <option value="resolved">Résolu / Intégré</option>
                  </select>
                </div>
              </div>
            ))}

            {feedbacks.length === 0 && (
              <div style={{ padding: 24, color: "#64748B", textAlign: "center", gridColumn: "1 / -1" }}>
                Aucun retour d'expérience reçu pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: LICENSE KEYS GENERATION & MANAGEMENT */}
      {activeTab === "license_keys" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18 }}>Générateur de Clés de Licence &amp; Verrouillage d'Accès</h3>
            <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
              Seules les personnes disposant d'un compte actif avec mot de passe ou d'une clé de licence valide peuvent accéder à PD&amp;I.
            </p>
          </div>

          {/* GENERATE NEW KEY FORM */}
          <div style={{
            background: "linear-gradient(180deg, #111C2B, #0B121C)",
            border: "1px solid rgba(103,232,249,0.3)",
            borderRadius: 16,
            padding: 20
          }}>
            <h4 style={{ margin: "0 0 12px", color: "#67E8F9", fontSize: 14, fontWeight: 900 }}>
              ⚡ Émettre une nouvelle clé d'activation PD&amp;I
            </h4>
            <form onSubmit={handleGenerateLicenseKey} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Formule logicielle</label>
                <select
                  value={licenseKeyDraft.plan}
                  onChange={e => setLicenseKeyDraft({ ...licenseKeyDraft, plan: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                >
                  <option value="basic">Basic (ISO 2D)</option>
                  <option value="pro">Pro (Vision + CAO)</option>
                  <option value="team">Team (Équipe)</option>
                  <option value="enterprise">Enterprise (Sur-mesure)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Durée de validité</label>
                <select
                  value={licenseKeyDraft.type}
                  onChange={e => setLicenseKeyDraft({ ...licenseKeyDraft, type: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                >
                  <option value="PRO_YEAR">Annuelle (365 jours)</option>
                  <option value="PRO_MONTH">Mensuelle (30 jours)</option>
                  <option value="TRIAL_30">Essai 30 jours</option>
                  <option value="TRIAL_7">Essai 7 jours</option>
                  <option value="LIFETIME">À vie (Permanent)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Assigner à un email (Optionnel)</label>
                <input
                  type="email"
                  placeholder="client@entreprise.com"
                  value={licenseKeyDraft.assignedTo}
                  onChange={e => setLicenseKeyDraft({ ...licenseKeyDraft, assignedTo: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    height: 38,
                    background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                    border: 0,
                    borderRadius: 8,
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(14,165,233,0.35)"
                  }}
                >
                  + Générer la clé sécurisée
                </button>
              </div>
            </form>
          </div>

          {/* TABLE OF KEYS */}
          <div style={{
            overflowX: "auto",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0A111A"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#111C2B", color: "#94A3B8", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                  <th style={{ padding: "12px 14px" }}>Code de Licence</th>
                  <th style={{ padding: "12px 14px" }}>Formule</th>
                  <th style={{ padding: "12px 14px" }}>Assignée à</th>
                  <th style={{ padding: "12px 14px" }}>Statut</th>
                  <th style={{ padding: "12px 14px" }}>Activée par</th>
                  <th style={{ padding: "12px 14px" }}>Expiration</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {licenseKeys.map(k => (
                  <tr key={k.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", color: "#E2E8F0" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <code style={{ background: "#050911", padding: "4px 8px", borderRadius: 6, color: "#38BDF8", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.03em" }}>
                        {k.code}
                      </code>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 800, color: "#F8FAFC" }}>{k.plan?.toUpperCase()}</span>
                      <span style={{ color: "#94A3B8", fontSize: 11, marginLeft: 6 }}>({k.type})</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94A3B8" }}>
                      {k.assignedTo || "— Libre d'activation —"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        background: k.status === "active" ? "rgba(16,185,129,0.15)" : k.status === "revoked" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        color: k.status === "active" ? "#34D399" : k.status === "revoked" ? "#F87171" : "#FBBF24"
                      }}>
                        {k.status === "generated" ? "Générée (En attente)" : k.status === "active" ? "Activée" : "Révoquée"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#67E8F9", fontSize: 11 }}>
                      {k.activatedBy || "—"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 11 }}>
                      {new Date(k.expiresAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(k.code);
                            pdiAlert(`Clé copiée dans le presse-papier :\n${k.code}`);
                          }}
                          style={{ background: "#0E1B2C", color: "#67E8F9", border: "1px solid rgba(103,232,249,0.3)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                        >
                          📋 Copier
                        </button>
                        {k.status !== "revoked" && (
                          <button
                            type="button"
                            onClick={() => handleRevokeLicense(k.id)}
                            style={{ background: "rgba(239,68,68,0.15)", color: "#F87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                          >
                            Révoquer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {licenseKeys.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                      Aucune clé de licence générée pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CREATION COMPTE */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "grid",
          placeItems: "center",
          zIndex: 10050,
          padding: 16
        }}>
          <div style={{
            width: "min(560px, 95vw)",
            background: "linear-gradient(180deg, #131F30, #0B131E)",
            border: "1px solid rgba(103,232,249,0.4)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
            color: "#F8FAFC"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#67E8F9" }}>Créer un Compte Abonné (Privilège Super Admin)</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: 0, color: "#94A3B8", fontSize: 20, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Nom complet</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Rachid Bensalem"
                  value={newAccountDraft.name}
                  onChange={e => setNewAccountDraft({ ...newAccountDraft, name: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Email de connexion</label>
                <input
                  type="email"
                  required
                  placeholder="ex: rachid.b@engineering.dz"
                  value={newAccountDraft.email}
                  onChange={e => setNewAccountDraft({ ...newAccountDraft, email: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Mot de passe initial (Optionnel)</label>
                <input
                  type="password"
                  placeholder="Définir un mot de passe initial sécurisé"
                  value={newAccountDraft.password || ""}
                  onChange={e => setNewAccountDraft({ ...newAccountDraft, password: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Entreprise / Organisation</label>
                <input
                  type="text"
                  placeholder="ex: Sonatrach / Bureau d'Études"
                  value={newAccountDraft.company}
                  onChange={e => setNewAccountDraft({ ...newAccountDraft, company: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Formule / Type de compte</label>
                  <select
                    value={newAccountDraft.accountType}
                    onChange={e => setNewAccountDraft({ ...newAccountDraft, accountType: e.target.value as any })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="basic">Basic (Découverte)</option>
                    <option value="pro">Pro (Ingénierie ISO)</option>
                    <option value="team">Team (Équipe)</option>
                    <option value="enterprise">Enterprise (Illimité)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Périodicité d'abonnement</label>
                  <select
                    value={newAccountDraft.subscriptionPlan}
                    onChange={e => setNewAccountDraft({ ...newAccountDraft, subscriptionPlan: e.target.value as any })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="monthly">Mensuel (Facturation 30j)</option>
                    <option value="yearly">Annuel (Facturation 365j)</option>
                    <option value="trial">Essai temporaire</option>
                    <option value="lifetime">Accès permanent (À vie)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Rôle applicatif</label>
                  <select
                    value={newAccountDraft.role}
                    onChange={e => setNewAccountDraft({ ...newAccountDraft, role: e.target.value as any })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="client">Client / Abonné standard</option>
                    <option value="admin">Administrateur</option>
                    <option value="super_admin">Super Administrateur</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>État initial</label>
                  <select
                    value={newAccountDraft.status}
                    onChange={e => setNewAccountDraft({ ...newAccountDraft, status: e.target.value as any })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="active">Actif immédiat</option>
                    <option value="pending_activation">En attente d'activation</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: "#1E293B", color: "#CBD5E1", border: 0, borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ background: "linear-gradient(135deg, #0284C7, #22D3EE)", color: "white", border: 0, borderRadius: 8, padding: "9px 18px", fontWeight: 900, cursor: "pointer" }}
                >
                  Enregistrer dans Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJOUT PAYS PERSONNALISE */}
      {showAddCountryModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "grid",
          placeItems: "center",
          zIndex: 10050,
          padding: 16
        }}>
          <div style={{
            width: "min(520px, 95vw)",
            background: "linear-gradient(180deg, #131F30, #0B131E)",
            border: "1px solid rgba(103,232,249,0.4)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
            color: "#F8FAFC"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#67E8F9" }}>Ajouter un Pays &amp; Villes à la Whitelist</h3>
              <button
                type="button"
                onClick={() => setShowAddCountryModal(false)}
                style={{ background: "transparent", border: 0, color: "#94A3B8", fontSize: 20, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddNewCountry} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Code ISO (2 lettres)</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="ex: CH"
                    value={newCountryDraft.code}
                    onChange={e => setNewCountryDraft({ ...newCountryDraft, code: e.target.value.toUpperCase() })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px", textTransform: "uppercase", fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Nom du pays</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Suisse"
                    value={newCountryDraft.name}
                    onChange={e => setNewCountryDraft({ ...newCountryDraft, name: e.target.value })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Drapeau Emoji</label>
                  <input
                    type="text"
                    placeholder="🇨🇭"
                    value={newCountryDraft.flag}
                    onChange={e => setNewCountryDraft({ ...newCountryDraft, flag: e.target.value })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px", fontSize: 16 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Devise par défaut</label>
                  <select
                    value={newCountryDraft.currency}
                    onChange={e => setNewCountryDraft({ ...newCountryDraft, currency: e.target.value })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="DZD">DZD (DA)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Passerelle</label>
                  <select
                    value={newCountryDraft.paymentGateway}
                    onChange={e => setNewCountryDraft({ ...newCountryDraft, paymentGateway: e.target.value as any })}
                    style={{ width: "100%", height: 38, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="paddle">Paddle (Intl)</option>
                    <option value="slickpay_baridimob">Slick-Pay (DZ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>
                  Villes / Régions principales (séparées par des virgules)
                </label>
                <textarea
                  rows={3}
                  placeholder="Genève, Zurich, Lausanne, Bâle, Berne"
                  value={newCountryDraft.defaultCities}
                  onChange={e => setNewCountryDraft({ ...newCountryDraft, defaultCities: e.target.value })}
                  style={{ width: "100%", borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "8px 10px", fontSize: 12, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddCountryModal(false)}
                  style={{ background: "#1E293B", color: "#CBD5E1", border: 0, borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{ background: "linear-gradient(135deg, #0284C7, #22D3EE)", color: "white", border: 0, borderRadius: 8, padding: "9px 18px", fontWeight: 900, cursor: "pointer" }}
                >
                  Ajouter à la Whitelist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SIMULATEUR DE TRANSACTION */}
      {showSimulateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          display: "grid",
          placeItems: "center",
          zIndex: 10050,
          padding: 16
        }}>
          <div style={{
            width: "min(600px, 95vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            background: "linear-gradient(180deg, #131F30, #0B131E)",
            border: "1px solid rgba(103,232,249,0.4)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
            color: "#F8FAFC"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#67E8F9" }}>🧪 Simulateur de Paiement &amp; Souscription</h3>
                <p style={{ margin: 0, color: "#94A3B8", fontSize: 11 }}>
                  Testez le mécanisme de souscription automatique BaridiMob / Slick-Pay (Algérie) et Paddle (International).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSimulateModal(false);
                  setSimulatedTx(null);
                }}
                style={{ background: "transparent", border: 0, color: "#94A3B8", fontSize: 20, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRunPaymentSimulation} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Nom complet de l'abonné</label>
                  <input
                    type="text"
                    required
                    value={simDraft.name}
                    onChange={e => setSimDraft({ ...simDraft, name: e.target.value })}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Email abonné</label>
                  <input
                    type="email"
                    required
                    value={simDraft.email}
                    onChange={e => setSimDraft({ ...simDraft, email: e.target.value })}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Pays d'accès</label>
                  <select
                    value={simDraft.countryCode}
                    onChange={e => {
                      const cCode = e.target.value;
                      const cObj = countries.find(c => c.code === cCode);
                      const defaultCity = cObj && cObj.defaultCities.length > 0 ? cObj.defaultCities[0] : "";
                      setSimDraft({ ...simDraft, countryCode: cCode, city: defaultCity });
                    }}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    {countries.filter(c => c.allowed).map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Ville / Wilaya</label>
                  <select
                    value={simDraft.city}
                    onChange={e => setSimDraft({ ...simDraft, city: e.target.value })}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    {(countries.find(c => c.code === simDraft.countryCode)?.defaultCities || ["Capitale"]).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Formule logicielle</label>
                  <select
                    value={simDraft.plan}
                    onChange={e => setSimDraft({ ...simDraft, plan: e.target.value as any })}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="basic">Basic (Découverte)</option>
                    <option value="pro">Pro (Ingénierie ISO)</option>
                    <option value="team">Team (Équipe Bureau)</option>
                    <option value="enterprise">Enterprise (Illimité)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>Périodicité</label>
                  <select
                    value={simDraft.billingCycle}
                    onChange={e => setSimDraft({ ...simDraft, billingCycle: e.target.value as any })}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "#070E17", border: "1px solid rgba(148,163,184,0.3)", color: "white", padding: "0 10px" }}
                  >
                    <option value="monthly">Mensuel (30 jours)</option>
                    <option value="yearly">Annuel (365 jours)</option>
                  </select>
                </div>
              </div>

              {/* LIVE PRICING & GATEWAY PREVIEW */}
              {(() => {
                const conf = getPaymentConfigForCountry(simDraft.countryCode);
                const pricing = conf.pricingTable[simDraft.plan];
                const amount = simDraft.billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;
                return (
                  <div style={{
                    background: conf.provider === "slickpay_baridimob" ? "rgba(16,185,129,0.12)" : "rgba(56,189,248,0.12)",
                    border: `1px solid ${conf.provider === "slickpay_baridimob" ? "rgba(16,185,129,0.3)" : "rgba(56,189,248,0.3)"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>Passerelle automatique déterminée :</div>
                      <div style={{ fontWeight: 900, color: conf.provider === "slickpay_baridimob" ? "#34D399" : "#38BDF8", fontSize: 13 }}>
                        {conf.provider === "slickpay_baridimob" ? "🇩🇿 BaridiMob / Slick-Pay (Algérie)" : "🌐 Paddle Payments (International)"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>Montant calculé :</div>
                      <div style={{ fontWeight: 900, color: "#F8FAFC", fontSize: 16 }}>
                        {amount.toLocaleString()} {conf.currency}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  style={{ background: "#1E293B", color: "#CBD5E1", border: 0, borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  style={{ background: "linear-gradient(135deg, #0284C7, #22D3EE)", color: "white", border: 0, borderRadius: 8, padding: "9px 18px", fontWeight: 900, cursor: "pointer" }}
                >
                  ⚡ Émettre la transaction de test
                </button>
              </div>
            </form>

            {/* IF SIMULATED TRANSACTION GENERATED */}
            {simulatedTx && (
              <div style={{
                marginTop: 18,
                background: "#080F18",
                border: "1px solid rgba(56,189,248,0.4)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#34D399", fontWeight: 900, fontSize: 13 }}>
                    ✓ Transaction simulée enregistrée avec succès !
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApproveTransaction(simulatedTx.id)}
                    style={{
                      background: "linear-gradient(135deg, #10B981, #059669)",
                      border: 0,
                      color: "white",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontWeight: 900,
                      fontSize: 11,
                      cursor: "pointer"
                    }}
                  >
                    Valider &amp; Activer l'abonné maintenant →
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>
                  ID : <b style={{ color: "#38BDF8" }}>{simulatedTx.id}</b> • {simulatedTx.amount} {simulatedTx.currency} ({simulatedTx.provider})
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* TAB: CLARITY UX ANALYTICS */}
      {activeTab === "clarity_ux" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📊 Microsoft Clarity UX &amp; Session Replays</span>
                <span style={{ fontSize: 11, background: "#059669", color: "#ECFDF5", padding: "2px 8px", borderRadius: 6, fontWeight: 800 }}>
                  100% Gratuit / Illimité
                </span>
              </h3>
              <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: 12 }}>
                Suivi comportemental UX, cartes de chaleur (heatmaps), rage clicks et replays de sessions sans aucun coût d'API.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsEditingClarity(!isEditingClarity)}
                style={{
                  background: "#1E293B",
                  border: "1px solid #334155",
                  color: "#E2E8F0",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                ⚙️ {isEditingClarity ? "Masquer configuration" : "Configurer ID / iFrame"}
              </button>
              <a
                href="https://clarity.microsoft.com"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none"
                }}
              >
                Ouvrir Clarity Console ↗
              </a>
            </div>
          </div>

          {/* CONFIGURATION PANEL */}
          {isEditingClarity && (
            <div style={{
              background: "#0F172A",
              border: "1px solid #38BDF8",
              borderRadius: 14,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              <h4 style={{ margin: 0, color: "#38BDF8", fontSize: 14, fontWeight: 800 }}>
                Configuration Microsoft Clarity (Dashboard Embed)
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 4 }}>
                    Project ID Clarity
                  </label>
                  <input
                    type="text"
                    value={clarityId}
                    onChange={(e) => {
                      setClarityId(e.target.value);
                      localStorage.setItem("pdi_clarity_id", e.target.value);
                      if (e.target.value) {
                        initClarity(e.target.value);
                      }
                    }}
                    placeholder="ex: u9abcd1234"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#020617",
                      border: "1px solid #334155",
                      color: "white",
                      fontFamily: "monospace",
                      fontSize: 12
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 4 }}>
                    URL Partage iFrame Dashboard (Settings &gt; Sharing)
                  </label>
                  <input
                    type="text"
                    value={clarityEmbedUrl}
                    onChange={(e) => {
                      setClarityEmbedUrl(e.target.value);
                      localStorage.setItem("pdi_clarity_embed", e.target.value);
                    }}
                    placeholder="https://clarity.microsoft.com/embed/..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#020617",
                      border: "1px solid #334155",
                      color: "white",
                      fontFamily: "monospace",
                      fontSize: 12
                    }}
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>
                💡 <i>Pour obtenir le lien iFrame : Connectez-vous sur clarity.microsoft.com &gt; Settings &gt; Sharing &gt; Activez "Dashboard Sharing" et copiez le lien généré.</i>
              </p>
            </div>
          )}

          {/* IFRAME EMBED VIEW */}
          {clarityEmbedUrl ? (
            <div style={{
              background: "#0B1120",
              border: "1px solid rgba(148,163,184,0.15)",
              borderRadius: 16,
              overflow: "hidden",
              height: "75vh",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
              <iframe
                src={clarityEmbedUrl}
                title="Microsoft Clarity Dashboard"
                width="100%"
                height="100%"
                style={{ border: "none" }}
                allow="fullscreen"
              />
            </div>
          ) : (
            <div style={{
              background: "linear-gradient(180deg, #111C2B, #0B121C)",
              border: "1px dashed rgba(56,189,248,0.3)",
              borderRadius: 16,
              padding: 40,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16
            }}>
              <span style={{ fontSize: 42 }}>📊</span>
              <div style={{ maxWidth: 520 }}>
                <h4 style={{ margin: "0 0 6px", color: "#F8FAFC", fontSize: 16, fontWeight: 800 }}>
                  Intégration Microsoft Clarity prête à être connectée
                </h4>
                <p style={{ margin: 0, color: "#94A3B8", fontSize: 13, lineHeight: 1.6 }}>
                  Renseignez votre <b>Project ID Clarity</b> ou l'URL de partage d'iFrame pour intégrer en temps réel vos heatmaps, enregistrements de clics et métriques UX au sein de ce panneau.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingClarity(true)}
                style={{
                  background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                  color: "white",
                  border: 0,
                  padding: "10px 20px",
                  borderRadius: 10,
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                ⚙️ Renseigner le lien Clarity
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: SANITY CMS CONTENT */}
      {activeTab === "sanity_cms" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📝 Gestionnaire de Contenus &amp; Annonces CMS (Sanity)</span>
                <span style={{
                  fontSize: 11,
                  background: isSanityConfigured ? "#059669" : "#D97706",
                  color: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 800
                }}>
                  {isSanityConfigured ? "Connecté Sanity Studio" : "Mode Démo Locale"}
                </span>
              </h3>
              <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: 12 }}>
                Visualisation en lecture seule des annonces, nouveautés et communications SaaS gérées via Sanity CMS (Offre Developer 0€).
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setSanityLoading(true);
                  getSanityAnnouncements().then((res) => {
                    setSanityAnnouncements(res.announcements);
                    setIsSanityConfigured(res.isConfigured);
                  }).finally(() => setSanityLoading(false));
                }}
                style={{
                  background: "#1E293B",
                  border: "1px solid #334155",
                  color: "#E2E8F0",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                🔄 Actualiser
              </button>
              <a
                href="https://www.sanity.io/manage"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #F97316, #FB923C)",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none"
                }}
              >
                Ouvrir Sanity Studio ↗
              </a>
            </div>
          </div>

          {/* PROJECT INFO CARD */}
          <div style={{
            background: "#0F172A",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: 14,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12
          }}>
            <div>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Project ID Sanity :</span>
              <div style={{ fontWeight: 800, color: SANITY_PROJECT_ID ? "#38BDF8" : "#94A3B8", fontFamily: "monospace", fontSize: 12 }}>
                {SANITY_PROJECT_ID || "(Non configuré - Démo active)"}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Dataset :</span>
              <div style={{ fontWeight: 800, color: "#F8FAFC", fontFamily: "monospace", fontSize: 12 }}>
                {SANITY_DATASET}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Nombre d'annonces :</span>
              <div style={{ fontWeight: 800, color: "#34D399", fontSize: 14 }}>
                {sanityAnnouncements.length} enregistrements
              </div>
            </div>
          </div>

          {/* ANNOUNCEMENTS TABLE / CARDS */}
          {sanityLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
              Chargement des contenus Sanity...
            </div>
          ) : (
            <div style={{
              background: "#080F18",
              border: "1px solid rgba(148,163,184,0.15)",
              borderRadius: 14,
              overflow: "hidden"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#0F172A", borderBottom: "1px solid #1E293B" }}>
                    <th style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 11, textTransform: "uppercase" }}>Titre de l'annonce</th>
                    <th style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 11, textTransform: "uppercase" }}>Catégorie</th>
                    <th style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 11, textTransform: "uppercase" }}>Auteur / Source</th>
                    <th style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 11, textTransform: "uppercase" }}>Date Publication</th>
                  </tr>
                </thead>
                <tbody>
                  {sanityAnnouncements.map((item) => (
                    <tr key={item._id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 13 }}>{item.title}</div>
                        {item.content && (
                          <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4, maxWidth: 600 }}>{item.content}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          background: item.tag === "feature" ? "rgba(56,189,248,0.15)" : item.tag === "maintenance" ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.15)",
                          color: item.tag === "feature" ? "#38BDF8" : item.tag === "maintenance" ? "#EF4444" : "#94A3B8",
                          border: `1px solid ${item.tag === "feature" ? "#0284C7" : item.tag === "maintenance" ? "#DC2626" : "#475569"}`
                        }}>
                          {item.tag || "Général"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#CBD5E1", fontSize: 12 }}>
                        {item.author || "PD&I Admin"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#94A3B8", fontSize: 12, fontFamily: "monospace" }}>
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                      </td>
                    </tr>
                  ))}
                  {sanityAnnouncements.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#64748B" }}>
                        Aucune annonce publiée dans le CMS Sanity pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
