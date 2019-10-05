import * as w from '../model/world';
import Vec from '../util/vector';

export function initialWorld(width: number, height: number): w.World {
    return {
        tick: 0,
        width,
        height,
        teams: [initialTeam(0), initialTeam(1)],
        map: initialMap(width, height),
        entities: [],
    };
}

function initialTeam(teamId: number): w.Team {
    return {
        teamId,
        score: 0,
        radarCooldown: 0,
        trapCooldown: 0,
    };
}

function initialMap(width: number, height: number): w.Cell[][] {
    const map = new Array<w.Cell[]>();
    for (let y = 0; y < height; ++y) {
        const row = new Array<w.Cell>();
        for (let x = 0; x < width; ++x) {
            row.push({
                pos: new Vec(x, y),
                seen: null,
                ore: 0,
                hole: false,
            });
        }
        map.push(row);
    }
    return map;
}

export function clone(world: w.World): w.World {
    const clone: w.World = {
        ...world,
    };
    return clone;
}
