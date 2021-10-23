//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IWETH9.sol";

contract NFTFloorMarket is ReentrancyGuard {

    // Events
    event OfferPlaced(
        address contract,
        address offerer,
        uint256 amount
    );

    event OfferWithdrawn(
        address contract,
        address offerer,
        uint256 amount
    );

    event OfferAccepted(
        address contract,
        address offerer,
        address seller,
        uint256 amount
    );


    // Contracts
    address public wethAddress;


    // Record-keeping
    // NFT Contract -> Offer Value : [ offerers ]
    mapping(address => mapping(uint256 => address[])) offerersByAmount;

    // NFT Contract -> Offers
    //mapping(address => uint256[]) offerAmounts;


    /**
     * Constructor
     **/
    constructor(
        address _wethAddress
    ) {
        wethAddress = _wethAddress;
    }

    /**
     * Make an offer on any NFT within a contract
     **/
    function makeOffer(
        address contract,
        uint256 amount
    )
        public
        nonReentrant
    {
        // Require that the offerer has allowed this contract to spend their WETH
        require(IWETH9(wethAddress).allowance(msg.sender, address(this)) >= amount, "Allowance not granted");

        // Require that the offerer has the WETH
        require(IWETH9(wethAddress).balanceOf(msg.sender) >= amount, "Not enough WETH");

        // Add the records
        offerersByAmount[contract][amount].push(msg.sender);
        //offerAmounts[contract].push(amount);

        // Emit an event
        emit OfferPlaced(contract, msg.sender, amount);
    }


    /**
     * Accept an offer for an NFT floor bid
     **/
    function takeOffer(
        address contract,
        uint256 tokenId,
        uint256 amount
    )
        public
        nonReentrant
    {
        // Require that the seller owns the token
        require(IERC721(contract).ownerOf(tokenId) == msg.sender, "Not owner of token");

        // Require that the contract can transfer the token
        require(
            IERC721(contract).isApprovedForAll(msg.sender, address(this)) || IERC721(contract).getApproved(tokenId) == address(this),
            "Allowance not granted"
        );

        // Make sure that we still have a valid offer
        uint256 _length = offerersByAmount[contract][amount].length;
        require(_length > 0, "No offers at amount");

        // Pull the last offerer
        address offerer = offerersByAmount[contract][amount][_length - 1];
        offerersByAmount[contract][amount].pop(); // Remove the offerer

        // If we've removed the last offer at this price, then remove from offers list
        //if (_length == 1) {
        //    offerAmounts[contract]
        //}

        // Require that the offerer has allowed this contract to spend their WETH
        require(IWETH9(wethAddress).allowance(offerer, address(this)) >= amount, "Allowance not granted");

        // Require that the offerer has the WETH
        require(IWETH9(wethAddress).balanceOf(offerer) >= amount, "Not enough WETH");

        // Transfer NFT to the buyer
        IERC721(contract).safeTransferFrom(msg.sender, offerer, tokenId);

        // Transfer WETH to the seller
        IWETH9(wethAddress).transferFrom(offerer, msg.sender, amount);

        // Emit an event
        emit OfferAccepted(contract, offerer, msg.sender, amount);
    }

    /**
     * Do not accept value sent directly to contract
     **/
    receive() external payable {
        revert("No value accepted");
    }
}
