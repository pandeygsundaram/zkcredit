// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BitGoRegistry
 * @notice Registers BitGo wallets and verifies BitGo attestations.
 */
contract BitGoRegistry {
    address public owner;
    address public bitGoVerifier;

    mapping(address => bytes32) public walletIds;
    mapping(bytes32 => address) public walletToAgent;
    mapping(address => bool) public isBitGoVerified;
    mapping(bytes32 => bool) public usedAttestations;

    event BitGoVerifierUpdated(address indexed verifier);
    event WalletLinked(address indexed agent, bytes32 indexed walletId);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address verifier_) {
        require(verifier_ != address(0), "invalid verifier");
        owner = msg.sender;
        bitGoVerifier = verifier_;
    }

    /// @notice Updates the BitGo verifier signer used for attestation checks.
    /// @param verifier New verifier address.
    function setBitGoVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "invalid verifier");
        bitGoVerifier = verifier;
        emit BitGoVerifierUpdated(verifier);
    }

    /// @notice Links caller to a BitGo wallet after off-chain KYC.
    /// @param walletId BitGo wallet identifier.
    /// @param signature BitGo attestation signature.
    function linkBitGoWallet(bytes32 walletId, bytes calldata signature) external {
        require(walletId != bytes32(0), "invalid wallet");
        require(walletIds[msg.sender] == bytes32(0), "already linked");
        require(walletToAgent[walletId] == address(0), "wallet exists");

        bytes32 message = keccak256(abi.encodePacked(msg.sender, walletId, block.chainid, address(this)));
        require(verifyBitGoAttestation(message, signature), "invalid attestation");

        walletIds[msg.sender] = walletId;
        walletToAgent[walletId] = msg.sender;
        isBitGoVerified[msg.sender] = true;

        emit WalletLinked(msg.sender, walletId);
    }

    /// @notice Returns the linked BitGo wallet ID for an agent.
    /// @param agent Agent address.
    function getWallet(address agent) external view returns (bytes32) {
        return walletIds[agent];
    }

    /// @notice Validates and consumes a one-time BitGo stealth attestation.
    /// @dev Called by StealthRegistry when using BitGo stealth path.
    /// @param agent Agent opening the loan.
    /// @param loanId Loan identifier.
    /// @param stealthAddress Stealth wallet address.
    /// @param bitGoAttestation BitGo signed attestation payload.
    function consumeStealthAttestation(address agent, bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation)
        external
        returns (bool)
    {
        require(isBitGoVerified[agent], "not bitgo verified");
        bytes32 attHash = keccak256(bitGoAttestation);
        require(!usedAttestations[attHash], "attestation used");

        bytes32 message = keccak256(abi.encodePacked(agent, walletIds[agent], loanId, stealthAddress, block.chainid, address(this)));
        require(verifyBitGoAttestation(message, bitGoAttestation), "invalid attestation");

        usedAttestations[attHash] = true;
        return true;
    }

    /// @notice Verifies a BitGo ECDSA attestation against configured verifier.
    /// @param message Signed message hash preimage.
    /// @param sig Signature bytes.
    function verifyBitGoAttestation(bytes32 message, bytes memory sig) public view returns (bool) {
        if (sig.length != 65) return false;

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;

        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        return ecrecover(digest, v, r, s) == bitGoVerifier;
    }
}
