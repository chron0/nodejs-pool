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
        let cached = txn.getString(cacheDB, cacheKey);
        txn.abort();
        if (cached !== null){
            return JSON.parse(cached);
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
let currentTime = Date.now();
let cycleCount = 0;
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
let intCounter = 0;
let start = now();
globalMinerList.forEach(function (miner) {
    if (minerList.indexOf(miner) === -1) {
        intCounter += 1;
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
let end = now();
console.log('Spent ' + (end-start).toFixed(3) + 'ms on this - parsed: ' + intCounter);
console.log('Performing removal state with all miners in the list - indexOf');
minerList = Object.keys(globalMinerList);
intCounter = 0;
start = now();
globalMinerList.forEach(function (miner) {
    if (minerList.indexOf(miner) === -1) {
        intCounter += 1;
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
end = now();
console.log('Spent ' + (end-start).toFixed(3) + 'ms on this - parsed: ' + intCounter);

let globalMinerObject = {};
globalMinerList.forEach(function(miner){
    globalMinerObject[miner] = true;
});
minerList = {};
console.log('Performing removal state with no miners in the list - in');
intCounter = 0;
start = now();
globalMinerList.forEach(function (miner) {
    if (!(miner in minerList)) {
        intCounter += 1;
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
end = now();
console.log('Spent ' + (end-start).toFixed(3) + 'ms on this - parsed: ' + intCounter);
console.log('Performing removal state with all miners in the list - in');
intCounter = 0;
start = now();
globalMinerList.forEach(function (miner) {
    if (!(miner in globalMinerObject)) {
        intCounter += 1;
        let minerStats = getCache(miner);
        if (minerStats.hash !== 0) {
            minerStats.hash = 0;
            cache_updates[miner] = minerStats;
        }
    }
});
end = now();
console.log('Spent ' + (end-start).toFixed(3) + 'ms on this - parsed: ' + intCounter);