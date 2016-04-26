'use strict';

let _ = require('lodash');
let utils = require('./utils.js');

class EmulatorMarket {
    constructor(logger, marketId) {
        this.log = logger;
        this.marketId = marketId;
        this.initialized = false;
    }

    onListMarketBook(marketBook) {
        if (marketBook.marketId != this.marketId) {
            throw new Error('onListMarketBook marketId mismatch');
        }

        this.log.debug('feed feedListMarketBook for market: ' + this.marketId);

        this.status = marketBook.status;
        this.betDelay = marketBook.betDelay;
        this.inplay = marketBook.inplay;
        this.version = marketBook.version;
        _.each(marketBook.runners, (runner) => {
            let availableToBack = _.cloneDeep(runner.ex.availableToBack);
            let backAvailability = [];
            _.reduce(availableToBack, (acc, item) => {
                acc += item.size;
                item.size = utils.normalizeSize(acc);
                backAvailability.push(item);
                return acc;
            } , 0);
            this.log.debug('back availability', backAvailability);
        });

        this.initialized = true;
    }
}

module.exports = EmulatorMarket;