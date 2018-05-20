/**
 * Created by Narcis2007 on 13.05.2018.
 */
'use strict';
const BigNumber = require('bignumber.js')
const expectThrow = require('./expectThrow.js')

var NudgeToken = artifacts.require("NudgeToken");
var ImpetusPreICO = artifacts.require("ImpetusPreICO");

contract('ImpetusPreICO', async (accounts) => { //todo: verific whitelist amount

    describe('pre-ico safety checks', function() {

        it('should return the correct number of tokens for the number of ETH contributed',async () => {
            let preIco = await ImpetusPreICO.new();
            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1000, "szabo") / (10 ** 8));

            assert.equal((await preIco.calculateNumberOfTokensFromWeisReceived(web3.toWei(1000, "szabo"))).toString(), new BigNumber(1).mul(new BigNumber('10').pow(8)).toString());

            assert.equal((await preIco.calculateNumberOfTokensFromWeisReceived(web3.toWei(1, "ether"))).toString(), new BigNumber(1000).mul(new BigNumber('10').pow(8)).toString());
        });

        it('should only let the owner whitelist addresses',async () => {
            let preIco = await ImpetusPreICO.new();

            await preIco.whiteListAddress(accounts[0], true, 0, 1);

            assert.equal(await preIco.whitelistedAddresses(accounts[0]), true);

            await expectThrow( preIco.whiteListAddress(accounts[1], true, 0, 1,{ from: accounts[2]}));

        });

        it('should only allow a bonus of up to 30%',async () => {
            let preIco = await ImpetusPreICO.new();

            await preIco.whiteListAddress(accounts[0], true, 30, 1);

            assert.equal(await preIco.whitelistedAddresses(accounts[0]), true);

            await expectThrow(  preIco.whiteListAddress(accounts[1], true, 31, 1));

            await preIco.whiteListAddress(accounts[2], true, 1, 1);
            assert.equal(await preIco.whitelistedAddresses(accounts[2]), true);

        });

        it('should only allow contribution once the pre-ico is active',async () => {
            let preIco = await ImpetusPreICO.new();
            let token = await NudgeToken.new();
            await preIco.whiteListAddress(accounts[0], true, 0, 1);
            await token.setMintAgent(preIco.address, true);
            await preIco.setNudgeToken(token.address);

            await expectThrow( preIco.send(web3.toWei(1, "ether" )));

            await preIco.startPreICO();
            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1, "ether") / (10 ** 8));

            await preIco.send(web3.toWei(1, "ether" ));

            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(1).mul(new BigNumber('10').pow(8)).toString());

            await preIco.finalizePreICO();

            await expectThrow(  preIco.send(web3.toWei(1, "ether" )));
        });

        it('should give the bonus',async () => {
            let preIco = await ImpetusPreICO.new();
            let token = await NudgeToken.new();
            await preIco.whiteListAddress(accounts[0], true, 20, 1);
            await token.setMintAgent(preIco.address, true);
            await preIco.setNudgeToken(token.address);
            await preIco.setImpetusAddress(accounts[1]);
            await preIco.startPreICO();

            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1, "ether") / (10 ** 8));

            await preIco.sendTransaction({ from: accounts[0], value: web3.toWei(1, "ether") });

            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(1.2).mul(new BigNumber('10').pow(8)).toString());
            assert.equal((await preIco.getNormalTokensSold()).toString(), new BigNumber(1).mul(new BigNumber('10').pow(8)).toString());
            assert.equal((await preIco.getBonusTokensSold()).toString(), new BigNumber(0.2).mul(new BigNumber('10').pow(8)).toString());
            assert.equal((await token.balanceOf(accounts[0])).toString(), new BigNumber(1.2).mul(new BigNumber('10').pow(8)).toString() , "ballance incorrect");
            assert.equal((await web3.eth.getBalance(accounts[1])).toString(), new BigNumber(web3.toWei(101, "ether")).toString(), "amount of ETH received incorrect");
        });

        it('should not allow gas price of over 100 gwei',async () => {
            let preIco = await ImpetusPreICO.new();
            let token = await NudgeToken.new();
            await preIco.whiteListAddress(accounts[0], true, 20, 1);
            await token.setMintAgent(preIco.address, true);
            await preIco.setNudgeToken(token.address);
            await preIco.setImpetusAddress(accounts[3]);
            await preIco.startPreICO();

            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1, "ether") / (10 ** 8));

            await expectThrow( preIco.sendTransaction({ from: accounts[0], value: web3.toWei(1, "ether"), gasPrice: web3.toWei(101, "gwei") }));
            await preIco.sendTransaction({ from: accounts[0], value: web3.toWei(1, "ether"), gasPrice: web3.toWei(99, "gwei") });

            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(1.2).mul(new BigNumber('10').pow(8)).toString());
            assert.equal((await preIco.getNormalTokensSold()).toString(), new BigNumber(1).mul(new BigNumber('10').pow(8)).toString());
            assert.equal((await preIco.getBonusTokensSold()).toString(), new BigNumber(0.2).mul(new BigNumber('10').pow(8)).toString());

            assert.equal((await token.balanceOf(accounts[0])).toString(), new BigNumber(1.2).mul(new BigNumber('10').pow(8)).toString() , "ballance incorrect");

            assert.equal((await web3.eth.getBalance(accounts[3])).toString(), new BigNumber(web3.toWei(101, "ether")).toString(), "amount of ETH received incorrect");


        });
    });

    describe('full pre-ico flow', function() {

        it('should work', async () => {
            let token = await NudgeToken.new();
            let preIco = await ImpetusPreICO.new();
            await token.setMintAgent(preIco.address, true);
            await preIco.setNudgeToken(token.address);
            await preIco.setImpetusAddress(accounts[9]);

            preIco.setSmallestTokenUnitPriceInWei(125000); //Price: 0.0000125 ETH/NUDGE - 80,000 NUDGE/ETH


            await preIco.whiteListAddress(accounts[0], true, 0, 1);

            await preIco.whiteListAddress(accounts[1], true, 30, 1);

            await preIco.startPreICO();


            await expectThrow( preIco.sendTransaction({ from: accounts[8], value: web3.toWei(1, "ether") }));

            assert.equal((await web3.eth.getBalance(accounts[9])).toString(), new BigNumber(web3.toWei(100, "ether")).toString(), "amount of ETH incorrect");

            await preIco.sendTransaction({ from: accounts[0], value: web3.toWei(1, "ether") }); // contribute with 1 ETH

            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(80000).mul(new BigNumber('10').pow(8)).toString()); //should recevie 80 000 whole tokens

            assert.equal((await token.balanceOf(accounts[0])).toString(), new BigNumber(80000).mul(new BigNumber('10').pow(8)).toString() , "ballance incorrect");

            await preIco.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
            //should recevie 80 000 whole tokens and 30% bonus
            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(160000 + (80000 * 30 / 100)).mul(new BigNumber('10').pow(8)).toString());

            assert.equal((await token.balanceOf(accounts[1])).toString(), new BigNumber(80000 + (80000 * 30 / 100)).mul(new BigNumber('10').pow(8)).toString() , "ballance incorrect");


            assert.equal((await web3.eth.getBalance(accounts[9])).toString(), new BigNumber(web3.toWei(102, "ether")).toString(), "amount of ETH incorrect");

            //should not be able to transfer untill the token is released
            await expectThrow( token.transfer(accounts[1], new BigNumber(80000).mul(new BigNumber('10').pow(8)), { from: accounts[0] }));
            await preIco.finalizePreICO();
            await expectThrow( preIco.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") }));
            await token.stopMintingForever();

            await token.releaseTokenTransfer();

            await token.transfer(accounts[2], new BigNumber(80000 + (80000 * 30 / 100)).mul(new BigNumber('10').pow(8)), { from: accounts[1] });
            assert.equal((await token.balanceOf(accounts[1])).toString(), 0 , "ballance incorrect");

            assert.equal((await token.balanceOf(accounts[2])).toString(), new BigNumber(80000 + (80000 * 30 / 100)).mul(new BigNumber('10').pow(8)).toString() , "ballance incorrect");

        });
    });
});

