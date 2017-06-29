"use strict";
let lmdb = require('node-lmdb');
let env = new lmdb.Env();
let argv = require('minimist')(process.argv.slice(2));
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
        console.time('load_cache_data');
        let cached = txn.getString(this.cacheDB, cacheKey);
        console.timeEnd('load_cache_data');
        txn.abort();
        if (cached !== null){
            console.time('cache_parse');
            let parse_data = JSON.parse(cached);
            console.timeEnd('cache_parse');
            return parse_data;
        }
    } catch (e) {
        return false;
    }
    return false;
};

console.time('load_miner_list');
getCache('minerList');
console.timeEnd('load_miner_list');