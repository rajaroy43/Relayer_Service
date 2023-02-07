import { Signer, constants, ethers } from "ethers";
import { CallData, CallParams, MetaTx } from "./utils/types";
import { checkMetaTxDataNotNull, getEip712Data } from "./utils";
import { SignTypedDataVersion, recoverTypedSignature } from "@metamask/eth-sig-util";
import OffchainStorageService from "./utils/store";
const Receiver = require("../artifacts/contracts/Receiver.sol/Receiver.json");
const { ReceiverAddress } = require("../DeployedAddress.json");

const MAX_GAS_LIMIT = 2000000;
const BATCH_INTERVAL = 60; //60 seconds
class RelayerService {
	private signer: Signer;
	public contract: any;
	private provider: any;
	private messages: any[];
	private intervalId: NodeJS.Timeout;
	public offchainStorage: OffchainStorageService;
	public batches: MetaTx[][];

	constructor(provider: any, privateKey: string) {
		this.signer = new ethers.Wallet(privateKey, provider);
		this.provider = provider;
		this.contract = new ethers.Contract(ReceiverAddress, Receiver.abi, provider);
		this.messages = [];
		this.batches = [];
		this.startBatchInterval();
		this.offchainStorage = new OffchainStorageService();
	}

	async submitMessage(message: MetaTx) {
		// Validate message
		if (!(await this.isValidMessage(message))) {
			throw new Error("Invalid message");
		}
		console.log("Message validated");

		// Add message to batch
		this.messages.push({ ...message });
	}

	private async isValidMessage(message: MetaTx) {
		// Checking message params
		const currentTime = (await this.provider.getBlock()).timestamp;
		console.log("starting");
		// checking null every property
		if (!checkMetaTxDataNotNull(message)) {
			return false;
		}
		console.log("EIPTXDATA/Message in Relayer", message);
		if (
			message.from == constants.AddressZero ||
			message.to == constants.AddressZero ||
			message.tokenContract == constants.AddressZero ||
			message.amount <= 0 ||
			message.expiry < currentTime ||
			message.txGas <= 0 ||
			message.txGas >= MAX_GAS_LIMIT
		) {
			return false;
		}

		const getSigData = getEip712Data(message);
		const recoveredAddr = recoverTypedSignature({
			data: getSigData.data,
			signature: message.signature,
			version: SignTypedDataVersion.V4,
		});
		console.log("recoveredAddr", recoveredAddr);

		if (recoveredAddr != message.from) {
			return false;
		}
		return true;
	}

	private startBatchInterval() {
		this.intervalId = setInterval(() => {
			this.sendBatch();
		}, BATCH_INTERVAL * 1000);
	}

	private async sendBatch() {
		// BatchId and BatchNonce should be defined by the relayer ,not by the user
		if (this.messages.length === 0 || this.batches.length === 0) {
			return;
		}
		const currentQueue = [...this.messages];
		// Calculate gas limit for the batch
		let gasLimit = 0;
		let currentBatch: MetaTx[] = [];
		let firstBatch: MetaTx[] = [];
		let currentBatchIdIndex = 0;
		const onchainIndex = (await this.contract.currentBatchId()).toNumber();
		for (const message of currentQueue) {
			if (gasLimit + message.txGas > MAX_GAS_LIMIT) {
				this.batches.push(currentBatch);
				currentBatch = [];
				gasLimit = 0;
				currentBatchIdIndex++;
			}
			const currentBatchId = currentBatchIdIndex + onchainIndex;
			let batchNonce = await this.offchainStorage.get(`${currentBatchId}-${message.from}-batchNonce`);
			if (!batchNonce) {
				batchNonce = "1";
			}
			// pushing batchId and batchNonce

			message.batchNonce = parseInt(batchNonce);
			message.batchId = currentBatchId;
			await this.offchainStorage.set(`${currentBatchId}-${message.from}-batchNonce`, (parseInt(batchNonce) + 1).toString());
			currentBatch.push(message);
			gasLimit += message.txGas;
		}

		if (currentBatch.length) {
			this.batches.push(currentBatch);
		}
		console.log("before processing batches", this.batches);

		firstBatch = this.batches.splice(0, 1)[0];
		const callData: CallData[] = [];
		const callParams: CallParams[] = [];
		console.log("batches", this.batches);
		firstBatch.map((message) => {
			const call__Data = {
				from: message.from,
				to: message.to,
				data: message.data,
				signature: message.signature,
			};
			const call__Params = {
				tokenContract: message.tokenContract,
				amount: message.amount,
				batchId: message.batchId,
				batchNonce: message.batchNonce,
				expiry: message.expiry,
				txGas: message.txGas,
			};

			callData.push(call__Data);
			callParams.push(call__Params);
		});

		const tx = await this.contract.connect(this.signer).batch(callData, callParams, { gasLimit: MAX_GAS_LIMIT });
		const txResp = await tx.wait();
		console.log("tx resp", txResp);
	}
}

export default RelayerService;
