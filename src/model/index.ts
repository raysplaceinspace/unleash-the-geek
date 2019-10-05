import * as w from '../model/world';

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
    for (let i = 0; i < height; ++i) {
        const row = new Array<w.Cell>();
        for (let j = 0; j < width; ++j) {
            row.push({ seen: null, ore: 0, hole: false });
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
