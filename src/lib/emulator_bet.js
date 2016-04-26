let NEXT_BET_ID = 1000000000;

class EmulatorBet {
    constructor(marketId, selectionId, side, price, size) {
        this.id = NEXT_BET_ID++;
        this.marketId = marketId
        this.selectionId = selectionId;
        this.side = side;
        this.price = price;
        this.size = size;
    }
}

module.exports = EmulatorBet;
