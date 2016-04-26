let _ = require('lodash');

let NEXT_BET_ID = 10000000000;

const BET_DEFAULT_OPTIONS = {
    orderType: 'LIMIT',
    persistenceType: "LAPSE"
};

class EmulatorBet {
    constructor(selectionId, side, price, size, opts = {}) {
        let options = _.merge(_.cloneDeep(BET_DEFAULT_OPTIONS), opts);
        if(options.orderType!='LIMIT') {
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
        }
    }
}

module.exports = EmulatorBet;
