// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";
import {ZKCreditResolver} from "../src/ZKCreditResolver.sol";
import {StealthRegistry} from "../src/StealthRegistry.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {LoanManager} from "../src/LoanManager.sol";

contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address oracleSigner = vm.envAddress("ORACLE_SIGNER");
        address bitgoVerifier = vm.envAddress("BITGO_VERIFIER");

        vm.startBroadcast(pk);

        BitGoRegistry bitgo = new BitGoRegistry(bitgoVerifier);
        CreditVerifier verifier = new CreditVerifier(oracleSigner, address(bitgo));
        ZKCreditResolver resolver = new ZKCreditResolver();
        StealthRegistry stealth = new StealthRegistry(address(bitgo));
        CollateralVault vault = new CollateralVault(usdc);
        LoanManager manager = new LoanManager(address(verifier), address(vault), address(stealth), address(bitgo), address(resolver));

        vault.setLoanManager(address(manager));
        resolver.setController(address(manager), true);
        stealth.setLoanManager(address(manager));
        verifier.setScorer(address(manager), true);

        vm.stopBroadcast();
    }
}
