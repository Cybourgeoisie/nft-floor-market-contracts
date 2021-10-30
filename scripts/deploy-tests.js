// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
  await network.provider.request({
    method: "hardhat_reset",
    params: [],
  });

  // Check the address of the sender
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    deployer.address
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const NFTContract = await ethers.getContractFactory('ERC721NFT');

  for (let idx = 0; idx < 3; idx++) {
    nftContract = await NFTContract.deploy(`NFT Collection #${idx+1}`, "NFT${idx+1}");

    for (let nftIdx = 1; nftIdx <= 10; nftIdx++) {
      await nftContract.connect(deployer).mint('0x70997970c51812dc3a010c7d01b50e0d17dc79c8', nftIdx);
    }

    console.log(`NFT ${idx+1} contract deployed to ${nftContract.address}`);
  }

  // We get the contract to deploy
  const contractFactory = await ethers.getContractFactory('NFTFloorMarket');

  // Deploy contract
  const contract = await contractFactory.deploy();
  await contract.deployed();

  console.log('NFT Floor Market contract deployed to:', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
