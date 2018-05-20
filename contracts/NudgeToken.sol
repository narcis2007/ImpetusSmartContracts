pragma solidity ^0.4.20;
/*
 * ERC20 interface
 * see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 {
    uint public totalSupply;

    function balanceOf(address who) constant returns (uint);
    function allowance(address owner, address spender) constant returns (uint);

    function transfer(address to, uint value) returns (bool ok);
    function transferFrom(address from, address to, uint value) returns (bool ok);
    function approve(address spender, uint value) returns (bool ok);
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}



/**
 * Math operations with safety checks
 */
contract SafeMath {
    function safeMul(uint a, uint b) internal returns (uint) {
        uint c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function safeDiv(uint a, uint b) internal returns (uint) {
        assert(b > 0);
        uint c = a / b;
        assert(a == b * c + a % b);
        return c;
    }

    function safeSub(uint a, uint b) internal returns (uint) {
        assert(b <= a);
        return a - b;
    }

    function safeAdd(uint a, uint b) internal returns (uint) {
        uint c = a + b;
        assert(c>=a && c>=b);
        return c;
    }

    function max64(uint64 a, uint64 b) internal constant returns (uint64) {
        return a >= b ? a : b;
    }

    function min64(uint64 a, uint64 b) internal constant returns (uint64) {
        return a < b ? a : b;
    }

    function max256(uint256 a, uint256 b) internal constant returns (uint256) {
        return a >= b ? a : b;
    }

    function min256(uint256 a, uint256 b) internal constant returns (uint256) {
        return a < b ? a : b;
    }

    function assert(bool assertion) internal {
        if (!assertion) {
            revert();
        }
    }
}



/**
 * Standard ERC20 token with Short Hand Attack and approve() race condition mitigation.
 *
 * Based on code by FirstBlood:
 * https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract StandardToken is ERC20, SafeMath {

    string public name;
    string public symbol;
    uint public decimals;

    /* Actual balances of token holders */
    mapping(address => uint) balances;

    /* approve() allowances */
    mapping (address => mapping (address => uint)) allowed;

    /**
     *
     * Fix for the ERC20 short address attack
     *
     * http://vessenes.com/the-erc20-short-address-attack-explained/
     */
    modifier onlyPayloadSize(uint size) {
        if(msg.data.length < size + 4) {
            revert();
        }
        _;
    }

    function transfer(address _to, uint _value) onlyPayloadSize(2 * 32) returns (bool success) {
        balances[msg.sender] = safeSub(balances[msg.sender], _value);
        balances[_to] = safeAdd(balances[_to], _value);
        Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint _value) returns (bool success) {
        uint _allowance = allowed[_from][msg.sender];

        balances[_to] = safeAdd(balances[_to], _value);
        balances[_from] = safeSub(balances[_from], _value);
        allowed[_from][msg.sender] = safeSub(_allowance, _value);
        Transfer(_from, _to, _value);
        return true;
    }

    function balanceOf(address _owner) constant returns (uint balance) {
        return balances[_owner];
    }

    function approve(address _spender, uint _value) returns (bool success) {

        // To change the approve amount you first have to reduce the addresses`
        //  allowance to zero by calling `approve(_spender, 0)` if it is not
        //  already 0 to mitigate the race condition described here:
        //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
        if ((_value != 0) && (allowed[msg.sender][_spender] != 0)) revert();

        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) constant returns (uint remaining) {
        return allowed[_owner][_spender];
    }

}





/**
 * Upgrade agent interface inspired by Lunyr.
 *
 * Upgrade agent transfers tokens to a new contract.
 * Upgrade agent itself can be the token contract, or just a middle man contract doing the heavy lifting.
 */
contract UpgradeAgent {

    uint public originalSupply;

    /** Interface marker */
    function isUpgradeAgent() public constant returns (bool) {
        return true;
    }

    function upgradeFrom(address _from, uint256 _value) public;

}


/**
 * A token upgrade mechanism where users can opt-in amount of tokens to the next smart contract revision.
 *
 * First envisioned by Golem and Lunyr projects.
 */
