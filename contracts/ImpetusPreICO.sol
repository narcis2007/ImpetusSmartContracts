pragma solidity ^0.4.20;

import "./NudgeToken.sol";

contract ImpetusPreICO is SafeMath, Ownable {

    NudgeToken nudgeToken = NudgeToken(0x5694a14620676843e5270f83b77db0467916af78);

    address public impetusAddress = 0x1d477fa6a6aa9aec8ee0bf30687baf8141e90358;

    bool public isActive = false;
    uint public totalTokensSold = 0;
    uint public normalTokensSold = 0;
    uint public bonusTokensSold = 0;
    uint public NORMAL_TOKENS_LIMIT = 1776000000 * (10 ** 8);
    uint public BONUS_TOKENS_LIMIT =   189000000 * (10 ** 8);
    uint public tokenPrice = 125000 wei;
    
    uint public etherRaised = 0;

    mapping(address => bool) public whitelistedAddresses;
    mapping(address => uint) public bonuses;
    mapping(address => uint) public requiredEtherContributions;

    function () ifActive onlyWhitelisted public payable {
        require(tx.gasprice <= 100000000000  ); //less than 100 gwei
        uint numberOfTokens = calculateNumberOfTokensFromWeisReceived(msg.value);
        normalTokensSold += numberOfTokens;
        require(normalTokensSold <= NORMAL_TOKENS_LIMIT);
        totalTokensSold += numberOfTokens;

        uint bonus = (numberOfTokens * bonuses[msg.sender]) / 100;
        totalTokensSold += bonus;

        bonusTokensSold += bonus;
        require(bonusTokensSold <= BONUS_TOKENS_LIMIT);
        require(totalTokensSold <= ((nudgeToken.getSupplyCap() * 9) / 10));//changed TODO


        nudgeToken.mint(msg.sender, numberOfTokens + bonus);
        impetusAddress.transfer(msg.value);
        etherRaised += msg.value;

    }

    function whiteListAddress(address addr, bool whitelisted, uint bonus, uint requiredEtherContribution) onlyOwner public {
        require(bonus <= 30);
        whitelistedAddresses[addr] = whitelisted;
        bonuses[addr] = bonus;
        requiredEtherContributions[addr] = requiredEtherContribution * 1 ether;

    }

    function finalizePreICO() public onlyOwner {
        isActive = false;
    }

    function startPreICO() public onlyOwner {
        isActive = true;
    }

    modifier onlyWhitelisted {
        require(msg.value == requiredEtherContributions[msg.sender]);
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

    function getNormalTokensSold() constant returns(uint){
        return normalTokensSold;
    }

    function getBonusTokensSold() constant returns(uint){
        return bonusTokensSold;
    }

}