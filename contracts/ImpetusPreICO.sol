pragma solidity ^0.4.20;

import "./NudgeToken.sol";

contract ImpetusPreICO is SafeMath, Ownable {

    NudgeToken nudgeToken = NudgeToken(0xdC03Ca9C3327f45e1FcD316CDF3C8E093ed668A4);

    address public impetusAddress = 0x1d477fa6a6aa9aec8ee0bf30687baf8141e90358;

    bool public isActive = false;
    uint public totalTokensSold = 0;
    uint public tokenPrice = 140000 wei;

    mapping(address => bool) public whitelistedAddresses;
    mapping(address => uint) public bonuses;

    function () ifActive onlyWhitelisted public payable {
        uint numberOfTokens = calculateNumberOfTokensFromWeisReceived(msg.value);
        totalTokensSold += numberOfTokens;

        uint bonus = (numberOfTokens * bonuses[msg.sender]) / 100;
        totalTokensSold += bonus;

        require(totalTokensSold <= ((nudgeToken.getSupplyCap() * 9) / 10));


        nudgeToken.mint(msg.sender, numberOfTokens + bonus);
        nudgeToken.lockFrom(msg.sender, bonus, 180);
        impetusAddress.transfer(msg.value);

    }

    function whiteListAddress(address addr, bool whitelisted, uint bonus) onlyOwner public {
        require(bonus <= 30);
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

    function setNudgeToken(address addr) onlyOwner {
        nudgeToken = NudgeToken(addr);
    }

    function setImpetusAddress(address addr) onlyOwner {
        impetusAddress = addr;
    }

    /**
   * Calculate the number of tokens to be issued from the amount of weis received.
   *
   */
    function calculateNumberOfTokensFromWeisReceived(uint weisReceived) public constant returns (uint256) {
        return safeDiv(weisReceived, tokenPrice);
    }

    function setSmallestTokenUnitPriceInWei(uint tokenPriceInWei) public onlyOwner {
        tokenPrice = tokenPriceInWei * 1 wei;
    }

    function getTotalTokensSold() constant returns(uint){
        return totalTokensSold;
    }

}