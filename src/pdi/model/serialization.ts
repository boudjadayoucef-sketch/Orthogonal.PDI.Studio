import type { PdiIsometricModel } from './index';

export const PDI_MODEL_SCHEMA_VERSION = '1.0' as const;

export function serializePdiModel(model: PdiIsometricModel): string {
  return JSON.stringify(model, null, 2);
}

export function parsePdiModel(input: string): PdiIsometricModel {
  const value: unknown = JSON.parse(input);

  if (!value || typeof value !== 'object') {
    throw new Error('Invalid PD&I model: expected an object.');
  }

  const model = value as Partial<PdiIsometricModel>;
  if (model.schemaVersion !== PDI_MODEL_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported PD&I model schema: ${String(model.schemaVersion)}.`,
    );
  }

  if (!Array.isArray(model.lines)) {
    throw new Error('Invalid PD&I model: lines must be an array.');
  }

  return model as PdiIsometricModel;
}
