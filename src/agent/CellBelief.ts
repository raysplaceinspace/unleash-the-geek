import * as traverse from '../util/traverse';
import * as w from '../model';
import * as Params from './Params';
import Vec from '../util/vector';

export default class CellBelief {
    pos: Vec;

    oreBelief = 0;
    oreKnown = 0;
    hadOre = false;

    trapBelief = 0;
    trapKnown = 0;

    appearsTrapped = false;

    private constructor(pos: Vec) {
        this.pos = pos;
    }

    public static create(pos: Vec, bounds: traverse.Dimensions) {
        const result = new CellBelief(pos);
        result.oreBelief = CellBelief.priorOreBelief(pos, bounds);
        return result;
    }

    private static priorOreBelief(pos: Vec, bounds: traverse.Dimensions): number {
        let prior = 0;
        if (pos.x < Params.OreStartX) {
            const proportion = 1 - (pos.x / Params.OreStartX);
            prior += proportion * Params.OreBeforeStartXPriorBelief;
        }
        if (traverse.distanceToEdge(pos, bounds) <= Params.OreMargin) {
            prior += Params.OreMarginPriorBelief;
        }
        return prior;
    }

    observedSelfDig(success: boolean, appearsTrapped: boolean) {
        if (success) {
            this.oreBelief = 1;
            this.oreKnown = 1;
            this.hadOre = true;
        } else {
            this.oreBelief = -1;
            this.oreKnown = -1;
        }

        this.appearsTrapped = this.appearsTrapped || appearsTrapped;
    }

    observedNeighbour(success: boolean, neighbour: CellBelief) {
        const distance = Vec.l1(this.pos, neighbour.pos);
        const modifier = Math.exp(-distance);

        if (success) {
            this.oreBelief += 10 * modifier;
        } else if (neighbour.hadOre) {
            // The only reason we're unsuccessful is because we always dig until the neighbour doesn't have ore anymore,
            // not because there is possibly no ore here
        } else {
            this.oreBelief -= 10 * modifier;
        }
    }

    observedStillEnemy(carryingProbability: number) {
        if (carryingProbability > 0) {
            this.trapBelief += 1;
        }
    }

    observedEnemyDig(carryingProbability: number) {
        if (carryingProbability > 0) {
            this.trapBelief += 1;
        }
    }

    observedOre(success: boolean) {
        if (success) {
            this.oreBelief = 1;
            this.oreKnown = 1;
            this.hadOre = true;
        } else {
            this.oreBelief = -1;
            this.oreKnown = -1;
        }
    }

    observedTrap() {
        this.trapKnown = 1;
    }

    oreProbability() {
        if (this.pos.x === 0) {
            return 0; // Never any ore in the headquarter row
        } else if (this.oreKnown < 0) {
            return 0;
        } else if (this.oreKnown > 0) {
            return 1;
        } else {
            return 1 / (1 + Math.exp(-this.oreBelief));
        }

    }

    trapProbability() {
        if (this.pos.x === 0) {
            return 0; // Never any traps in the headquarter row
        } else if (this.trapKnown > 0) {
            return 1;
        } else if (this.trapKnown < 0) {
            return -1;
        } else {
            return 1 - Math.exp(-this.trapBelief); // zero trap belief = 0 probability of a trap 
        }
    }
}
