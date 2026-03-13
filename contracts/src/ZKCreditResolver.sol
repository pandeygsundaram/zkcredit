// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKCreditResolver
 * @notice Lightweight resolver-like storage for zkCredit records.
 */
contract ZKCreditResolver {
    address public owner;
    mapping(address => bool) public controllers;

    mapping(bytes32 => address) public nodeOwner;
    mapping(bytes32 => address) public nodeAddr;
    mapping(bytes32 => mapping(string => string)) public nodeText;
    mapping(bytes32 => bytes) public nodeContenthash;

    event ControllerSet(address indexed controller, bool allowed);
    event NodeRegistered(bytes32 indexed node, address indexed owner);
    event AddrChanged(bytes32 indexed node, address addr);
    event TextChanged(bytes32 indexed node, string key, string value);
    event ContenthashChanged(bytes32 indexed node, bytes value);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyController() {
        require(controllers[msg.sender], "only controller");
        _;
    }

    modifier onlyNodeOwnerOrController(bytes32 node) {
        require(msg.sender == nodeOwner[node] || controllers[msg.sender], "not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        controllers[msg.sender] = true;
    }

    function setController(address controller, bool allowed) external onlyOwner {
        controllers[controller] = allowed;
        emit ControllerSet(controller, allowed);
    }

    function registerNode(bytes32 node, address owner_) external onlyController {
        if (nodeOwner[node] == address(0)) {
            nodeOwner[node] = owner_;
            emit NodeRegistered(node, owner_);
        }
    }

    function setAddr(bytes32 node, address account) external onlyNodeOwnerOrController(node) {
        nodeAddr[node] = account;
        emit AddrChanged(node, account);
    }

    function addr(bytes32 node) external view returns (address) {
        return nodeAddr[node];
    }

    function setText(bytes32 node, string calldata key, string calldata value) external onlyController {
        nodeText[node][key] = value;
        emit TextChanged(node, key, value);
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return nodeText[node][key];
    }

    function setContenthash(bytes32 node, bytes calldata value) external onlyController {
        nodeContenthash[node] = value;
        emit ContenthashChanged(node, value);
    }

    function contenthash(bytes32 node) external view returns (bytes memory) {
        return nodeContenthash[node];
    }
}
