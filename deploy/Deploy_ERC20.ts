import { parseEther } from "ethers/lib/utils";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const tx = await deploy("MockErc20", {
        from: deployer,
        args: ["Automata", "Ata", parseEther("100000000")],
        log: true,
    });

    console.log(`The address of ERC20 contract is  ${tx.address}`);
};
export default func;
