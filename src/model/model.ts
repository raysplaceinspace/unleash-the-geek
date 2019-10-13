import Vec from '../util/vector';

export const MaxTicks = 200;
export const DigRange = 1;
export const RadarRange = 5;
export const TrapRange = 1;
export const MovementSpeed = 4;

export interface World {
    tick: number;
    numRobots: number;
    width: number;
    height: number;
    teams: Team[];
    map: Cell[][];
    entities: Entity[];
    actions: Action[];
}

export interface Team {
    teamId: number
    score: number;
    radarCooldown: number;
    trapCooldown: number;
}

export interface Cell {
    pos: Vec;
    ore: number | null;
    hole: boolean;
}

export interface Entity {
    id: number;
    type: ItemType;
    pos: Vec;
    carrying?: number;
    dead?: boolean;
}

export enum ItemType {
    None = -1,
    RobotTeam0 = 0,
    RobotTeam1 = 1,
    Radar = 2,
    Trap = 3,
    Ore = 4,
}

export type Action =
    WaitAction
    | MoveAction
    | DigAction
    | RequestAction

export interface ActionBase {
    entityId: number;
    type: string;
    tag?: string;
}

export interface WaitAction extends ActionBase {
    type: "wait";
}

export interface MoveAction extends ActionBase {
    type: "move";
    target: Vec;
}

export interface DigAction extends ActionBase {
    type: "dig";
    target: Vec;
}

export interface RequestAction extends ActionBase {
    type: "request";
    item: ItemType;
}