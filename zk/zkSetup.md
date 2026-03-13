
# ZK Circuit Setup and Proof Generation Guide

This guide explains how to compile a Circom circuit and generate a Groth16 proof using **circom + snarkjs**.

The example circuit used here:

```
zk/circuits/polymarket_history.circom
```

Build artifacts are written to:

```
build/
```

---

# 1. Install Dependencies

### Install Node.js (v20 recommended)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:

```bash
node -v
npm -v
```

---

### Install Circom

If not installed:

```bash
cargo install --git https://github.com/iden3/circom.git
```

Verify:

```bash
circom --version
```

---

### Install snarkjs

```bash
npm install -g snarkjs
```

Verify:

```bash
snarkjs --version
```

---

# 2. Install Circuit Dependencies

Your circuit imports **circomlib components** (Poseidon, etc).

Initialize npm and install libraries:

```bash
npm init -y
npm install circomlib circomlibjs
```

This creates:

```
node_modules/circomlib/circuits
```

---

# 3. Project Structure

Example structure:

```
projectx/
│
├─ zk/
│   └─ circuits/
│       └─ polymarket_history.circom
│
├─ build/
│
├─ node_modules/
└─ package.json
```

---

# 4. Compile the Circuit

Create the build directory:

```bash
mkdir -p build
```

Compile the circuit:

```bash
circom zk/circuits/polymarket_history.circom \
  --r1cs \
  --wasm \
  --sym \
  -l ./node_modules \
  -o build
```

Explanation:

| flag       | purpose                    |
| ---------- | -------------------------- |
| `--r1cs`   | constraint system          |
| `--wasm`   | witness generator          |
| `--sym`    | debugging symbols          |
| `-l`       | include path for circomlib |
| `-o build` | output folder              |

Expected output:

```
build/polymarket_history.r1cs
build/polymarket_history.sym
build/polymarket_history_js/polymarket_history.wasm
```

---

# 5. Download Powers of Tau

Groth16 requires a trusted setup.

Download the Phase 1 Powers of Tau file:

```
powersOfTau28_hez_final_22.ptau
```

Example:

```bash
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_22.ptau
```

This file is large (~4.5GB).

---

# 6. Generate Initial ZKey

Create the initial proving key:

```bash
snarkjs groth16 setup \
  build/polymarket_history.r1cs \
  powersOfTau28_hez_final_22.ptau \
  build/polymarket_history_0000.zkey
```

---

# 7. Contribute to the Ceremony

```bash
snarkjs zkey contribute \
  build/polymarket_history_0000.zkey \
  build/polymarket_history_final.zkey \
  --name="First contribution"
```

Optional beacon step:

```bash
snarkjs zkey beacon \
  build/polymarket_history_final.zkey \
  build/polymarket_history_final.zkey \
  0123456789abcdef \
  10
```

---

# 8. Export Verification Key

```bash
snarkjs zkey export verificationkey \
  build/polymarket_history_final.zkey \
  build/verification_key.json
```

---

# 9. Generate Witness

Create an input file:

```
input.json
```

Example:

```json
{
  "someInput": 1
}
```

Generate witness:

```bash
snarkjs wtns calculate \
  build/polymarket_history_js/polymarket_history.wasm \
  input.json \
  build/witness.wtns
```

---

# 10. Generate Proof

```bash
snarkjs groth16 prove \
  build/polymarket_history_final.zkey \
  build/witness.wtns \
  build/proof.json \
  build/public.json
```

Outputs:

```
build/proof.json
build/public.json
```

---

# 11. Verify Proof

```bash
snarkjs groth16 verify \
  build/verification_key.json \
  build/public.json \
  build/proof.json
```

Expected result:

```
OK!
```

---

# 12. Generate Solidity Verifier

```bash
snarkjs zkey export solidityverifier \
  build/polymarket_history_final.zkey \
  build/Verifier.sol
```

Generate calldata:

```bash
snarkjs zkey export soliditycalldata \
  build/public.json \
  build/proof.json
```

This produces parameters for calling the verifier contract.

---

# Final Output Artifacts

```
build/
│
├─ polymarket_history.r1cs
├─ polymarket_history.sym
├─ polymarket_history_js/
│
├─ polymarket_history_final.zkey
├─ verification_key.json
├─ witness.wtns
├─ proof.json
├─ public.json
└─ Verifier.sol
```

---
