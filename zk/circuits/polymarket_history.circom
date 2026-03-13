pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template Select() {
    signal input b; // 0 or 1
    signal input x;
    signal input y;
    signal output out;

    b * (b - 1) === 0;
    out <== y + b * (x - y);
}

template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    signal hash[depth + 1];
    hash[0] <== leaf;

    component chooseL[depth];
    component chooseR[depth];
    component h[depth];

    for (var i = 0; i < depth; i++) {
        chooseL[i] = Select();
        chooseR[i] = Select();

        chooseL[i].b <== pathIndices[i];
        chooseR[i].b <== pathIndices[i];

        chooseL[i].x <== pathElements[i];
        chooseL[i].y <== hash[i];
        chooseR[i].x <== hash[i];
        chooseR[i].y <== pathElements[i];

        h[i] = Poseidon(2);
        h[i].inputs[0] <== chooseL[i].out;
        h[i].inputs[1] <== chooseR[i].out;
        hash[i + 1] <== h[i].out;
    }

    root <== hash[depth];
}

/**
 * Private inputs:
 * - proxy
 * - fixed-size trade arrays
 * - merkle path
 * Public outputs:
 * - score (300-850)
 * - merkleRoot
 * - nullifier
 */
template PolymarketHistory(maxTrades, depth) {
    signal input proxy;
    signal input volumes[maxTrades];
    signal input pnls[maxTrades];
    signal input timestamps[maxTrades];
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal output score;
    signal output merkleRoot;
    signal output nullifier;

    signal used[maxTrades];
    component isz[maxTrades];

    signal totalVolume[maxTrades + 1];
    signal totalPnl[maxTrades + 1];
    signal tradeCount[maxTrades + 1];
    totalVolume[0] <== 0;
    totalPnl[0] <== 0;
    tradeCount[0] <== 0;

    for (var i = 0; i < maxTrades; i++) {
        isz[i] = IsZero();
        isz[i].in <== timestamps[i];
        used[i] <== 1 - isz[i].out; // timestamp != 0

        totalVolume[i + 1] <== totalVolume[i] + (volumes[i] * used[i]);
        totalPnl[i + 1] <== totalPnl[i] + (pnls[i] * used[i]);
        tradeCount[i + 1] <== tradeCount[i] + used[i];
    }

    signal vol;
    signal pnl;
    signal cnt;
    vol <== totalVolume[maxTrades];
    pnl <== totalPnl[maxTrades];
    cnt <== tradeCount[maxTrades];

    // Tiered terms to avoid non-integer division in-circuit.
    component volGe1m = LessThan(64);  volGe1m.in[0] <== vol; volGe1m.in[1] <== 1000000;
    component volGe10m = LessThan(64); volGe10m.in[0] <== vol; volGe10m.in[1] <== 10000000;
    component volGe100m = LessThan(64); volGe100m.in[0] <== vol; volGe100m.in[1] <== 100000000;

    component pnlGe100k = LessThan(64); pnlGe100k.in[0] <== pnl; pnlGe100k.in[1] <== 100000;
    component pnlGe500k = LessThan(64); pnlGe500k.in[0] <== pnl; pnlGe500k.in[1] <== 500000;
    component pnlGe1m = LessThan(64);   pnlGe1m.in[0] <== pnl; pnlGe1m.in[1] <== 1000000;

    component cntGe10 = LessThan(16); cntGe10.in[0] <== cnt; cntGe10.in[1] <== 10;
    component cntGe50 = LessThan(16); cntGe50.in[0] <== cnt; cntGe50.in[1] <== 50;
    component cntGe100 = LessThan(16); cntGe100.in[0] <== cnt; cntGe100.in[1] <== 100;

    signal volumeTerm;
    signal pnlTerm;
    signal tradeTerm;

    volumeTerm <== (1 - volGe1m.out) * 20 + (1 - volGe10m.out) * 30 + (1 - volGe100m.out) * 50;
    pnlTerm <== (1 - pnlGe100k.out) * 30 + (1 - pnlGe500k.out) * 50 + (1 - pnlGe1m.out) * 70;
    tradeTerm <== (1 - cntGe10.out) * 20 + (1 - cntGe50.out) * 30 + (1 - cntGe100.out) * 30;

    signal rawScore;
    rawScore <== 300 + volumeTerm + pnlTerm + tradeTerm;

    component rawLtMin = LessThan(16); rawLtMin.in[0] <== rawScore; rawLtMin.in[1] <== 300;
    component maxLtRaw = LessThan(16); maxLtRaw.in[0] <== 850; maxLtRaw.in[1] <== rawScore;

    signal lowClamped;
    lowClamped <== rawLtMin.out * 300 + (1 - rawLtMin.out) * rawScore;
    score <== maxLtRaw.out * 850 + (1 - maxLtRaw.out) * lowClamped;

    // Leaf binds proxy + aggregated history.
    component leafHash = Poseidon(4);
    leafHash.inputs[0] <== proxy;
    leafHash.inputs[1] <== vol;
    leafHash.inputs[2] <== pnl;
    leafHash.inputs[3] <== cnt;

    component merkle = MerkleInclusion(depth);
    merkle.leaf <== leafHash.out;
    for (var d = 0; d < depth; d++) {
        merkle.pathElements[d] <== pathElements[d];
        merkle.pathIndices[d] <== pathIndices[d];
    }
    merkleRoot <== merkle.root;

    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== proxy;

    nullifierHash.inputs[1] <== merkleRoot;
    nullifier <== nullifierHash.out;
}

template Main(maxTrades, depth) {
    // Private witness inputs
    signal input proxy;
    signal input volumes[maxTrades];
    signal input pnls[maxTrades];
    signal input timestamps[maxTrades];
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Public inputs (become Groth16 public signals)
    signal input score;
    signal input merkleRoot;
    signal input nullifier;

    component c = PolymarketHistory(maxTrades, depth);
    c.proxy <== proxy;
    for (var i = 0; i < maxTrades; i++) {
        c.volumes[i] <== volumes[i];
        c.pnls[i] <== pnls[i];
        c.timestamps[i] <== timestamps[i];
    }
    for (var d = 0; d < depth; d++) {
        c.pathElements[d] <== pathElements[d];
        c.pathIndices[d] <== pathIndices[d];
    }

    // Constrain computed values to supplied public values.
    c.score === score;
    c.merkleRoot === merkleRoot;
    c.nullifier === nullifier;
}

component main {public [score, merkleRoot, nullifier]} = Main(32, 20);
