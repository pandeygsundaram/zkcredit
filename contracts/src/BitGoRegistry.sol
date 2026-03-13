// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BitGoRegistry
 * @notice Links BitGo MPC wallets and manages stealth addresses.
 */
contract BitGoRegistry {
    address public owner;
    address public loanManager;
    address public bitGoVerifier;

    mapping(address => bytes32) public walletIds;
    mapping(bytes32 => address) public walletToAgent;

    mapping(address => address) public activeStealth;
    mapping(address => address) public stealthToAgent;
    mapping(bytes32 => address) public loanStealth;

    mapping(bytes32 => bool) public usedAttestations;
    mapping(bytes32 => bool) public validAttestations;
    mapping(address => uint256) public nonces;

    event WalletRegistered(address indexed agent, bytes32 indexed walletId);
    event StealthLinked(address indexed agent, address indexed stealth, bytes32 indexed loanId);
    event BitGoVerifierUpdated(address indexed verifier);
    event LoanManagerUpdated(address indexed loanManager);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "only loan manager");
        _;
    }

    constructor(address _verifier) {
        require(_verifier != address(0), "invalid verifier");
        owner = msg.sender;
        bitGoVerifier = _verifier;
    }

    function setBitGoVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "invalid verifier");
        bitGoVerifier = verifier;
        emit BitGoVerifierUpdated(verifier);
    }

    function setLoanManager(address manager) external onlyOwner {
        require(manager != address(0), "invalid manager");
        loanManager = manager;
        emit LoanManagerUpdated(manager);
    }

    function registerWallet(bytes32 walletId, bytes calldata signature) external {
        _registerWallet(msg.sender, walletId, signature);
    }

    function registerWalletFor(address agent, bytes32 walletId, bytes calldata signature) external onlyLoanManager {
        _registerWallet(agent, walletId, signature);
    }

    function linkStealthAddress(bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation) external {
        _linkStealth(msg.sender, loanId, stealthAddress, bitGoAttestation);
    }

    function registerStealthAddress(bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation) external {
        _linkStealth(msg.sender, loanId, stealthAddress, bitGoAttestation);
    }

    function linkStealthAddressFor(address agent, bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation)
        external
        onlyLoanManager
    {
        _linkStealth(agent, loanId, stealthAddress, bitGoAttestation);
    }

    function getWallet(address agent) external view returns (bytes32) {
        return walletIds[agent];
    }

    function getStealth(bytes32 loanId) external view returns (address) {
        return loanStealth[loanId];
    }

    function isStealthOf(address stealth, address agent) external view returns (bool) {
        return stealthToAgent[stealth] == agent;
    }

    function _registerWallet(address agent, bytes32 walletId, bytes calldata signature) internal {
        require(agent != address(0), "invalid agent");
        require(walletId != bytes32(0), "invalid wallet");
        require(walletIds[agent] == bytes32(0), "already registered");
        require(walletToAgent[walletId] == address(0), "wallet exists");

        bytes32 message = keccak256(abi.encodePacked(agent, walletId, block.chainid));
        require(_verifyBitGo(message, signature), "invalid signature");

        walletIds[agent] = walletId;
        walletToAgent[walletId] = agent;

        emit WalletRegistered(agent, walletId);
    }

    function _linkStealth(address agent, bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation) internal {
        bytes32 walletId = walletIds[agent];
        require(walletId != bytes32(0), "no wallet");
        require(stealthAddress != address(0), "invalid stealth");
        require(stealthToAgent[stealthAddress] == address(0), "stealth used");

        bytes32 attestationHash = keccak256(bitGoAttestation);
        require(!usedAttestations[attestationHash], "attestation used");

        bytes32 message = keccak256(abi.encodePacked(walletId, stealthAddress, loanId, nonces[agent]++, block.chainid));
        require(_verifyBitGo(message, bitGoAttestation), "invalid attestation");

        usedAttestations[attestationHash] = true;
        validAttestations[attestationHash] = true;
        activeStealth[agent] = stealthAddress;
        stealthToAgent[stealthAddress] = agent;
        loanStealth[loanId] = stealthAddress;

        emit StealthLinked(agent, stealthAddress, loanId);
    }

    function _verifyBitGo(bytes32 message, bytes memory sig) internal view returns (bool) {
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

        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        return ecrecover(ethSigned, v, r, s) == bitGoVerifier;
    }

    // Spec-compatible aliases
    function bitGoWalletIds(address agent) external view returns (bytes32) {
        return walletIds[agent];
    }

    function activeStealthAddress(address agent) external view returns (address) {
        return activeStealth[agent];
    }

    function loanStealthAddress(bytes32 loanId) external view returns (address) {
        return loanStealth[loanId];
    }
}
