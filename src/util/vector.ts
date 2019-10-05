export class Vec {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Vec(this.x, this.y);
    }

    static distance(to: Vec, from: Vec) {
        const xDiff = to.x - from.x;
        const yDiff = to.y - from.y;
        return Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
    }

    static diff(to: Vec, from: Vec) {
        return new Vec(to.x - from.x, to.y - from.y);
    }

    static fromAngle(angle: number, radius: number = 1) {
        return new Vec(radius * Math.cos(angle), radius * Math.sin(angle));
    }

    add(vec: Vec) {
        this.x += vec.x;
        this.y += vec.y;
        return this;
    }

    addMul(vec: Vec, multiplier: number) {
        this.x += vec.x * multiplier;
        this.y += vec.y * multiplier;
        return this;
    }

    sub(vec: Vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        return this;
    }

    mul(multiplier: number) {
        this.x *= multiplier;
        this.y *= multiplier;
        return this;
    }

    dot(vec: Vec) {
        return this.x * vec.x + this.y * vec.y;
    }

    unit() {
        const length = this.length();
        if (length > 0) {
            this.x /= length;
            this.y /= length;
        }
        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

}

export default Vec;