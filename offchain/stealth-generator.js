const { ethers } = require('ethers');

class StealthGenerator {
  constructor(registryAddress, chainId) {
    this.registryAddress = registryAddress;
    this.chainId = chainId;
  }

  generateSpendingKey() {
    const wallet = ethers.Wallet.createRandom();
    return {
      privateKey: wallet.privateKey,
      address: wallet.address,
      publicKey: wallet.signingKey.publicKey
    };
  }

  toMetaAddress(publicKey) {
    return ethers.keccak256(publicKey);
  }

  deriveLoanStealthAddress() {
    return ethers.Wallet.createRandom();
  }

  async signLoanLink(agentAddress, loanId, stealthWallet) {
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'bytes32', 'uint256', 'address'],
        [agentAddress, loanId, this.chainId, this.registryAddress]
      )
    );
    return stealthWallet.signMessage(ethers.getBytes(messageHash));
  }
}

module.exports = { StealthGenerator };
