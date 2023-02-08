# Relayer Service for Meta Transactions with ERC20 Tokens

This project is a demonstration of a relayer service that allows users to submit and batch transactions through meta transactions. The relayer service is implemented using TypeScript/Node.js, and the receiver and target smart contracts are implemented using Solidity and TypeScript/Node.js. The user interface is built using React.

## Usage/Installation

To use the project, you'll need to have `npm` or `yarn` installed.

1. Run `npm install` or `yarn` to install the dependencies.
2. Use the following commands to compile, test, deploy and run the various components:

   - `yarn compile` - Compiles the smart contracts and generates TypeScript bindings.
   - `yarn test` - Runs tests for the contracts.
   - `yarn deploy` - Deploys the contracts to a local network.
   - `npm run node` - Runs a local host node.
   - `yarn start_relayer` - Starts the relayer service.
   - `yarn start_app` - Starts the web application.

3. Check `package.json` scripts for more options.

## Demo

1. You'll need to create a `.env` file in the root directory and add your `PRIVATE_KEY` and `PROVIDER_URL`. Use the `.env.example` file as a reference.
2. You'll need to install Metamask and add a local network with the following details:
   - New RPC URL: http://127.0.0.1:8545/
   - Chain ID: 13337
3. Run `npm run node` - to start the Hardhat node.
4. Run `yarn start_relayer` - to start the relayer service.
5. Run `yarn start_app` - to start the web application
6. Fill in the required information (To address, Token Contract Address, and amount you want to send), and click the "Sign" button.
7. Approve the token transfer to the relayer contract and sign the parameters.
8. Wait for a few seconds for the To address to receive the tokens

### NOTE

Here i'm only assuming for transferring erc20 tokens(First approve the contract and then sign params) , if you wan't to perform some other action you can simply use `data` parameter of calldata of this line
https://github.com/rajaroy43/Automata_Test/blob/6dea1861666f3a9b22147e3a635c3ad4be3dc76e/contracts/Receiver.sol#L46
https://github.com/rajaroy43/Automata_Test/blob/6dea1861666f3a9b22147e3a635c3ad4be3dc76e/contracts/Receiver.sol#L106-L108

## Project Structure

The project consists of the following components:

- `contracts` - Contains the receiver and target smart contracts.
- `relayer` - Contains the implementation of the relayer service.
- `ui` - Contains the user interface built with React.
