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
  let owner, takers = [], makers = [], getterTestMakers;
  let marketFeeAddress = '0x85c560610A3c8ACccAD214A6BAaefCdDC81aDDA8';

  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    [owner, takers[0], takers[1], takers[2], ...makers] = await ethers.getSigners();

    // For later tests
    getterTestMakers = [
      [makers[2], ethers.utils.parseEther("1.25") ],
      [makers[3], ethers.utils.parseEther("2.5")  ],
      [makers[4], ethers.utils.parseEther("3.75") ],
      [makers[0], ethers.utils.parseEther("5.0")  ],
      [makers[1], ethers.utils.parseEther("6.25") ],
      [makers[2], ethers.utils.parseEther("7.5")  ],
      [makers[3], ethers.utils.parseEther("8.75") ],
      [makers[4], ethers.utils.parseEther("10.0") ],
      [makers[5], ethers.utils.parseEther("11.25")],
      [makers[0], ethers.utils.parseEther("12.5") ],
      [makers[1], ethers.utils.parseEther("13.75")],
      [makers[2], ethers.utils.parseEther("15.0") ]
    ]

    const NFTContract = await ethers.getContractFactory('ERC721NFT');
    nftContracts = [
      await NFTContract.deploy("Cheap", "CHEAP"),
      await NFTContract.deploy("Expensive", "EXPENSIVE"),
      await NFTContract.deploy("NGMI", "NGMI")
    ];

    await nftContracts[0].connect(owner).mint(takers[0].address, 0);

    await nftContracts[1].connect(owner).mint(takers[1].address, 0);
    await nftContracts[1].connect(owner).mint(takers[1].address, 1);

    await nftContracts[2].connect(owner).mint(takers[2].address, 0);
    await nftContracts[2].connect(owner).mint(takers[2].address, 1);
    await nftContracts[2].connect(owner).mint(takers[2].address, 2);

    const NFTFloorMarket = await ethers.getContractFactory('NFTFloorMarket');
    marketContract = await NFTFloorMarket.deploy();
    //await marketContract.setRoyaltyRegistryAddress('0xad2184fb5dbcfc05d8f056542fb25b04fa32a95d');
    await marketContract.setMarketFeeAddress(marketFeeAddress);
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

    it('Default test: Fails to allow non-owner to set royalty lookup or market fee address', async function () {
      await expectRevert(marketContract.connect(takers[0]).setRoyaltyRegistryAddress(takers[0].address), 'Ownable: caller is not the owner');
      await expectRevert(marketContract.connect(takers[0]).setMarketFeeAddress(takers[0].address), 'Ownable: caller is not the owner');
    });

    it('Default test: Fails to allow non-owner to set minimum buy offer', async function () {
      await expectRevert(marketContract.connect(takers[0]).setMinimumBuyOffer(ethers.utils.parseEther("5.0")), 'Ownable: caller is not the owner');
    });

    it('Default test: Fails to allow non-owner to set minimum buy offer', async function () {
      expect(await marketContract.MINIMUM_BUY_OFFER()).to.be.eq(ethers.utils.parseEther("0.01"));
      await marketContract.connect(owner).setMinimumBuyOffer(ethers.utils.parseEther("1.0"));
      expect(await marketContract.MINIMUM_BUY_OFFER()).to.be.eq(ethers.utils.parseEther("1.0"));
      await marketContract.connect(owner).setMinimumBuyOffer(ethers.utils.parseEther("0.01"));
      expect(await marketContract.MINIMUM_BUY_OFFER()).to.be.eq(ethers.utils.parseEther("0.01"));
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
      await expectRevert(marketContract.connect(takers[0]).withdrawOffer(1), 'Sender does not own offer');
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
      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.006"));
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
    });

    it('Make another offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
      await marketContract.connect(makers[1]).makeOffer(nftContracts[1].address, {value : ethers.utils.parseEther("5.3")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.3"));
    });

    it('Expected reverts on takeOffer', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.3"));
      await expectRevert(marketContract.connect(takers[0]).takeOffer(1, 0), 'Offer does not exist');
      await expectRevert(marketContract.connect(takers[1]).takeOffer(2, 1), 'ERC721: transfer caller is not owner nor approved');

      // Taker 2 sets approval for contract 1 (which they have no tokens for)
      await nftContracts[1].connect(takers[2]).setApprovalForAll(marketContract.address, true);
      await expectRevert(marketContract.connect(takers[2]).takeOffer(2, 1), 'ERC721: transfer caller is not owner nor approved');
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.3"));
    });

    it('Make another offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.3"));
      await marketContract.connect(makers[1]).makeOffer(nftContracts[1].address, {value : ethers.utils.parseEther("6.75")});
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("12.05"));
    });

    it('Take an offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("12.05"));
      await nftContracts[1].connect(takers[1]).setApprovalForAll(marketContract.address, true);
      await marketContract.connect(takers[1]).takeOffer(3, 1); // (_offerId, _tokenId)
      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.03975"));
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.3"));
    });

    it('Take the other offer on contract #1', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("5.3"));
      await marketContract.connect(takers[1]).takeOffer(2, 0); // (_offerId, _tokenId)
      //await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.06625"));
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
    });

    /*
    it('Expected reverts on withdrawMarketFees', async function () {
      await expectRevert(marketContract.connect(takers[0]).withdrawMarketFees(), 'Ownable: caller is not the owner');
      await expectRevert(marketContract.connect(makers[0]).withdrawMarketFees(), 'Ownable: caller is not the owner');
    });

    it('Withdraw market fees', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("0"));
      await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);

      // Shouldn't withdraw anything more
      await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
    });
    */

  });


  describe('Getters', function () {
    it('Make multiple offers on #2', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(0);
      for (let idx = 0; idx < getterTestMakers.length; idx++) {
        await marketContract.connect(getterTestMakers[idx][0]).makeOffer(nftContracts[2].address, {value : getterTestMakers[idx][1]});
      }
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("97.5"));
    });

    async function reviewOffersByContract(_debug = false) {
      // Get the number of offers
      let length = await marketContract.getOffersByContractCount(nftContracts[2].address);
      expect(length).to.be.eq(getterTestMakers.length);

      let limitSize = 5;
      for (let offsetIdx = 0; offsetIdx < length; offsetIdx+=limitSize) {
        let res = await marketContract.getOffersByContract(nftContracts[2].address, limitSize, Math.ceil(offsetIdx / limitSize));

        expect(res.length).to.be.eq(limitSize);

        for (let idx = 0; idx < res.length && res[idx]._value.toString() != 0; idx++) {
          expect(res[idx]._contract).to.be.eq(nftContracts[2].address);
          expect(res[idx]._offerer).to.be.eq(getterTestMakers[offsetIdx + idx][0].address);
          expect(res[idx]._value).to.be.eq(getterTestMakers[offsetIdx + idx][1]);
        }
      }
    }

    async function reviewOffersByOfferer(_debug = false) {
      // Compile the list of makers & relative counts
      let localMakers = {};
      for (let set of getterTestMakers) {
        if (!localMakers.hasOwnProperty(set[0].address)) {
          localMakers[set[0].address] = [];
        }

        localMakers[set[0].address].push(set[1]);
      }

      // For each of the various offerers...
      for (let makerAddress in localMakers) {
        // Get the number of offers
        let length = await marketContract.getOffersByOffererCount(makerAddress);
        expect(length).to.be.eq(localMakers[makerAddress].length);

        let limitSize = 2;
        for (let offsetIdx = 0; offsetIdx < length; offsetIdx+=limitSize) {
          let res = await marketContract.getOffersByOfferer(makerAddress, limitSize, Math.ceil(offsetIdx / limitSize));

          expect(res.length).to.be.eq(limitSize);

          for (let idx = 0; idx < res.length && res[idx]._value.toString() != 0; idx++) {
            let matchFound = false;
            for (let value of localMakers[makerAddress]) {
              if (
                res[idx]._contract === nftContracts[2].address &&
                res[idx]._offerer === makerAddress &&
                res[idx]._value.toString() === value.toString()
              ) {
                matchFound = true;
              }
            }
            expect(matchFound).to.be.eq(true);
          }
        }
      }
    }

    it('Get offers by contract', reviewOffersByContract);

    it('Get offers by offerer', reviewOffersByOfferer);

    it('Pluck out an offer from the middle of contract #2', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("97.5"));

      await nftContracts[2].connect(takers[2]).approve(marketContract.address, 0);
      await marketContract.connect(takers[2]).takeOffer(9, 0); // (_offerId, _tokenId)

      // Remove the associated getterTestMakers row
      getterTestMakers[5] = getterTestMakers[getterTestMakers.length - 1];
      getterTestMakers.pop();

      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.10375"));
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("90.0"));
    });

    it('Get offers by contract', reviewOffersByContract);

    it('Get offers by offerer', reviewOffersByOfferer);

    it('Pluck out another offer from near the end of contract #2', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("90.0"));

      await nftContracts[2].connect(takers[2]).approve(marketContract.address, 2);
      await marketContract.connect(takers[2]).takeOffer(13, 2); // (_offerId, _tokenId)

      // Remove the associated getterTestMakers row
      getterTestMakers[9] = getterTestMakers[getterTestMakers.length - 1];
      getterTestMakers.pop();

      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.16625"));
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("77.5"));
    });

    it('Get offers by contract', reviewOffersByContract);

    it('Get offers by offerer', reviewOffersByOfferer);

    it('Pluck out another offer from near the beginning of contract #2', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("77.5"));

      await nftContracts[2].connect(takers[2]).approve(marketContract.address, 1);
      await marketContract.connect(takers[2]).takeOffer(5, 1); // (_offerId, _tokenId)

      // Remove the associated getterTestMakers row
      getterTestMakers[1] = getterTestMakers[getterTestMakers.length - 1];
      getterTestMakers.pop();

      expect(await ethers.provider.getBalance(marketFeeAddress)).to.be.eq(ethers.utils.parseEther("0.17875"));
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("75.0"));
    });

    it('Get offers by contract', reviewOffersByContract);

    it('Get offers by offerer', reviewOffersByOfferer.bind(this, true));

    /*
    it('Withdraw market fees', async function () {
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("75.0"));
      await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("75.0"));

      // Shouldn't withdraw anything more
      await marketContract.connect(owner).withdrawMarketFees();
      expect(await ethers.provider.getBalance(marketContract.address)).to.be.eq(ethers.utils.parseEther("75.0"));
    });
    */

  });

});
