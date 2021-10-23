/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();

module.exports = {
  solidity: '0.8.0',
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  }
};
