import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, utils } from "ethers";
import { Receiver, ERC20 } from "typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

describe("Receiver Contract", () => {
	let relayer: SignerWithAddress,
		account1: SignerWithAddress,
		account2: SignerWithAddress,
		account3: SignerWithAddress,
		account4: SignerWithAddress,
		receiver: Receiver,
		name = "Receiver",
		version = "1.0.0",
		tokenContractErc20: ERC20;

	const getGasCost = async (tokenContractErc20: ERC20, amount: BigNumber) => {
		await tokenContractErc20.approve(account4.address, amount);
		const txGas = await tokenContractErc20.connect(account4).estimateGas.transferFrom(account1.address, receiver.address, amount);
		return txGas;
	};

	const getMetaTx20Data = async (
		from: SignerWithAddress,
		to: SignerWithAddress,
		data: string,
		tokenContractErc20: ERC20,
		amount: BigNumber,
		batchId: number,
		batchNonce: number,
		chainId: number | undefined,
		verifyingContractAddress: string,
	) => {
		const block = await ethers.provider.getBlock();
		const expiry = block.timestamp + 1000000;
		// Only for calculating estimate gas cost

		const txGas = await getGasCost(tokenContractErc20, amount);
		const domain = {
			name,
			version,
			chainId,
			verifyingContract: verifyingContractAddress,
		};

		// The named list of all type definitions
		const types = {
			ERC20MetaTransaction: [
				{ name: "from", type: "address" },
				{ name: "to", type: "address" },
				{ name: "tokenContract", type: "address" },
				{ name: "amount", type: "uint256" },
				{ name: "batchId", type: "uint256" },
				{ name: "batchNonce", type: "uint256" },
				{ name: "expiry", type: "uint256" },
				{ name: "txGas", type: "uint256" },
			],
		};

		// The data to sign
		const value = {
			from: from.address,
			to: to.address,
			tokenContract: tokenContractErc20.address,
			amount,
			batchId,
			batchNonce,
			expiry,
			txGas,
		};

		const signature = await from._signTypedData(domain, types, value);

		const callData = [
			{
				from: from.address,
				to: to.address,
				data,
				signature,
			},
		];

		const callParams = [
			{
				tokenContract: tokenContractErc20.address,
				amount,
				batchId,
				batchNonce,
				expiry,
				txGas,
			},
		];
		return { callData, callParams };
	};
	beforeEach(async () => {
		[account1, account2, account3, account4, relayer] = await ethers.getSigners();
		receiver = <Receiver>await (await ethers.getContractFactory("Receiver")).connect(relayer).deploy(relayer.address, name, version);
		tokenContractErc20 = <ERC20>await (await ethers.getContractFactory("MockErc20")).deploy("Automata", "ATA", parseEther("1000000"));
	});

	it("should execute  meta transactions for erc20 transferFrom", async () => {
		const amount = parseEther("100");
		const batchId = 0;
		const batchNonce = 1;
		const chainId = network.config.chainId;
		const { callData, callParams } = await getMetaTx20Data(
			account1,
			account2,
			"0x",
			tokenContractErc20,
			amount,
			batchId,
			batchNonce,
			chainId,
			receiver.address,
		);
		// Owner must be relayer

		expect(await receiver.owner()).to.be.equal(relayer.address);

		expect(await tokenContractErc20.balanceOf(account2.address)).to.equal(0);

		await tokenContractErc20.approve(receiver.address, amount);

		const sucess = true;
		const returnDataInBytes32 = utils.zeroPad(utils.hexlify(1), 32); //1 is true return erc20 token transferFrom

		// Only call by relayer
		await expect(receiver.connect(account1).batch(callData, callParams)).to.be.revertedWith(
			"can only be executed by the meta tx processor",
		);

		await expect(receiver.connect(relayer).batch(callData, callParams))
			.to.emit(receiver, "MetaTx")
			.withArgs(account1.address, batchId, batchNonce, sucess, returnDataInBytes32);
		expect(await tokenContractErc20.balanceOf(account2.address)).to.be.equal(amount);
	});

	it("should fail for insufficient token , Account has 0 tokens", async () => {
		const revertReason = utils.toUtf8Bytes("ERC20: transfer amount exceeds balance");
		const encodedRevertReason = utils.defaultAbiCoder.encode(["bytes"], [revertReason]);

		const ErrorSignature = "Error(string)";
		// taking only 1st 4 bytes
		const errorSignatureSelector = utils.id(ErrorSignature).slice(0, 10);

		const revertReasonInBytes = errorSignatureSelector + encodedRevertReason.slice(2);
		const amount = parseEther("100");
		const batchId = 0;
		const batchNonce = 1;
		const chainId = network.config.chainId;
		const { callData, callParams } = await getMetaTx20Data(
			account2,
			account3,
			"0x",
			tokenContractErc20,
			amount,
			batchId,
			batchNonce,
			chainId,
			receiver.address,
		);

		expect(await tokenContractErc20.balanceOf(account3.address)).to.equal(0);

		await tokenContractErc20.connect(account2).approve(receiver.address, amount);

		const sucess = false;
		await expect(receiver.connect(relayer).batch(callData, callParams))
			.to.emit(receiver, "MetaTx")
			.withArgs(account2.address, batchId, batchNonce, sucess, revertReasonInBytes);
		expect(await tokenContractErc20.balanceOf(account3.address)).to.be.equal(0);
	});

	it("should fail for Without approving token", async () => {
		const revertReason = utils.toUtf8Bytes("ERC20: insufficient allowance");
		const encodedRevertReason = utils.defaultAbiCoder.encode(["bytes"], [revertReason]);

		const ErrorSignature = "Error(string)";
		// taking only 1st 4 bytes
		const errorSignatureSelector = utils.id(ErrorSignature).slice(0, 10);

		const revertReasonInBytes = errorSignatureSelector + encodedRevertReason.slice(2);
		const amount = parseEther("100");
		const batchId = 0;
		const batchNonce = 1;
		const chainId = network.config.chainId;
		const { callData, callParams } = await getMetaTx20Data(
			account1,
			account2,
			"0x",
			tokenContractErc20,
			amount,
			batchId,
			batchNonce,
			chainId,
			receiver.address,
		);

		expect(await tokenContractErc20.balanceOf(account2.address)).to.equal(0);

		const sucess = false;
		await expect(receiver.batch(callData, callParams))
			.to.emit(receiver, "MetaTx")
			.withArgs(account1.address, batchId, batchNonce, sucess, revertReasonInBytes);
		expect(await tokenContractErc20.balanceOf(account2.address)).to.be.equal(0);
	});

	it("should fail for higher txgas or lowerTxGas and fail for past time expiry", async () => {
		const amount = parseEther("100");
		const batchId = 0;
		const batchNonce = 1;
		const chainId = network.config.chainId;
		const higherTxGas = 2000000000;
		const block = await ethers.provider.getBlock();
		const expiry = block.timestamp;

		const domain = {
			name,
			version,
			chainId,
			verifyingContract: receiver.address,
		};

		// The named list of all type definitions
		const types = {
			ERC20MetaTransaction: [
				{ name: "from", type: "address" },
				{ name: "to", type: "address" },
				{ name: "tokenContract", type: "address" },
				{ name: "amount", type: "uint256" },
				{ name: "batchId", type: "uint256" },
				{ name: "batchNonce", type: "uint256" },
				{ name: "expiry", type: "uint256" },
				{ name: "txGas", type: "uint256" },
			],
		};

		// The data to sign
		const value = {
			from: account1.address,
			to: account2.address,
			tokenContract: tokenContractErc20.address,
			amount,
			batchId,
			batchNonce,
			expiry,
			txGas: higherTxGas,
		};

		const signature = await account1._signTypedData(domain, types, value);

		const callData = [
			{
				from: account1.address,
				to: account2.address,
				data: "0x",
				signature,
			},
		];

		const callParams = [
			{
				tokenContract: tokenContractErc20.address,
				amount,
				batchId,
				batchNonce,
				expiry,
				txGas: higherTxGas,
			},
		];
		expect(await tokenContractErc20.balanceOf(account2.address)).to.equal(0);

		await tokenContractErc20.approve(receiver.address, amount);

		await expect(receiver.connect(relayer).batch(callData, callParams)).to.not.emit(receiver, "MetaTx");
		expect(await tokenContractErc20.balanceOf(account2.address)).to.be.equal(0);

		// Same For lower gas Cost

		let lowerTxGas = await getGasCost(tokenContractErc20, amount);

		lowerTxGas = lowerTxGas.sub(10000);

		const value_LowerGas = {
			from: account1.address,
			to: account2.address,
			tokenContract: tokenContractErc20.address,
			amount,
			batchId,
			batchNonce,
			expiry,
			txGas: lowerTxGas,
		};

		const signature_LowerGas = await account1._signTypedData(domain, types, value_LowerGas);

		const callData_LowerGas = [
			{
				from: account1.address,
				to: account2.address,
				data: "0x",
				signature: signature_LowerGas,
			},
		];

		const callParams__LowerGas = [
			{
				tokenContract: tokenContractErc20.address,
				amount,
				batchId,
				batchNonce,
				expiry,
				txGas: higherTxGas,
			},
		];

		await expect(receiver.connect(relayer).batch(callData_LowerGas, callParams__LowerGas)).to.not.emit(receiver, "MetaTx");

		// Past Expiry time
		let txGas = await getGasCost(tokenContractErc20, amount);
		const expiry_Past = expiry - 1000;

		const value_PastExpiry = {
			from: account1.address,
			to: account2.address,
			tokenContract: tokenContractErc20.address,
			amount,
			batchId,
			batchNonce,
			expiry: expiry_Past,
			txGas,
		};

		const signature_PastExpiry = await account1._signTypedData(domain, types, value_PastExpiry);

		const callData_PastExpiry = [
			{
				from: account1.address,
				to: account2.address,
				data: "0x",
				signature: signature_PastExpiry,
			},
		];

		const callParams__PastExpiry = [
			{
				tokenContract: tokenContractErc20.address,
				amount,
				batchId,
				batchNonce,
				expiry: expiry_Past,
				txGas,
			},
		];

		await expect(receiver.connect(relayer).batch(callData_PastExpiry, callParams__PastExpiry)).to.not.emit(receiver, "MetaTx");
	});

	it("should execute for multiple token ", async () => {
		const tokenContractErc20_2 = <ERC20>await (await ethers.getContractFactory("MockErc20")).deploy("DAI", "DAI", parseEther("1000000"));

		const amount = parseEther("100");
		const batchId = 0;
		const batchNonce = 1;
		const amount_2 = parseEther("100");
		const batchNonce_2 = 2;
		const chainId = network.config.chainId;
		const metaData1 = await getMetaTx20Data(
			account1,
			account2,
			"0x",
			tokenContractErc20,
			amount,
			batchId,
			batchNonce,
			chainId,
			receiver.address,
		);

		const metaData2 = await getMetaTx20Data(
			account1,
			account2,
			"0x",
			tokenContractErc20_2,
			amount_2,
			batchId,
			batchNonce_2,
			chainId,
			receiver.address,
		);

		const callData = [metaData1.callData[0], metaData2.callData[0]];
		const callParams = [metaData1.callParams[0], metaData2.callParams[0]];

		expect(await tokenContractErc20.balanceOf(account2.address)).to.equal(0);
		expect(await tokenContractErc20_2.balanceOf(account2.address)).to.equal(0);

		await tokenContractErc20.approve(receiver.address, amount);
		await tokenContractErc20_2.approve(receiver.address, amount);

		const sucess = true;
		const returnDataInBytes32 = utils.zeroPad(utils.hexlify(1), 32); //1 is true return erc20 token transferFrom
		await expect(receiver.connect(relayer).batch(callData, callParams))
			.to.emit(receiver, "MetaTx")
			.withArgs(account1.address, batchId, batchNonce, sucess, returnDataInBytes32);
		expect(await tokenContractErc20.balanceOf(account2.address)).to.be.equal(amount);
		expect(await tokenContractErc20_2.balanceOf(account2.address)).to.be.equal(amount);
	});

	it("should fail for same BatchNonce/maximum gas usage/Invalid signatures", async () => {
		const tokenContractErc20_2 = <ERC20>await (await ethers.getContractFactory("MockErc20")).deploy("DAI", "DAI", parseEther("1000000"));

		const amount = parseEther("100");
		const batchId = 0;
		const batchNonce = 1;
		const chainId = network.config.chainId;
		const { callData, callParams } = await getMetaTx20Data(
			account1,
			account2,
			"0x",
			tokenContractErc20,
			amount,
			batchId,
			batchNonce,
			chainId,
			receiver.address,
		);
		expect(await tokenContractErc20.balanceOf(account2.address)).to.equal(0);

		await tokenContractErc20.approve(receiver.address, amount);

		const sucess = true;
		const returnDataInBytes32 = utils.zeroPad(utils.hexlify(1), 32); //1 is true return erc20 token transferFrom

		// Only call by relayer
		await expect(receiver.connect(account1).batch(callData, callParams)).to.be.revertedWith(
			"can only be executed by the meta tx processor",
		);

		// Length of callParams and Call must be same
		await expect(receiver.connect(relayer).batch(callData, [])).to.be.revertedWith("Length Mismatch");

		// TxGas should not be less than the required gas  , otherwise there will be no Meta TX

		// Same Nonce and Same Signature,but different `to` account address
		const To_Changed_callData = callData.map((item) => {
			return { ...item, to: relayer.address };
		});

		await expect(receiver.connect(relayer).batch(To_Changed_callData, callParams)).to.not.emit(receiver, "MetaTx");

		// Same Nonce and Same Signature,but different `amount

		const Amount_Changed_callParams = callParams.map((item) => {
			return { ...item, amount: amount.mul(100) };
		});
		await expect(receiver.connect(relayer).batch(callData, Amount_Changed_callParams)).to.not.emit(receiver, "MetaTx");

		// Same Nonce and Same Signature,but different token contract
		const Token_Changed_callParams = callParams.map((item) => {
			return { ...item, tokenContract: tokenContractErc20_2.address };
		});
		await expect(receiver.connect(relayer).batch(callData, Token_Changed_callParams)).to.not.emit(receiver, "MetaTx");

		// Changed Nonce and Same Signature,which is invalid signature
		const Nonce_Changed_callParams = callParams.map((item) => {
			return { ...item, batchNonce: 2 };
		});
		await expect(receiver.connect(relayer).batch(callData, Nonce_Changed_callParams)).to.not.emit(receiver, "MetaTx");

		// Changed TXGas and Same Signature,which is invalid signature
		const TxGas_Changed_callParams = callParams.map((item) => {
			return { ...item, txGas: 2009090 };
		});
		await expect(receiver.connect(relayer).batch(callData, TxGas_Changed_callParams)).to.not.emit(receiver, "MetaTx");

		// Successfully transfered ERC20
		await expect(receiver.connect(relayer).batch(callData, callParams))
			.to.emit(receiver, "MetaTx")
			.withArgs(account1.address, batchId, batchNonce, sucess, returnDataInBytes32);

		expect(await tokenContractErc20.balanceOf(account2.address)).to.be.equal(amount);

		// Can Changed Relayer Address
		await receiver.update_relayer(account4.address);

		expect(await receiver.relayer()).to.be.equal(account4.address);

		// Same Nonce and Same Signature , again with all the same params,but relayer changed now
		await expect(receiver.connect(relayer).batch(callData, callParams)).to.be.revertedWith("can only be executed by the meta tx processor");

		// Same Nonce and Same Signature , again with all the same params,and new relayer
		await expect(receiver.connect(account4).batch(callData, callParams)).to.not.emit(receiver, "MetaTx");
	});
});
