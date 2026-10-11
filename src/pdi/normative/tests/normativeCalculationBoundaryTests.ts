import { NormativeEvidenceRegistry } from "../registry/normativeEvidenceRegistry";
import { NormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import {
  NormativeEvidence,
  NormativeVerifiedValue,
} from "../types/normativeEvidenceTypes";
import {
  requireVerifiedNormativeCalculationInput,
  resolveNormativeCalculationInput,
  resolvePressureDesignStress,
  resolveWeldQualityFactor,
  resolveWeldReductionFactor,
  resolveYCoefficient,
} from "../validators/normativeCalculationBoundary";

export function runNormativeCalculationBoundaryTests(): {
  success: boolean;
  testsRun: number;
  results: string[];
} {
  const results: string[] = [];
  let success = true;
  let testsRun = 0;

  const STD = "SYNTHETIC_STANDARD_NORM11";
  const EDT = "SYNTHETIC_EDITION_2026_REV_A";

  function ev(id: string, status: "VERIFIED" | "UNVERIFIED"): NormativeEvidence {
    return {
      evidenceId: id,
      standardId: STD,
      editionId: EDT,
      clauseReference: `SYNTHETIC_CLAUSE_${id}`,
      sourceType: "VERIFIED_INTERNAL_REFERENCE",
      sourceReference: `SYNTHETIC_SOURCE_${id}`,
      verificationStatus: status,
      verifiedBy: status === "VERIFIED" ? `SYNTHETIC_AUDITOR_${id}` : undefined,
      verifiedAt: status === "VERIFIED" ? "2026-01-01T00:00:00.000Z" : undefined,
    };
  }

  function resolverWith(records: readonly NormativeEvidence[]) {
    const r = new NormativeEvidenceRegistry();
    for (const x of records) {
      r.register(x);
    }
    return new NormativeEvidenceResolver(r);
  }

  function vv<T>(
    value: T,
    ids: readonly string[],
    status: "VERIFIED" | "UNVERIFIED" = "VERIFIED"
  ): NormativeVerifiedValue<T> {
    return { value, verificationStatus: status, evidenceIds: ids };
  }

  function ok(c: boolean, m: string) {
    if (!c) throw new Error(m);
  }

  const A = ev("SYNTHETIC_NORM11_EVIDENCE_A_001", "VERIFIED");
  const B = ev("SYNTHETIC_NORM11_EVIDENCE_B_002", "VERIFIED");
  const U = ev("SYNTHETIC_NORM11_EVIDENCE_UNVERIFIED_003", "UNVERIFIED");
  const R = resolverWith([A, B, U]);

  function test(name: string, f: () => void) {
    testsRun++;
    try {
      f();
      results.push(`✅ PASS ${testsRun}: ${name}`);
    } catch (err: any) {
      success = false;
      results.push(`❌ FAIL ${testsRun}: ${name} (${err.message})`);
      throw err;
    }
  }

  test("verified value + verified evidence accepted", () => {
    const x = resolveNormativeCalculationInput(
      { name: "S", verifiedValue: vv(42.5, [A.evidenceId]) },
      R
    );
    ok(x.valid && x.value === 42.5, "expected accepted value");
  });

  test("UNVERIFIED value rejected", () => {
    const x = resolveNormativeCalculationInput(
      { name: "S", verifiedValue: vv(42.5, [A.evidenceId], "UNVERIFIED") },
      R
    );
    ok(!x.valid, "expected rejection");
  });

  test("missing evidence rejected", () => {
    const x = resolveNormativeCalculationInput(
      { name: "S", verifiedValue: vv(42.5, ["SYNTHETIC_NORM11_MISSING"]) },
      R
    );
    ok(!x.valid, "expected rejection");
  });

  test("UNVERIFIED evidence rejected", () => {
    const x = resolveNormativeCalculationInput(
      { name: "S", verifiedValue: vv(42.5, [U.evidenceId]) },
      R
    );
    ok(!x.valid, "expected rejection");
  });

  test("multiple verified evidence accepted", () => {
    const x = resolveNormativeCalculationInput(
      { name: "S", verifiedValue: vv(42.5, [A.evidenceId, B.evidenceId]) },
      R
    );
    ok(x.valid, "expected accepted value");
  });

  test("empty evidence rejected", () => {
    const x = resolveNormativeCalculationInput(
      { name: "S", verifiedValue: vv(42.5, []) },
      R
    );
    ok(!x.valid, "expected rejection");
  });

  test("empty name rejected", () => {
    const x = resolveNormativeCalculationInput(
      { name: " ", verifiedValue: vv(42.5, [A.evidenceId]) },
      R
    );
    ok(!x.valid, "expected rejection");
  });

  test("missing verifiedValue rejected", () => {
    const x = resolveNormativeCalculationInput(
      {
        name: "S",
        verifiedValue: undefined as unknown as NormativeVerifiedValue<number>,
      },
      R
    );
    ok(!x.valid, "expected rejection");
  });

  test("hard guard returns verified value", () => {
    ok(
      requireVerifiedNormativeCalculationInput(
        { name: "S", verifiedValue: vv(138, [A.evidenceId]) },
        R
      ) === 138,
      "wrong value"
    );
  });

  test("hard guard rejects unverified value", () => {
    let threw = false;
    try {
      requireVerifiedNormativeCalculationInput(
        { name: "S", verifiedValue: vv(138, [A.evidenceId], "UNVERIFIED") },
        R
      );
    } catch {
      threw = true;
    }
    ok(threw, "expected throw");
  });

  test("S/E/W/Y adapters accept verified values", () => {
    ok(
      resolvePressureDesignStress(
        { name: "S", verifiedValue: vv(138, [A.evidenceId]) },
        R
      ).valid,
      "S failed"
    );
    ok(
      resolveWeldQualityFactor(
        { name: "E", verifiedValue: vv(1, [A.evidenceId]) },
        R
      ).valid,
      "E failed"
    );
    ok(
      resolveWeldReductionFactor(
        { name: "W", verifiedValue: vv(1, [A.evidenceId]) },
        R
      ).valid,
      "W failed"
    );
    ok(
      resolveYCoefficient(
        { name: "Y", verifiedValue: vv(0.4, [A.evidenceId]) },
        R
      ).valid,
      "Y failed"
    );
  });

  test("fresh registry remains empty", () => {
    ok(
      new NormativeEvidenceRegistry().count() === 0,
      "NORM-11 must not seed normative data"
    );
  });

  return { success, testsRun, results };
}
