import { Writable, WritableOptions } from 'stream';

export interface Options extends WritableOptions {
    readonly channels?: number;
    readonly bitDepth?: number;
    readonly sampleRate?: number;
    readonly lowWaterMark?: number;
    readonly highWaterMark?: number;
}

export interface Format {
    readonly float?: boolean;
    readonly signed?: boolean;
    readonly bitDepth?: number;
    readonly channels?: number;
    readonly sampleRate?: number;
    readonly samplesPerFrame?: number;
}

/**
 * The `Speaker` class accepts raw PCM data written to it, and then sends that data
 * to the default output device of the OS.
 *
 * @param opts options.
 */
export default class Speaker extends Writable {
    constructor(opts?: Options);

    /**
     * Closes the audio backend. Normally this function will be called automatically
     * after the audio backend has finished playing the audio buffer through the
     * speakers.
     *
     * @param flush Defaults to `true`.
     */
    public close(flush: boolean): string;

    /**
     * Returns the `MPG123_ENC_*` constant that corresponds to the given "format"
     * object, or `null` if the format is invalid.
     *
     * @param format format object with `channels`, `sampleRate`, `bitDepth`, etc.
     * @return MPG123_ENC_* constant, or `null`
     */
    public getFormat(format: Format): number | null;

    /**
     * Returns whether or not "format" is playable via the "output module"
     * that was selected during compilation.
     *
     * @param format MPG123_ENC_* format constant
     * @return whether or not is playable
     */
    public isSupported(format: number): boolean;
}
