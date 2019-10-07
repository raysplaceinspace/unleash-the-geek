const DiscountRate = 0.95;

export function discount(payoff: number, ticks: number) {
    return payoff * Math.pow(DiscountRate, ticks);
}