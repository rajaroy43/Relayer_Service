export type MetaTx = {
    from: string;
    to: string;
    data: string;
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
    signature: string;
    tokenContract: string;
    amount: number;
    batchId: number;
    batchNonce: number;
    expiry: number;
    txGas: number;
};

export type CallData = {
    from: string;
    to: string;
    data: string;
    signature: string;
};

export type CallParams = {
    tokenContract: string;
    amount: number;
    batchId: number;
    batchNonce: number;
    expiry: number;
    txGas: number;
};
