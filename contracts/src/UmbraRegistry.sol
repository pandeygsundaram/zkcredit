// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IUmbra} from "./interfaces/IUmbra.sol";

contract UmbraRegistry {
    IUmbra public immutable umbra;
    address public owner;

    mapping(address => bytes32) public metaAddresses;
    mapping(address => address) public stealthToAgent;
    mapping(bytes32 => address) public loanStealthAddress;

    // BitGo support
    mapping(address => bytes32) public bitGoWalletId;
    address public bitGoVerifier;

    event MetaAddressRegistered(address indexed agent, bytes32 spendingPubKey);
    event StealthAddressLinked(address indexed agent, address indexed stealthAddress, bytes32 indexed loanId);
    event BitGoLinked(address indexed agent, bytes32 walletId);
    event BitGoVerifierUpdated(address indexed verifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _umbra) {
        umbra = IUmbra(_umbra);
        owner = msg.sender;
    }

    function setBitGoVerifier(address verifier) external onlyOwner {
        bitGoVerifier = verifier;
        emit BitGoVerifierUpdated(verifier);
    }

    function registerMetaAddress(bytes32 spendingPubKey) external {
        require(metaAddresses[msg.sender] == bytes32(0), "Already registered");
        require(spendingPubKey != bytes32(0), "Invalid key");

        metaAddresses[msg.sender] = spendingPubKey;
        emit MetaAddressRegistered(msg.sender, spendingPubKey);
    }

    function linkBitGoWallet(bytes32 walletId, bytes calldata signature) external {
        require(bitGoWalletId[msg.sender] == bytes32(0), "already linked");

        bytes32 message = keccak256(abi.encodePacked(msg.sender, walletId));
        require(_verifyBitGo(message, signature), "invalid bitgo sig");

        bitGoWalletId[msg.sender] = walletId;
        emit BitGoLinked(msg.sender, walletId);
    }

    function linkStealthAddress(address stealthAddress, bytes32 loanId, bytes calldata signature) external {
        require(metaAddresses[msg.sender] != bytes32(0), "No meta address");
        require(stealthToAgent[stealthAddress] == address(0), "Already linked");

        bytes32 message = keccak256(abi.encodePacked(msg.sender, loanId, block.chainid));
        require(_verifySignature(message, signature, stealthAddress), "Invalid signature");

        stealthToAgent[stealthAddress] = msg.sender;
        loanStealthAddress[loanId] = stealthAddress;

        emit StealthAddressLinked(msg.sender, stealthAddress, loanId);
    }

    function getMetaAddress(address agent) external view returns (bytes32) {
        return metaAddresses[agent];
    }

    function isStealthOf(address stealthAddress, address agent) external view returns (bool) {
        return stealthToAgent[stealthAddress] == agent;
    }

    function parseAnnouncement(uint256 announcementId)
        external
        view
        returns (address stealthAddress, uint256 amount, bytes32 encryptedViewingKey)
    {
        return umbra.getAnnouncement(announcementId);
    }

    function _verifyBitGo(bytes32 message, bytes memory signature) internal view returns (bool) {
        if (bitGoVerifier == address(0)) return false;
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        return ecrecover(digest, v, r, s) == bitGoVerifier;
    }

    function _verifySignature(bytes32 message, bytes memory signature, address signer) internal pure returns (bool) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        return ecrecover(digest, v, r, s) == signer;
    }

    function _splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
