let _ = require('lodash');

let NEXT_BET_ID = 10000000000;

const BET_DEFAULT_OPTIONS = {
    orderType: 'LIMIT',
    persistenceType: "LAPSE"
};

class EmulatorBet {
    constructor(selectionId, side, price, size, opts = {}) {
        let options = _.merge(_.cloneDeep(BET_DEFAULT_OPTIONS), opts);
        if (options.orderType != 'LIMIT') {
            throw new Error('Only orderType="LIMIT" orders are supported');
        }
        this.betId = NEXT_BET_ID++;
        this.orderType = options.orderType;
        this.selectionId = selectionId;
        this.side = side;
        this.limitOrder = {
            price: price,
            size: size,
            persistenceType: options.persistenceType
        };
        this.placedDate = (new Date()).toISOString();

        this.averagePriceMatched = 0;
        this.sizeMatched = 0;
        this.sizeRemaining = this.limitOrder.size;
        this.sizeLapsed = 0;
        this.sizeCancelled = 0;
        this.sizeVoided = 0;
    }

    getInstruction() {
        return {
            selectionId: this.selectionId,
            limitOrder: this.limitOrder,
            orderType: this.orderType,
            side: this.side
        }
    }

    getOrder() {
        return {
            betId: this.betId,
            orderType: this.orderType,
            status: 'EXECUTABLE',
            persistenceType: this.limitOrder.persistenceType,
            side: this.side,
            price: this.limitOrder.price,
            size: this.limitOrder.size,
            bspLiability: 0,
            placedDate: this.placedDate,
            avgPriceMatched: this.averagePriceMatched,
            sizeMatched: this.sizeMatched,
            sizeRemaining: this.sizeRemaining,
            sizeLapsed: this.sizeLapsed,
            sizeCancelled: this.sizeCancelled,
            sizeVoided: this.sizeVoided,
            isEmulatorBet: true
        };
    }

    lapse() {
        this.sizeLapsed = this.sizeRemaining;
        this.sizeRemaining = 0;
    }
}

module.exports = EmulatorBet;
