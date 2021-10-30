// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
  // Check the address of the sender
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    deployer.address
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());


  /**
   
  Royalty Engine:

  Mainnet: 0x0385603ab55642cb4dd5de3ae9e306809991804f
  Rinkeby: 0x8d17687ea9a6bb6efA24ec11DcFab01661b2ddcd
  Ropsten: 0xFf5A6F7f36764aAD301B7C9E85A5277614Df5E26
  Polygon: 0x28EdFcF0Be7E86b07493466e7631a213bDe8eEF2
  Mumbai:  0x0a01E11887f727D1b1Cd81251eeEE9BEE4262D07

   **/


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
