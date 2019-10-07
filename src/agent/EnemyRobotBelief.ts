import * as w from '../model';
import Vec from '../util/vector';

export default class EnemyRobotBelief {
    carryingBelief = 0;

    constructor(public entityId: number) {
    }

    observedStillAtHeadquarters() {
        this.carryingBelief = 1;
    }

    observedEnemyDig() {
        this.carryingBelief = -1;
    }

    observedPotentialDig() {
        this.carryingBelief -= 0.1;
    }

    carryingProbability() {
        return Math.max(0, 1 - Math.exp(-this.carryingBelief)); // zero probability if zero belief
    }
}