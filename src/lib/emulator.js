'use strict';

let _ = require('lodash');
let EmulatorMarket = require('./emulator_market.js');

const NETWORK_DELAY = 20; // 20ms, every API call is delayed this time
const BETTING_DELAY = 100; // 100ms caused by Malta roundtrip

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
        this.market.delete(marketId);
    }

    isEmulatedMarket(marketId) {
        return this.markets.has(marketId);
    }

    // getMarketBook feed, provides prices for emulator
    onListMarketBook(marketBooks) {
        this.log.debug('feed feedListMarketBook', marketBooks);
        _.each(marketBooks, (marketBook) => {
            if (!this.markets.has(marketBook.marketId)) {
                // skip not emulated markets
                return;
            }
            let marketEmulator = this.markets.get(marketBook.marketId);
            marketEmulator.onListMarketBook(marketBook);
        });
    }

    // handle orders
    placeOrders() {

    }
}

module.exports = Emulator;