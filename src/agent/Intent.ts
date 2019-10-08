import * as w from '../model';
import PathMap from './PathMap';

export abstract class Intent {
    constructor(public robotId: number, public value: number) {
    }

    abstract toAction(robot: w.Entity, pathMap: PathMap): w.Action;

    subsumes(other: Intent): boolean {
        if (this.duplicates(other)) {
            // Enforce an ordering so one action always wins
            return this.value > other.value || (this.value === other.value && this.robotId < other.robotId)
        } else {
            return false;
        }
    }

    duplicates(other: Intent): boolean {
        return false;
    }
}

export default Intent;