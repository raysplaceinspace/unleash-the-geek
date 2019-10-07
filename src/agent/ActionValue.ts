import * as w from '../model';

export default class ActionValue {
    constructor(public value: number, public action: w.Action) {
    }

    subsumes(other: ActionValue) {
        if (this.duplicates(other)) {
            // Enforce an ordering so one action always wins
            return this.value > other.value || (this.value === other.value && this.action.entityId < other.action.entityId)
        } else {
            return false;
        }
    }

    duplicates(other: ActionValue) {
        if (this.action.type === "dig" && other.action.type === "dig" && this.action.target.equals(other.action.target)) {
            return true;
        } else if (this.action.type === "request" && other.action.type === "request" && this.action.item === other.action.item) {
            return true;
        } else {
            return false;
        }
    }
}