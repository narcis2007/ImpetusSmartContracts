/**
 * Created by Narcis2007 on 13.05.2018.
 */
'use strict';
const BigNumber = require('bignumber.js')

var NudgeToken = artifacts.require("NudgeToken");
var ImpetusPreICO = artifacts.require("ImpetusPreICO");


contract('ImpetusPreICO', async (accounts) => {

    describe('pre-ico safety checks', function() {

        it('should return the correct number of tokens for the number of ETH contributed',async () => {
            let preIco = await ImpetusPreICO.new();
            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1000, "szabo") / (10 ** 8));

            assert.equal((await preIco.calculateNumberOfTokensFromWeisReceived(web3.toWei(1000, "szabo"))).toString(), new BigNumber(1).mul(new BigNumber('10').pow(8)).toString());

            assert.equal((await preIco.calculateNumberOfTokensFromWeisReceived(web3.toWei(1, "ether"))).toString(), new BigNumber(1000).mul(new BigNumber('10').pow(8)).toString());
        });

        it('should only let the owner whitelist addresses',async () => {
            let preIco = await ImpetusPreICO.new();

            await preIco.whiteListAddress(accounts[0], true, 0);

            assert.equal(await preIco.whitelistedAddresses(accounts[0]), true);

            try {
                await preIco.whiteListAddress(accounts[1], true, 0);
                assert.fail("should have thrown an error")
            } catch (error) {
                //ok
            }
        });

        it('should only allow contribution once the pre-ico is active',async () => {
            let preIco = await ImpetusPreICO.new();
            let token = await NudgeToken.new();
            await preIco.whiteListAddress(accounts[0], true, 0);
            await token.setMintAgent(preIco.address, true);
            await token.setLockAgent(preIco.address, true);
            await preIco.setNudgeToken(token.address);

            await preIco.startPreICO();
            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1000, "szabo") / (10 ** 8));

            await preIco.send(web3.toWei(1000, "szabo" ));

            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(1).mul(new BigNumber('10').pow(8)).toString());

            await preIco.finalizePreICO();

            try {
                await preIco.send(web3.toWei(1000, "szabo" ));
                assert.fail("should have thrown an error")
            } catch (error) {
                //ok
            }
        });

        it('should give and lock the bonus',async () => {
            let preIco = await ImpetusPreICO.new();
            let token = await NudgeToken.new();
            await preIco.whiteListAddress(accounts[0], true, 20);
            await token.setMintAgent(preIco.address, true);
            await token.setLockAgent(preIco.address, true);
            await preIco.setNudgeToken(token.address);
            await preIco.setImpetusAddress(accounts[1]);
            await preIco.startPreICO();

            preIco.setSmallestTokenUnitPriceInWei(web3.toWei(1000, "szabo") / (10 ** 8));

            await preIco.send(web3.toWei(1000, "szabo" ));

            assert.equal((await preIco.getTotalTokensSold()).toString(), new BigNumber(1.2).mul(new BigNumber('10').pow(8)).toString());

            assert.equal((await token.balanceOf(accounts[0])).toString(), new BigNumber(1.2).mul(new BigNumber('10').pow(8)).toString() , "ballance incorrect");
            assert.equal(await token.amountsLocked(accounts[0]), new BigNumber(0.2).mul(new BigNumber('10').pow(8)).toString(), "amount locked incorrect");



            assert.equal((await web3.eth.getBalance(accounts[1])).toString(), new BigNumber(web3.toWei(1000, "szabo")).add(new BigNumber(web3.toWei(100, "ether"))).toString(), "amount of ETH received incorrect");


        });
    });

    // describe('full pre-ico flow', function() {
    //
    //     it('should return the correct supplyCap after construction',async () => {
    //         let token = await NudgeToken.new();
    //         let preIco = await ImpetusPreICO.new();
    //         await token.setMintAgent(preIco.address, true);
    //         await preIco.setNudgeToken(token.address);
    //
    //     });
    // });
});