import * as Params from './Params';

export function discount(payoff: number, ticks: number) {
    return payoff * Math.pow(Params.DiscountRate, ticks);
}