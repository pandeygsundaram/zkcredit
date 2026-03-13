// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKCreditResolver
 * @notice ENS-like metadata resolver for zkCredit.
 */
contract ZKCreditResolver {
    address public owner;
    mapping(address => bool) public controllers;

    mapping(bytes32 => address) public nodeOwner;
    mapping(bytes32 => address) public nodeAddr;
    mapping(bytes32 => mapping(string => string)) public nodeText;
    mapping(bytes32 => bytes) public nodeContenthash;

    event ControllerSet(address indexed controller, bool allowed);
    event ENSRegistered(bytes32 indexed node, address indexed owner);
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

    /// @notice Grants or revokes controller role.
    /// @param controller Controller address.
    /// @param allowed Whether controller is allowed.
    function setController(address controller, bool allowed) external onlyOwner {
        controllers[controller] = allowed;
        emit ControllerSet(controller, allowed);
    }

    /// @notice Registers ENS-style node ownership and default address.
    /// @param node ENS node hash.
    /// @param owner_ Node owner address.
    function registerENS(bytes32 node, address owner_) public onlyController {
        if (nodeOwner[node] == address(0)) {
            nodeOwner[node] = owner_;
            nodeAddr[node] = owner_;
            emit ENSRegistered(node, owner_);
        }
    }

    /// @notice Backward-compatible alias for ENS node registration.
    function registerNode(bytes32 node, address owner_) external onlyController {
        registerENS(node, owner_);
    }

    /// @notice Resolves node to mapped address.
    function resolve(bytes32 node) external view returns (address) {
        return nodeAddr[node];
    }

    /// @notice Sets address record for a node.
    function setAddr(bytes32 node, address account) external onlyNodeOwnerOrController(node) {
        nodeAddr[node] = account;
        emit AddrChanged(node, account);
    }

    /// @notice Reads address record for a node.
    function addr(bytes32 node) external view returns (address) {
        return nodeAddr[node];
    }

    /// @notice Sets text record for a node.
    function setText(bytes32 node, string calldata key, string calldata value) external onlyController {
        nodeText[node][key] = value;
        emit TextChanged(node, key, value);
    }

    /// @notice Reads text record for a node.
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return nodeText[node][key];
    }

    /// @notice Compatibility getter for text records.
    function texts(bytes32 node, string calldata key) external view returns (string memory) {
        return nodeText[node][key];
    }

    /// @notice Alias getter used by off-chain clients.
    function getText(bytes32 node, string calldata key) external view returns (string memory) {
        return nodeText[node][key];
    }

    /// @notice Sets contenthash (e.g., Fileverse/IPFS CID bytes).
    function setContenthash(bytes32 node, bytes calldata value) external onlyController {
        nodeContenthash[node] = value;
        emit ContenthashChanged(node, value);
    }

    /// @notice Reads contenthash record.
    function contenthash(bytes32 node) external view returns (bytes memory) {
        return nodeContenthash[node];
    }
}
