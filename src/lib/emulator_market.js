class EmulatorMarket {
    constructor(logger, marketId) {
        this.log = logger;
        this.martketId = marketId;
    }

    feedListMarketBook(marketBook) {
        this.log.debug('feed feedListMarketBook for market: '+marketId);
    }
}

module.exports = EmulatorMarket;