contract UpgradeableToken is StandardToken {

    /** Contract / person who can set the upgrade path. This can be the same as team multisig wallet, as what it is with its default value. */
    address public upgradeMaster;

    /** The next contract where the tokens will be migrated. */
    UpgradeAgent public upgradeAgent;

    /** How many tokens we have upgraded by now. */
    uint256 public totalUpgraded;

    /**
     * Upgrade states.
     *
     * - NotAllowed: The child contract has not reached a condition where the upgrade can bgun
     * - WaitingForAgent: Token allows upgrade, but we don't have a new agent yet
     * - ReadyToUpgrade: The agent is set, but not a single token has been upgraded yet
     * - Upgrading: Upgrade agent is set and the balance holders can upgrade their tokens
     *
     */
    enum UpgradeState {Unknown, NotAllowed, WaitingForAgent, ReadyToUpgrade, Upgrading}

    /**
     * Somebody has upgraded some of his tokens.
     */
    event Upgrade(address indexed _from, address indexed _to, uint256 _value);

    /**
     * New upgrade agent available.
     */
    event UpgradeAgentSet(address agent);

    /**
     * Do not allow construction without upgrade master set.
     */
    function UpgradeableToken(address _upgradeMaster) {
        upgradeMaster = _upgradeMaster;
    }

    /**
     * Allow the token holder to upgrade some of their tokens to a new contract.
     */
    function upgrade(uint256 value) public {

        UpgradeState state = getUpgradeState();
        if(!(state == UpgradeState.ReadyToUpgrade || state == UpgradeState.Upgrading)) {
            // Called in a bad state
            revert();
        }

        // Validate input value.
        if (value == 0) revert();

        balances[msg.sender] = safeSub(balances[msg.sender], value);

        // Take tokens out from circulation
        totalSupply = safeSub(totalSupply, value);
        totalUpgraded = safeAdd(totalUpgraded, value);

        // Upgrade agent reissues the tokens
        upgradeAgent.upgradeFrom(msg.sender, value);
        Upgrade(msg.sender, upgradeAgent, value);
    }

    /**
     * Set an upgrade agent that handles
     */
    function setUpgradeAgent(address agent) external {

        if(!canUpgrade()) {
            // The token is not yet in a state that we could think upgrading
            revert();
        }

        if (agent == 0x0) revert();
        // Only a master can designate the next agent
        if (msg.sender != upgradeMaster) revert();
        // Upgrade has already begun for an agent
        if (getUpgradeState() == UpgradeState.Upgrading) revert();

        upgradeAgent = UpgradeAgent(agent);

        // Bad interface
        if(!upgradeAgent.isUpgradeAgent()) revert();
        // Make sure that token supplies match in source and target
        if (upgradeAgent.originalSupply() != totalSupply) revert();

        UpgradeAgentSet(upgradeAgent);
    }

    /**
     * Get the state of the token upgrade.
     */
    function getUpgradeState() public constant returns(UpgradeState) {
        if(!canUpgrade()) return UpgradeState.NotAllowed;
        else if(address(upgradeAgent) == 0x00) return UpgradeState.WaitingForAgent;
        else if(totalUpgraded == 0) return UpgradeState.ReadyToUpgrade;
        else return UpgradeState.Upgrading;
    }

    /**
     * Change the upgrade master.
     *
     * This allows us to set a new owner for the upgrade mechanism.
     */
    function setUpgradeMaster(address master) public {
        if (master == 0x0) revert();
        if (msg.sender != upgradeMaster) revert();
        upgradeMaster = master;
    }

    /**
     * Child contract can enable to provide the condition when the upgrade can begun.
     */
    function canUpgrade() public constant returns(bool) {
        return true;
    }

}




/*
 * Ownable
 *
 * Base contract with an owner.
 * Provides onlyOwner modifier, which prevents function from running if it is called by anyone other than the owner.
 */
contract Ownable {
    address public owner;

    function Ownable() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert();
        }
        _;
    }

    function transferOwnership(address newOwner) onlyOwner {
        if (newOwner != address(0)) {
            owner = newOwner;
        }
    }

}




/**
 * Contract for releasing the token transfer after a successful crowdsale.
 */
contract ReleasableToken is StandardToken, Ownable {

    /* The finalizer contract that allows unlift the transfer limits on this token */
    address public releaseAgent;

    /** A crowdsale contract can release us to the wild if ICO success. If false we are are in transfer lock up period.*/
    bool public released = false;

    function ReleasableToken(){
        releaseAgent = msg.sender;
    }

    /**
     * Limit token transfer until the crowdsale is over.
     *
     */
    modifier canTransfer(address _sender) {

        if(!released) {
            revert();
        }

        _;
    }

    /**
     * Set the contract that can call release and make the token transferable.
     *
     * Design choice. Allow reset the release agent to fix fat finger mistakes.
     */
    function setReleaseAgent(address addr) onlyOwner inReleaseState(false) public {

        // We don't do interface check here as we might want to a normal wallet address to act as a release agent
        releaseAgent = addr;
    }

    /**
     * One way function to release the tokens to the wild.
     *
     * Can be called only from the release agent that is the final ICO contract. It is only called if the crowdsale has been success (first milestone reached).
     */
    function releaseTokenTransfer() public onlyReleaseAgent {
        released = true;
    }

    /** The function can be called only before or after the tokens have been releasesd */
    modifier inReleaseState(bool releaseState) {
        if(releaseState != released) {
            revert();
        }
        _;
    }

    /** The function can be called only by a whitelisted release agent. */
    modifier onlyReleaseAgent() {
        if(msg.sender != releaseAgent) {
            revert();
        }
        _;
    }

    function transfer(address _to, uint _value) canTransfer(msg.sender) returns (bool success) {
        // Call StandardToken.transfer()
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint _value) canTransfer(_from) returns (bool success) {
        // Call StandardToken.transferForm()
        return super.transferFrom(_from, _to, _value);
    }

}


/**
 * A token that can increase its supply by another contract.
 *
 * This allows uncapped crowdsale by dynamically increasing the supply when money pours in.
 * Only mint agents, contracts whitelisted by owner, can mint new tokens.
 *
 */
