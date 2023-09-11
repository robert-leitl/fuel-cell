// https://theorangeduck.com/page/exponential-map-angle-axis-angular-velocity
// https://theorangeduck.com/page/visualizing-rotation-spaces

import { quat, vec3 } from "gl-matrix";
import { clamp } from "./math-util";

export const quatUtil = {};

/**
 * Calculates the quaternion describing the difference between the 
 * given two rotations: diff = a x b*
 * 
 * @param {quat} out The receiving quaternion
 * @param {quat} a The unit quaternion of the start rotation
 * @param {quat} b The unit quaternion of the end rotation
 * @returns out
 */
quatUtil.diff = (out, a, b) => {
    const _b = quat.conjugate(quat.create(), b);
    return quat.multiply(out, a, _b);
}

/**
 * Takes a 3D vector and produces a quaternion rotation from it (exponential map).
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The given vector
 * @returns out
 */
quatUtil.exp = (out, v) => {
    const x = v[0];
    const y = v[1];
    const z = v[2];
    const halfangle = Math.sqrt(x*x + y*y + z*z);
	
    if (halfangle < 1e-8) {
        return quat.normalize(out, quat.fromValues(x, y, z, 1.));
    } else {
        const c = Math.cos(halfangle);
        const s = Math.sin(halfangle) / halfangle;
        return quat.copy(out, quat.fromValues(s * x, s * y, s * z, c));
    }
}

/**
 * Takes a quaternion and converts it into the corresponding exponentially
 * mapped 3D vector (inverse of the quatUtil.exp)
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} q The unit quaternion
 * @returns out
 */
quatUtil.log = (out, q) => {
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];
    const length = Math.sqrt(x*x + y*y + z*z);
	
    if (length < 1e-8) {
        return vec3.copy(out, vec3.fromValues(x, y, z));
    } else {
        const halfangle = Math.acos(clamp(w, -1.0, 1.0));
        const v = vec3.fromValues(x, y, z);
        vec3.scale(v, v, 1 / length);
        return vec3.scale(out, v, halfangle);
    }
}

/**
 * An approximation of the exp function on a quaternion which
 * can be used for very small rotations (like you might get when 
 * integrating angular velocities with a very small timestep).
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The input vector
 * @returns out
 */
quatUtil.expApprox = (out, v) => {
    return quat.normalize(out, [...v, 1]);
}

/**
 * An approximation of the ln function on a quaternion which
 * can be used for very small rotations (like you might get when 
 * integrating angular velocities with a very small timestep).
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} q The input quaternion
 * @returns out
 */
quatUtil.logApprox = (out, q) => {
    return vec3.copy(out, q);
}

/**
 * Creates a unit quaternion from the given scaled-angle-axis vector
 * (= axis scaled by the angle of rotation).
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The scaled-angle-axis vector
 * @returns out
 */
quatUtil.fromScaledAngleAxis = (out, v) => {
    return quatUtil.exp(out, (vec3.scale(vec3.create(), v, 0.5)));
}

/**
 * Creates a scaled-angle-axis representation of the given
 * unit quaternion.
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} q The unit quaternion
 * @returns out
 */
quatUtil.toScaledAngleAxis = (out, q) => {
    return vec3.scale(out, quatUtil.log(out, q), 2.);
}

/**
 * Returns the angular velocity of the given quaternion.
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} q The given rotation unit quaternion
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.toAngularVelocity = (out, q, dt) => {
    const v = quatUtil.toScaledAngleAxis(vec3.create(), q);
    return vec3.scale(out, v, 1 / dt);
}

/**
 * Returns the unit quaternion representing the given
 * angular velocity.
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The angular velocity
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.fromAngularVelocity = (out, v, dt) => {
    const vel = vec3.scale(vec3.create(), v, dt);
    return quatUtil.fromScaledAngleAxis(out, vel);
}

/**
 * Ensure the quaternion is on the hemisphere closest to the identity quaternion.
 * 
 * @param {quat} out The receiving quaternion
 * @param {quat} x The given quaternion
 * @returns out
 */
quatUtil.abs = (out, x) => {
    return x[3] < 0.0 ? quat.scale(out, x, -1) : quat.copy(out, x);
}

/**
 * Returns the angular velocity between the current and next rotation.
 * (v = (next - curr) / dt)
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} next The quaternion representing the next rotation
 * @param {curr} curr The quaternion representing the current rotation
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.differentiateAngularVelocity = (out, next, curr, dt) => {
    const q = quatUtil.diff(quat.create(), next, curr);
    quatUtil.abs(q, q);
    return quatUtil.toAngularVelocity(out, q, dt);
}

/**
 * Integrates the given angular-velocity by the timestep and creates
 * a new rotation by adding it to the given current rotation.
 * (next = curr + vel * dt)
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} vel The angular velocity to integrate
 * @param {quat} curr The quaternion representing the current rotation
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.integrateAngularVelocity = (out, vel, curr, dt) => {
    const q = quatUtil.fromAngularVelocity(quat.create(), vel, dt);
    return quat.multiply(out, q, curr);
}

/**
 * Creates a unit quaternion from the given scaled-angle-axis vector
 * (= axis scaled by the angle of rotation). Approximation for small 
 * timesteps.
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The scaled-angle-axis vector
 * @returns out
 */
quatUtil.fromScaledAngleAxisApprox = (out, v) => {
    return quatUtil.expApprox(out, (vec3.scale(vec3.create(), v, 0.5)));
}

/**
 * Creates a scaled-angle-axis representation of the given
 * unit quaternion. Approximation for small timesteps.
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} q The unit quaternion
 * @returns out
 */
quatUtil.toScaledAngleAxisApprox = (out, q) => {
    return vec3.scale(out, quatUtil.logApprox(out, q), 2.);
}

/**
 * Returns the angular velocity of the given quaternion.
 * Approximation for small timesteps.
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} q The given rotation unit quaternion
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.toAngularVerlocityApprox = (out, q, dt) => {
    const v = quatUtil.toScaledAngleAxisApprox(vec3.create(), q);
    return vec3.scale(out, v, 1 / dt);
}

/**
 * Returns the unit quaternion representing the given
 * angular velocity. Approximation for small timesteps.
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The angular velocity
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.fromAngularVelocityApprox = (out, v, dt) => {
    const vel = vec3.scale(vec3.create(), v, dt);
    return quatUtil.fromScaledAngleAxisApprox(out, vel);
}

/**
 * Returns the angular velocity between the current and next rotation.
 * Approximation for small timesteps.
 * 
 * @param {vec3} out The receiving vector
 * @param {quat} next The quaternion representing the next rotation
 * @param {curr} curr The quaternion representing the current rotation
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.differentiateAngularVelocityApprox = (out, next, curr, dt) => {
    const q = quatUtil.diff(quat.create(), next, curr);
    quatUtil.abs(q, q);
    return quatUtil.toAngularVerlocityApprox(out, q, dt);
}

/**
 * Creates a unit quaternion from the given scaled-angle-axis vector
 * (= axis scaled by the angle of rotation). Approximation for small timesteps.
 * 
 * @param {quat} out The receiving quaternion
 * @param {vec3} v The scaled-angle-axis vector
 * @param {quat} curr The quaternion representing the current rotation
 * @param {number} dt The timestep
 * @returns out
 */
quatUtil.integrateAngularVelocityApprox = (out, vel, curr, dt) => {
    const q = quatUtil.fromAngularVelocityApprox(quat.create(), vel, dt);
    return quat.multiply(out, q, curr);
}

Object.preventExtensions(quatUtil);