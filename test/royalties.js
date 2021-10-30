const { expect } = require('chai');
const hre = require('hardhat');
const fs = require('fs');

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');


const ERC721_ABI = require('../data/erc721abi.json');

const TO_IMPERSONATE = {
  'coinartist' : {
    'address' : '0x148e2ed011a9eaaa200795f62889d68153eeacde',
    'items' : {
      'rarible' : [13244]
    }
  },
  'vitalik' : {
    'address' : '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
  },
  'dummy' : {
    'address' : '0x254f99Ef16C46397f6345b7352Ee284761f7E059'
  },
  'raribleRoyalty' : {
    'address' : '0x3B24804587A841C11B4E5bAac8A6211671672ce0'
  },
  'cybourgeoisie' : {
    'address' : '0x9eE5E3Ff06425CF972E77c195F70Ecb18aC23d7f',
    'items' : {
      'bayc' : [10]
    }
  }
};
  
const IMPERSONATED = {};


describe('NFT Floor Market Royalty Payment Tests on Ethereum', function () {
  let marketContract;
  let owner, accts = [];
  let royaltyEngineAddress = '0x0385603ab55642cb4dd5de3ae9e306809991804f';
  let marketFeeAddress = '0x85c560610A3c8ACccAD214A6BAaefCdDC81aDDA8';

  before(async () => {
    // impersonate accounts holding shells
    for (const identity in TO_IMPERSONATE) {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [TO_IMPERSONATE[identity].address],
      });

      IMPERSONATED[identity] = await ethers.provider.getSigner(TO_IMPERSONATE[identity].address);
    }

    nftContracts = {
      'ndShells' : await ethers.getContractAt(ERC721_ABI, '0x1276dce965ADA590E42d62B3953dDc1DDCeB0392'),
      'bayc'     : await ethers.getContractAt(ERC721_ABI, '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'),
      'rarible'  : await ethers.getContractAt(ERC721_ABI, '0x60f80121c31a0d46b5279700f9df786054aa5ee5'),
    };

    [owner, ...accts] = await ethers.getSigners();

    const NFTFloorMarket = await ethers.getContractFactory('NFTFloorMarket');
    marketContract = await NFTFloorMarket.deploy(marketFeeAddress, royaltyEngineAddress, ethers.utils.parseEther("0.01"));
  });


  describe('Default checks on contracts - assumptions', function () {
    it('Default test: NFT contracts should all exist and be as expected', async function () {
      expect(await nftContracts['ndShells'].name()).to.equal("Neon District In-Game Item");
      expect(await nftContracts['ndShells'].symbol()).to.equal("NDIGI");

      expect(await nftContracts['bayc'].name()).to.equal("BoredApeYachtClub");
      expect(await nftContracts['bayc'].symbol()).to.equal("BAYC");

      expect(await nftContracts['rarible'].name()).to.equal("Rarible");
      expect(await nftContracts['rarible'].symbol()).to.equal("RARI");
    });

    it('Default test: Vitalik\'s account has enough ETH', async function () {
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['vitalik'].address)).to.be.eq("7306648585590009566490");
    });

    it('Default test: Cybourgeoisie\'s account owns BAYC #10', async function () {
      expect(await nftContracts['bayc'].ownerOf(10)).to.be.eq(TO_IMPERSONATE['cybourgeoisie'].address);
    });
  });


  describe('Royalty Tests', function () {

    it('Have Vitalik send Cybourgeoisie funds because of high estimates', async function () {
      await IMPERSONATED['vitalik'].sendTransaction({
        to: TO_IMPERSONATE['cybourgeoisie'].address,
        value: ethers.utils.parseEther("100.0")
      });
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['cybourgeoisie'].address)).to.be.eq("101950016835087156937");
    });

    it('Have Vitalik send the dummy address funds for easy math', async function () {
      await IMPERSONATED['vitalik'].sendTransaction({
        to: TO_IMPERSONATE['dummy'].address,
        value: ethers.utils.parseEther("100.0")
      });
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['dummy'].address)).to.be.eq(ethers.utils.parseEther("100.0"));
    });

    it('Have Coin Artist send the dummy address the Rarible token', async function () {
      await nftContracts['rarible'].connect(IMPERSONATED['coinartist']).transferFrom(
        TO_IMPERSONATE['coinartist'].address,
        TO_IMPERSONATE['dummy'].address,
        13244
      );
      expect((await nftContracts['rarible'].ownerOf(13244)).toLowerCase()).to.be.eq(TO_IMPERSONATE['dummy'].address.toLowerCase());
    });

    it('Get no royalty back from a BAYC', async function () {
      let royalties = await marketContract.getRoyalties(nftContracts['bayc'].address, 10, ethers.utils.parseEther("42.0"));
      expect(royalties).to.have.all.keys("0", "1", 'recipients', 'amounts');
      expect(royalties.recipients.length).to.be.eq(0);
      expect(royalties.amounts.length).to.be.eq(0);
    });

    it('Get royalty back from Rarible token', async function () {
      let royalties = await marketContract.getRoyalties(nftContracts['rarible'].address, 13244, ethers.utils.parseEther("5.0"));
      expect(royalties).to.have.all.keys("0", "1", 'recipients', 'amounts');
      expect(royalties.recipients.length).to.be.eq(1);
      expect(royalties.amounts.length).to.be.eq(1);
      expect(royalties.recipients[0]).to.be.eq('0x3B24804587A841C11B4E5bAac8A6211671672ce0');
      expect(royalties.amounts[0]).to.be.eq(ethers.utils.parseEther("0.5"));
    });

    it('Make an offer on any BAYC', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
      await marketContract.connect(IMPERSONATED['vitalik']).makeOffer(nftContracts['bayc'].address, {value : ethers.utils.parseEther("42.0")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("42.0"));
    });

    it('Withdraw an offer on any BAYC', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("42.0"));
      await marketContract.connect(IMPERSONATED['vitalik']).withdrawOffer(0);
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
    });

    it('Make another offer on any BAYC', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
      await marketContract.connect(IMPERSONATED['vitalik']).makeOffer(nftContracts['bayc'].address, {value : ethers.utils.parseEther("150.0")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("150.0"));
    });

    it('Expected reverts on takeOffer for Rarible', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("150.0"));
      await expectRevert(marketContract.connect(IMPERSONATED['dummy']).takeOffer(0, 10), 'Offer does not exist');
      await expectRevert(marketContract.connect(IMPERSONATED['dummy']).takeOffer(1, 10), 'ERC721: transfer caller is not owner nor approved');

      // Taker 2 sets approval for contract 1 (which they have no tokens for)
      await nftContracts['bayc'].connect(IMPERSONATED['dummy']).setApprovalForAll(marketContract.address, true);
      await expectRevert(marketContract.connect(IMPERSONATED['dummy']).takeOffer(1, 10), 'ERC721: transfer caller is not owner nor approved');
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("150.0"));
    });

    it('Take an offer on BAYC with BAYC #10', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("150.0"));
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['cybourgeoisie'].address)).to.be.eq(ethers.utils.parseEther("101.950016835087156937"));
      await nftContracts['bayc'].connect(IMPERSONATED['cybourgeoisie']).approve(marketContract.address, 10);
      await marketContract.connect(IMPERSONATED['cybourgeoisie']).takeOffer(1, 10); // (_offerId, _tokenId)
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['cybourgeoisie'].address)).to.be.eq(ethers.utils.parseEther("251.193455186725150656")); // Received 150 ETH minus 0.75 ETH for platform fee
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.75"));
      expect((await nftContracts['bayc'].ownerOf(10)).toLowerCase()).to.be.eq(TO_IMPERSONATE['vitalik'].address);
    });


    it('Make an offer on any Rarible', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
      await marketContract.connect(IMPERSONATED['vitalik']).makeOffer(nftContracts['rarible'].address, {value : ethers.utils.parseEther("5.0")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.0"));
    });

    it('Expected reverts on takeOffer for Rarible', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.0"));
      await expectRevert(marketContract.connect(IMPERSONATED['cybourgeoisie']).takeOffer(1, 13244), 'Offer does not exist');
      await expectRevert(marketContract.connect(IMPERSONATED['cybourgeoisie']).takeOffer(2, 13244), 'ERC721: transfer caller is not owner nor approved');

      // Taker 2 sets approval for contract 1 (which they have no tokens for)
      await nftContracts['rarible'].connect(IMPERSONATED['cybourgeoisie']).setApprovalForAll(marketContract.address, true);
      await expectRevert(marketContract.connect(IMPERSONATED['cybourgeoisie']).takeOffer(2, 13244), 'ERC721: transfer caller is not owner nor approved');
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.0"));
    });

    it('Take an offer on Rarible with Rarible #13244', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.0"));
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['dummy'].address)).to.be.eq(ethers.utils.parseEther("99.990774836958796836"));
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['raribleRoyalty'].address)).to.be.eq(ethers.utils.parseEther("3.889950025493718652"));
      await nftContracts['rarible'].connect(IMPERSONATED['dummy']).approve(marketContract.address, 13244);
      await marketContract.connect(IMPERSONATED['dummy']).takeOffer(2, 13244); // (_offerId, _tokenId)
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['raribleRoyalty'].address)).to.be.eq(ethers.utils.parseEther("4.389950025493718652")); // Received EXACTLY 0.5 more ETH
      expect(await ethers.provider.getBalance(TO_IMPERSONATE['dummy'].address)).to.be.eq(ethers.utils.parseEther("104.463255320487517594")); // Received 4.5 ETH minus gas + market fee
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.775"));
      expect((await nftContracts['rarible'].ownerOf(13244)).toLowerCase()).to.be.eq(TO_IMPERSONATE['vitalik'].address);
    });

  });

});
