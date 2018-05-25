/**
 * Created by Narcis2007 on 12.05.2018.
 */
'use strict';

const expectThrow = require('./expectThrow.js')
const BigNumber = require('bignumber.js')
var NudgeToken = artifacts.require("NudgeToken");


contract('NudgeToken', async (accounts) => {

    const MAX_SUPPLY = new BigNumber('3780000000').mul(new BigNumber('10').pow(8));

    describe('token', function() {

        it('should return the correct supplyCap after construction',async () => {
            let token = await NudgeToken.new()
            let totalSupply = await token.getSupplyCap()
            assert.equal(totalSupply.toNumber(), MAX_SUPPLY)
        });

        it('should have the name NUDGE Token', async function() {
            let token = await NudgeToken.new()
            let name = await token.name()
            assert.equal(name, "NUDGE Token", "NUDGE Token wasn't the name")
        });

        it('should have the symbol NUDGE', async function() {
            let token = await NudgeToken.new()
            let symbol = await token.symbol()
            assert.equal(symbol, "NUDGE", "NUDGE wasn't the symbol")
        });

        it('should have 8 decimals', async function() {
            let token = await NudgeToken.new()
            let decimals = await token.decimals()
            assert.equal(decimals, 8, "8 wasn't the number of decimals")
        });
    });

    describe('transfers', function () {

        it('should allow transfer() 100 NUDGE units from accounts[0] to accounts[1]', async function() {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let amount = 100

            // initial account[0] and account[1] balance
            let account0StartingBalance = await token.balanceOf(accounts[0])
            let account1StartingBalance = await token.balanceOf(accounts[1])

            // transfer amount from account[0] to account[1]
            await token.transfer(accounts[1], amount, { from: accounts[0] })

            // final account[0] and account[1] balance
            let account0EndingBalance = await token.balanceOf(accounts[0])
            let account1EndingBalance = await token.balanceOf(accounts[1])

            assert.equal(account0EndingBalance.toNumber(), account0StartingBalance.toNumber() - amount, "Balance of account 0 incorrect")
            assert.equal(account1EndingBalance.toNumber(), account1StartingBalance.toNumber() + amount, "Balance of account 1 incorrect")
        });

        it('should throw an error when trying to transfer more than a balance', async function () {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[1], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let accountStartingBalance = await token.balanceOf(accounts[1]);
            let amount = accountStartingBalance + 1;
            await expectThrow(  token.transfer(accounts[2], amount, { from: accounts[1] }));
        });

        it('should throw an error when trying to transfer when the token is not yet released', async function () {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[1], MAX_SUPPLY);
            await expectThrow(  token.transfer(accounts[2], 1, { from: accounts[1] }));
        });
    });

    describe('minting', function () {

        it('should throw an error when trying to mint more than the maximum supply cap', async function () {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await expectThrow(  token.mint(accounts[1], MAX_SUPPLY +1));
            assert.equal(await token.totalSupply(), 0, "totalSupply not 0")
        });

        it('should throw an error when trying to mint after the minting has been stopped', async function () {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[1], 1);
            await token.stopMintingForever();
            await expectThrow( token.mint(accounts[1], 1));
            assert.equal(await token.totalSupply(), 1, "totalSupply incorrect")
        });
    });

    describe('lock', function() {

        it('should be able to lock tokens and transfer only those available',async () => {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            await token.setLockAgent(accounts[0], true);
            await token.lockFrom(accounts[0], 1, 1); //lock from acc[0] 1 token for 1 day

            assert.equal((await token.balanceOf(accounts[0])).toString(), MAX_SUPPLY.toString() , "balance incorrect");
            assert.equal(await token.amountsLocked(accounts[0]), 1, "amount locked incorrect");

            await token.transfer(accounts[1], MAX_SUPPLY, { from: accounts[0] });
            assert.equal(await token.balanceOf(accounts[0]), 1 , "balance incorrect");
            assert.equal((await token.balanceOf(accounts[1])).toString(), (MAX_SUPPLY.sub(1)).toString() , "balance incorrect");

            web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [17000000], id: 0})
            web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})

            await token.transfer(accounts[1], 1, { from: accounts[0] });
            assert.equal(await token.balanceOf(accounts[0]), 0 , "balance incorrect");
            assert.equal((await token.balanceOf(accounts[1])).toString(), MAX_SUPPLY.toString() , "balance incorrect");
        });

        it('should be able to lock tokens and throw an exception if more tokens than the locked and unlocked balance are transfered',async () => {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY.sub(10));
            await token.mint(accounts[2], 10);
            await token.releaseTokenTransfer();
            await token.setLockAgent(accounts[0], true);
            await token.lockFrom(accounts[0], 1, 1); //lock from acc[0] 1 token for 1 day

            assert.equal((await token.balanceOf(accounts[0])).toString(), MAX_SUPPLY.sub(10).toString() , "balance incorrect");
            assert.equal(await token.amountsLocked(accounts[0]), 1, "amount locked incorrect");
            await expectThrow( token.transfer(accounts[1], MAX_SUPPLY.sub(1), { from: accounts[0] }));
        });

        it('should not be able to lock tokens after this function has been deactivated',async () => {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            await token.setLockAgent(accounts[0], true);
            await token.lockFrom(accounts[0], 1, 1); //lock from acc[0] 1 token for 1 day

            assert.equal((await token.balanceOf(accounts[0])).toString(), MAX_SUPPLY.toString() , "balance incorrect");
            assert.equal(await token.amountsLocked(accounts[0]), 1, "amount locked incorrect");
            await token.deactivateLockingForever();
            await expectThrow(  token.lockFrom(accounts[0], 1, 1));
        });

        it('should be able to lock twice or more',async () => {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            await token.setLockAgent(accounts[0], true);
            await token.lockFrom(accounts[0], 1, 1); //lock from acc[0] 1 token for 0 days
            await token.lockFrom(accounts[0], 1, 2); //lock from acc[0] 1 token for 0 days

            assert.equal((await token.balanceOf(accounts[0])).toString(), MAX_SUPPLY.toString() , "balance incorrect");
            assert.equal(await token.amountsLocked(accounts[0]), 2, "amount locked incorrect");

        });

        //

    });

    describe('allowance', function () {

        it('should return the correct allowance amount after approval', async function () {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let amount = 100;

            //owner(account[0]) approves to account[1] to spend the amount
            await token.approve(accounts[1], amount);

            //checking the amount that an owner allowed to
            let allowance = await token.allowance(accounts[0], accounts[1]);
            assert.equal(allowance, amount, "The amount allowed is not equal!")

            //checking the amount to a not allowed account
            let non_allowance = await token.allowance(accounts[0], accounts[2]);
            assert.equal(non_allowance, 0, "The amount allowed is not equal!")
        });

        it('should allow transfer from allowed account', async function () {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let amount = 100;

            let account0StartingBalance = await token.balanceOf(accounts[0]);
            let account1StartingBalance = await token.balanceOf(accounts[1]);
            let account2StartingBalance = await token.balanceOf(accounts[2]);
            assert.equal(account1StartingBalance, 0);
            assert.equal(account2StartingBalance, 0);

            //owner(account[0]) approves to account[1] to spend the amount
            await token.approve(accounts[1], amount);

            //account[1] orders a transfer from owner(account[0]) to account[1]
            await token.transferFrom(accounts[0], accounts[2], amount, {from : accounts[1]});
            let account0AfterTransferBalance = await token.balanceOf(accounts[0]);
            let account1AfterTransferBalance = await token.balanceOf(accounts[1]);
            let account2AfterTransferBalance = await token.balanceOf(accounts[2]);

            assert.equal(account0StartingBalance - amount, account0AfterTransferBalance);
            assert.equal(account1AfterTransferBalance, 0);
            assert.equal(amount, account2AfterTransferBalance)
        });

        it('should throw an error when trying to transfer more than allowed', async function() {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let amount = 100;

            //owner(account[0]) approves to account[1] to spend the amount
            await token.approve(accounts[1], amount);

            let overflowed_amount = amount + 1;
            await expectThrow(  token.transferFrom(accounts[0], accounts[2], overflowed_amount, {from: accounts[1]}));
        })

        it('should throw an error when trying to transfer from not allowed account', async function() {
            let token = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let amount = 100;
            await expectThrow( token.transferFrom(accounts[0], accounts[2], amount, {from: accounts[1]}))
        })
    });

    describe('burnable', function () {

        it('owner should be able to burn tokens', async function () {
            let token                = await NudgeToken.new();
            await token.setMintAgent(accounts[0], true);
            await token.mint(accounts[0], MAX_SUPPLY);
            await token.releaseTokenTransfer();
            let balance              = await token.balanceOf(accounts[0]);
            let totalSupply          = await token.totalSupply();
            let luckys_burned_amount = 100;
            let expectedTotalSupply  = totalSupply - luckys_burned_amount;
            let expectedBalance      = balance - luckys_burned_amount

            const {logs} = await token.burn(luckys_burned_amount);
            let final_supply = await token.totalSupply();
            let final_balance = await token.balanceOf(accounts[0]);
            assert.equal(expectedTotalSupply, final_supply, "Supply after burn do not fit.");
            assert.equal(expectedBalance, final_balance, "Supply after burn do not fit.");

            const event = logs.find(e => e.event === 'Burned');
            assert.notEqual(event, undefined, "Event Burned not fired!")
        });

        it('Can not burn more tokens than your balance', async function () {
            let token = await NudgeToken.new();
            let totalSupply = await token.totalSupply();
            let luckys_burnable_amount = totalSupply + 1;
            await expectThrow(  token.burn(luckys_burnable_amount));
        });
    });
});