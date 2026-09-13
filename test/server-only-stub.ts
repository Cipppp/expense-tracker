/*
 * `server-only` e un pachet care crapa intentionat daca ajunge in bundle-ul de
 * client. In teste nu exista bundle, doar Node, iar importul n-ar avea ce
 * rezolva — asa ca e inlocuit cu nimic. Vezi alias-ul din vitest.config.ts.
 */
export {};
