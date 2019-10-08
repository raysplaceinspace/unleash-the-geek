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

    public claimPath(robotId: number, pathMap: PathMap, target: Vec): Vec {
        const direct = collections.minBy(
            traverse.neighbours(pathMap.from, this.bounds, w.MovementSpeed),
            n => Vec.distance(target, n));
        
        const directAllowed = this.claim(robotId, direct.x, direct.y);
        if (directAllowed) {
            return direct;
        } else {
            const path = pathMap.pathTo(target);
            return path[0];
        }
    }

    // Return whether this robot can go to this location
    // Allow one robot to enter an explosion at a time, because if an enemy chooses to kamikaze, it is a fair 1:1 trade
    private claim(robotId: number, x: number, y: number): boolean {
        const explosionId = this.explosionMap.getExplosionId(x, y);
        if (explosionId) {
            const claimedRobotId = this.claimedExplosions.get(explosionId);
            if (claimedRobotId === robotId) {
                return true;
            } else if (claimedRobotId) {
                // Another robot claimed this explosion
                return false;
            } else {
                this.claimedExplosions.set(explosionId, robotId);
                return true;
            }
        } else {
            return true;
        }
    }
}
