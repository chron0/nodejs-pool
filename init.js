"use strict";
let mysql = require("promise-mysql");
let fs = require("fs");
let argv = require('minimist')(process.argv.slice(2));
let config = fs.readFileSync("./config.json");
let coinConfig = fs.readFileSync("./coinConfig.json");
let protobuf = require('protocol-buffers');
let async = require('async');

global.support = require("./lib/support.js")();
global.config = JSON.parse(config);
global.protos = protobuf(fs.readFileSync('./lib/data.proto'));
let comms;
let coinInc;

// Config Table Layout
// <module>.<item>
if (global.config.hasOwnProperty('solo') && global.config.solo) {
    require('./lib/pool.js');
} else {
    if (argv.module === 'api') {
        global.mysql = mysql.createPool(global.config.mysql);
        global.support.getSQLConfig(function (config_data) {
                async.forEachOf(config_data, function (config_module, module_name, callback) {
                    if (!global.config.hasOwnProperty(module_name)) {
                        global.config[module_name] = {};
                    }
                    async.eachOfSeries(config_module, function (config_item, config_key, callback_int) {
                        if (global.config[module_name].hasOwnProperty(config_key)) {
                            return callback_int();
                        }
                        global.config[module_name][config_key] = config_item;
                        return callback_int();
                    }, function () {
                        callback();
                    });
                }, function () {
                    workerInit();
                });
            }
        );
    } else {
        global.support.getConfig(global.config.configHost, workerInit);
    }
}

function workerInit() {
    global.config['coin'] = JSON.parse(coinConfig)[global.config.coin];
    coinInc = require(global.config.coin.funcFile);
    global.coinFuncs = new coinInc();
    if (argv.module !== 'pool'){
        comms = require('./lib/local_comms');
        global.database = new comms();
        global.database.initEnv();
    }
    global.coinFuncs.blockedAddresses.push(global.config.pool.address);
    global.coinFuncs.blockedAddresses.push(global.config.payout.feeAddress);
    switch (argv.module) {
        case 'pool':
            require('./lib/pool.js');
            break;
        case 'blockManager':
            require('./lib/blockManager.js');
            break;
        case 'payments':
            require('./lib/payments.js');
            break;
        case 'api':
            require('./lib/api.js');
            break;
        case 'remoteShare':
            require('./lib/remoteShare.js');
            break;
        case 'worker':
            require('./lib/worker.js');
            break;
        case 'longRunner':
            require('./lib/longRunner.js');
            break;
        default:
            console.error("Invalid module provided.  Please provide a valid module");
            process.exit(1);
    }
}