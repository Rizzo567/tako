// Schema CLOUD (control-plane identità). Tabelle prefissate `cloud_*`.
// ISOLAMENTO: questo index NON è esportato da src/schema/index.ts (locale).
// Va importato esplicitamente solo dal backend in modo cloud (TAKO_MODE=cloud).
// Vedi MASTER_PLAN-cloud-auth §3.1 e §2.1.
export * from './owners.js'
export * from './tokens.js'
export * from './sessions.js'
export * from './restaurants.js'
export * from './audit.js'
