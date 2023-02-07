import React, { useEffect, useState } from "react";
import { Typography, TextField, Button } from "@material-ui/core";
import { Buffer } from "buffer";
import { MockErc20 } from "../../typechain";
import { connectWallet } from "./util/interact";
import { TypedMessage } from "@metamask/eth-sig-util";
import { ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ERC20 } from "./constants";
declare global {
	interface Window {
		ethereum: any;
	}
}
window.Buffer = window.Buffer || Buffer;

const App = () => {
	const [walletAddress, setWallet] = useState("");
	const [status, setStatus] = useState("");

	const [eipTxData1, setEipTxData] = useState({
		from: "",
		to: "",
		tokenContract: "",
		amount: "",
	});

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setEipTxData({
			...eipTxData1,
			[e.target.name]: e.target.value,
		});
	};

	function addWalletListener() {
		if (window.ethereum) {
			window.ethereum.on("accountsChanged", (accounts: any) => {
				if (accounts.length > 0) {
					setWallet(accounts[0]);
					setEipTxData({
						...eipTxData1,
						from: accounts[0],
					});
					setStatus("👆🏽 Populate the Data and Click on Button to execute...");
				} else {
					setWallet("");
					setStatus("🦊 Connect to Metamask using the top right button.");
				}
			});
		} else {
			setStatus(
				// @ts-ignore
				<p>
					{" "}
					🦊{" "}
					<a target="_blank" rel="noreferrer" href={`https://metamask.io/download.html`}>
						You must install Metamask, a virtual Ethereum wallet, in your browser.
					</a>
				</p>,
			);
		}
	}

	const handleSign = async (e: any) => {
		e.preventDefault();
		try {
			const provider = new ethers.providers.Web3Provider(window.ethereum);
			// Get the address of the user's MetaMask account
			const signer = provider.getSigner();
			const signerAddress = await signer.getAddress();

			const responseBatchData = await fetch("http://localhost:4000/batchdata", {
				method: "GET",
				headers: {
					accept: "application/json",
				},
			});
			const { relayerAddress } = await responseBatchData.json();
			console.log(relayerAddress);
			console.log(eipTxData1);
			const amount = parseEther(eipTxData1.amount); //Here probabaly will use amount*10**decimalsOfContract
			// @ts-ignore
			const expireTimeInOneDay = (await provider.getBlock()).timestamp + 86400;
			console.log("date", expireTimeInOneDay);
			// @ts-ignore
			const erc20: MockErc20 = new ethers.Contract(eipTxData1.tokenContract, ERC20.abi, signer);
			const isAllowance = await erc20.allowance(signerAddress, relayerAddress);
			if (isAllowance.lt(amount)) {
				await erc20.connect(signer).approve(relayerAddress, ethers.constants.MaxUint256);
			}

			// spender/signer must be relayer here
			// const txGas = await erc20.connect(signer)
			//   .estimateGas.transferFrom(
			//     relayerAddress,
			//     eipTxData1.to,
			//     amount
			// );
			const txGas = 45000; //From above line

			const eipTxData = {
				...eipTxData1,
				relayerAddress,
				amount: amount.toString(),
				expiry: expireTimeInOneDay,
				txGas,
			};
			console.log(eipTxData);
			const msgParams: TypedMessage<{
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
				primaryType: "ERC20MetaTransaction",
				domain: {
					name: "Receiver",
					version: "1.0.0",
					chainId: (await provider.getNetwork()).chainId,
					verifyingContract: relayerAddress,
				},
				message: {
					from: eipTxData.from,
					to: eipTxData.to,
					tokenContract: eipTxData.tokenContract,
					amount: eipTxData.amount,
					expiry: eipTxData.expiry,
					txGas: eipTxData.txGas,
				},
			};
			const signature = await window.ethereum.request({
				method: "eth_signTypedData_v4",
				params: [walletAddress, JSON.stringify(msgParams)],
			});
			// Now post this message to relayer service

			const responseSubmit = await fetch("http://localhost:4000/submitMessage", {
				method: "POST",
				headers: {
					accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...eipTxData,
					data: "0x",
					name: "Receiver",
					version: "1.0.0",
					chainId: (await provider.getNetwork()).chainId,
					verifyingContract: relayerAddress,
					signature: signature,
				}),
			});
			const response12 = await responseSubmit.json();
			console.log(response12);
		} catch (error: any) {
			console.log("error is ", error.message);
			return;
		}
	};

	//called only once
	useEffect(() => {
		async function setup() {
			// @ts-ignore
			const { address, status } = await connectWallet();
			// const { address, status } = await getCurrentWalletConnected();

			setWallet(address);
			setEipTxData({
				...eipTxData1,
				from: address,
			});
			// @ts-ignore
			setStatus(status);

			addWalletListener();
		}
		setup();
	}, []);

	return (
		<div className="center">
			<Typography variant="h4">EIP712 TypeV4 ERC20 transfer tokens</Typography>
			<form onSubmit={handleSign}>
				<div>
					<label htmlFor="to">To:</label>
					<input type="text" width="98" height="48" name="to" value={eipTxData1.to} onChange={handleChange} />
				</div>
				<div>
					<label htmlFor="tokenContract">Token Contract:</label>
					<input type="text" name="tokenContract" value={eipTxData1.tokenContract} onChange={handleChange} />
				</div>
				<div>
					<label htmlFor="amount">Amount:</label>
					<input type="text" name="amount" value={eipTxData1.amount} onChange={handleChange} />
				</div>
				<Button type="submit" variant="contained" color="primary">
					Sign
				</Button>
			</form>
		</div>
	);
};

export default App;
