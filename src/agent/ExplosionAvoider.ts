import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import ExplosionMap from './ExplosionMap';
import PathMap from './PathMap';
import Vec from '../util/vector';

export default class ExplosionAvoider {
    private claimedExplosions = new Map<number, number>(); // explosionId -> robotId

    constructor(private explosionMap: ExplosionMap, private bounds: traverse.Dimensions) {
    }

    public assignedRobots(target: Vec): number[] {
        const explosionIds = this.explosionMap.getExplosionIds(target.x, target.y);
        if (explosionIds) {
            return explosionIds.map(explosionId => this.claimedExplosions.get(explosionId)).filter(x => !!x);
        }
        return [];
    }

    public claimPath(robotId: number, pathMap: PathMap, target: Vec): Vec {
        const direct = collections.minBy(
            traverse.neighbours(pathMap.from, this.bounds, w.MovementSpeed),
            n => Vec.distance(target, n));
        
        const claimedDirectPath = this.claim(robotId, direct.x, direct.y);
        if (claimedDirectPath) {
            return direct;
        } else {
            const path = pathMap.pathTo(target);
            return path[0];
        }
    }

    // Return whether this robot can go to this location
    // Allow one robot to enter an explosion at a time, because if an enemy chooses to kamikaze, it is a fair 1:1 trade
    private claim(robotId: number, x: number, y: number): boolean {
        const explosionIds = this.explosionMap.getExplosionIds(x, y);
        if (!explosionIds) {
            return true;
        }

        for (const explosionId of explosionIds) {
            if (explosionId) {
                const claimedRobotId = this.claimedExplosions.get(explosionId);
                if (claimedRobotId && claimedRobotId !== robotId) {
                    // There is an explosion at this cell that another robot has claimed
                    return false;
                }
            }
        }
        
        // Claim all explosions at this cell
        for (const explosionId of explosionIds) {
            this.claimedExplosions.set(explosionId, robotId);
        }
        return true;
    }
}
