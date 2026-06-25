// build/{verification_key,proof,public}.json -> opinion_board/src/testdata.rs
// (mismo formato que identity/circuits/scripts/gen_testdata.mjs; 3 public signals).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, "..", "build");
const vk = JSON.parse(readFileSync(join(build, "verification_key.json")));
const proof = JSON.parse(readFileSync(join(build, "proof.json")));
const pub = JSON.parse(readFileSync(join(build, "public.json")));

const g1 = (p) => [p[0], p[1]];
const g2 = (p) => [p[0][0], p[0][1], p[1][0], p[1][1]];
const strArr = (a) => "[" + a.map((s) => `"${s}"`).join(", ") + "]";
const icRust = "[\n" + vk.IC.map((p) => "        " + strArr(g1(p))).join(",\n") + ",\n    ]";
const toBytes32 = (dec) => {
  const hex = BigInt(dec).toString(16).padStart(64, "0");
  const out = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
};
const pubRust = "[\n" + pub.map((d) => "        [" + toBytes32(d).join(", ") + "]").join(",\n") + ",\n    ]";

const out = `//! AUTO-GENERADO por platform/circuits/scripts/gen_testdata.mjs — NO editar.
//! Artefactos ZK (BLS12-381) del circuito de plataforma para los tests del contrato.
//! Public signals: [issuerRoot, platformId, contentHash].
#![allow(dead_code)]

pub const VK_ALPHA: [&str; 2] = ${strArr(g1(vk.vk_alpha_1))};
pub const VK_BETA: [&str; 4] = ${strArr(g2(vk.vk_beta_2))};
pub const VK_GAMMA: [&str; 4] = ${strArr(g2(vk.vk_gamma_2))};
pub const VK_DELTA: [&str; 4] = ${strArr(g2(vk.vk_delta_2))};
pub const VK_IC: [[&str; 2]; ${vk.IC.length}] = ${icRust};

pub const PROOF_A: [&str; 2] = ${strArr(g1(proof.pi_a))};
pub const PROOF_B: [&str; 4] = ${strArr(g2(proof.pi_b))};
pub const PROOF_C: [&str; 2] = ${strArr(g1(proof.pi_c))};

/// [issuerRoot, platformId, contentHash] big-endian (32 c/u).
pub const PUBLIC_SIGNALS: [[u8; 32]; 3] = ${pubRust};
`;

const dst = join(here, "..", "..", "contracts", "opinion_board", "src", "testdata.rs");
writeFileSync(dst, out);
console.log("OK:", dst);
