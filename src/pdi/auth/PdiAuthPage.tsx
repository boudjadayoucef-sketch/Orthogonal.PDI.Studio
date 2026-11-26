import React, { useState, useEffect, useMemo, useRef } from "react";
import PdiBrandMark from "../app/PdiBrandMark";
import { PdiLoginLoadingOverlay } from "./PdiLoginLoadingOverlay";
import type { PdiUserProfile } from "../../types/pdiAuthTypes";
import { PdiCountryConfig, PDI_DEFAULT_COUNTRIES } from "../data/pdiGeoData";
import PdiInfoModals, { ModalType } from "../modals/PdiInfoModals";
import { isSupabaseBrowserConfigured } from "../../lib/supabase";
import {
  loginWithSupabaseEmailPassword,
  sendSupabasePasswordResetEmail,
  completeSupabasePasswordRecovery,
  validateSupabaseRecoveryPassword,
  sanitizeSupabaseAuthErrorText,
  PdiSupabaseAuthError,
  type SupabaseClientAuthUser,
  type SupabaseVerifiedLoginResult,
  type SupabasePasswordRecoveryResult,
} from "../../lib/supabaseAuth";
import { isStagingSandboxMode } from "../../lib/stagingSandbox";

export const SUPABASE_UNCONFIGURED_LOGIN_ERROR =
  "Authentification Supabase indisponible : la configuration Supabase navigateur (VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY) est absente ou désactivée. Connexion bloquée (aucune bascule Firebase n'est autorisée).";

export const SUPABASE_UNCONFIGURED_RESET_ERROR =
  "Réinitialisation du mot de passe indisponible : la configuration Supabase navigateur est absente ou désactivée. Aucune bascule Firebase n'est autorisée.";

export const SUPABASE_GOOGLE_OAUTH_DISABLED_NOTICE =
  "Connexion Google (OAuth Supabase) non activée sur cet environnement. Utilisez la connexion email / mot de passe Supabase.";

export function isCoherentAuthorizedLoginResult(
  res: { profile: PdiUserProfile; isSuperAdmin: boolean } | null | undefined,
  currentAuthUser: { uid: string; emailVerified?: boolean; email?: string | null } | null | undefined
): boolean {
  if (!res || !res.profile || !res.profile.uid) return false;
  if (res.profile.status !== "active") return false;
  if (!currentAuthUser || currentAuthUser.uid !== res.profile.uid) return false;
  if (res.isSuperAdmin === true && currentAuthUser.emailVerified !== true) return false;
  return true;
}

/**
 * Flux de connexion exclusif Supabase Auth (MIG-04-AUTH-01-FIX-02).
 * Bloque explicitement si Supabase n'est pas configuré et n'effectue jamais de bascule Firebase.
 */
export async function executeSupabaseExclusiveLogin(
  email: string,
  password: string,
  options: {
    supabaseAvailable: boolean;
    loginFn?: (email: string, password: string) => Promise<SupabaseVerifiedLoginResult>;
  }
): Promise<SupabaseVerifiedLoginResult> {
  if (!options.supabaseAvailable) {
    throw new PdiSupabaseAuthError(
      SUPABASE_UNCONFIGURED_LOGIN_ERROR,
      "client/supabase-unconfigured",
      503
    );
  }
  const loginImpl = options.loginFn ?? loginWithSupabaseEmailPassword;
  const sbRes = await loginImpl(email, password);
  if (!isCoherentAuthorizedLoginResult(sbRes, sbRes.authUser)) {
    throw new PdiSupabaseAuthError(
      "Incohérence de session Supabase détectée : le profil actif ou l'identité vérifiée par le serveur n'est pas valide.",
      "auth/invalid-claims",
      403,
      "invalid_claims"
    );
  }
  return sbRes;
}

/**
 * Flux de récupération de mot de passe exclusif Supabase Auth (MIG-04-AUTH-01-FIX-02).
 * Bloque explicitement si Supabase n'est pas configuré et n'effectue jamais de bascule Firebase.
 */
export async function executeSupabaseExclusivePasswordReset(
  email: string,
  options: {
    supabaseAvailable: boolean;
    resetFn?: (email: string) => Promise<void>;
  }
): Promise<void> {
  if (!options.supabaseAvailable) {
    throw new PdiSupabaseAuthError(
      SUPABASE_UNCONFIGURED_RESET_ERROR,
      "client/supabase-unconfigured",
      503
    );
  }
  const cleaned = (email ?? "").trim();
  if (!cleaned) {
    throw new PdiSupabaseAuthError(
      "Veuillez saisir votre adresse email.",
      "auth/missing-credentials",
      400
    );
  }
  const resetImpl = options.resetFn ?? sendSupabasePasswordResetEmail;
  await resetImpl(cleaned);
}

/**
 * Flux de finalisation de récupération de mot de passe exclusif Supabase Auth (MIG-04-AUTH-02).
 * Valide la correspondance et la conformité des mots de passe, vérifie la configuration Supabase,
 * met à jour le mot de passe sans ancien mot de passe et sans jamais basculer sur Firebase.
 */
export async function executeSupabaseExclusivePasswordRecoveryUpdate(
  newPassword: string,
  confirmPassword: string,
  options: {
    supabaseAvailable: boolean;
    completeRecoveryFn?: (
      newPassword: string,
      confirmPassword: string
    ) => Promise<SupabasePasswordRecoveryResult>;
  }
): Promise<SupabasePasswordRecoveryResult> {
  if (!options.supabaseAvailable) {
    throw new PdiSupabaseAuthError(
      SUPABASE_UNCONFIGURED_RESET_ERROR,
      "client/supabase-unconfigured",
      503
    );
  }

  const validation = validateSupabaseRecoveryPassword(newPassword, confirmPassword);
  if ("code" in validation) {
    throw new PdiSupabaseAuthError(validation.message, validation.code, 400);
  }

  const completeImpl = options.completeRecoveryFn ?? completeSupabasePasswordRecovery;
  return await completeImpl(newPassword, confirmPassword);
}

export const LOGIN_EMAIL_PLACEHOLDER = "Adresse e-mail" as const;

