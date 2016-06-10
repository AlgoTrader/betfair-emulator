'use strict';

let _ = require('lodash');
let EmulatorMarket = require('./emulator_market.js');

const NETWORK_DELAY = 20; // ms, every API call is delayed this time
const BETTING_DELAY = 50; // ms caused by Malta roundtrip

class Emulator {
    constructor(logger) {
        this.log = logger;
        this.markets = new Map();
        this.log.debug('Emulator log started');
    }

    // control which markets are emulated
    enableEmulationForMarket(marketId) {
        this.log.info('started emulation for market: ' + marketId);
        this.markets.set(marketId, new EmulatorMarket(this.log, marketId));
    }

    disableEmulationForMarket(marketId) {
        this.log.info('stopped emulation for market: ' + marketId);
        this.markets.delete(marketId);
    }

    isEmulatedMarket(marketId) {
        return this.markets.has(marketId);
    }

    // getMarketBook feed, provides prices for emulator
    onListMarketBook(params, marketBooks) {
        this.log.debug('feed feedListMarketBook', marketBooks);
        _.each(marketBooks, (marketBook) => {
            if (!this.markets.has(marketBook.marketId)) {
                // skip not emulated markets
                return;
            }
            let marketEmulator = this.markets.get(marketBook.marketId);
            marketEmulator.onListMarketBook(params, marketBook);
        });
    }

    // handle orders
    placeOrders(params, cb = () => {}) {
        this.log.debug('placeOrders scheduled', params);
        let marketId = params.marketId;
        if (!this.markets.has(marketId)) {
            throw new Error('Market does not use emulator, marketId='+ marketId);
        }
        let market = this.markets.get(marketId);
        if(!market.initialized) {
            console.log('throw error');
            throw new Error('Cannot bet on uninitialized market, marketId='+marketId);
        }
        let delay = market.betDelay*1000 + NETWORK_DELAY +BETTING_DELAY;
        _.delay(() => {
            this.log.debug('placeOrders delayed execution, delay='+delay, params);
            market.placeOrders(params, cb);
        }, delay);
    }
}

module.exports = Emulator;