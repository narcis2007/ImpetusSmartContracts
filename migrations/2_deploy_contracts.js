/**
 * Created by Narcis2007 on 12.05.2018.
 */
var NudgeToken = artifacts.require("NudgeToken");

module.exports = function(deployer, network, accounts) {

    var token = null;

    return deployer.deploy(NudgeToken, { from: accounts[0], gas: 4700000 }).then(() => {
            return NudgeToken.deployed().then(instance => { token = instance })
    })
};