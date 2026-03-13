// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IUmbra {
    function getAnnouncement(uint256 announcementId)
        external
        view
        returns (address stealthAddress, uint256 amount, bytes32 encryptedViewingKey);
}
