import { deltaAngle } from "./math-util";

/**
 * Second order system value for procedural animation with target values (https://www.youtube.com/watch?v=KPoeNZZ6H4s).
 */
export class SecondOrderSystemAngle {
    // the current value of the system
    #y;
  
    // the current velocity of the system
    #yd; 
  
    // the previous target value
    #xp; 
  
    // constants derived from the frequency, damping and response factors
    #k1; #k2; #k3;
  
    /**
     * Creates a new second order system for a single value.
     *
     * @param f The frequency value (f > 0) (i.e. f = 4.6)
     * @param z The damping factor (0 = no damping, 0 < damping < 1 = underdamped -> vibration, > 1 = no vibration) (i.e. z = 0.35)
     * @param r The response factor (0 = slow acceleration, 0 < response < 1 = immediate response, r > 1 = overshoot, r < 0 = anticipate motion / wind up) (i.e. r = 2)
     * @param x0 The initial target angle in radians
     */
    constructor(f, z, r, x0) {
      this.#y = x0;
      this.#xp = x0;
      this.#yd = 0;
  
      this.#k1 = z / (Math.PI * f);
      this.#k2 = 1 / ((2 * Math.PI * f) * (2 * Math.PI * f));
      this.#k3 = (r * z) / (2 * Math.PI * f);
    }
  
    /**
     * Updates the state of the second order system.
     *
     * @param dt the delta time from the previous update (in seconds i.e. 0.016 for 60 fps)
     * @param x the new target angle in radians
     * @param xd the optional velocity of the target
     */
    update(dt, x, xd) {
        x = this.#y + deltaAngle(this.#y, x)

        // estimate the target velocity
        if (xd == null) {
            xd = deltaAngle(this.#xp, x) / dt;
            this.#xp = x;
        }
    
        // integrate position by velocity
        this.#y += this.#yd * dt;
    
        // clamp k2 for stability
        const k2 = Math.max(this.#k2, 1.1 * ((dt * dt) / 4 + (dt * this.#k1) / 2));
    
        // update the acceleration
        const ydd = (x + this.#k3 * xd - this.#y - this.#k1 * this.#yd) / k2;
    
        // integrate velocity by acceleration
        this.#yd += ydd * dt;
    
        return this.#y;
    }
  
    get value() {
        return this.#y;
    }
  }