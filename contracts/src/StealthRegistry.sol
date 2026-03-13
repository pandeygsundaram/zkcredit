// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {BitGoRegistry} from "./BitGoRegistry.sol";

/**
 * @title StealthRegistry
 * @notice Supports both self-custody stealth and BitGo MPC stealth linking.
 */
contract StealthRegistry {
    address public owner;
    address public loanManager;
    BitGoRegistry public immutable bitGoRegistry;

    mapping(address => bytes32) public metaAddresses;
    mapping(address => address) public stealthToAgent;
    mapping(bytes32 => address) public loanStealth;

    event MetaAddressRegistered(address indexed agent, bytes32 indexed spendingPubKey);
    event StealthAddressLinked(address indexed agent, address indexed stealthAddress, bytes32 indexed loanId, string mode);
    event LoanManagerUpdated(address indexed manager);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "only manager");
        _;
    }

    constructor(address bitgo_) {
        owner = msg.sender;
        bitGoRegistry = BitGoRegistry(bitgo_);
    }

    /// @notice Sets the LoanManager allowed to link stealth addresses on behalf of agents.
    /// @param manager LoanManager address.
    function setLoanManager(address manager) external onlyOwner {
        require(manager != address(0), "invalid manager");
        loanManager = manager;
        emit LoanManagerUpdated(manager);
    }

    /// @notice Registers agent's self-custody stealth meta-address.
    /// @param spendingPubKey Public spending key hash/identifier.
    function registerMetaAddress(bytes32 spendingPubKey) external {
        require(metaAddresses[msg.sender] == bytes32(0), "Already registered");
        require(spendingPubKey != bytes32(0), "Invalid key");
        metaAddresses[msg.sender] = spendingPubKey;
        emit MetaAddressRegistered(msg.sender, spendingPubKey);
    }

    /// @notice Links a self-generated stealth address for a given loan.
    /// @param stealthAddress One-time stealth address.
    /// @param loanId Loan identifier.
    /// @param signature Signature proving stealth key control.
    function linkStealthAddressSelf(address stealthAddress, bytes32 loanId, bytes calldata signature) external {
        _linkSelf(msg.sender, stealthAddress, loanId, signature);
    }

    /// @notice Backward-compatible alias for self-custody linking.
    function linkStealthAddress(address stealthAddress, bytes32 loanId, bytes calldata signature) external {
        _linkSelf(msg.sender, stealthAddress, loanId, signature);
    }

    /// @notice Links a BitGo-generated stealth address using BitGo attestation.
    /// @param loanId Loan identifier.
    /// @param stealthAddress BitGo-generated stealth address.
    /// @param bitGoAttestation BitGo signed attestation.
    function linkStealthAddressBitGo(bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation) external {
        _linkBitGo(msg.sender, loanId, stealthAddress, bitGoAttestation);
    }

    /// @notice LoanManager-assisted self-custody linking path.
    function linkStealthAddressFor(address agent, address stealthAddress, bytes32 loanId, bytes calldata signature)
        external
        onlyLoanManager
    {
        _linkSelf(agent, stealthAddress, loanId, signature);
    }

    /// @notice LoanManager-assisted BitGo linking path.
    function linkStealthAddressBitGoFor(address agent, bytes32 loanId, address stealthAddress, bytes calldata bitGoAttestation)
        external
        onlyLoanManager
    {
        _linkBitGo(agent, loanId, stealthAddress, bitGoAttestation);
    }

    /// @notice Returns linked stealth address for a loan.
    /// @param loanId Loan identifier.
    function getStealth(bytes32 loanId) external view returns (address) {
        return loanStealth[loanId];
    }

    function _linkSelf(address agent, address stealthAddress, bytes32 loanId, bytes memory signature) internal {
        require(metaAddresses[agent] != bytes32(0), "No meta address");
        require(stealthAddress != address(0), "Invalid stealth");
        require(stealthToAgent[stealthAddress] == address(0), "Already linked");

        bytes32 message = keccak256(abi.encodePacked(agent, loanId, block.chainid, address(this)));
        require(_verifySignature(message, signature, stealthAddress), "Invalid signature");

        stealthToAgent[stealthAddress] = agent;
        loanStealth[loanId] = stealthAddress;

        emit StealthAddressLinked(agent, stealthAddress, loanId, "self");
    }

    function _linkBitGo(address agent, bytes32 loanId, address stealthAddress, bytes memory bitGoAttestation) internal {
        require(stealthAddress != address(0), "Invalid stealth");
        require(stealthToAgent[stealthAddress] == address(0), "Already linked");
        require(bitGoRegistry.consumeStealthAttestation(agent, loanId, stealthAddress, bitGoAttestation), "invalid bitgo attestation");

        stealthToAgent[stealthAddress] = agent;
        loanStealth[loanId] = stealthAddress;

        emit StealthAddressLinked(agent, stealthAddress, loanId, "bitgo");
    }

    function _verifySignature(bytes32 message, bytes memory signature, address signer) internal pure returns (bool) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s) == signer;
    }
}
