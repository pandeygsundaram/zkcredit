const fs = require('fs');
const { ethers } = require('ethers');

/**
 * Verifies real Groth16 proof compatibility against deployed verifier contracts.
 *
 * Required env:
 * - RPC_URL
 * - GROTH16_VERIFIER_ADDRESS
 *
 * Optional env:
 * - ZK_CREDIT_VERIFIER_ADDRESS (if set, also dry-runs submitZKScore via callStatic)
 * - ROOT_SIGNATURE_HEX
 */

async function main() {
  const rpc = process.env.RPC_URL;
  const groth16Addr = process.env.GROTH16_VERIFIER_ADDRESS;
  const zkCreditAddr = process.env.ZK_CREDIT_VERIFIER_ADDRESS;
  const rootSig = process.env.ROOT_SIGNATURE_HEX || '0x';

  if (!rpc || !groth16Addr) {
    throw new Error('Missing env: RPC_URL, GROTH16_VERIFIER_ADDRESS');
  }

  const proof = JSON.parse(fs.readFileSync(process.env.PROOF_JSON || 'proof.json', 'utf8'));
  const publicSignals = JSON.parse(fs.readFileSync(process.env.PUBLIC_JSON || 'public.json', 'utf8'));

  const pA = [proof.pi_a[0], proof.pi_a[1]];
  const pB = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]]
  ];
  const pC = [proof.pi_c[0], proof.pi_c[1]];

  const provider = new ethers.JsonRpcProvider(rpc);

  const groth16 = new ethers.Contract(
    groth16Addr,
    ['function verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[]) view returns (bool)'],
    provider
  );
  const ok = await groth16.verifyProof(pA, pB, pC, publicSignals);
  console.log(JSON.stringify({ groth16VerifyOk: ok }, null, 2));
  if (!ok) process.exit(2);

  if (zkCreditAddr) {
    const zkCredit = new ethers.Contract(
      zkCreditAddr,
      ['function submitZKScore(uint256[2],uint256[2][2],uint256[2],uint256[],bytes)'],
      provider
    );
    await zkCredit.submitZKScore.staticCall(pA, pB, pC, publicSignals, rootSig);
    console.log(JSON.stringify({ zkCreditStaticCall: 'ok' }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

