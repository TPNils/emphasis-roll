
import { ExecException, spawn } from 'child_process';
import { Writable } from 'stream';

export interface ExecResponse {
  cmd: string;
  args: string[];
  stdout?: string;
  stderr?: string;
  err?: ExecException;
};

export class Cli {

  public execPromise(command: string, ...args: string[]): Promise<ExecResponse> {
    const externalStack = new Error().stack.replace(/^.*\n/, '');
    return new Promise<ExecResponse>(async (resolve, reject) => {
      const response: ExecResponse = {
        cmd: command,
        args: args,
        stdout: '',
        stderr: '',
      };
      const child = spawn(command, args, {shell: true});
      child.stdout.pipe(new Writable({write: (chunk, encoding, callback) => {
        if (chunk instanceof Buffer) {
          response.stdout += chunk.toString();
        } else {
          response.stdout += chunk;
        }
        callback();
      }}));
      child.stderr.pipe(new Writable({write: (chunk, encoding, callback) => {
        if (chunk instanceof Buffer) {
          response.stderr += chunk.toString();
        } else {
          response.stderr += chunk;
        }
        callback();
      }}));
      child.on('error', err => {
        err.stack = err.message + '\n' + externalStack;
        response.err = err;
      });
      child.on('close', (code, signal) => {
        if (signal) {
          const err = new Error(`${command} was killed with signal ` + signal);
          err.stack = err.message + '\n' + externalStack;
          response.err = err;
        } else if (code) {
          const err = new Error(`${command} exited with code ${code}.`)
          err.stack = err.message + '\n' + externalStack;
          response.err = err;
        }
        resolve(response);
      });
    })
  }

  public throwIfError(cmd: ExecResponse, options: {ignoreOut?: boolean} = {}): void {
    if (cmd.err) {
      throw cmd.err;
    }
    if (cmd.stderr && !options.ignoreOut) {
      throw new Error(cmd.stderr);
    }
  }

}

export const cli = new Cli();
for (let prop in cli) {
  if (typeof cli[prop] === 'function') {
    cli[prop] = cli[prop].bind(cli);
  }
}