import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Capa1Credential } from "@behuman/shared";
import {
  addressHashField,
  generateProof,
  nullifierField,
  verifyProofLocally,
  buildVerifyArgs,
} from "./index.js";
import { poseidon1, poseidon3, circuitsBuildDir } from "./poseidonBls.js";
import { buildTree, merkleProof } from "./merkle.js";
import { g1ToBytes, g2ToBytes, encodeProof } from "./blsEncode.js";

const hex = (a: Uint8Array) => Buffer.from(a).toString("hex");

describe("blsEncode (formato zcash big-endian, validado vs ark)", () => {
  it("G1 = BE(x)‖BE(y)", () => {
    const alpha: [string, string] = [
      "1997681254063098102123329509308268375069642767770300126918848771878756139532931617477074978719036262400663338354582",
      "1094730072833072412548519435715222530945982222020673345824546685714501508251910201195840354119719238960459618183789",
    ];
    expect(hex(g1ToBytes(alpha))).toBe(
      "0cfaaca7c155468b1838a7adfcc70b89c20eec64608bf8d3b262795175802966ea87e997a947ba1cc7b12f32868c0796071cd3ab27e0cd52cf5eb7aa1f8f5e578bffe724f26517c335425636ed2b2bdbace2bbc63f50543b951085eddf23ea6d",
    );
  });

  it("G2 = BE(x_c1)‖BE(x_c0)‖BE(y_c1)‖BE(y_c0)", () => {
    const beta: [string[], string[]] = [
      [
        "2960546352061553643417526639455729050292923284117591315264527796885872513449081742697942449459825738882250505757380",
        "2522153864088687969812342359172526951301685587065423197852006805694100493254347670673887037544133614227933897050558",
      ],
      [
        "1639904864291447128123532788489029798690423741490216413978405282468186876718999509894446515481587071006232430144436",
        "1272970963840655757888111087036638270797827109106602463635908395039125058482985428353931934821386097537714334579273",
      ],
    ];
    expect(hex(g2ToBytes(beta))).toBe(
      "106302fc82293e634549b6e6de12cb40959e332dc618a1242ffd784a39469d7caa75509ffd8ac19d030508ea9b0249be133c2cbf459ed157b9b8ad767b07b28bd646b795a1853f37e6ad6e9e8fa426a3b669cb6e2acf31e74bd14173e360a2c4084549ec954a76e9b9872ef037bbe32f9c0c462a00832683b0e4801934fe38af41bfb99d1d4ee170932343418905ba490aa798e7c59676eecb1f179dd8b30770779ead0b492527c96c77cb09593511880a9a920491b69432ccf3fc077cc26bb4",
    );
  });
});

describe("addressHashField (réplica del contrato)", () => {
  it("coincide con address_field_hash del FIXED_ADDR de los tests del contrato", () => {
    const G = "GDYQS2PJTNNCJDYXHU4XQ57VQU6FHPTKCJMM7WG5NUHRZIT6SXAYKIJI";
    const expected = BigInt(
      "0x10e9d1ddcad4c8c5704478d82ade79b1f1f332d55784de8caf503d1001c751ba",
    ).toString();
    expect(addressHashField(G)).toBe(expected);
  });
});

describe("poseidon bls (idéntico al circuito)", () => {
  it("commitment = Poseidon(1995, 32, secret)", async () => {
    const secret = "1234567890123456789012345678901234567890";
    const c = await poseidon3("1995", "32", secret);
    expect(c.toString()).toBe(
      "36994699823721141971394725509675585589277291566104333993581842441978584684119",
    );
  });

  it("nullifier = Poseidon(secret) — global anti-Sybil (sin addressHash)", async () => {
    const secret = "1234567890123456789012345678901234567890";
    const nf = await poseidon1(secret);
    expect(await nullifierField(secret)).toBe(nf.toString());
    // TODO: golden del nullifier — regenerar tras recompilar kyc.circom + poseidon1.circom
  });
});

// End-to-end del puente off-chain: credencial -> árbol -> prueba -> verify (snarkjs).
describe("puente off-chain (credencial -> prueba ZK)", () => {
  it("genera una prueba cuyo issuerRoot = root del árbol y verifica con snarkjs", async () => {
    const G = "GDYQS2PJTNNCJDYXHU4XQ57VQU6FHPTKCJMM7WG5NUHRZIT6SXAYKIJI";
    const secret = "987654321098765432109876543210";
    const attributes = { birthYear: 1990, countryCode: 32 };

    const commitment = await poseidon3(attributes.birthYear, attributes.countryCode, secret);
    const tree = await buildTree([commitment]); // 1 humano verificado en el árbol
    const path = merkleProof(tree, 0);

    const credential: Capa1Credential = {
      attributes,
      secret,
      commitment: commitment.toString(),
      issuerRoot: tree.root.toString(),
      pathElements: path.pathElements.map(String),
      pathIndices: path.pathIndices,
    };

    const gen = await generateProof(credential, G);

    // publicSignals = [commitment, nullifier, issuerRoot, addressHash]
    expect(gen.publicSignals[0]).toBe(commitment.toString());
    expect(gen.publicSignals[1]).toBe(await nullifierField(secret)); // Poseidon(secret), no address
    expect(gen.publicSignals[2]).toBe(tree.root.toString()); // el circuito calcula el mismo root
    expect(gen.publicSignals[3]).toBe(addressHashField(G));

    const vk = JSON.parse(
      readFileSync(resolve(circuitsBuildDir(), "verification_key.json"), "utf8"),
    );
    expect(await verifyProofLocally(gen, vk)).toBe(true);

    // Encoding para el contrato.
    const enc = encodeProof(gen.proof);
    expect(enc.a.length).toBe(96);
    expect(enc.b.length).toBe(192);
    expect(enc.c.length).toBe(96);
    expect(buildVerifyArgs(G, gen).length).toBe(3);
  }, 60_000);
});
