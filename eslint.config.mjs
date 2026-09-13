import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/*
 * `next lint` a dispărut în Next 16, iar scriptul care-l chema pica de la
 * sine — deci linting nu mai rula de ceva vreme, în tăcere. ESLint se cheamă
 * acum direct, cu aceleași reguli pe care le aducea Next.
 */
export default [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "prisma/migrations/**"],
  },
  ...coreWebVitals,
  ...typescript,
];
