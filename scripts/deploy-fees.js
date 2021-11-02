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
  Polygon: 0x28EdFcF0Be7E86b07493466e7631a213bDe8eEF2
  Mumbai:  0x0a01E11887f727D1b1Cd81251eeEE9BEE4262D07

   **/

  let chainId = (await ethers.provider.getNetwork()).chainId;

  // Default Configs
  let marketFeeAddress = '0x85c560610A3c8ACccAD214A6BAaefCdDC81aDDA8',
    royaltyEngine,
    minimumBuyOffer;

  switch (chainId) {
    case 1:
      royaltyEngine = '0x0385603ab55642cb4dd5de3ae9e306809991804f';
      minimumBuyOffer = ethers.utils.parseEther("0.01");
      break;
    case 4:
      royaltyEngine = '0x8d17687ea9a6bb6efA24ec11DcFab01661b2ddcd';
      minimumBuyOffer = ethers.utils.parseEther("0.01");
      break;
    case 137:
      royaltyEngine = '0x28EdFcF0Be7E86b07493466e7631a213bDe8eEF2';
      minimumBuyOffer = ethers.utils.parseEther("1.0");
      break;
    case 80001:
      royaltyEngine = '0x0a01E11887f727D1b1Cd81251eeEE9BEE4262D07';
      minimumBuyOffer = ethers.utils.parseEther("1.0");
      break;
    default:
      throw 'Invalid Chain ID:' + chainId;
  }


  // We get the contract to deploy
  const contractFactory = await ethers.getContractFactory('NFTFloorMarket');

  // Deploy contract
  const contract = await contractFactory.deploy(marketFeeAddress, royaltyEngine, minimumBuyOffer);
  await contract.deployed();

  console.log('NFT Floor Market contract deployed to:', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
