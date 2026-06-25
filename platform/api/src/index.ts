// @behuman/api — Backend de la plataforma de opinión (CAPA 2).
//
// La participación NO se gatea por is_verified(address): se gatea con una prueba ZK de
// pertenencia (ver platform/contracts/opinion_board). Acá sólo vive el contenido off-chain
// y el perfil, keyed por `platformId` (seudónimo anónimo). Cero PII, cero address.
//
// El servidor HTTP está en ./server.ts (perfil/username + contenido + feed).
export { app } from "./server.js";