contract MintableToken is StandardToken, Ownable {

    /** List of agents that are allowed to create new tokens */
    mapping (address => bool) public mintAgents;
    bool public isMintingEnabled = true;

    event MintingAgentChanged(address addr, bool state  );


    /**
     * Create new tokens and allocate them to an address..
     *
     * Only callably by a crowdsale contract (mint agent).
     */
    function mint(address receiver, uint amount) onlyMintAgent canMint public {
        totalSupply = safePlus(totalSupply, amount);
        balances[receiver] = safePlus(balances[receiver], amount);

        // This will make the mint transaction apper in EtherScan.io
        // We can remove this after there is a standardized minting event
        Transfer(0, receiver, amount);
    }

    modifier canMint(){
        if(!isMintingEnabled) {
            revert();
        }
        _;
    }

    function stopMintingForever(){
        isMintingEnabled = false;
    }

    /**
     * Owner can allow a crowdsale contract to mint new tokens.
     */
    function setMintAgent(address addr, bool state) onlyOwner public {
        mintAgents[addr] = state;
        MintingAgentChanged(addr, state);
    }

    function safePlus(uint a, uint b) internal returns (uint) {
        uint c = a + b;
        assert(c>=a);
        return c;
    }

    modifier onlyMintAgent() {
        // Only crowdsale contracts are allowed to mint new tokens
        if(!mintAgents[msg.sender]) {
            revert();
        }
        _;
    }

}

/**
 * A token that can increase its supply by another contract up to a certain limit.
 *
 * This allows a capped crowdsale.
 * Only mint agents, contracts whitelisted by owner, can mint new tokens.
 *
 */
contract CappedMintableToken is MintableToken{
    /** The maximum number of tokens that can ever exist */
    uint256 public supplyCap;

    function CappedMintableToken(uint _supplyCap){
        supplyCap = _supplyCap;
    }

    function mint(address receiver, uint amount) onlyMintAgent public {
        // Check that the cap has not been reached before minting new tokens
        assert(safeAdd(totalSupply, amount) <= supplyCap);
        MintableToken.mint(receiver, amount);
    }

    function getSupplyCap() constant returns (uint){
        return supplyCap;
    }
}

contract BurnableToken is StandardToken {

    /** How many tokens we burned */
    event Burned(address burner, uint burnedAmount);

    /**
     * Burn extra tokens from a balance.
     *
     */
    function burn(uint burnAmount) {
        address burner = msg.sender;
        balances[burner] = safeSub(balances[burner], burnAmount);
        totalSupply = safeSub(totalSupply, burnAmount);
        Burned(burner, burnAmount);
    }
}

contract LockableToken is ReleasableToken {

    mapping (address => bool) public lockAgents;
    mapping (address => uint) public amountsLocked;
    mapping (address => uint) public periodsLocked;
    bool lockingActive = true;

    /**
     * Lock tokens from balance until a certain time.
     *
     */
    function lockFrom(address who, uint amount, uint daysLocked) onlyLockAgent isLockingActivated {
        require(balances[who] >= amount);
        require(daysLocked < 365); //don't lock more than a year

        balances[who] -= amount;
        amountsLocked[who] += amount;
        uint releaseTime = now + (daysLocked * 1 days);
        if(periodsLocked[who] > releaseTime) //if that address has tokens locked take the longest period
        releaseTime = periodsLocked[who];

        periodsLocked[who] = releaseTime;
    }

    function transfer(address _to, uint _value) returns (bool success) {
        return super.transfer(_to, tryToUnlockAndGetAvailableBallance(msg.sender, _value));
    }

    function transferFrom(address _from, address _to, uint _value) returns (bool success) {
        return super.transferFrom(_from, _to, tryToUnlockAndGetAvailableBallance(_from, _value));
    }

    function tryToUnlockAndGetAvailableBallance(address who, uint _value) returns (uint){
        if(amountsLocked[who] != 0){
            if(periodsLocked[who] < now){
                balances[who] += amountsLocked[who];
                amountsLocked[who] = 0;
            }
            if(_value > balances[who] && _value <= balanceOf(who))
            _value = balances[who];
        }
        return _value;
    }

    function balanceOf(address who) public constant returns (uint balance) {
        return balances[who] + amountsLocked[who];
    }

    modifier onlyLockAgent() {
        if(!lockAgents[msg.sender]) {
            revert();
        }
        _;
    }

    modifier isLockingActivated() {
        if(!lockingActive) {
            revert();
        }
        _;
    }

    function deactivateLockingForever() onlyOwner{
        lockingActive = false;
    }

    function setLockAgent(address who, bool isLockAgent) onlyOwner {
        lockAgents[who] = isLockAgent;
    }
}



contract NudgeToken is LockableToken, CappedMintableToken, UpgradeableToken, BurnableToken {

    function NudgeToken() CappedMintableToken(378 * (10 ** (7 + 8))) UpgradeableToken(msg.sender){
        symbol = "NUDGE";
        name = "NUDGE Token";
        decimals = 8;

    }

}