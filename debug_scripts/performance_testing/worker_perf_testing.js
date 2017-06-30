"use strict";
let lmdb = require('node-lmdb');
let now = require("performance-now");
let env = new lmdb.Env();
let argv = require('minimist')(process.argv.slice(2));
const sprintf = require("sprintf-js").sprintf;
env.open({
        path: argv.db_path,
        maxDbs: 10,
        mapSize: 1024 * 1024 * 1024,
        noSync: false,
        mapAsync: true,
        useWritemap: false,
        noMetaSync: true,
        maxReaders: 512
    });
let shareDB = env.openDbi({
        name: 'shares',
        create: true,
        dupSort: true,
        dupFixed: false,
        integerDup: true,
        integerKey: true,
        keyIsUint32: true
    });
let blockDB = env.openDbi({
        name: 'blocks',
        create: true,
        integerKey: true,
        keyIsUint32: true
    });
let cacheDB = env.openDbi({
        name: 'cache',
        create: true
    });

let getCache = function(cacheKey){
    try {
        let txn = env.beginTxn({readOnly: true});
        let lmdb_load_start = now();
        let cached = txn.getString(cacheDB, cacheKey);
        let lmdb_load_end = now();
        txn.abort();
        if (cached !== null){
            let json_parse_start = now();
            let parse_data = JSON.parse(cached);
            let json_parse_end = now();
            console.log('Spent ' + (lmdb_load_end-lmdb_load_start).toFixed(3) + 'ms loading data from LMDB');
            console.log('Spent ' + (json_parse_end-json_parse_start).toFixed(3) + 'ms parsing the LMDB data');
            return parse_data;
        }
    } catch (e) {
        return false;
    }
    return false;
};

let cache_updates = {};
let locTime = Date.now() - 600000;
let localStats = {pplns: 0, pps: 0, solo: 0, prop: 0, global: 0, miners: {}};
let localMinerCount = {pplns: 0, pps: 0, solo: 0, prop: 0, global: 0};
let localTimes = {
    pplns: locTime, pps: locTime, solo: locTime, prop: locTime,
    global: locTime, miners: {}
};
let minerList = [];
let identifiers = {};
let currentTime = Date.now();
let cycleCount = 0;
let activeAddresses = [];
let globalMinerList = getCache('minerList');
// pplns: 0, pps: 0, solo: 0, prop: 0, global: 0
['pplns', 'pps', 'solo', 'prop', 'global'].forEach(function (key) {
    let cachedData = getCache(key + "_stats");
    let parsing_pool_stats_start = now();
    if (cachedData !== false) {
        cachedData.hash = Math.floor(localStats[key] / 600);
        cachedData.lastHash = localTimes[key];
        cachedData.minerCount = localMinerCount[key];
        if (!cachedData.hasOwnProperty("hashHistory")) {
            cachedData.hashHistory = [];
            cachedData.minerHistory = [];
        }
        if (cycleCount === 0) {
            cachedData.hashHistory.unshift({ts: currentTime, hs: cachedData.hash});
            if (cachedData.hashHistory.length > 120) {
                while (cachedData.hashHistory.length > 120) {
                    cachedData.hashHistory.pop();
                }
            }
            cachedData.minerHistory.unshift({ts: currentTime, cn: cachedData.minerCount});
            if (cachedData.minerHistory.length > 120) {
                while (cachedData.minerHistory.length > 120) {
                    cachedData.minerHistory.pop();
                }
            }
        }
    } else {
        cachedData = {
            hash: Math.floor(localStats[key] / 600),
            totalHashes: 0,
            lastHash: localTimes[key],
            minerCount: localMinerCount[key],
            hashHistory: [{ts: currentTime, hs: cachedData.hash}],
            minerHistory: [{ts: currentTime, cn: cachedData.hash}]
        };
    }
    cache_updates[key + "_stats"] = cachedData;
    let parsing_pool_stats_end = now();
    console.log('Spent ' + (parsing_pool_stats_end-parsing_pool_stats_start).toFixed(3) + 'ms parsing the ' + key + ' data');
});
console.log('Performing removal state with no miners in the list - indexOf');
let start = now();
globalMinerList.forEach(function (miner) {
    if (minerList.indexOf(miner) === -1) {
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
let end = now();
console.log('Spent ' + (start-end).toFixed(3) + 'ms on this');
console.log('Performing removal state with all miners in the list - indexOf');
minerList = Object.keys(globalMinerList);
start = now();
globalMinerList.forEach(function (miner) {
    if (minerList.indexOf(miner) === -1) {
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
end = now();
console.log('Spent ' + (start-end).toFixed(3) + 'ms on this');

minerList = {};
console.log('Performing removal state with no miners in the list - in');
start = now();
globalMinerList.forEach(function (miner) {
    if (miner in minerList) {
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
end = now();
console.log('Spent ' + (start-end).toFixed(3) + 'ms on this');
console.log('Performing removal state with all miners in the list - in');
minerList = globalMinerList;
start = now();
globalMinerList.forEach(function (miner) {
    if (miner in minerList) {
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
end = now();
console.log('Spent ' + (start-end).toFixed(3) + 'ms on this');