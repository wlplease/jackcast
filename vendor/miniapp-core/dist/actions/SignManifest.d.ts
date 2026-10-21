import * as Errors from '../errors.ts';
import type { OneOf } from '../internal/types.ts';
export type SignManifestOptions = {
    domain: string;
};
export type SignManifestResult = {
    header: string;
    payload: string;
    signature: string;
};
export type SignManifest = (options: SignManifestOptions) => Promise<SignManifestResult>;
type RejectedByUserJsonError = {
    type: 'rejected_by_user';
};
type InvalidDomainJsonError = {
    type: 'invalid_domain';
};
type GenericErrorJsonError = {
    type: 'generic_error';
    message?: string;
};
export type SignManifestJsonError = RejectedByUserJsonError | InvalidDomainJsonError | GenericErrorJsonError;
export type SignManifestRejectedReason = SignManifestJsonError['type'];
export type SignManifestJsonResult = OneOf<{
    result: SignManifestResult;
} | {
    error: SignManifestJsonError;
}>;
export type WireSignManifest = (options: SignManifestOptions) => Promise<SignManifestJsonResult>;
/**
 * Thrown when sign manifest action was rejected by the user.
 */
export declare class RejectedByUser extends Errors.BaseError {
    readonly name = "SignManifest.RejectedByUser";
    constructor();
}
/**
 * Thrown when the provided domain is invalid.
 */
export declare class InvalidDomain extends Errors.BaseError {
    readonly name = "SignManifest.InvalidDomain";
    constructor();
}
/**
 * Thrown when manifest signing fails for generic reasons.
 */
export declare class GenericError extends Errors.BaseError {
    readonly name = "SignManifest.GenericError";
    constructor(message?: string);
}
export {};
