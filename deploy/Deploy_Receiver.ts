import fs from "fs";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const tx = await deploy("Receiver", {
        from: deployer,
        args: [deployer, "Receiver", "1.0.0"],
        log: true,
    });

    console.log(`The address of Recevier contract is  ${tx.address}`);

    const data = {
        ReceiverAddress: tx.address,
    };
    fs.writeFile("DeployedAddress.json", JSON.stringify(data), (err) => {
        if (err) {
            console.error(err);
        }
    });
};
export default func;
