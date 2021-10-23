const { expect } = require('chai');
const hre = require('hardhat');
const fs = require('fs');

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

describe('NFT Floor Market Tests', function () {
  let nftContracts = [], marketContract;
  let owner, takers = [], makers = [];

  before(async () => {
    [owner, takers[0], takers[1], takers[2], ...makers] = await ethers.getSigners();

    const NFTContract = await ethers.getContractFactory('ERC721NFT');
    nftContracts = [
      await NFTContract.deploy("Cheap", "CHEAP"),
      await NFTContract.deploy("Expensive", "EXPENSIVE"),
      await NFTContract.deploy("NGMI", "NGMI")
    ];

    await nftContracts[0].connect(owner).mint(takers[0].address, 0);

    await nftContracts[1].connect(owner).mint(takers[1].address, 0);
    await nftContracts[1].connect(owner).mint(takers[1].address, 1);

    await nftContracts[2].connect(owner).mint(takers[2].address, 2);

    const NFTFloorMarket = await ethers.getContractFactory('NFTFloorMarket');
    marketContract = await NFTFloorMarket.deploy();
  });


  describe('Default checks on contracts - assumptions', function () {
    it('Default test: NFT contracts name & symbol should return expected values', async function () {
      expect(await nftContracts[0].name()).to.equal("Cheap");
      expect(await nftContracts[0].symbol()).to.equal("CHEAP");
      expect(await nftContracts[1].name()).to.equal("Expensive");
      expect(await nftContracts[1].symbol()).to.equal("EXPENSIVE");
      expect(await nftContracts[2].name()).to.equal("NGMI");
      expect(await nftContracts[2].symbol()).to.equal("NGMI");
    });
  });


  describe('Swap Tests', function () {
    it('Make an offer on contract #0', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
      await marketContract.connect(makers[0]).makeOffer(nftContracts[0].address, {value : ethers.utils.parseEther("1.0")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("1.0"));
    });

    it('Expected reverts on withdrawOffer', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("1.0"));
      await expectRevert(marketContract.connect(takers[0]).withdrawOffer(1), 'Offer does not exist');
      await expectRevert(marketContract.connect(takers[0]).withdrawOffer(0), 'Sender does not own offer');
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("1.0"));
    });

    it('Withdraw an offer on contract #0', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("1.0"));
      await marketContract.connect(makers[0]).withdrawOffer(0);
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
    });

    it('Make another offer on contract #0', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
      await marketContract.connect(makers[0]).makeOffer(nftContracts[0].address, {value : ethers.utils.parseEther("1.2")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("1.2"));
    });

    it('Take an offer on contract #0', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("1.2"));
      await nftContracts[0].connect(takers[0]).approve(marketContract.address, 0);
      await marketContract.connect(takers[0]).takeOffer(1, 0); // (_offerId, _tokenId)
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0.006"));
    });

    it('Make another offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0.006"));
      await marketContract.connect(makers[1]).makeOffer(nftContracts[1].address, {value : ethers.utils.parseEther("5.3")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.306"));
    });

    it('Expected reverts on takeOffer', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.306"));
      await expectRevert(marketContract.connect(takers[0]).takeOffer(1, 0), 'Offer does not exist');
      await expectRevert(marketContract.connect(takers[1]).takeOffer(2, 1), 'Allowance not granted');

      // Taker 2 sets approval for contract 1 (which they have no tokens for)
      await nftContracts[1].connect(takers[2]).setApprovalForAll(marketContract.address, true);
      await expectRevert(marketContract.connect(takers[2]).takeOffer(2, 1), 'Not owner of token');
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.306"));
    });

    it('Make another offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.306"));
      await marketContract.connect(makers[1]).makeOffer(nftContracts[1].address, {value : ethers.utils.parseEther("6.75")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("12.056"));
    });

    it('Take an offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("12.056"));
      await nftContracts[1].connect(takers[1]).setApprovalForAll(marketContract.address, true);
      await marketContract.connect(takers[1]).takeOffer(3, 1); // (_offerId, _tokenId)
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.33975"));
    });

    it('Take the other offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.33975"));
      await marketContract.connect(takers[1]).takeOffer(2, 0); // (_offerId, _tokenId)
      //await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0.06625"));
    });

    it('Expected reverts on withdrawMarketFees', async function () {
      await expectRevert(marketContract.connect(takers[0]).withdrawMarketFees(), 'Ownable: caller is not the owner');
      await expectRevert(marketContract.connect(makers[0]).withdrawMarketFees(), 'Ownable: caller is not the owner');
    });

    it('Withdraw market fees', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0.06625"));
      await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);

      // Shouldn't withdraw anything more
      await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
    });

  });

});
