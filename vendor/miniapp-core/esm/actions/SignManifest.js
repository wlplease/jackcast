import * as Errors from "../errors.js";
/**
 * Thrown when sign manifest action was rejected by the user.
 */
export class RejectedByUser extends Errors.BaseError {
    name = 'SignManifest.RejectedByUser';
    constructor() {
        super('Sign manifest rejected by user');
    }
}
/**
 * Thrown when the provided domain is invalid.
 */
export class InvalidDomain extends Errors.BaseError {
    name = 'SignManifest.InvalidDomain';
    constructor() {
        super('Invalid domain provided');
    }
}
/**
 * Thrown when manifest signing fails for generic reasons.
 */
export class GenericError extends Errors.BaseError {
    name = 'SignManifest.GenericError';
    constructor(message = 'Manifest signing failed') {
        super(message);
    }
}
