// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Receiver Smart Contract
 * @author Abhishek Ray
 */

contract Receiver is Ownable, EIP712, ReentrancyGuard {
    using ECDSA for bytes32;
    address public relayer;

    bytes32 constant ERC20METATRANSACTION_TYPEHASH =
        keccak256(
            "ERC20MetaTransaction(address from,address to,address tokenContract,uint256 amount,uint256 batchId,uint256 batchNonce,uint256 expiry,uint256 txGas)"
        );
    // //////////////////////////////////////////

    // //////////////// EVENTS //////////////////
    event MetaTx(
        address indexed from,
        uint256 indexed batchId,
        uint256 indexed batchNonce,
        bool success,
        bytes returnData
    );

    // //////////////// STATE ///////////////////
    mapping(address => mapping(uint256 => uint256)) batches;

    // //////////////////////////////////////////

    constructor(
        address _relayer,
        string memory name,
        string memory version
    ) EIP712(name, version) {
        relayer = _relayer;
    }

    struct Call {
        address from;
        address to;
        bytes data; //Using this data when calling contract.call(data) //ANy function of tokenContract,for simplicity we are only doing transferFrom
        bytes signature;
    }

    struct CallParams {
        address tokenContract;
        uint256 amount;
        uint256 batchId;
        uint256 batchNonce;
        uint256 expiry;
        uint256 txGas;
    }

    function _executeMetaTransaction(
        Call memory callData,
        CallParams memory callParams
    ) internal nonReentrant returns (bool success, bytes memory returnData) {
        if (
            (block.timestamp > callParams.expiry) ||
            (batches[callData.from][callParams.batchId] + 1 !=
                callParams.batchNonce) ||
            !verify(callData, callParams)
        ) {
            return (false, "");
        }
        (success, returnData) = _performERC20MetaTx(callData, callParams);
    }

    /**
     * @dev Verifies the signature based on typed structured data.
     * See https://eips.ethereum.org/EIPS/eip-712
     */
    function verify(
        Call memory callData,
        CallParams memory callParams
    ) public view returns (bool) {
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ERC20METATRANSACTION_TYPEHASH,
                    callData.from,
                    callData.to,
                    callParams.tokenContract,
                    callParams.amount,
                    callParams.batchId,
                    callParams.batchNonce,
                    callParams.expiry,
                    callParams.txGas
                )
            )
        ).recover(callData.signature);
        return signer == callData.from;
    }

    function _performERC20MetaTx(
        Call memory callData,
        CallParams memory callParams
    ) internal returns (bool success, bytes memory returnData) {
        batches[callData.from][callParams.batchId] = callParams.batchNonce;
        // Here only performing transferFrom just to make it simple
        // Can change the data here as well by using `callData.data`
        (success, returnData) = callParams.tokenContract.call{
            gas: callParams.txGas
        }(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                callData.from,
                callData.to,
                callParams.amount
            )
        );
        emit MetaTx(
            callData.from,
            callParams.batchId,
            callParams.batchNonce,
            success,
            returnData
        );
    }

    function meta_nonce(
        address from,
        uint256 batchId
    ) external view returns (uint256) {
        return batches[from][batchId];
    }

    function update_relayer(address _newRelayer) external onlyOwner {
        require(
            _newRelayer != address(0) && _newRelayer != relayer,
            "Zero Address/Same Relayer"
        );
        relayer = _newRelayer;
    }

    function batch(
        Call[] memory callData,
        CallParams[] memory callParams
    ) external {
        require(
            msg.sender == relayer,
            "can only be executed by the meta tx processor"
        );
        require(callParams.length == callData.length, "Length Mismatch");
        for (uint256 i = 0; i < callData.length; i++) {
            _executeMetaTransaction(callData[i], callParams[i]);
        }
    }
}
