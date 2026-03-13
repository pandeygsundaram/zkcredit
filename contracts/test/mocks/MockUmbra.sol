// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockUmbra {
    function getAnnouncement(uint256)
        external
        pure
        returns (address stealthAddress, uint256 amount, bytes32 encryptedViewingKey)
    {
        return (address(0), 0, bytes32(0));
    }
}
