/**
 * server/engine/strategy.js — thin strategy helpers.
 *
 * Validation / normalization / presets are owned by shared/contract.js; this
 * module only re-exports them so engine code and tests have one import site.
 */
export {
  DEFAULT_STRATEGY,
  STRATEGY_PRESETS,
  STRATEGY_VERSION,
  validateStrategy,
  normalizeStrategy,
  deepMerge,
  clone,
} from "../../shared/contract.js";

import { normalizeStrategy, validateStrategy } from "../../shared/contract.js";

/**
 * Resolve a partial override on top of a full strategy.
 * @param {object} base
 * @param {object} patch
 * @param {{strict?: boolean}} [opts] strict => throw on validation errors
 */
export function resolveStrategy(base, patch, opts = {}) {
  const merged = normalizeStrategy({ ...base, ...patch });
  const check = validateStrategy(merged);
  if (opts.strict && !check.valid) {
    const error = new Error(`策略校验失败：${check.errors.join("；")}`);
    error.code = "INVALID_STRATEGY";
    error.details = check.errors;
    throw error;
  }
  return check;
}
