'use strict';

let _ = require('lodash');
let utils = require('./utils.js');
let EmulatorBet = require('./emulator_bet.js');

class EmulatorMarket {
    constructor(logger, marketId) {
        this.log = logger;
        this.marketId = marketId;
        this.initialized = false;
        this.runners = {};
        this.matchedBets = new Map();
        this.unmatchedBets = new Map();
    }

    _matchBets() {

    }

    onListMarketBook(marketBook) {
        if (marketBook.marketId != this.marketId) {
            throw new Error('onListMarketBook marketId mismatch');
        }

        this.log.debug('onListMarketBook for market: ' + this.marketId);

        this.status = marketBook.status;
        this.betDelay = marketBook.betDelay;
        this.inplay = marketBook.inplay;
        this.version = marketBook.version;
        _.each(marketBook.runners, (runner) => {
            // avaliable to BACK
            let availableToBack = _.cloneDeep(runner.ex.availableToBack);
            let backAvailability = [];
            _.reduce(availableToBack, (acc, item) => {
                acc += item.size;
                item.size = utils.normalizeSize(acc);
                backAvailability.push(item);
                return acc;
            }, 0);
            this.log.debug('back availability', backAvailability);

            // avaliable to lAY
            let availableToLay = _.cloneDeep(runner.ex.availableToLay);
            let layAvailability = [];
            _.reduce(availableToLay, (acc, item) => {
                acc += item.size;
                item.size = utils.normalizeSize(acc);
                layAvailability.push(item);
                return acc;
            }, 0);
            this.log.debug('lay availability', layAvailability);

            // store
            this.runners[runner.selectionId] = {
                selectionId: runner.selectionId,
                backAvailability,
                layAvailability
            }
        });
        this.log.debug('preprocessed runners', this.runners);

        this.initialized = true;
    }

    placeOrders(params) {
        if (params.marketId != this.marketId) {
            throw new Error('placeOrders marketId mismatch');
        }
        if (!_.isArray(params.instructions) || _.isEmpty(params.instructions)) {
            throw new Error('placeOrders: bad or empty instructions');
        }

        this.log.debug('placeOrders params:', params);

        // TODO - limitOrder is hardcoded
        let marketId = params.marketId;
        let bets = [];
        _.each(params.instructions, (instruction) => {
            let bet = new EmulatorBet(
                instruction.selectionId,
                instruction.side,
                instruction.limitOrder.price,
                instruction.limitOrder.size,
                {
                    orderType: instruction.orderType,
                    persistenceType: instruction.limitOrder.persistenceType
                }
            );
            this.matchedBets.set(bet.betId, bet);
            bets.push(bet);
        });

        // result
        let result = {
            customerRef: params.customerRef,
            status: "SUCCESS",
            marketId: marketId,
            id: 2, // UNDOCUMENTED parameter
            instructionReports: _.map(bets, (bet) => {
                return {
                    status: "SUCCESS",
                    instruction: _.omit(_.clone(bet), 'betId'),
                    betId: bet.betId,
                    placedDate: null,
                    averagePriceMatched: 0,
                    sizeMatched: 0
                }
            })
        };
        this.log.debug('placeOrders result:', result);
        return result;
    }
}

module.exports = EmulatorMarket;