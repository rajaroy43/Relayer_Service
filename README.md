## Usage/Installation

Run `npm install` or `yarn` and then:

- `yarn compile` - to compile smart contract and generate typechain ts bindings
- `yarn test` - to run tests
- `yarn deploy` - to deploy to local network (see options for more)
- `npm run node` - to run a localhost node
- `yarn start_relayer` - to run a relayer service
- `yarn start_app` - to run web application

Check `package.json` scripts for more options.
Use `.env.example` file and adapt it to you values and settings

## Demo

1. First create `.env` in root directory and add your PRIVATE_KEY and PROVIDER_URL there ,get format from `.env.example`
2. Install metamask , and add the local network :
   New RPC URL=http://127.0.0.1:8545/
   Chain ID = 13337

3. run `npm run node` - For starting hardhat node
4. run `yarn start_relayer` - For starting relayer service
5. run `yarn start_app` - for staring web application`
6. Now fill all given information (To address , TokenContract Address and amount that you wan't to send) and after clicking Sign button, First you ask for approval of token to relayer contract and then sign the parameter
7. Now wait some seconds , for receiving amount tokens for To Address.
