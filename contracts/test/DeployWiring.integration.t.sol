// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";
import {ZKCreditResolver} from "../src/ZKCreditResolver.sol";
import {StealthRegistry} from "../src/StealthRegistry.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {LoanManager} from "../src/LoanManager.sol";
import {ZKCreditVerifier} from "../src/ZKCreditVerifier.sol";
import {MockGroth16Verifier} from "./mocks/MockGroth16Verifier.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract DeployWiringIntegrationTest is Test {
    function testDeployScriptWiringShape() external {
        address oracleSigner = address(0x0A11CE);
        address bitgoVerifier = address(0xB17);

        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        MockGroth16Verifier groth16 = new MockGroth16Verifier();

        BitGoRegistry bitgo = new BitGoRegistry(bitgoVerifier);
        CreditVerifier verifier = new CreditVerifier(oracleSigner, address(bitgo));
        ZKCreditResolver resolver = new ZKCreditResolver();
        StealthRegistry stealth = new StealthRegistry(address(bitgo));
        CollateralVault vault = new CollateralVault(address(usdc));
        LoanManager manager =
            new LoanManager(address(verifier), address(vault), address(stealth), address(bitgo), address(resolver));
        ZKCreditVerifier zkVerifier = new ZKCreditVerifier(address(groth16), address(verifier), oracleSigner);

        // Mirror Deploy.s.sol wiring.
        vault.setLoanManager(address(manager));
        resolver.setController(address(manager), true);
        stealth.setLoanManager(address(manager));
        verifier.setScorer(address(manager), true);
        verifier.setScorer(address(zkVerifier), true);
        manager.setZKCreditVerifier(address(zkVerifier));

        assertEq(vault.loanManager(), address(manager));
        assertTrue(resolver.controllers(address(manager)));
        assertEq(stealth.loanManager(), address(manager));
        assertTrue(verifier.scorers(address(manager)));
        assertTrue(verifier.scorers(address(zkVerifier)));
        assertEq(address(manager.zkCreditVerifier()), address(zkVerifier));
    }
}