export const PDI_OFFERS = [
  {
    id: "trial",
    name: "Essai Gratuit 30 Jours (Trial Pro)",
    badge: "🎁 30 Jours Offerts",
    priceDZ: "0 DZD",
    priceIntl: "0 €",
    subtext: "0 DZD / 0 € débité aujourd'hui",
    popular: true,
    desc: "Testez l'intégralité du moteur de tuyauterie et vision IA sans engagement.",
    features: [
      "Accès complet aux modules Pro pendant 30 jours",
      "Éditeur isométrique 2D/3D & spools illimités",
      "Vision IA Sketch-to-ISO (50 esquisses)",
      "Nomenclature BOM & repérage soudures W00x",
      "Export DXF / DWG / PDF haute définition",
      "Empreinte bancaire obligatoire (0 prélèvement immédiat)"
    ]
  },
  {
    id: "basic",
    name: "Basic (Indépendant)",
    badge: "Découverte",
    priceDZ: "2 500 DZD",
    priceIntl: "25 €",
    subtext: "Facturation mensuelle",
    popular: false,
    desc: "Idéal pour les projeteurs indépendants et petits chantiers.",
    features: [
      "1 projet actif simultané",
      "Éditeur isométrique 2D/3D standard",
      "Catalogue standard brides ASME/DIN (1/2\" à 24\")",
      "Export PDF & PNG vectoriel",
      "Métré linéaire et liste de matériel de base"
    ]
  },
  {
    id: "pro",
    name: "Pro (Ingénieur Piping)",
    badge: "Ingénierie Avancée",
    priceDZ: "4 900 DZD",
    priceIntl: "49 €",
    subtext: "Facturation mensuelle",
    popular: false,
    desc: "La référence pour les ingénieurs d'études et experts en tuyauterie.",
    features: [
      "Projets et lignes de tuyauteries illimités",
      "Vision IA Sketch-to-ISO illimitée",
      "Génération automatique des soudures W00x (Shop/Field)",
      "BOM complet (Tubes, Raccords, Vannes, Goujons)",
      "Calcul d'épaisseur sous pression ASME B31.3",
      "Export DXF, DWG, PDF haute résolution"
    ]
  },
  {
    id: "team",
    name: "Team (Bureau d'Études)",
    badge: "Collaboration 5 Postes",
    priceDZ: "12 500 DZD",
    priceIntl: "125 €",
    subtext: "Facturation mensuelle",
    popular: false,
    desc: "Pour les équipes de 2 à 5 projeteurs et ingénieurs calculs.",
    features: [
      "5 postes ingénieurs inclus",
      "Bibliothèques de composants sur-mesure partagées",
      "Gestion centralisée des rôles et des clés de licence",
      "Revue de projet collaborative en temps réel",
      "Support technique prioritaire par email & visio"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise (Industrie & EPC)",
    badge: "Grands Comptes",
    priceDZ: "35 000 DZD",
    priceIntl: "350 €",
    subtext: "Facturation mensuelle / annuelle",
    popular: false,
    desc: "Sur-mesure pour les majors de l'énergie, raffineries et EPC.",
    features: [
      "Postes et utilisateurs illimités",
      "Intégration API personnalisée & Interfaçage ERP",
      "Module avancé pipe-racks & charpente métallique",
      "Déploiement Cloud dédié ou On-Premise",
      "SLA garanti 99.9% et support dédié 24/7"
    ]
  }
];

export type PdiAuthSuccessMeta = {
  provider: "supabase";
  emailVerified: boolean;
  authUser: SupabaseClientAuthUser;
};

export type PdiAuthPageProps = {
  onSuccess: (profile: PdiUserProfile, isSuperAdmin: boolean, meta?: PdiAuthSuccessMeta) => void;
  onBackToLanding: () => void;
  initialTab?: "login" | "register" | "activation";
  /** Optionnel (tests) : remplace la détection de configuration Supabase navigateur */
  supabaseConfiguredOverride?: boolean;
  /** Optionnel (tests) : injecte le service de connexion Supabase */
  loginWithSupabaseFn?: (email: string, password: string) => Promise<SupabaseVerifiedLoginResult>;
  /** Optionnel (tests) : injecte le service de réinitialisation mot de passe Supabase */
  resetPasswordWithSupabaseFn?: (email: string) => Promise<void>;
  /** MIG-04-AUTH-02 : active l'écran dédié de définition du nouveau mot de passe (session recovery validée uniquement) */
  passwordRecoveryMode?: boolean;
  /** MIG-04-AUTH-02 : adresse e-mail informative associée à la session de récupération vérifiée */
  passwordRecoveryEmail?: string | null;
  /** MIG-04-AUTH-02 : erreur contrôlée lorsque le lien ou la session de récupération est absent, invalide ou expiré */
  passwordRecoveryError?: string | null;
  /** MIG-04-AUTH-02 : état initial de confirmation réussie (utile pour les tests de rendu) */
  initialRecoveryCompleted?: boolean;
  /** MIG-04-AUTH-02 : callback appelé lorsque l'utilisateur revient à la connexion normale */
  onExitPasswordRecovery?: () => void;
  /** Optionnel (tests) : injecte le service de finalisation de récupération Supabase */
  completePasswordRecoveryFn?: (
    newPassword: string,
    confirmPassword: string
  ) => Promise<SupabasePasswordRecoveryResult>;
};

export default function PdiAuthPage({
  onSuccess,
  onBackToLanding,
  initialTab = "login",
  supabaseConfiguredOverride,
  loginWithSupabaseFn,
  resetPasswordWithSupabaseFn,
  passwordRecoveryMode = false,
  passwordRecoveryEmail = null,
  passwordRecoveryError = null,
  initialRecoveryCompleted = false,
  onExitPasswordRecovery,
  completePasswordRecoveryFn,
}: PdiAuthPageProps) {
  const [tab, setTab] = useState<"login" | "register" | "activation">(initialTab);
  const supabaseAvailable = useMemo(
    () =>
      typeof supabaseConfiguredOverride === "boolean"
        ? supabaseConfiguredOverride
        : !isStagingSandboxMode() && isSupabaseBrowserConfigured(),
    [supabaseConfiguredOverride]
  );
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTransitionTimer();
    };
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  
  // Countries list loaded from Firebase / local default
  const [allCountries, setAllCountries] = useState<PdiCountryConfig[]>(PDI_DEFAULT_COUNTRIES);

  // Filter ONLY allowed countries for client registration dropdown (excluded countries are hidden)
  const allowedCountries = useMemo(() => {
    return allCountries.filter(c => c.allowed);
  }, [allCountries]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regCountryCode, setRegCountryCode] = useState("DZ");
  const [regCity, setRegCity] = useState("16 - Alger");
  const [customCity, setCustomCity] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regPlan, setRegPlan] = useState("trial");
  const [regActivationKey, setRegActivationKey] = useState("");

  // Payment method and card coordinates state (Mandatory even for trial)
  const [dzPaymentMethod, setDzPaymentMethod] = useState<"cib_edahabia" | "baridimob">("cib_edahabia");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [baridiMobPhone, setBaridiMobPhone] = useState("");
  const [baridiMobRip, setBaridiMobRip] = useState("");
  const [intlPostalCode, setIntlPostalCode] = useState("");

  // Modals state for legal, tech references and payment policies
  const [activeInfoModal, setActiveInfoModal] = useState<ModalType>(null);
  const [showPlansComparison, setShowPlansComparison] = useState(false);

  // Selected Country details
  const selectedCountry = useMemo(() => {
    return allCountries.find(c => c.code.toUpperCase() === regCountryCode.toUpperCase()) || allCountries[0] || PDI_DEFAULT_COUNTRIES[0];
  }, [allCountries, regCountryCode]);

  // Activation form state
  const [actEmail, setActEmail] = useState("");
  const [actKey, setActKey] = useState("");

  // Reset password request state
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);

  // MIG-04-AUTH-02 : Password recovery completion state (nouveau mot de passe uniquement)
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryCompleted, setRecoveryCompleted] = useState(initialRecoveryCompleted);

  // UI status states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    passwordRecoveryError ? sanitizeSupabaseAuthErrorText(passwordRecoveryError) : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (passwordRecoveryError) {
      setErrorMsg(sanitizeSupabaseAuthErrorText(passwordRecoveryError));
      setSuccessMsg(null);
    }
  }, [passwordRecoveryError]);

  useEffect(() => {
    if (passwordRecoveryMode) {
      setTab("login");
      setShowResetForm(false);
      setRecoveryCompleted(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [passwordRecoveryMode]);

  // MIG-04-AUTH-01-FIX-02 & MIG-05-FIX-01 : Charger le module Firebase uniquement de façon
  // paresseuse lorsque l'onglet d'inscription est effectivement ouvert (0 import statique au boot).
  useEffect(() => {
    if (tab !== "register") return;
    let cancelled = false;
    void import("../../lib/firebase")
      .then(({ getCountryRestrictionsFromFirebase }) => getCountryRestrictionsFromFirebase())
      .then((res) => {
        if (!cancelled && isMountedRef.current && res && res.length > 0) {
          setAllCountries(res);
        }
      })
      .catch(() => {
        // Fallback silencieux sur PDI_DEFAULT_COUNTRIES déjà initialisé
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  // When country changes, reset city to the first default city of that country
  const handleCountryChange = (newCode: string) => {
    setRegCountryCode(newCode);
    const country = allCountries.find(c => c.code === newCode);
    if (country && country.defaultCities && country.defaultCities.length > 0) {
      setRegCity(country.defaultCities[0]);
    } else {
      setRegCity("");
    }
    setCustomCity("");
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    clearTransitionTimer();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!supabaseAvailable) {
      setErrorMsg(SUPABASE_UNCONFIGURED_LOGIN_ERROR);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const sbRes = await executeSupabaseExclusiveLogin(loginEmail, loginPassword, {
        supabaseAvailable,
        loginFn: loginWithSupabaseFn,
      });
      if (!isMountedRef.current) return;
      setSuccessMsg(`Connexion Supabase vérifiée ! Bienvenue ${sbRes.profile.name}.`);
      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        if (!isMountedRef.current) return;
        if (!isCoherentAuthorizedLoginResult(sbRes, sbRes.authUser)) {
          setErrorMsg("Session Supabase interrompue ou non autorisée avant l'ouverture de l'espace de travail.");
          return;
        }
        onSuccess(sbRes.profile, sbRes.isSuperAdmin, {
          provider: "supabase",
          emailVerified: sbRes.emailConfirmed,
          authUser: sbRes.authUser,
        });
      }, 600);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMsg(err?.message || "Erreur de connexion Supabase. Vérifiez vos identifiants.");
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regPassword !== regPasswordConfirm) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au minimum 6 caractères.");
      return;
    }

    // MANDATORY PAYMENT / CIB VALIDATION (Even for 30-day Free Trial)
    const isAlgeria = selectedCountry.code === "DZ";
    if (isAlgeria) {
      if (dzPaymentMethod === "cib_edahabia") {
        const cleanCard = cardNumber.replace(/\s+/g, "");
        if (cleanCard.length < 15) {
          setErrorMsg("⚠️ Coordonnées CIB / Edahabia obligatoires : Veuillez renseigner un numéro de carte valide (16 chiffres), même pour l'essai gratuit de 30 jours (0,00 DZD débité).");
          return;
        }
        if (!cardExpiry || cardExpiry.trim().length < 4) {
          setErrorMsg("⚠️ Date d'expiration de la carte CIB / Edahabia manquante (format MM/AA).");
          return;
        }
        if (!cardCvv || cardCvv.trim().length < 3) {
          setErrorMsg("⚠️ Code CVV / CVC de sécurité (3 chiffres au dos de la carte) manquant.");
          return;
        }
        if (!cardHolder || cardHolder.trim().length < 3) {
          setErrorMsg("⚠️ Nom et Prénom du titulaire de la carte CIB / Edahabia requis.");
          return;
        }
      } else {
        // BaridiMob verification
        if (!baridiMobPhone || baridiMobPhone.trim().length < 9) {
          setErrorMsg("⚠️ Numéro de téléphone BaridiMob valide requis pour l'empreinte de sécurité.");
          return;
        }
        if (!baridiMobRip || baridiMobRip.trim().length < 10) {
          setErrorMsg("⚠️ Numéro de compte / RIP BaridiMob (20 chiffres) obligatoire.");
          return;
        }
      }
    } else {
      // International Paddle Card verification
      const cleanCard = cardNumber.replace(/\s+/g, "");
      if (cleanCard.length < 15) {
        setErrorMsg("⚠️ Coordonnées bancaires obligatoires : Veuillez renseigner une carte de crédit valide (Visa / MasterCard / Amex), même pour l'essai de 30 jours (0,00 € débité).");
        return;
      }
      if (!cardExpiry || cardExpiry.trim().length < 4) {
        setErrorMsg("⚠️ Date d'expiration de la carte manquante (format MM/AA).");
        return;
      }
      if (!cardCvv || cardCvv.trim().length < 3) {
        setErrorMsg("⚠️ Code CVC / CVV manquant (3 chiffres au dos de votre carte).");
        return;
      }
      if (!cardHolder || cardHolder.trim().length < 3) {
        setErrorMsg("⚠️ Nom complet du porteur de la carte bancaire requis.");
        return;
      }
    }

    const finalCity = (regCity === "Autre ville..." || !regCity) ? (customCity.trim() || "Non spécifiée") : regCity;

    isSubmittingRef.current = true;
    clearTransitionTimer();
    setLoading(true);

    try {
      const { auth, registerWithEmailAndPasswordSecure } = await import("../../lib/firebase");
      const profile = await registerWithEmailAndPasswordSecure({
        email: regEmail,
        password: regPassword,
        name: regName,
        company: regCompany,
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        city: finalCity,
        requestedPlan: regPlan,
        activationKey: regActivationKey
      });

      if (!isMountedRef.current) return;

      if (profile.status === "active" && isCoherentAuthorizedLoginResult({ profile, isSuperAdmin: false }, auth.currentUser)) {
        setSuccessMsg(`Compte créé et activé avec succès ! Bienvenue ${profile.name}. Formule : ${regPlan.toUpperCase()}.`);
        transitionTimerRef.current = setTimeout(() => {
          transitionTimerRef.current = null;
          if (!isMountedRef.current) return;
          if (!isCoherentAuthorizedLoginResult({ profile, isSuperAdmin: false }, auth.currentUser)) {
            setErrorMsg("Session interrompue avant l'ouverture de l'espace de travail.");
            return;
          }
          onSuccess(profile, false);
        }, 600);
      } else {
        setSuccessMsg(`Compte enregistré pour ${profile.name} (${selectedCountry.name}) ! Empreinte bancaire pré-autorisée avec succès. En attente de validation finale.`);
        setActEmail(profile.email || regEmail);
        setTab("activation");
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMsg(err.message || "Erreur lors de la création du compte.");
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    clearTransitionTimer();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { auth, activateAccountWithLicenseKey } = await import("../../lib/firebase");
      const profile = await activateAccountWithLicenseKey(actEmail, actKey);
      if (!isMountedRef.current) return;
      if (!isCoherentAuthorizedLoginResult({ profile, isSuperAdmin: false }, auth.currentUser)) {
        throw new Error(
          "Activation non confirmée : le profil n'est pas en statut actif ou la session ne correspond pas."
        );
      }
      setSuccessMsg(`Félicitations ! Votre compte a été activé avec la formule ${profile.accountType.toUpperCase()}.`);
      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        if (!isMountedRef.current) return;
        if (!isCoherentAuthorizedLoginResult({ profile, isSuperAdmin: false }, auth.currentUser)) {
          setErrorMsg("Session interrompue avant l'ouverture de l'espace de travail.");
          return;
        }
        onSuccess(profile, false);
      }, 700);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMsg(err.message || "Erreur d'activation de la licence.");
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!supabaseAvailable) {
      setErrorMsg(SUPABASE_UNCONFIGURED_RESET_ERROR);
      return;
    }

    if (!resetEmail.trim()) {
      setErrorMsg("Veuillez saisir votre adresse email.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await executeSupabaseExclusivePasswordReset(resetEmail, {
        supabaseAvailable,
        resetFn: resetPasswordWithSupabaseFn,
      });
      if (!isMountedRef.current) return;
      setSuccessMsg(`Un email de réinitialisation sécurisé Supabase a été envoyé à ${resetEmail}. Vérifiez votre boîte de réception.`);
      setShowResetForm(false);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMsg(err?.message || "Erreur lors de l'envoi de l'email de réinitialisation Supabase.");
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleCompletePasswordRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!supabaseAvailable) {
      setErrorMsg(SUPABASE_UNCONFIGURED_RESET_ERROR);
      return;
    }

    const validation = validateSupabaseRecoveryPassword(
      recoveryNewPassword,
      recoveryConfirmPassword
    );
    if ("code" in validation) {
      setErrorMsg(validation.message);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await executeSupabaseExclusivePasswordRecoveryUpdate(
        recoveryNewPassword,
        recoveryConfirmPassword,
        {
          supabaseAvailable,
          completeRecoveryFn: completePasswordRecoveryFn,
        }
      );
      if (!isMountedRef.current) return;
      setRecoveryNewPassword("");
      setRecoveryConfirmPassword("");
      setRecoveryCompleted(true);
      setSuccessMsg(
        "Votre nouveau mot de passe a été enregistré avec succès. Vous pouvez maintenant vous connecter normalement."
      );
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const safeErrMsg =
        sanitizeSupabaseAuthErrorText(err?.message) ||
        "Impossible d'enregistrer le nouveau mot de passe Supabase.";
      setErrorMsg(safeErrMsg);
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleReturnToNormalLoginFromRecovery = () => {
    setRecoveryNewPassword("");
    setRecoveryConfirmPassword("");
    setRecoveryCompleted(false);
    setShowResetForm(false);
    setLoginEmail("");
    setLoginPassword("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setTab("login");
    onExitPasswordRecovery?.();
  };

  return (
    <div className="pdi-auth-container">
      <style>{`
        .pdi-auth-container, .pdi-auth-container * {
          box-sizing: border-box;
        }

        .pdi-auth-container {
          min-height: 100vh;
          width: 100vw;
          background: radial-gradient(circle at 50% 10%, rgba(14, 165, 233, 0.15), transparent 45%),
                      radial-gradient(circle at 90% 90%, rgba(245, 158, 11, 0.08), transparent 40%),
                      #070B12;
          color: #E5EDF8;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 16px 12px;
          position: relative;
          overflow-y: auto;
        }

        .pdi-auth-topbar {
          position: absolute;
          top: 14px;
          left: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 20;
        }

        .pdi-auth-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(15, 23, 42, 0.7);
          color: #94A3B8;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pdi-auth-back-btn:hover {
          color: #E2E8F0;
          border-color: #38BDF8;
          background: rgba(14, 165, 233, 0.15);
        }

        .pdi-auth-card {
          width: 100%;
          max-width: 600px;
          border-radius: 20px;
          border: 1px solid rgba(103, 232, 249, 0.28);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(8, 13, 24, 0.99));
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(103, 232, 249, 0.1);
          padding: 22px 26px;
          margin: 38px auto 6px;
          position: relative;
          z-index: 10;
        }

        .pdi-auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 4px;
          background: #0B111A;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          padding: 3px;
          margin: 14px 0 16px;
        }

        .pdi-auth-tab-btn {
          border: 0;
          background: transparent;
          color: #8EA3C2;
          font-size: 11px;
          font-weight: 900;
          padding: 7px 4px;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          white-space: nowrap;
        }
        .pdi-auth-tab-btn.active {
          background: linear-gradient(135deg, #0284C7, #0EA5E9);
          color: white;
          box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35);
        }

        .pdi-form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 11px;
          min-width: 0;
          width: 100%;
        }
        .pdi-form-group label {
          font-size: 10.5px;
          font-weight: 800;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .pdi-form-group input, .pdi-form-group select {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: #090E17;
          color: #F8FAFC;
          padding: 0 12px;
          font-size: 12.5px;
          font-weight: 700;
          outline: none;
          transition: border-color 0.2s;
        }
        .pdi-form-group input:focus, .pdi-form-group select:focus {
          border-color: #38BDF8;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }

        .pdi-input-pwd-wrap {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          min-width: 0;
        }
        .pdi-input-pwd-wrap input {
          width: 100%;
          min-width: 0;
          padding-right: 38px;
        }
        .pdi-pwd-toggle {
          position: absolute;
          right: 10px;
          background: transparent;
          border: 0;
          color: #64748B;
          cursor: pointer;
          font-size: 13px;
          padding: 3px;
        }
        .pdi-pwd-toggle:hover {
          color: #94A3B8;
        }

        .pdi-btn-submit {
          box-sizing: border-box;
          width: 100%;
          height: 40px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #0284C7, #22D3EE);
          color: white;
          font-size: 12.5px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 6px;
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.35);
          transition: transform 0.15s, opacity 0.15s;
        }
        .pdi-btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .pdi-btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pdi-btn-google {
          box-sizing: border-box;
          width: 100%;
          height: 38px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          background: #0B121E;
          color: #E2E8F0;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .pdi-btn-google:hover:not(:disabled) {
          background: #111A2C;
          border-color: #38BDF8;
        }

        .pdi-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 11px 0;
          color: #64748B;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .pdi-divider::before, .pdi-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(148, 163, 184, 0.15);
        }

        .pdi-msg-error {
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.12);
          color: #FCA5A5;
          border-radius: 9px;
          padding: 8px 10px;
          font-size: 11.5px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .pdi-msg-success {
          border: 1px solid rgba(34, 197, 94, 0.4);
          background: rgba(34, 197, 94, 0.12);
          color: #86EFAC;
          border-radius: 9px;
          padding: 8px 10px;
          font-size: 11.5px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .pdi-super-btn-link {
          background: transparent;
          border: 0;
          color: #67E8F9;
          font-size: 10.5px;
          font-weight: 800;
          text-decoration: underline;
          cursor: pointer;
          margin-top: 8px;
          display: block;
          text-align: center;
          width: 100%;
        }
      `}</style>

      {/* Top Bar */}
      <div className="pdi-auth-topbar">
        <PdiBrandMark variant="horizontal" size="sm" />
        <button className="pdi-auth-back-btn" onClick={onBackToLanding}>
          ← Retour à la présentation
        </button>
      </div>

      {/* Main Auth Card */}
      <div className="pdi-auth-card">
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#67E8F9", background: "rgba(14, 165, 233, 0.12)", border: "1px solid rgba(103,232,249,0.3)", padding: "3px 9px", borderRadius: 999 }}>
            Portail d'Accès Sécurisé
          </span>
          <h1 style={{ fontSize: 19, fontWeight: 900, color: "#F8FAFC", margin: "8px 0 3px", letterSpacing: "-0.02em" }}>
            Connexion &amp; Licences PD&amp;I
          </h1>
          <p style={{ fontSize: 11.5, color: "#94A3B8", margin: 0, fontWeight: 600 }}>
            Accès protégé par chiffrement fort et clés d'activation officielles.
          </p>
        </div>

        {/* Navigation Tabs (masqués pendant la finalisation de récupération de mot de passe) */}
        {!passwordRecoveryMode && (
          <div className="pdi-auth-tabs">
            <button
              type="button"
              className={`pdi-auth-tab-btn ${tab === "login" ? "active" : ""}`}
              onClick={() => { setTab("login"); setErrorMsg(null); setSuccessMsg(null); }}
            >
              Connexion
            </button>
            <button
              type="button"
              className={`pdi-auth-tab-btn ${tab === "register" ? "active" : ""}`}
              onClick={() => { setTab("register"); setErrorMsg(null); setSuccessMsg(null); }}
            >
              Créer un compte
            </button>
            <button
              type="button"
              className={`pdi-auth-tab-btn ${tab === "activation" ? "active" : ""}`}
              onClick={() => { setTab("activation"); setErrorMsg(null); setSuccessMsg(null); }}
            >
              Activer licence
            </button>
          </div>
        )}

        {/* Error / Success Notifications */}
        {errorMsg && <div className="pdi-msg-error" data-testid="pdi-auth-error-banner" role="alert">⚠️ {errorMsg}</div>}
        {successMsg && <div className="pdi-msg-success" data-testid="pdi-auth-success-banner" role="status">✓ {successMsg}</div>}

        {/* PASSWORD RECOVERY COMPLETION VIEW (MIG-04-AUTH-02 : session Supabase recovery validée uniquement) */}
        {passwordRecoveryMode && !recoveryCompleted && (
          <form
            onSubmit={handleCompletePasswordRecoverySubmit}
            data-testid="pdi-supabase-recovery-update-form"
          >
            <div
              style={{
                background: "rgba(14, 165, 233, 0.1)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                borderRadius: 12,
                padding: 12,
                margin: "12px 0 16px",
              }}
            >
              <div style={{ fontWeight: 900, color: "#38BDF8", fontSize: 12, marginBottom: 4 }}>
                🔐 Définition du nouveau mot de passe (Supabase Auth)
              </div>
              <div style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.45 }}>
                Votre session de récupération Supabase est active. Choisissez un nouveau mot de passe d&apos;au moins 6 caractères puis confirmez-le.
                {passwordRecoveryEmail ? (
                  <div style={{ marginTop: 6, color: "#94A3B8", fontWeight: 700 }}>
                    Compte concerné : <span style={{ color: "#E2E8F0" }}>{passwordRecoveryEmail}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pdi-form-group">
              <label htmlFor="pdi-recovery-new-password">Nouveau mot de passe</label>
              <div className="pdi-input-pwd-wrap">
                <input
                  id="pdi-recovery-new-password"
                  data-testid="pdi-recovery-new-password-input"
                  type={showRecoveryPassword ? "text" : "password"}
                  required
                  minLength={6}
                  maxLength={128}
                  disabled={!supabaseAvailable || loading}
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="pdi-pwd-toggle"
                  onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                  tabIndex={-1}
                >
                  {showRecoveryPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="pdi-form-group">
              <label htmlFor="pdi-recovery-confirm-password">Confirmation du nouveau mot de passe</label>
              <input
                id="pdi-recovery-confirm-password"
                data-testid="pdi-recovery-confirm-password-input"
                type={showRecoveryPassword ? "text" : "password"}
                required
                minLength={6}
                maxLength={128}
                disabled={!supabaseAvailable || loading}
                placeholder="Confirmez votre nouveau mot de passe"
                value={recoveryConfirmPassword}
                onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              data-testid="pdi-recovery-submit-btn"
              className="pdi-btn-submit"
              disabled={loading || !supabaseAvailable}
            >
              {loading
                ? "Enregistrement du nouveau mot de passe..."
                : "Enregistrer le nouveau mot de passe"}
            </button>

            <button
              type="button"
              data-testid="pdi-recovery-cancel-btn"
              className="pdi-super-btn-link"
              onClick={handleReturnToNormalLoginFromRecovery}
            >
              Annuler et revenir à la connexion normale
            </button>
          </form>
        )}

        {/* PASSWORD RECOVERY SUCCESS CONFIRMATION VIEW (MIG-04-AUTH-02) */}
        {passwordRecoveryMode && recoveryCompleted && (
          <div
            data-testid="pdi-supabase-recovery-success"
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(52, 211, 153, 0.35)",
              borderRadius: 12,
              padding: 16,
              margin: "12px 0 10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 900, color: "#6EE7B7", fontSize: 13.5, marginBottom: 6 }}>
              ✓ Mot de passe mis à jour avec succès
            </div>
            <p style={{ fontSize: 11.5, color: "#CBD5E1", margin: "0 0 14px", lineHeight: 1.5 }}>
              Votre nouveau mot de passe a été enregistré par Supabase Auth. Vous pouvez désormais revenir à l&apos;écran de connexion normale.
            </p>
            <button
              type="button"
              data-testid="pdi-recovery-back-to-login-btn"
              className="pdi-btn-submit"
              onClick={handleReturnToNormalLoginFromRecovery}
            >
              Revenir à la connexion normale →
            </button>
          </div>
        )}

        {/* TAB 1: LOGIN (SUPABASE AUTH EXCLUSIF — MIG-04-AUTH-01-FIX-02 & MIG-04-AUTH-02) */}
        {!passwordRecoveryMode && tab === "login" && !showResetForm && (
          <form onSubmit={handleLoginSubmit} data-testid="pdi-supabase-login-form">
            {!supabaseAvailable ? (
              <div
                data-testid="pdi-supabase-unconfigured-banner"
                role="alert"
                className="pdi-msg-error"
                style={{ marginBottom: 14 }}
              >
                ⚠️ {SUPABASE_UNCONFIGURED_LOGIN_ERROR}
              </div>
            ) : (
              <div
                data-testid="pdi-supabase-auth-badge"
                style={{
                  padding: "8px 12px",
                  marginBottom: 14,
                  borderRadius: 10,
                  background: "rgba(5, 150, 105, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#6EE7B7",
                  textAlign: "center",
                }}
              >
                Authentification sécurisée Supabase Auth (vérifiée côté serveur)
              </div>
            )}

            <div className="pdi-form-group">
              <label>Adresse Email ou Identifiant</label>
              <input
                type="email"
                data-testid="pdi-login-email-input"
                required
                disabled={!supabaseAvailable || loading}
                placeholder={LOGIN_EMAIL_PLACEHOLDER}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="pdi-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Mot de passe</label>
              </div>
              <div className="pdi-input-pwd-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  data-testid="pdi-login-password-input"
                  required
                  disabled={!supabaseAvailable || loading}
                  placeholder="Votre mot de passe sécurisé"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pdi-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="pdi-supabase-login-submit"
              className="pdi-btn-submit"
              disabled={loading || !supabaseAvailable}
            >
              {loading
                ? "Vérification serveur Supabase en cours..."
                : !supabaseAvailable
                  ? "Connexion bloquée (Supabase non configuré)"
                  : "Se connecter via Supabase Auth →"}
            </button>

            <div className="pdi-divider">OU</div>

            <button
              type="button"
              data-testid="pdi-btn-google-disabled"
              className="pdi-btn-google"
              disabled={true}
              aria-disabled="true"
              title={SUPABASE_GOOGLE_OAUTH_DISABLED_NOTICE}
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-2.9z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
              </svg>
              Google OAuth (indisponible — non activé sur Supabase)
            </button>
            <div
              data-testid="pdi-google-disabled-notice"
              style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 6, lineHeight: 1.4 }}
            >
              {SUPABASE_GOOGLE_OAUTH_DISABLED_NOTICE}
            </div>

            <button
              type="button"
              data-testid="pdi-open-reset-form-btn"
              className="pdi-super-btn-link"
              onClick={() => {
                setShowResetForm(true);
                setResetEmail(loginEmail);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              🔑 Mot de passe oublié ? Réinitialiser via Supabase Auth
            </button>
          </form>
        )}

        {/* PASSWORD RESET VIEW (SUPABASE AUTH EXCLUSIF) */}
        {!passwordRecoveryMode && tab === "login" && showResetForm && (
          <form onSubmit={handleResetPasswordSubmit} data-testid="pdi-supabase-reset-form">
            {!supabaseAvailable && (
              <div
                data-testid="pdi-supabase-reset-unconfigured-banner"
                role="alert"
                className="pdi-msg-error"
                style={{ marginBottom: 14 }}
              >
                ⚠️ {SUPABASE_UNCONFIGURED_RESET_ERROR}
              </div>
            )}

            <div style={{ background: "rgba(14, 165, 233, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 900, color: "#38BDF8", fontSize: 12, marginBottom: 4 }}>
                🔒 Réinitialisation du mot de passe (Supabase Auth)
              </div>
              <div style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.4 }}>
                Saisissez votre adresse email enregistrée. Un lien sécurisé vous sera envoyé exclusivement par Supabase Auth pour réinitialiser votre mot de passe.
              </div>
            </div>

            <div className="pdi-form-group">
              <label>Adresse email du compte</label>
              <input
                type="email"
                data-testid="pdi-reset-email-input"
                required
                disabled={!supabaseAvailable || loading}
                placeholder={LOGIN_EMAIL_PLACEHOLDER}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              data-testid="pdi-supabase-reset-submit"
              className="pdi-btn-submit"
              disabled={loading || !supabaseAvailable}
            >
              {loading
                ? "Envoi Supabase en cours..."
                : !supabaseAvailable
                  ? "Réinitialisation bloquée (Supabase non configuré)"
                  : "Envoyer le lien de réinitialisation Supabase →"}
            </button>

            <button
              type="button"
              className="pdi-super-btn-link"
              onClick={() => setShowResetForm(false)}
            >
              Annuler et revenir à la connexion
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {!passwordRecoveryMode && tab === "register" && (
          <form onSubmit={handleRegisterSubmit}>
            <div className="pdi-form-group">
              <label>Nom complet &amp; Prénom</label>
              <input
                type="text"
                required
                placeholder="Ex: Karim Belkacem"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>

            <div className="pdi-form-group">
              <label>Email professionnel</label>
              <input
                type="email"
                required
                placeholder="nom@societe.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>

            <div className="pdi-form-group">
              <label>Entreprise / Bureau d'études</label>
              <input
                type="text"
                placeholder="Ex: Sonatrach / Bureau d'études tuyauterie"
                value={regCompany}
                onChange={(e) => setRegCompany(e.target.value)}
              />
            </div>

            {/* GEO LOCALIZATION: PAYS & VILLE DROPDOWNS */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 10, width: "100%" }}>
              <div className="pdi-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Pays de facturation</label>
                  <span style={{ fontSize: 10, color: "#38BDF8", fontWeight: 700 }}>
                    {allowedCountries.length} autorisés
                  </span>
                </div>
                <select
                  value={regCountryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  style={{
                    background: "#0F172A",
                    borderColor: "rgba(56, 189, 248, 0.4)",
                    color: "#F8FAFC",
                    fontWeight: 600
                  }}
                >
                  {allowedCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pdi-form-group">
                <label>
                  {selectedCountry.code === "DZ" ? "Wilaya / Ville" : "Ville"}
                </label>
                {selectedCountry.defaultCities && selectedCountry.defaultCities.length > 0 ? (
                  <select
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    style={{
                      background: "#0F172A",
                      borderColor: "rgba(56, 189, 248, 0.4)",
                      color: "#F8FAFC"
                    }}
                  >
                    {selectedCountry.defaultCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                    <option value="Autre ville...">➕ Autre ville...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ex: Paris, Montréal..."
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* If user picked custom city or "Autre ville..." */}
            {regCity === "Autre ville..." && (
              <div className="pdi-form-group" style={{ marginTop: -4 }}>
                <label style={{ fontSize: 11, color: "#94A3B8" }}>Précisez le nom de votre ville :</label>
                <input
                  type="text"
                  required
                  placeholder="Nom de votre ville"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* PAYMENT GATEWAY ROUTING INDICATOR */}
            <div
              style={{
                background: selectedCountry.code === "DZ"
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.25))"
                  : "linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(30, 58, 138, 0.25))",
                border: `1px solid ${selectedCountry.code === "DZ" ? "rgba(16, 185, 129, 0.4)" : "rgba(56, 189, 248, 0.4)"}`,
                borderRadius: 10,
                padding: "8px 10px",
                marginBottom: 11,
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%"
              }}
            >
              <div style={{ fontSize: 20, flexShrink: 0 }}>
                {selectedCountry.code === "DZ" ? "💳" : "🌐"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: selectedCountry.code === "DZ" ? "#34D399" : "#38BDF8",
                  marginBottom: 1
                }}>
                  {selectedCountry.code === "DZ" ? "Paiement Algérie (DZD)" : "Paiement International (EUR / USD)"}
                </div>
                <div style={{ fontSize: 10.5, color: "#CBD5E1", lineHeight: 1.35 }}>
                  {selectedCountry.code === "DZ" ? (
                    <>
                      Réglez en Dinars via <strong style={{ color: "#FFF" }}>Baridi Mob &amp; Carte Edahabia</strong> propulsé par la passerelle agréée <span style={{ color: "#34D399" }}>Slick-Pay</span>.
                    </>
                  ) : (
                    <>
                      Règlement mondial sécurisé via <strong style={{ color: "#FFF" }}>Paddle</strong> (Cartes Visa / MasterCard, PayPal). Facturation conforme TVA locale.
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, width: "100%" }}>
              <div className="pdi-form-group">
                <label>Mot de passe</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 6 caractères"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <div className="pdi-form-group">
                <label>Confirmation</label>
                <input
                  type="password"
                  required
                  placeholder="Confirmer"
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                />
              </div>
            </div>

            {/* SECTION SÉLECTION DE FORMULE AVEC DÉTAIL DES OFFRES */}
            <div style={{ marginTop: 8, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Choix de votre formule
                </label>
                <button
                  type="button"
                  onClick={() => setShowPlansComparison(!showPlansComparison)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#38BDF8",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  {showPlansComparison ? "Masquer détails ▲" : "Comparer les offres ▼"}
                </button>
              </div>

              {/* Grid of plan cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                {PDI_OFFERS.map((offer) => {
                  const isSelected = regPlan === offer.id;
                  const price = selectedCountry.code === "DZ" ? offer.priceDZ : offer.priceIntl;
                  return (
                    <div
                      key={offer.id}
                      onClick={() => setRegPlan(offer.id)}
                      style={{
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(2, 132, 199, 0.15))"
                          : "#090E17",
                        border: `1.5px solid ${isSelected ? "#38BDF8" : "rgba(148, 163, 184, 0.18)"}`,
                        borderRadius: 12,
                        padding: "10px 8px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        transition: "all 0.2s",
                        position: "relative"
                      }}
                    >
                      {offer.popular && (
                        <div style={{
                          position: "absolute",
                          top: -7,
                          background: "#F59E0B",
                          color: "#000",
                          fontSize: 8,
                          fontWeight: 900,
                          padding: "1px 6px",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}>
                          Top
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#FFF" : "#CBD5E1", marginBottom: 2 }}>
                        {offer.name.split(" ")[0]}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: isSelected ? "#38BDF8" : "#94A3B8" }}>
                        {price}
                      </div>
                      <div style={{ fontSize: 9, color: "#64748B", marginTop: 2 }}>
                        {offer.id === "trial" ? "30 jours" : "/mois"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Plan In-depth Feature Preview */}
              {(() => {
                const current = PDI_OFFERS.find(o => o.id === regPlan) || PDI_OFFERS[0];
                const price = selectedCountry.code === "DZ" ? current.priceDZ : current.priceIntl;
                return (
                  <div style={{
                    marginTop: 10,
                    background: "rgba(15, 23, 42, 0.75)",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: 12,
                    padding: "12px 14px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#F8FAFC" }}>
                        ✨ {current.name} — <span style={{ color: "#38BDF8" }}>{price}</span> <span style={{ fontSize: 10, color: "#94A3B8" }}>{current.subtext}</span>
                      </div>
                      <span style={{
                        background: "rgba(14, 165, 233, 0.15)",
                        color: "#38BDF8",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999
                      }}>
                        {current.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>
                      {current.desc}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                      {current.features.map((feat, idx) => (
                        <div key={idx} style={{ fontSize: 10.5, color: "#CBD5E1", display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ color: "#10B981", fontWeight: "bold" }}>✓</span> {feat}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* MANDATORY PAYMENT / CIB / BARIDIMOB SECTION */}
            <div style={{
              background: selectedCountry.code === "DZ"
                ? "linear-gradient(180deg, rgba(6, 78, 59, 0.18), rgba(15, 23, 42, 0.9))"
                : "linear-gradient(180deg, rgba(30, 58, 138, 0.18), rgba(15, 23, 42, 0.9))",
              border: `1.5px solid ${selectedCountry.code === "DZ" ? "rgba(16, 185, 129, 0.45)" : "rgba(56, 189, 248, 0.45)"}`,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{selectedCountry.code === "DZ" ? "🇩🇿" : "💳"}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#FFF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {selectedCountry.code === "DZ" ? "Empreinte Bancaire Algérie (CIB / BaridiMob)" : "Coordonnées Bancaires (Paddle Merchant)"}
                    </div>
                    <div style={{ fontSize: 10, color: selectedCountry.code === "DZ" ? "#34D399" : "#38BDF8", fontWeight: 700 }}>
                      🔒 Obligatoire pour validation d'accès (0 {selectedCountry.code === "DZ" ? "DZD" : "€"} débité pour l'essai 30 jours)
                    </div>
                  </div>
                </div>
                <span style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  color: "#FCD34D",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 6
                }}>
                  PCI-DSS Sécurisé
                </span>
              </div>

              {/* ALGERIA: SLICK-PAY & BARIDIMOB TOGGLE */}
              {selectedCountry.code === "DZ" ? (
                <div>
                  {/* Selector CIB vs BaridiMob */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 6,
                    background: "#090E17",
                    padding: 4,
                    borderRadius: 10,
                    marginBottom: 12,
                    width: "100%"
                  }}>
                    <button
                      type="button"
                      onClick={() => setDzPaymentMethod("cib_edahabia")}
                      style={{
                        border: 0,
                        background: dzPaymentMethod === "cib_edahabia" ? "linear-gradient(135deg, #059669, #10B981)" : "transparent",
                        color: dzPaymentMethod === "cib_edahabia" ? "#FFF" : "#94A3B8",
                        fontWeight: 800,
                        fontSize: 11,
                        padding: "8px 6px",
                        borderRadius: 8,
                        cursor: "pointer"
                      }}
                    >
                      💳 Carte CIB / Edahabia
                    </button>
                    <button
                      type="button"
                      onClick={() => setDzPaymentMethod("baridimob")}
                      style={{
                        border: 0,
                        background: dzPaymentMethod === "baridimob" ? "linear-gradient(135deg, #059669, #10B981)" : "transparent",
                        color: dzPaymentMethod === "baridimob" ? "#FFF" : "#94A3B8",
                        fontWeight: 800,
                        fontSize: 11,
                        padding: "8px 6px",
                        borderRadius: 8,
                        cursor: "pointer"
                      }}
                    >
                      📱 Virement BaridiMob RIP
                    </button>
                  </div>

                  {dzPaymentMethod === "cib_edahabia" ? (
                    <div>
                      <div className="pdi-form-group">
                        <label>Numéro de carte CIB / Edahabia (16 chiffres)</label>
                        <input
                          type="text"
                          required
                          maxLength={19}
                          placeholder="6280 XXXX XXXX XXXX"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          style={{ letterSpacing: "0.08em", fontFamily: "monospace" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 8, width: "100%" }}>
                        <div className="pdi-form-group">
                          <label>Titulaire carte</label>
                          <input
                            type="text"
                            required
                            placeholder="Nom &amp; Prénom"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                          />
                        </div>
                        <div className="pdi-form-group">
                          <label>Expiration</label>
                          <input
                            type="text"
                            required
                            maxLength={5}
                            placeholder="MM/AA"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            style={{ textAlign: "center" }}
                          />
                        </div>
                        <div className="pdi-form-group">
                          <label>CVV (3 chiffres)</label>
                          <input
                            type="password"
                            required
                            maxLength={3}
                            placeholder="•••"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            style={{ textAlign: "center" }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="pdi-form-group">
                        <label>N° Téléphone BaridiMob émetteur</label>
                        <input
                          type="tel"
                          required
                          placeholder="0550 XX XX XX / 0660 XX XX XX"
                          value={baridiMobPhone}
                          onChange={(e) => setBaridiMobPhone(e.target.value)}
                        />
                      </div>
                      <div className="pdi-form-group">
                        <label>RIP BaridiMob (20 chiffres CCP)</label>
                        <input
                          type="text"
                          required
                          placeholder="0079999900XXXXXXXXXX"
                          value={baridiMobRip}
                          onChange={(e) => setBaridiMobRip(e.target.value)}
                          style={{ letterSpacing: "0.05em", fontFamily: "monospace" }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6, lineHeight: 1.4 }}>
                    🏛️ Passerelle de paiement agréée <strong style={{ color: "#34D399" }}>Slick-Pay Algérie</strong> (GIE Monétique &amp; SATIM). Vos données de paiement sont strictement chiffrées selon les standards bancaires algériens.
                  </div>
                </div>
              ) : (
                /* INTERNATIONAL: PADDLE MERCHANT CARD CHECKOUT */
                <div>
                  <div className="pdi-form-group">
                    <label>Numéro de carte bancaire (Visa, MasterCard, Amex)</label>
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      style={{ letterSpacing: "0.08em", fontFamily: "monospace" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 8, width: "100%" }}>
                    <div className="pdi-form-group">
                      <label>Nom sur la carte</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: John Dupont"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                      />
                    </div>
                    <div className="pdi-form-group">
                      <label>Expiration</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        style={{ textAlign: "center" }}
                      />
                    </div>
                    <div className="pdi-form-group">
                      <label>CVC / CVV</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        style={{ textAlign: "center" }}
                      />
                    </div>
                  </div>

                  <div className="pdi-form-group">
                    <label>Code Postal / ZIP</label>
                    <input
                      type="text"
                      placeholder="Ex: 75008, 10001..."
                      value={intlPostalCode}
                      onChange={(e) => setIntlPostalCode(e.target.value)}
                    />
                  </div>

                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6, lineHeight: 1.4 }}>
                    🌐 Traité de manière sécurisée par <strong style={{ color: "#38BDF8" }}>Paddle.com</strong> (Merchant of Record). Chiffrement bancaire TLS 1.3 &amp; conformité TVA locale.
                  </div>
                </div>
              )}
            </div>

            <div className="pdi-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Clé d'activation (si déjà reçue)</label>
                <span style={{ fontSize: 10, color: "#64748B" }}>Optionnel</span>
              </div>
              <input
                type="text"
                placeholder="Ex: PDI-PRO-ABCD-1234"
                value={regActivationKey}
                onChange={(e) => setRegActivationKey(e.target.value)}
              />
            </div>

            <button type="submit" className="pdi-btn-submit" disabled={loading}>
              {loading ? "Traitement et vérification..." : `Valider et Débloquer mon Compte (${regPlan === "trial" ? "Essai 30 Jours" : regPlan.toUpperCase()}) →`}
            </button>
          </form>
        )}

        {/* TAB 3: ACTIVATION */}
        {!passwordRecoveryMode && tab === "activation" && (
          <form onSubmit={handleActivationSubmit}>
            <div style={{ background: "rgba(14, 165, 233, 0.08)", border: "1px solid rgba(14, 165, 233, 0.25)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: "#67E8F9", fontSize: 12, marginBottom: 4 }}>
                🔑 Validation de Licence PD&amp;I
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.4 }}>
                Saisissez la clé d'activation officielle générée par le Super Administrateur pour débloquer votre compte.
              </div>
            </div>

            <div className="pdi-form-group">
              <label>Email du compte associé</label>
              <input
                type="email"
                required
                placeholder="Votre adresse email enregistrée"
                value={actEmail}
                onChange={(e) => setActEmail(e.target.value)}
              />
            </div>

            <div className="pdi-form-group">
              <label>Clé de licence officielle</label>
              <input
                type="text"
                required
                placeholder="PDI-PRO-XXXX-YYYY..."
                value={actKey}
                onChange={(e) => setActKey(e.target.value)}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em", color: "#A7F3D0" }}
              />
            </div>

            <button type="submit" className="pdi-btn-submit" disabled={loading}>
              {loading ? "Activation en cours..." : "Activer et débloquer mon compte →"}
            </button>
          </form>
        )}

        {/* FOOTER INFORMATIONS LÉGALES & TECHNIQUES */}
        <div style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: "1px solid rgba(148, 163, 184, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px 12px",
            fontSize: 10.5,
            color: "#94A3B8"
          }}>
            <button
              type="button"
              onClick={() => setActiveInfoModal("legal")}
              style={{
                background: "none",
                border: "none",
                color: "#94A3B8",
                fontSize: 10.5,
                cursor: "pointer",
                padding: 0,
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
            >
              Mentions Légales &amp; Confidentialité
            </button>
            <span style={{ color: "#475569" }}>•</span>
            <button
              type="button"
              onClick={() => setActiveInfoModal("tech_ref")}
              style={{
                background: "none",
                border: "none",
                color: "#94A3B8",
                fontSize: 10.5,
                cursor: "pointer",
                padding: 0,
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#38BDF8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
            >
              Normes Techniques (ISO / ASME)
            </button>
            <span style={{ color: "#475569" }}>•</span>
            <button
              type="button"
              onClick={() => setActiveInfoModal("payment_terms")}
              style={{
                background: "none",
                border: "none",
                color: "#94A3B8",
                fontSize: 10.5,
                cursor: "pointer",
                padding: 0,
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#FBBF24")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
            >
              Modalités de Paiement
            </button>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#64748B",
            marginTop: 2
          }}>
            <span>PD&amp;I · Pipeline Design &amp; Isometrics © 2026</span>
            <span style={{ fontWeight: 800, color: "#FFFFFF" }}>Powered by ORTHOGONAL - ENG</span>
          </div>
        </div>
      </div>

      {/* HIGH-TECH LOADING OVERLAY ANIMATION DURING LOGIN/REGISTRATION */}
      {loading && (
        <PdiLoginLoadingOverlay
          userEmail={loginEmail || regEmail}
          userName={loginEmail ? loginEmail.split("@")[0] : regName}
          message="Connexion et vérification des accès PD&I..."
        />
      )}

      {/* MODAL SYSTEM: LEGAL, TECH REFS & PAYMENT MODALS */}
      <PdiInfoModals
        activeModal={activeInfoModal}
        onClose={() => setActiveInfoModal(null)}
        userCountryCode={selectedCountry.code}
      />
    </div>
  );
}
