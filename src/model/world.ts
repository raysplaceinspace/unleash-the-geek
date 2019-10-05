import * as angles from '../util/angles';
import { Vec } from '../util/vector';

export enum ItemType {
    None = -1,
    RobotTeam0 = 0,
    RobotTeam1 = 1,
    Radar = 2,
    Trap = 3,
    Ore = 4,
}

export interface World {
    tick: number;
    width: number;
    height: number;
    teams: Team[];
    map: Cell[][];
    entities: Entity[];
}

export interface Team {
    teamId: number
    score: number;
    radarCooldown: number;
    trapCooldown: number;
}

export interface Cell {
    seen: number; // tick
    ore: number;
    hole: boolean;
}

export interface Entity {
    id: number;
    type: ItemType;
    x: number;
    y: number;
    carrying?: number;
}

export type Action =
    WaitAction

export interface ActionBase {
    type: string;
    tag?: string;
}

export interface WaitAction extends ActionBase {
    type: "wait";
}