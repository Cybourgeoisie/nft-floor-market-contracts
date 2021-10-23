//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTFloorMarket is ReentrancyGuard, Ownable {

    // Events
    event OfferPlaced(
        uint256 _offerId,
        address indexed _contract,
        address _offerer,
        uint256 _value
    );

    event OfferWithdrawn(
        uint256 _offerId,
        address indexed _contract,
        address _offerer,
        uint256 _value
    );

    event OfferAccepted(
        uint256 _offerId,
        address indexed _contract,
        address _offerer,
        address _seller,
        uint256 _value
    );


    // Offer Structure
    struct Offer {
        address _contract;
        address _offerer;
        uint256 _value;
        uint256 _contractListIndex;
        uint256 _offererListIndex;
    }


    // Keep track of latest offer ID
    uint256 public lastOfferId = 0;

    // Keep track of all offers
    mapping(uint256 => Offer) public offers;

    // Keep track of offer IDs per contract
    mapping(address => uint256[]) public offersByContract;

    // Keep track of offer per offerer address
    mapping(address => uint256[]) public offersByOfferer;


    // Market Fees
    uint256 MARKET_FEE_DIVIDEND = 200; // Comes out to 0.5%
    uint256 heldMarketFees = 0;


    /**
     * Make an offer on any NFT within a contract
     **/
    function makeOffer(
        address _contract
    )
        public
        payable
        nonReentrant
    {
        // Require that the contract is a valid ERC721 token
        require(IERC721(_contract).supportsInterface(0x80ac58cd), "Not a valid ERC-721 Contract");

        // Store the records
        offers[lastOfferId] = Offer(
            _contract,
            msg.sender,
            msg.value,
            offersByContract[_contract].length,
            offersByOfferer[msg.sender].length
        );
        offersByContract[_contract].push(lastOfferId);
        offersByOfferer[msg.sender].push(lastOfferId);

        // On to the next offer ID
        lastOfferId += 1;

        // Announce offer placed
        emit OfferPlaced(lastOfferId, _contract, msg.sender, msg.value);
    }


    /**
     * Withdraw an offer on any NFT within a contract
     **/
    function withdrawOffer(
        uint256 _offerId
    )
        public
        nonReentrant
    {
        // Get the offer
        Offer memory _offer = offers[_offerId];

        // Make sure the offer exists
        require(_offer._contract != address(0) && _offer._offerer != address(0) && _offer._value != 0, "Offer does not exist");

        // Make sure that the sender is the owner of the offer ID
        require(_offer._offerer == msg.sender, "Sender does not own offer");

        // Remove the offer
        _removeOffer(_offer, _offerId);

        // Send the value back to the offerer
        payable(msg.sender).transfer(_offer._value);

        // Announce offer withdrawn
        emit OfferWithdrawn(_offerId, _offer._contract, msg.sender, _offer._value);
    }


    /**
     * Take an offer on any NFT within a contract
     **/
    function takeOffer(
        uint256 _offerId,
        uint256 _tokenId
    )
        public
        nonReentrant
    {
        // Get the offer
        Offer memory _offer = offers[_offerId];

        // Make sure the offer exists
        require(_offer._contract != address(0) && _offer._offerer != address(0) && _offer._value != 0, "Offer does not exist");

        // Require that the seller owns the token
        require(IERC721(_offer._contract).ownerOf(_tokenId) == msg.sender, "Not owner of token");

        // Require that the contract can transfer the token
        require(
            IERC721(_offer._contract).isApprovedForAll(msg.sender, address(this)) || IERC721(_offer._contract).getApproved(_tokenId) == address(this),
            "Allowance not granted"
        );

        // Remove the offer
        _removeOffer(_offer, _offerId);

        // Transfer NFT to the buyer
        IERC721(_offer._contract).safeTransferFrom(msg.sender, _offer._offerer, _tokenId);

        // Split the value among royalties (need to implement EIP here), seller, and market
        uint256 marketFee = _offer._value / MARKET_FEE_DIVIDEND;
        uint256 sellerValue = _offer._value - marketFee;

        // Send the value to the seller
        payable(msg.sender).transfer(sellerValue);

        // Keep track of amount market earned
        heldMarketFees += marketFee;

        // Announce offer accepted
        emit OfferAccepted(_offerId, _offer._contract, _offer._offerer, msg.sender, _offer._value);
    }


    function withdrawMarketFees()
        public
        onlyOwner
        nonReentrant
    {
        payable(owner()).transfer(heldMarketFees);
        heldMarketFees = 0;
    }


    /**
     * Internal Helper Functions 
     **/

    function _removeOffer(Offer memory _offer, uint256 _offerId) private {
        // Find and remove from the contract list and offerer list
        _removeFromContractList(_offer._contract, _offer._contractListIndex);
        _removeFromOffererList(_offer._offerer, _offer._offererListIndex);

        // Remove the offer
        delete offers[_offerId];
    }


    function _removeFromContractList(address _contract, uint256 index) private {
        uint256 _length = offersByContract[_contract].length;

        // If this index is less than the last element, then replace this element with the last element
        if (index < _length - 1) {
            // Get the last offer ID in the list
            uint256 otherOfferId = offersByContract[_contract][_length - 1];

            // Replace with the last element
            offersByContract[_contract][index] = otherOfferId;

            // Update the position within offers
            offers[otherOfferId]._contractListIndex = index;
        }

        // Remove the last index
        offersByContract[_contract].pop();
    }

    function _removeFromOffererList(address offerer, uint256 index) private {
        uint256 _length = offersByOfferer[offerer].length;

        // If this index is less than the last element, then replace this element with the last element
        if (index < _length - 1) {
            // Get the last offer ID in the list
            uint256 otherOfferId = offersByOfferer[offerer][_length - 1];

            // Replace with the last element
            offersByOfferer[offerer][index] = otherOfferId;

            // Update the position within offers
            offers[otherOfferId]._offererListIndex = index;
        }

        // Remove the last index
        offersByOfferer[offerer].pop();
    }


    /**
     * Do not accept value sent directly to contract
     **/
    receive() external payable {
        revert("No value accepted");
    }
}
