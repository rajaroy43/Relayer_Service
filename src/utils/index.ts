import { TypedMessage } from "@metamask/eth-sig-util";
import { MetaTx } from "./types";

export const checkMetaTxDataNotNull = (metaTx: MetaTx) => {
    for (const property in metaTx) {
        // @ts-ignore
        // @ts-ignore
        if (metaTx[property] === null || metaTx[property] === undefined) {
            return false;
        }
    }
    return true;
};

export const getEip712Data = (eipTxData: MetaTx) => {
    const typedData: TypedMessage<{
        ERC20MetaTransaction: { name: string; type: string }[];
        EIP712Domain: { name: string; type: string }[];
    }> = {
        types: {
            ERC20MetaTransaction: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "tokenContract", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "expiry", type: "uint256" },
                { name: "txGas", type: "uint256" },
            ],
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
        },
        domain: {
            name: eipTxData.name,
            version: eipTxData.version,
            chainId: eipTxData.chainId,
            verifyingContract: eipTxData.verifyingContract,
        },
        primaryType: "ERC20MetaTransaction",
        message: {
            from: eipTxData.from,
            to: eipTxData.to,
            tokenContract: eipTxData.tokenContract,
            amount: eipTxData.amount,
            expiry: eipTxData.expiry,
            txGas: eipTxData.txGas,
        },
    };

    return { data: typedData };
};
