# Test Flow (Start -> Score -> Loan)

This runbook tests the full zkCredit flow on Base Sepolia from setup to loan approval/open.

## 1. Preflight

From repo root:

```bash
cd /mnt/d/dev/web3/projectx
```

Health check contracts first:

```bash
cd contracts
forge test
cd ..
```

If tests fail, stop and fix before live flow.

## 2. Env Setup

Root `.env` must include at least:

```bash
BASE_SEPOLIA_RPC=...
PRIVATE_KEY=...
USDC_ADDRESS=...

LOAN_MANAGER=0x90f389219b1a51CD474c05dc87b594C288a2e5e0
CREDIT_VERIFIER=0xf59c39DC0E76D002891D36af4Bc03E3b4e70B5e2
STEALTH_REGISTRY=0x55584DC11EFC4e726dDdd3Da258D8336a7d02aED
ZK_CREDIT_VERIFIER_ADDRESS=...
```

For `offchain/oracle-server.js`:

```bash
PORT=8787
RPC_URL=...
ORACLE_PRIVATE_KEY=...
CREDIT_VERIFIER_ADDRESS=...
ZK_CREDIT_VERIFIER_ADDRESS=...

# Polymarket endpoints
POLYMARKET_DATA_API=https://data-api.polymarket.com
POLYMARKET_GAMMA_API=https://gamma-api.polymarket.com
POLYMARKET_TIMEOUT_MS=10000

# Optional fallback
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets
```

## 3. Start Oracle Server

```bash
node offchain/oracle-server.js
```

Expected log:

```text
oracle server listening on 8787
```

## 4. Score Generation (Oracle Path)

Submit a score for the agent:

```bash
curl -X POST http://localhost:8787/submit-score \
  -H "content-type: application/json" \
  -d '{
    "agentAddress":"0xYOUR_AGENT",
    "proxyAddress":"0xYOUR_PROXY",
    "leverageBps":10000
  }'
```

Expected response has:
- `score`
- `leverageBps`
- `proofHash`
- `txHash`

Confirm on-chain record exists:

```bash
cast call $CREDIT_VERIFIER "latestRecords(address)(uint256,uint256,uint256)" 0xYOUR_AGENT --rpc-url $BASE_SEPOLIA_RPC
```

## 5. Quote + Loan Approval/Open (Main Path)

Create `test-flow.js` with this script:

```js
const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const LOAN_MANAGER_ABI = [
  'function getQuote(address[] tokens,uint256[] amounts) view returns (uint256 maxLoan,uint256 collateralRequired,uint8 tier,uint256 leverageMultiplier)',
  'function openLoan(uint256 totalCollateral,uint256 totalPrincipal,address stealthAddress,bytes stealthSignature) returns (bytes32 loanId)',
  'function loans(bytes32) view returns (address agent,address stealthAddress,uint256 scoreAtOpen,uint8 tierAtOpen,uint256 aprBps,uint256 targetPrincipal,uint256 targetCollateral,uint256 releasedPrincipal,uint256 postedCollateral,uint8 phase,uint256 lastPhaseAt,bool active,bool repaid,bool liquidated)',
  'event LoanOpened(bytes32 indexed loanId,address indexed agent,address indexed stealthAddress)'
];

const STEALTH_REGISTRY_ABI = [
  'function registerMetaAddress(bytes32 spendingPubKey) external',
  'function metaAddresses(address) view returns (bytes32)'
];

async function main() {
  const loanManager = new ethers.Contract(process.env.LOAN_MANAGER, LOAN_MANAGER_ABI, wallet);
  const stealthRegistry = new ethers.Contract(process.env.STEALTH_REGISTRY, STEALTH_REGISTRY_ABI, wallet);

  console.log('1) Ensure stealth meta-address');
  const zero = '0x' + '00'.repeat(32);
  const meta = await stealthRegistry.metaAddresses(wallet.address);
  if (meta === zero) {
    const spendingPubKey = ethers.keccak256(ethers.randomBytes(32));
    const tx = await stealthRegistry.registerMetaAddress(spendingPubKey);
    await tx.wait();
    console.log('   Registered');
  } else {
    console.log('   Already registered');
  }

  console.log('2) Get quote');
  const usdc = process.env.USDC_ADDRESS;
  const quote = await loanManager.getQuote([usdc], [ethers.parseUnits('1000', 6)]);
  console.log('   maxLoan:', ethers.formatUnits(quote.maxLoan, 6), 'tier:', Number(quote.tier));

  console.log('3) Create stealth address + signature');
  const nonce = (await provider.getTransactionCount(wallet.address)) + 1;
  const stealthAddress = ethers.getCreateAddress({ from: wallet.address, nonce });
  const digest = ethers.solidityPackedKeccak256(
    ['address', 'bytes32', 'address'],
    [wallet.address, ethers.id('test-loan'), stealthAddress]
  );
  const signature = await wallet.signMessage(ethers.getBytes(digest));

  console.log('4) Open loan');
  const tx = await loanManager.openLoan(
    ethers.parseUnits('1000', 6),
    ethers.parseUnits('500', 6),
    stealthAddress,
    signature
  );
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log) => {
      try {
        return loanManager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((x) => x && x.name === 'LoanOpened');

  if (!event) throw new Error('LoanOpened not found');
  const loanId = event.args.loanId;

  const loan = await loanManager.loans(loanId);
  console.log('   loanId:', loanId);
  console.log('   phase:', Number(loan.phase), 'released:', ethers.formatUnits(loan.releasedPrincipal, 6));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Run:

```bash
node test-flow.js
```

Expected:
- quote succeeds
- `openLoan` tx succeeds
- `LoanOpened` is found
- `loans(loanId)` returns active phase data

## 6. Optional ZK Score Path (If You Want ZK Instead of Oracle Path)

Build root:

```bash
curl -X POST http://localhost:8787/build-merkle-tree \
  -H "content-type: application/json" \
  -d '{
    "agents":[{"agentAddress":"0xYOUR_AGENT","proxyAddress":"0xYOUR_PROXY"}]
  }'
```

Generate proof:

```bash
AGENT_ADDRESS=0xYOUR_AGENT \
PROXY_ADDRESS=0xYOUR_PROXY \
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets \
ORACLE_BASE_URL=http://localhost:8787 \
CIRCUIT_WASM=zk/build/polymarket_history_js/polymarket_history.wasm \
CIRCUIT_ZKEY=zk/build/polymarket_history_final.zkey \
node offchain/agent-prover.js
```

Submit `submitZKScore(pA,pB,pC,publicSignals,rootSignature)` to `ZKCreditVerifier`, then run `test-flow.js` again for quote/open.

## 7. Post-Open Checks

- read loan state:

```bash
cast call $LOAN_MANAGER "loans(bytes32)(address,address,uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint8,uint256,bool,bool,bool)" 0xYOUR_LOAN_ID --rpc-url $BASE_SEPOLIA_RPC
```

- monitor events:

```bash
node monitor.js
```

## 8. Acceptance Checklist

- `forge test` passes
- `/submit-score` returns score and on-chain record is updated
- `getQuote` returns non-zero max loan
- `openLoan` succeeds and emits `LoanOpened`
- loan exists in `loans(loanId)` with expected phase/released fields
- optional: ZK path (`build-merkle-tree` -> prove -> `submitZKScore`) succeeds
