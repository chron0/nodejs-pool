"use strict";
let lmdb = require('node-lmdb');
let now = require("performance-now");
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

let cached_data = getCache('minerList');

console.log(Object.keys(cached_data).length + ' known miners in the database');