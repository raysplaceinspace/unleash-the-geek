import * as Params from './Params';

export default class BluffScheduler {
    nextBluff = 0;

    bluff(tick: number) {
        this.nextBluff = tick + Params.BluffInterval;
    }

    bluffReady(tick: number) {
        return tick >= this.nextBluff;
    }
}