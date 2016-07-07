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
        this.log.debug('try match bets');

        let matchedBetIds = [];
        this.unmatchedBets.forEach((bet, betId) => {
            this.log.info('_matchBets betId=', betId, bet.toString());
            let runner = this.runners[bet.selectionId];
            switch (bet.side) {
                case 'LAY':
                    let toLay = runner.layAvailability;
                    if(toLay.length==0) {
                        // no offers
                        return;
                    }
                    let worstLay = _.last(toLay);
                    console.log(worstLay, toLay);
                    if (bet.price > worstLay.price) {
                        bet.match(worstLay.price,
                            `marketWorstLayPrice=${worstLay.price}, price=${bet.price}`);
                        matchedBetIds.push(bet.betId);
                    }
                    _.forEach(toLay, (offer) => {
                        if (bet.price >= offer.price && bet.size < offer.size) {
                            bet.match(offer.price,
                                `marketPrice=${offer.price}, marketSize=${offer.size} price=${bet.price}`);
                            matchedBetIds.push(bet.betId);
                            return false;
                        }
                        return true;
                    });
                    break;
                case 'BACK':
                    let toBack = runner.backAvailability;
                    if(toBack.length==0) {
                        // no offers
                        return;
                    }
                    let worstBack = _.last(toBack);
                    if (bet.price < worstBack.price) {
                        bet.match(worstBack.price,
                            `marketWorstBackPrice=${worstBack.price}, price=${bet.price}`);
                        matchedBetIds.push(bet.betId);
                    }
                    _.forEach(toBack, (offer) => {
                        if (bet.price <= offer.price && bet.size < offer.size) {
                            bet.match(offer.price,
                                `marketPrice=${offer.price}, marketSize=${offer.size} price=${bet.price}`);
                            matchedBetIds.push(bet.betId);
                            return false;
                        }
                        return true;
                    });
                    break;
            }
        });
        // place matched bets to this.matchedBets, remove from this.unmatchedBets
        _.forEach(matchedBetIds, (betId) => {
            let bet = this.unmatchedBets.get(betId);
            this.matchedBets.set(betId, bet);
            this.unmatchedBets.delete(betId);
        });
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

    // update listMarketBook with emulator orders
    _updateOrders(runner, orders) {
        this.log.debug('update orders for runnerId' + runner.selectionId);

        if (!_.isArray(runner.orders)) {
            runner.orders = [];
        }

        let selectionId = runner.selectionId;
        for (let tuple of orders) {
            let [betId, bet] = tuple;
            if (selectionId == bet.selectionId) {
                runner.orders.push(bet.getOrder());
            }
        }
    }

    onListMarketBook(params, marketBook) {
        if (marketBook.marketId != this.marketId) {
            throw new Error('onListMarketBook marketId mismatch');
        }

        this.log.debug('onListMarketBook for market: ' + this.marketId, params);
        if (!this.inplay && marketBook.inplay) {
            this._onGoInplay();
        }

        this.status = marketBook.status;
        this.betDelay = marketBook.betDelay;
        this.inplay = marketBook.inplay;
        this.version = marketBook.version;

        // update prices
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

        // try match bets
        this._matchBets();

        // put orders into response
        _.each(marketBook.runners, (runner) => {
            // update orders/matches
            if (params.orderProjection == 'ALL' || params.orderProjection == 'EXECUTABLE') {
                this.log.debug('update unmatched orders');
                this._updateOrders(runner, this.unmatchedBets);
            }
            if (params.orderProjection == 'ALL' || params.orderProjection == 'EXECUTION_COMPLETE') {
                this.log.debug('update matched orders');
                this._updateOrders(runner, this.matchedBets);
            }
        });

        this.initialized = true;
    }

    placeOrders(params, cb = () => {}) {
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
                this.log,
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

    cancelOrders(params, cb = () => {}) {
        if (params.marketId != this.marketId) {
            throw new Error('cancelOrders marketId mismatch');
        }
        let instructions = _.cloneDeep(params.instructions);
        if(!instructions) {
            let ids = Array.from(this.unmatchedBets.keys());
            instructions = ids.map((id)=>{return {betId:id}});
        }
        if(instructions.length==0) {
            // no bets to cancel
            cb(null, {
                customerRef: params.customerRef,
                status: 'SUCCESS',
                marketId: params.marketId,
                instructionReports: []
            });
            return;
        }
        let allErrors = true;
        let hasErrors = false;
        let result = [];
        _.each(instructions, (instruction) => {
            let bet = this.unmatchedBets.get(instruction.betId);
            if(!bet) {
                result.push({
                    status: "FAILURE",
                    errorCode: "BET_TAKEN_OR_LAPSED",
                    instruction
                });
                hasErrors = true;
                return;
            }
            let sizeCancelled = bet.cancel(instruction.sizeReduction);
            result.push({
                status: "SUCCESS",
                instruction,
                sizeCancelled,
                cancelledDate: new Date()
            });
            allErrors = false;
            if(bet.sizeRemaining==0) {
                this.unmatchedBets.delete(bet.betId);
            }
        });
        let status = allErrors ? 'FAILURE' : (hasErrors ? "PROCESSED_WITH_ERRORS" : "SUCCESS");
        let errorCode = allErrors ? 'BET_ACTION_ERROR' : (hasErrors ? "PROCESSED_WITH_ERRORS" : undefined);
        cb(null, {
            customerRef: params.customerRef,
            status,
            errorCode,
            marketId: params.marketId,
            instructionReports: result
        });
    }
}

module.exports = EmulatorMarket;