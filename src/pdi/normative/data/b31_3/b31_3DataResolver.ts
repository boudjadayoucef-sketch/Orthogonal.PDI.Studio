/**
 * PDI NORMATIVE ENGINE — ASME B31.3 DATA RESOLVER
 * Reference: B31.3-02 (Controlled Normative Data Ingestion)
 * 
 * Résolveur déterministe pour la consultation et la vérification des données normatives ASME B31.3.
 * 
 * RÈGLES STRICTES (B31.3-02) :
 * 1. Résolution EXCLUSIVEMENT par dataId exact :
 *    - Ne recherche JAMAIS par texte approximatif ou nom de matériau.
 *    - Ne recherche JAMAIS par token heuristique.
 * 2. Aucune transformation ou conversion automatique :
 *    - Ne convertit JAMAIS d'unités (ex: MPa → ksi) automatiquement.
 *    - Ne convertit JAMAIS d'éditions ou de révisions.
 *    - Ne déduit JAMAIS une clause ou un paragraphe.
 * 3. Aucune promotion de statut :
 *    - Ne promeut JAMAIS UNVERIFIED vers FOUND_VERIFIED.
 * 4. Strictement déterministe et immuable.
 */

import type {
  B31_3NormativeDataRecord,
  B31_3DataResolutionResult,
  B31_3DataSetResolutionResult,
} from "../../types/b31_3DataTypes";
import type { IB31_3DataRegistry } from "./b31_3DataRegistry";
import { defaultB31_3DataRegistry } from "./b31_3DataRegistry";
import { isDisallowedTokenHeuristic } from "../../validators/normativeEvidenceValidator";
import { validateB31_3DataRecordStructure } from "./b31_3DataValidator";

export interface IB31_3DataResolver {
  resolveData<T = unknown>(dataId: string): B31_3DataResolutionResult<T>;
  resolveDataSet<T = unknown>(
    dataIds: readonly string[]
  ): B31_3DataSetResolutionResult<T>;
  createLookupFunction<T = unknown>(): (
    dataId: string
  ) => B31_3NormativeDataRecord<T> | undefined;
}

export class B31_3DataResolver implements IB31_3DataResolver {
  constructor(
    private readonly registry: IB31_3DataRegistry = defaultB31_3DataRegistry
  ) {}

  /**
   * Résout une donnée B31.3 par son identifiant unique exact.
   */
  public resolveData<T = unknown>(dataId: string): B31_3DataResolutionResult<T> {
    if (typeof dataId !== "string" || dataId.trim().length === 0) {
      return {
        dataId: String(dataId),
        status: "INVALID",
        message: "dataId must be a non-empty string.",
      };
    }

    const trimmed = dataId.trim();

    if (isDisallowedTokenHeuristic(trimmed)) {
      return {
        dataId: trimmed,
        status: "INVALID",
        message: `Token '${trimmed}' is a heuristic token and cannot be resolved as normative data.`,
      };
    }

    const record = this.registry.get<T>(trimmed);
    if (!record) {
      return {
        dataId: trimmed,
        status: "NOT_FOUND",
        message: `Normative data record with id '${trimmed}' was not found in registry.`,
      };
    }

    // Validation structurelle de sécurité
    const val = validateB31_3DataRecordStructure(record);
    if (!val.valid) {
      return {
        dataId: trimmed,
        status: "INVALID",
        record,
        message: `Data record with id '${trimmed}' is structurally invalid: ${val.errors
          .map((e) => e.message)
          .join("; ")}`,
      };
    }

    if (record.status === "VERIFIED") {
      return {
        dataId: trimmed,
        status: "FOUND_VERIFIED",
        record,
        message: "Normative data record found and confirmed as VERIFIED.",
      };
    }

    return {
      dataId: trimmed,
      status: "FOUND_UNVERIFIED",
      record,
      message:
        "Normative data record found but has UNVERIFIED status. Cannot be used as verified calculation baseline.",
    };
  }

  /**
   * Résout un ensemble de données B31.3 et fournit un bilan consolidé.
   */
  public resolveDataSet<T = unknown>(
    dataIds: readonly string[]
  ): B31_3DataSetResolutionResult<T> {
    if (!Array.isArray(dataIds)) {
      return {
        allFound: false,
        allVerified: false,
        valid: false,
        totalRequested: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        notFoundCount: 0,
        invalidCount: 1,
        results: [
          {
            dataId: "",
            status: "INVALID",
            message: "dataIds must be an array of strings.",
          },
        ],
      };
    }

    const results: B31_3DataResolutionResult<T>[] = [];
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let notFoundCount = 0;
    let invalidCount = 0;

    for (const did of dataIds) {
      const res = this.resolveData<T>(did);
      results.push(res);

      switch (res.status) {
        case "FOUND_VERIFIED":
          verifiedCount++;
          break;
        case "FOUND_UNVERIFIED":
          unverifiedCount++;
          break;
        case "NOT_FOUND":
          notFoundCount++;
          break;
        case "INVALID":
          invalidCount++;
          break;
      }
    }

    const totalRequested = dataIds.length;
    const allFound =
      totalRequested > 0 && notFoundCount === 0 && invalidCount === 0;
    const allVerified = totalRequested > 0 && verifiedCount === totalRequested;
    const valid = invalidCount === 0;

    return {
      allFound,
      allVerified,
      valid,
      totalRequested,
      verifiedCount,
      unverifiedCount,
      notFoundCount,
      invalidCount,
      results: Object.freeze(results),
    };
  }

  /**
   * Crée une fonction de lookup prête à l'emploi.
   */
  public createLookupFunction<T = unknown>(): (
    dataId: string
  ) => B31_3NormativeDataRecord<T> | undefined {
    return (dataId: string): B31_3NormativeDataRecord<T> | undefined => {
      const res = this.resolveData<T>(dataId);
      if (res.status === "FOUND_VERIFIED" || res.status === "FOUND_UNVERIFIED") {
        return res.record;
      }
      return undefined;
    };
  }
}

/**
 * Instance singleton globale du résolveur de données B31.3.
 */
export const defaultB31_3DataResolver = new B31_3DataResolver(
  defaultB31_3DataRegistry
);
