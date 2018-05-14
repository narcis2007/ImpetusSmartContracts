/**
 * Created by Narcis2007 on 12.05.2018.
 */
var NudgeToken = artifacts.require("NudgeToken");
var ImpetusPreICO = artifacts.require("ImpetusPreICO");

module.exports = function(deployer, network, accounts) {

    var token = null;

    return deployer.deploy(NudgeToken, { from: accounts[0], gas: 4700000 }).then(() => {
            return NudgeToken.deployed().then(instance => { token = instance })
    }).then(() => {
        deployer.deploy(ImpetusPreICO, { from: accounts[0], gas: 4700000 }).then(() => {
            return ImpetusPreICO.deployed().then(instance => {
                // set token addr
                 })
        })
    })
};