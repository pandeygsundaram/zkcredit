# zkCredit ZK Flow (Groth16 + Circom)

This folder contains the ZK circuit for private Polymarket history verification.

## Files
- `circuits/polymarket_history.circom`: score + Merkle inclusion + nullifier circuit.

## Prerequisites
- `circom` 2.1.x
- `snarkjs` latest
- `ptau` file (for example: `powersOfTau28_hez_final_22.ptau`)
- Node deps: `circomlib`, `circomlibjs`

## 1. Compile Circuit
```bash
mkdir -p build
circom circuits/polymarket_history.circom \
  --r1cs --wasm --sym \
  -l ./node_modules \
  -o build
```

## 2. Groth16 Setup
```bash
snarkjs groth16 setup \
  build/polymarket_history.r1cs \
  powersOfTau28_hez_final_22.ptau \
  build/polymarket_history_0000.zkey

snarkjs zkey contribute \
  build/polymarket_history_0000.zkey \
  build/polymarket_history_final.zkey \
  --name="zkcredit phase2"

snarkjs zkey export verificationkey \
  build/polymarket_history_final.zkey \
  build/verification_key.json

snarkjs zkey export solidityverifier \
  build/polymarket_history_final.zkey \
  build/Groth16Verifier.sol
```

## 3. Proof Generation (Agent Side)
1. Build daily tree on oracle:
```bash
curl -X POST http://localhost:8787/build-merkle-tree \
  -H "content-type: application/json" \
  -d '{"agents":[{"agentAddress":"0x28181511c4936928fb14Caad7c6caf34824A3688","proxyAddress":"0x5907A8140D0e2589C5327c39A1bB0f9fDD9e1B26"}]}'
```
2. Run prover:
```bash
AGENT_ADDRESS=0x... \
PROXY_ADDRESS=0x... \
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets \
ORACLE_BASE_URL=http://localhost:8787 \
CIRCUIT_WASM=zk/build/polymarket_history_js/polymarket_history.wasm \
CIRCUIT_ZKEY=zk/build/polymarket_history_final.zkey \
node offchain/agent-prover.js
```

This outputs:
- `pA`, `pB`, `pC`, `publicSignals`
- `rootSignature`

Notes:
- Tree depth is fixed to `20` and must match circuit depth.
- Oracle/prover/circuit leaf schema is canonical:
  - `leaf = Poseidon(proxy, totalVolume, totalPnl, tradeCount)`
  - `tradeCount = number of non-zero timestamps`

## 3b. Quick Witness Smoke Test (Example Input)
Generate a deterministic example input:
```bash
node zk/scripts/generate-input-example.js
```

Then calculate witness directly:
```bash
snarkjs wtns calculate \
  zk/build/polymarket_history_js/polymarket_history.wasm \
  zk/input.example.json \
  zk/build/example.wtns
```

If this succeeds, your circuit + wasm + input shape are aligned.

## 4. On-Chain Submission
Call:
`ZKCreditVerifier.submitZKScore(pA, pB, pC, publicSignals, rootSignature)`

Contract checks:
- Groth16 proof validity
- score in `[300, 850]`
- unused nullifier
- authorized merkle root (mapping or oracle signature)

Then it writes score to `CreditVerifier` via `setScore(...)`.

## 5. Real Verifier Compatibility Check
After generating `proof.json` and `public.json`, validate against deployed verifier:
```bash
RPC_URL=http://127.0.0.1:8545 \
GROTH16_VERIFIER_ADDRESS=0x... \
ZK_CREDIT_VERIFIER_ADDRESS=0x... \
ROOT_SIGNATURE_HEX=0x... \
node offchain/zk-proof-check.js
```

This checks:
- real Groth16 verifier accepts the proof
- `ZKCreditVerifier.submitZKScore(...)` static call does not revert
