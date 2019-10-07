import * as w from './model';

export function clone(world: w.World): w.World {
    return {
        ...world,
        teams: world.teams.map(cloneTeam),
        map: world.map.map(row => row.map(cloneCell)),
        entities: world.entities.map(cloneEntity),
        actions: [...world.actions],
    };
}

function cloneTeam(team: w.Team): w.Team {
    return {
        ...team,
    };
}

function cloneCell(cell: w.Cell): w.Cell {
    return {
        ...cell,
    };
}

function cloneEntity(entity: w.Entity): w.Entity {
    return {
        ...entity,
    };
}