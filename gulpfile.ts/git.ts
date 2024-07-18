import * as chalk from 'chalk';
import { context as githubContext } from '@actions/github';
import { cli } from './cli';
import { Version } from './version';
import { FoundryVTT } from './foundy-vtt';

export class Git {

  public static async setGithubLinks(manifest: FoundryVTT.Manifest.LatestVersion, isLatest: boolean): Promise<void> {
    const githubRepository = await Git.getGithubRepoName();
    if (githubRepository == null) {
      throw new Error(chalk.red(`Git no github repository found.`));
    }

    manifest.url = `https://github.com/${githubRepository}`;
    // When foundry checks if there is an update, it will fetch the manifest present in the zip, for us it points to the latest one.
    // The external one should point to itself so you can download a specific version
    // The zipped one should point to the latest manifest so when the "check for update" is executed it will fetch the latest
    if (isLatest) {
      // The manifest which is within the module zip
      manifest.manifest = `https://github.com/${githubRepository}/releases/download/latest/module.json`;
    } else {
      // Seperate file uploaded for github
      manifest.manifest = `https://github.com/${githubRepository}/releases/download/${manifest.version}/module.json`;
    }
    manifest.download = `https://github.com/${githubRepository}/releases/download/${manifest.version}/module.zip`;
  }

  public static async getGithubRepoName(): Promise<string> {
    let githubRepository: string;

    // Try to detect the github repo in a github action
    if (githubContext.payload?.repository?.full_name) {
      githubRepository = githubContext.payload?.repository?.full_name;
    }

    if (githubRepository == null) {
      let remoteName: string;
      {
        const out = await cli.execPromise('git remote');
        if (out.stdout) {
          const lines = out.stdout.split('\n');
          if (lines.length === 1) {
            remoteName = lines[0];
          }
        }
      }
      if (remoteName == null) {
        // Find the correct remote
        const out = await cli.execPromise('git branch -vv --no-color');
        if (out.stdout) {
          const rgx = /^\* [^\s]+ +[0-9a-fA-F]+ \[([^\/]+)\//;
          for (const line of out.stdout.split('\n')) {
            const match = rgx.exec(line);
            if (match) {
              remoteName = match[1];
            }
          }
        }
      }

      if (remoteName != null) {
        const remoteUrl = await cli.execPromise(`git remote get-url --push "${remoteName.replace(/"/g, '\\"')}"`);
        cli.throwIfError(remoteUrl);
        const sshRgx = /^git@github\.com:(.*)\.git$/i.exec(remoteUrl.stdout.trim());
        if (sshRgx) {
          githubRepository = sshRgx[1];
        } else {
          const httpRgx = /^https?:\/\/github\.com\/(.*)\.git$/i.exec(remoteUrl.stdout.trim());
          if (httpRgx) {
            githubRepository = httpRgx[1];
          }
        }
      }
    }
    
    return githubRepository;
  }

  public static async validateCleanRepo(): Promise<void> {
    const cmd = await cli.execPromise('git status --porcelain');
    cli.throwIfError(cmd);
    if (typeof cmd.stdout === 'string' && cmd.stdout.length > 0) {
      throw new Error("You must first commit your pending changes");
    }
  }

  public static async commitNewVersion(version: Version): Promise<void> {
    cli.throwIfError(await cli.execPromise('git add .'), {ignoreOut: true});
    cli.throwIfError(await cli.execPromise(`git commit -m "Updated to ${Version.toString(version)}`));
  }

  public static async deleteVersionTag(version: Version): Promise<void> {
    // Ignore errors
    await cli.execPromise(`git tag -d ${Version.toString(version)}`);
    await cli.execPromise(`git push --delete origin ${Version.toString(version)}`);
  }

  public static async getCurrentLongHash(): Promise<string> {
    const hash = await cli.execPromise(`git rev-parse HEAD`);
    cli.throwIfError(hash);
    return hash.stdout?.split('\n')?.[0];
  }

  public static async tagCurrentVersion(version: Version): Promise<void> {
    let versionStr = Version.toString(version);
    cli.throwIfError(await cli.execPromise(`git tag -a ${versionStr} -m "Updated to ${versionStr}"`));
    cli.throwIfError(await cli.execPromise(`git push origin ${versionStr}`), {ignoreOut: true});
  }

  public static async getLatestVersionTag(): Promise<Version> {
    const tagHash = await cli.execPromise('git show-ref --tags');
    const rgx = /refs\/tags\/(.*)/g;
    let match: RegExpExecArray;
    const versions: Version[] = [];
    while (match = rgx.exec(tagHash.stdout)) {
      try {
        versions.push(Version.parse(match[1]));
      } catch {/*ignore*/}
    }
    if (!versions.length) {
      return {major: 0, minor: 0, patch: 0};
    }
    versions.sort(Version.sort);
    return versions[versions.length - 1];
  }

  public static async push(): Promise<void> {
    cli.throwIfError(await cli.execPromise(`git push`));
  }

}