const { ethers } = require('ethers');
require('dotenv').config();

const ORACLE_BASE_URL = process.env.ORACLE_BASE_URL || 'http://localhost:8787';
const MIN_LOAN_USDC_6 = 500_000_000n; // 500 USDC (6 decimals)
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const LOAN_MANAGER_ABI = [
  'function getQuote(address[] tokens,uint256[] amounts) view returns (uint256 maxPrincipal,uint8 tier,uint256 aprBps,uint256 leverageMultiplier)',
  'function loanCounter() view returns (uint256)',
  'function openLoan(address[] collateralTokens,uint256[] collateralAmounts,uint256 totalPrincipal,address stealthAddress,bytes attestOrSignature) returns (bytes32 loanId)',
  'function loans(bytes32) view returns (address agent,address stealthAddress,uint256 scoreAtOpen,uint8 tierAtOpen,uint256 aprBps,uint256 targetPrincipal,uint256 targetCollateral,uint256 releasedPrincipal,uint256 postedCollateral,uint8 phase,uint256 lastPhaseAt,bool active,bool repaid,bool liquidated)',
  'event LoanOpened(bytes32 indexed loanId,address indexed agent,address indexed stealthAddress)'
];

const STEALTH_REGISTRY_ABI = [
  'function registerMetaAddress(bytes32 spendingPubKey) external'
];

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}: ${JSON.stringify(data)}`);
  }
  return data;
}

function ceilDiv(a, b) {
  return (a + b - 1n) / b;
}

async function main() {
  console.log('test-flow.js version: 2026-03-14-guard-v2');
  mustEnv('BASE_SEPOLIA_RPC');
  mustEnv('PRIVATE_KEY');
  mustEnv('USDC_ADDRESS');
  mustEnv('LOAN_MANAGER');
  mustEnv('STEALTH_REGISTRY');

  const scoreProxyAddress = process.env.SCORE_PROXY_ADDRESS || wallet.address;
  if (!ethers.isAddress(scoreProxyAddress)) {
    throw new Error('Invalid SCORE_PROXY_ADDRESS');
  }

  const collateralStr = process.env.TEST_COLLATERAL_USDC || '1000';
  const principalPct = Number(process.env.TEST_PRINCIPAL_PCT || '50');
  if (!(principalPct > 0 && principalPct <= 100)) {
    throw new Error('TEST_PRINCIPAL_PCT must be in (0,100]');
  }

  const loanManager = new ethers.Contract(process.env.LOAN_MANAGER, LOAN_MANAGER_ABI, wallet);
  const stealthRegistry = new ethers.Contract(process.env.STEALTH_REGISTRY, STEALTH_REGISTRY_ABI, wallet);

  console.log('1) Submit oracle score for wallet agent using selected proxy history');
  const scoreResp = await postJson(`${ORACLE_BASE_URL}/submit-score`, {
    agentAddress: wallet.address,
    proxyAddress: scoreProxyAddress,
    leverageBps: 10000
  });
  console.log(`   score=${scoreResp.score} tx=${scoreResp.txHash}`);

  console.log('2) Fetch quote from oracle endpoint');
  let collateralUnits = ethers.parseUnits(collateralStr, 6);
  let quoteResp = await postJson(`${ORACLE_BASE_URL}/get-quote`, {
    agentAddress: wallet.address,
    collateralTokens: [process.env.USDC_ADDRESS],
    collateralAmounts: [collateralUnits.toString()]
  });
  console.log(`   tier=${quoteResp.tier} apr=${quoteResp.aprPercent} max=${quoteResp.maxPrincipalFormatted}`);

  let quotedMaxPrincipal = BigInt(quoteResp.maxPrincipal);
  if (quotedMaxPrincipal > 0n && quotedMaxPrincipal < MIN_LOAN_USDC_6) {
    const scaledCollateral = ceilDiv(collateralUnits * MIN_LOAN_USDC_6, quotedMaxPrincipal);
    collateralUnits = scaledCollateral;
    console.log(
      `   quote below min loan; retrying with collateral=${ethers.formatUnits(collateralUnits, 6)} USDC`
    );
    quoteResp = await postJson(`${ORACLE_BASE_URL}/get-quote`, {
      agentAddress: wallet.address,
      collateralTokens: [process.env.USDC_ADDRESS],
      collateralAmounts: [collateralUnits.toString()]
    });
    quotedMaxPrincipal = BigInt(quoteResp.maxPrincipal);
    console.log(`   retry tier=${quoteResp.tier} apr=${quoteResp.aprPercent} max=${quoteResp.maxPrincipalFormatted}`);
  }

  console.log('3) Ensure stealth meta-address exists');
  try {
    const spendingPubKey = ethers.keccak256(ethers.randomBytes(32));
    const tx = await stealthRegistry.registerMetaAddress(spendingPubKey);
    await tx.wait();
    console.log(`   registered tx=${tx.hash}`);
  } catch (e) {
    const msg = (e?.shortMessage || e?.message || '').toLowerCase();
    if (msg.includes('already registered')) {
      console.log('   already registered');
    } else {
      console.log('   registration skipped (will still try openLoan)');
    }
  }

  console.log('4) Open loan');
  const totalCollateral = collateralUnits;
  const requestedPrincipal = (totalCollateral * BigInt(principalPct)) / 100n;
  const totalPrincipal = requestedPrincipal > quotedMaxPrincipal ? quotedMaxPrincipal : requestedPrincipal;
  if (totalPrincipal <= 0n) {
    throw new Error('Quoted max principal is zero; cannot open loan');
  }
  if (quotedMaxPrincipal < MIN_LOAN_USDC_6) {
    throw new Error(
      `Quoted max principal is ${ethers.formatUnits(quotedMaxPrincipal, 6)} USDC, below protocol minimum 500 USDC. ` +
      'Increase collateral or improve score/tier before opening a loan.'
    );
  }
  if (totalPrincipal < MIN_LOAN_USDC_6) {
    throw new Error(
      `Selected principal is ${ethers.formatUnits(totalPrincipal, 6)} USDC, below protocol minimum 500 USDC. ` +
      'Increase TEST_COLLATERAL_USDC or TEST_PRINCIPAL_PCT.'
    );
  }
  console.log(
    `   requested=${ethers.formatUnits(requestedPrincipal, 6)} USDC, using=${ethers.formatUnits(totalPrincipal, 6)} USDC`
  );
  const chainId = (await provider.getNetwork()).chainId;
  const nextLoanCounter = (await loanManager.loanCounter()) + 1n;
  const expectedLoanId = ethers.keccak256(
    ethers.solidityPacked(['address', 'uint256', 'uint256'], [wallet.address, chainId, nextLoanCounter])
  );
  const stealthAddress = wallet.address;
  const linkMessage = ethers.keccak256(
    ethers.solidityPacked(['address', 'bytes32', 'uint256', 'address'], [wallet.address, expectedLoanId, chainId, process.env.STEALTH_REGISTRY])
  );
  const signature = await wallet.signMessage(ethers.getBytes(linkMessage));

  const openTx = await loanManager.openLoan(
    [process.env.USDC_ADDRESS],
    [totalCollateral],
    totalPrincipal,
    stealthAddress,
    signature
  );
  const receipt = await openTx.wait();

  const event = receipt.logs
    .map((log) => {
      try {
        return loanManager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((x) => x && x.name === 'LoanOpened');

  if (!event) {
    throw new Error('LoanOpened not found in receipt logs');
  }
  const loanId = event.args.loanId;
  const loan = await loanManager.loans(loanId);

  console.log(`   loanId=${loanId}`);
  console.log(`   phase=${Number(loan.phase)} released=${ethers.formatUnits(loan.releasedPrincipal, 6)} USDC`);
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
