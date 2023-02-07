import express from "express";
const cors = require("cors");
import RelayerService from "./relayer";
import { ethers } from "ethers";
import { MetaTx } from "./utils/types";
const app = express();
app.use(cors());
app.use(express.json());
let relayerService: RelayerService;
app.get("/batchdata", async (req: any, res: any) => {
	const data = {
		relayerAddress: relayerService.contract.address,
	};
	res.status(200).json(data);
});
app.post("/submitMessage", async (req: any, res: any) => {
	const { from, to, data, name, version, chainId, verifyingContract, signature, tokenContract, amount, expiry, txGas } = req.body;
	const txData: MetaTx = {
		from,
		to,
		data,
		name,
		version,
		chainId,
		verifyingContract,
		signature,
		tokenContract,
		amount,
		batchId: 0,
		batchNonce: 0,
		expiry,
		txGas,
	};
	// console.log(txData);
	try {
		await relayerService.submitMessage(txData);
		res.status(200).json({ message: "Message successfully added" });
	} catch (error: any) {
		res.status(500).json({
			message: "Error submitting message: " + error.message,
		});
	}
});

// we can get this by using process.env
// const {PROVIDER_URL,PRIVATE_KEY} = process.env
//const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
// Local Host provider
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/");
// Local Metamask Private Key
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
app.listen(4000, () => {
	relayerService = new RelayerService(provider, PRIVATE_KEY);
	console.log("Server started at http://localhost:4000");
});
