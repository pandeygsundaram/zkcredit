// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";
import {ZKCreditResolver} from "../src/ZKCreditResolver.sol";
import {LoanManager} from "../src/LoanManager.sol";

contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address axiomQuery = vm.envAddress("AXIOM_QUERY_ADDRESS");
        address bitGoVerifier = vm.envAddress("BITGO_VERIFIER");

        vm.startBroadcast(pk);

        CreditVerifier verifier = new CreditVerifier();
        verifier.setAxiomQueryAddress(axiomQuery);

        CollateralVault vault = new CollateralVault(usdc);
        BitGoRegistry registry = new BitGoRegistry(bitGoVerifier);

        ZKCreditResolver resolver = new ZKCreditResolver();
        LoanManager manager = new LoanManager(address(verifier), address(vault), address(registry), address(resolver));

        vault.setLoanManager(address(manager));
        resolver.setController(address(manager), true);
        registry.setLoanManager(address(manager));
        verifier.setScorer(address(manager), true);

        vm.stopBroadcast();
    }
}
