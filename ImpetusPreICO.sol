pragma solidity ^0.4.20;

import "./ImpetusToken.sol";

contract ImpeturPreICO is SafeMath, Ownable {

    ImpetusToken impetusToken = ImpetusToken(0xdC03Ca9C3327f45e1FcD316CDF3C8E093ed668A4);

    address public impetusAddress = 0x1d477fa6a6aa9aec8ee0bf30687baf8141e90358;

    bool public isActive = false;
    uint public totalTokensSold = 0;
    uint public tokenPrice = 1000 szabo;

    mapping(address => bool) public whitelistedAddresses;
    mapping(address => uint) public bonuses;

    function () ifActive onlyWhitelisted public payable {
        uint numberOfTokens = calculateNumberOfTokensFromWeisReceived(msg.value);
        totalTokensSold += numberOfTokens;

        uint bonus = (numberOfTokens * bonuses[msg.sender]) / 100;
        totalTokensSold += bonus;

        require(totalTokensSold <= ((impetusToken.getSupplyCap() * 9) / 10));


        impetusToken.mint(msg.sender, numberOfTokens + bonus);
        impetusToken.lockFrom(msg.sender, bonus, 1);            //TODO: change it to 6 months!!!!
        impetusAddress.transfer(msg.value);

    }

    function whiteListAddress(address addr, bool whitelisted, uint bonus) onlyOwner public {
        whitelistedAddresses[addr] = whitelisted;
        bonuses[addr] = bonus;

    }

    function finalizePreICO() public onlyOwner {
        isActive = false;
    }

    function startPreICO() public onlyOwner {
        isActive = true;
    }

    modifier onlyWhitelisted {
        if(whitelistedAddresses[msg.sender] == false)
        revert();

        _;
    }


    modifier ifActive {
        if(isActive == false)
        revert();

        _;
    }

    /**
   * Calculate the number of tokens to be issued from the amount of weis received.
   *
   */
    function calculateNumberOfTokensFromWeisReceived(uint weisReceived) public constant returns (uint256) {
        return safeDiv(weisReceived, tokenPrice);
    }

    function setTokenPriceInSzabo(uint tokenPriceInSzabo) public onlyOwner {
        tokenPrice = tokenPriceInSzabo * 1 szabo;
    }

}