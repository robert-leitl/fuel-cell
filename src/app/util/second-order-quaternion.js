import { vec3, quat } from "gl-matrix";
import { quatUtil } from "./quat-util";

/**
 * Second order system value for procedural animation with target values (https://www.youtube.com/watch?v=KPoeNZZ6H4s).
 */
export class SecondOrderSystemQuaternion {

    // the current value of the system
    #q;

    // the current velocity of the system
    #v; 

    // the previous target value
    #q0; 

    // constants derived from the frequency, damping and response factors
    #k1; #k2; #k3;

    // temporary in-between variables
    #qd; #v0; #pa; #v0k3; #vk1; #vd; #a;

    /**
     * Creates a new second order system for a single value.
     *
     * @param {number} f The frequency value (f > 0) (i.e. f = 4.6)
     * @param {number} z The damping factor (0 = no damping, 0 < damping < 1 = underdamped -> vibration, > 1 = no vibration) (i.e. z = 0.35)
     * @param {number} r The response factor (0 = slow acceleration, 0 < response < 1 = immediate response, r > 1 = overshoot, r < 0 = anticipate motion / wind up) (i.e. r = 2)
     * @param {quat} q0 The initial target quaternion
     */
    constructor(f, z, r, q0) {
        this.#q = [...q0];
        this.#q0 = [...q0];
        this.#v = vec3.create();

        this.#k1 = z / (Math.PI * f);
        this.#k2 = 1 / ((2 * Math.PI * f) * (2 * Math.PI * f));
        this.#k3 = (r * z) / (2 * Math.PI * f);

        this.#qd = quat.create();
        this.#v0 = vec3.create();
        this.#pa = vec3.create();
        this.#v0k3 = vec3.create();
        this.#vk1 = vec3.create();
        this.#vd = vec3.create();
        this.#a = vec3.create();
    }

    /**
     * Updates the state of the second order system.
     *
     * @param {number} dt the delta time from the previous update (in seconds i.e. 0.016 for 60 fps)
     * @param {quat} next the new target unit quaternion
     * @returns {quat} the new unit quaternion
     */
    update(dt, next) {
        // estimate the target velocity
        quatUtil.differentiateAngularVelocity(this.#v0, next, this.#q0, dt);
        quat.copy(this.#q0, next);

        // integrate position by velocity
        quatUtil.integrateAngularVelocity(this.#q, this.#v, this.#q, dt);

        // clamp k2 for stability
        const k2 = Math.max(this.#k2, 1.1 * ((dt * dt) / 4 + (dt * this.#k1) / 2));
        const k2_inv = 1 / k2;

        // update the acceleration
        // get the scaled position difference: (x - y) / k2
        quatUtil.diff(this.#qd, next, this.#q);
        quatUtil.abs(this.#qd, this.#qd);
        quatUtil.toScaledAngleAxis(this.#pa, this.#qd);
        vec3.scale(this.#pa, this.#pa, k2_inv);
        // get the scaled velocity difference: (k3 * v0 - k1 * v1) / k2
        vec3.scale(this.#v0k3, this.#v0, this.#k3 * k2_inv);
        vec3.scale(this.#vk1, this.#v, this.#k1 * k2_inv);
        vec3.sub(this.#vd, this.#v0k3, this.#vk1);
        // combine the scaled position diff and the scaled velocity diff 
        // to be the new acceleration
        vec3.add(this.#a, this.#pa, this.#vd);

        // integrate velocity by acceleration
        vec3.scale(this.#vd, this.#a, dt);
        vec3.add(this.#v, this.#v, this.#vd);

        return this.#q;
    }

    /**
     * Updates the state of the second order system. Approximation for small timesteps.
     *
     * @param {number} dt the delta time from the previous update (in seconds i.e. 0.016 for 60 fps)
     * @param {quat} next the new target unit quaternion
     * @returns {quat} the new unit quaternion
     */
    updateApprox(dt, next) {
        // estimate the target velocity
        quatUtil.differentiateAngularVelocityApprox(this.#v0, next, this.#q0, dt);
        quat.copy(this.#q0, next);

        // integrate position by velocity
        quatUtil.integrateAngularVelocityApprox(this.#q, this.#v, this.#q, dt);

        // clamp k2 for stability
        const k2 = Math.max(this.#k2, 1.1 * ((dt * dt) / 4 + (dt * this.#k1) / 2));
        const k2_inv = 1 / k2;

        // update the acceleration
        // get the scaled position difference: (x - y) / k2
        quatUtil.diff(this.#qd, next, this.#q);
        quatUtil.abs(this.#qd, this.#qd);
        quatUtil.toScaledAngleAxisApprox(this.#pa, this.#qd);
        vec3.scale(this.#pa, this.#pa, k2_inv);
        // get the scaled velocity difference: (k3 * v0 - k1 * v1) / k2
        vec3.scale(this.#v0k3, this.#v0, this.#k3 * k2_inv);
        vec3.scale(this.#vk1, this.#v, this.#k1 * k2_inv);
        vec3.sub(this.#vd, this.#v0k3, this.#vk1);
        // combine the scaled position diff and the scaled velocity diff 
        // to be the new acceleration
        vec3.add(this.#a, this.#pa, this.#vd);

        // integrate velocity by acceleration
        vec3.scale(this.#vd, this.#a, dt);
        vec3.add(this.#v, this.#v, this.#vd);

        return this.#q;
    }

    get value() {
        return this.#q;
    }
}