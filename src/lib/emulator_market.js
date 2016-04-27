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

    // match bets using new price data
    _matchBets() {

        return;
    }

    // handle market go inplay
    _onGoInplay() {
        this.log.debug('marketId: ' + this.marketId + ' go inplay');

        // cancel all the bets that has persistence LAPSE
        let lapsedIds = [];
        for (let tuple of this.unmatchedBets) {
            let [betId, bet] = tuple;
            if (bet.limitOrder.persistenceType == 'LAPSE') {
                bet.lapse();
                lapsedIds.push(betId);
            }
        }
        _.each(lapsedIds, (id) => {this.unmatchedBets.delete(id);})
    }

    // update listMarketBook with emilator orders
    _updateOrders(runner, key, orders) {
        if (!_.isArray(runner[key])) {
            runner[key] = [];
        }

        let selectionId = runner.selectionId;
        for (let tuple of orders) {
            let [betId, bet] = tuple;
            if (selectionId == bet.selectionId) {
                runner[key].push(bet.getOrder());
            }
        }
    }

    onListMarketBook(marketBook) {
        if (marketBook.marketId != this.marketId) {
            throw new Error('onListMarketBook marketId mismatch');
        }

        this.log.debug('onListMarketBook for market: ' + this.marketId);
        if (!this.inplay && marketBook.inplay) {
            _onGoInplay();
        }

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

            // update orders/matches
            this._updateOrders(runner, 'orders', this.unmatchedBets);
            this._updateOrders(runner, 'matches', this.matchedBets);

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

    placeOrders(params, cb=() => {}) {
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
            this.unmatchedBets.set(bet.betId, bet);
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
                    instruction: bet.getInstruction(),
                    betId: bet.betId,
                    placedDate: bet.placedDate,
                    averagePriceMatched: bet.averagePriceMatched,
                    sizeMatched: bet.sizeMatched,
                    isEmulatorBet: true
                }
            })
        };
        this.log.debug('placeOrders result:', result);
        cb(null, result);
    }
}

module.exports = EmulatorMarket;