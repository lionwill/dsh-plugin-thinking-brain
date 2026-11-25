/**
 * Host half of the thinking-effort bundle.
 *
 * The feature is entirely a browser-side seat: it reads the Session's shared
 * model-selection directory and submits through the same `select` call the
 * built-in model menu uses, so no Host service, tool, or configuration is
 * needed here. The empty `apply` keeps the package a normal plugin row that
 * Plugins can enable, disable, and report on.
 */
export function apply() {}
