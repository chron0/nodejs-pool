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

let cached_data = {};
console.time('full_cache_load');
let txn = env.beginTxn({readOnly: true});
console.time('lmdb_data_grab');
let cached = txn.getString(cacheDB, 'minerList');
console.timeEnd('lmdb_data_grab');
txn.abort();
if (cached !== null){
    console.time('cache_parse');
    cached_data = JSON.parse(cached);
    console.timeEnd('cache_parse');
}
console.timeEnd('full_cache_load');

console.log(Object.keys(cached_data).length + ' known miners in the database');