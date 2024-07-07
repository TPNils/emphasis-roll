
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import { foundryManifest } from './foundry-manifest';
import { git } from './git';

export interface Version {
  major: number;
  minor: number;
  patch: number;
  addon?: string;
}

class Args {
  private static readonly versionMatch = /^v?(\d{1,})(?:\.(\d{1,})(?:\.(\d{1,})(-.+)?)?)?$/;
  /** @type {{u?: string; update?: string;}} */
  private args: {
    u?: string; update?: string;
    fi?: string; foundryinstance?: string;
  } = yargs.argv;
  
  public async getCurrentVersion(): Promise<string> {
    const versions = await Promise.all([
      git.getLatestVersionTag(),
      foundryManifest.getManifest().file.version,
    ]);
    const latestVersion = versions.filter(v => !!v).sort(this.sortVersions)[versions.length - 1];
    if (latestVersion.startsWith('v')) {
      return latestVersion.substring(1)
    }
    return latestVersion;
  }
 
  public getNextVersion(currentVersion: string, allowNoVersion: true): string
  public getNextVersion(currentVersion?: string, allowNoVersion?: false): string | null
  public getNextVersion(currentVersion?: string, allowNoVersion = false): string | null {
    if (currentVersion == null || currentVersion == '') {
      currentVersion = '0.0.0';
    }
    const version = this.args.update || this.args.u;
    if (!version) {
      if (allowNoVersion) {
        return null;
      }
      throw new Error('Missing version number. Use -u <version> (or --update) to specify a version.');
    }
  
    let targetVersion: string;
  
    if (Args.versionMatch.test(version)) {
      targetVersion = version;
    } else {
      targetVersion = currentVersion.replace(
        Args.versionMatch,
        (substring, major, minor, patch, addon) => {
          let target: string | null = null;
          if (version.toLowerCase() === 'major') {
            target = `${Number(major) + 1}.0.0`;
          } else if (version.toLowerCase() === 'minor') {
            target = `${major}.${Number(minor) + 1}.0`;
          } else if (version.toLowerCase() === 'patch') {
            target = `${major}.${minor}.${Number(patch) + 1}`;
          }
  
          if (addon) {
            target += addon;
          }
  
          return target;
        }
      );
    }
  
    if (targetVersion == null) {
      throw new Error(chalk.red('Error: Incorrect version arguments. Accepts the following:\n- major\n- minor\n- patch\n- the following patterns: 1.0.0 | 1.0.0-beta'));
    }
    return targetVersion;
  }
  
  public getFoundryInstanceName(): string | undefined {
    return this.args.foundryinstance ?? this.args.fi;
  }

  /**
   * @param {string} version
   * @returns {}
   */
  public parseVersion(version: string): Version | null {
    if (version == null) {
      return null;
    }
    const versionMatch = /^v?(\d{1,}).(\d{1,}).(\d{1,})(-.+)?$/;
    const exec = versionMatch.exec(version);
    if (exec) {
      return {
        major: Number(exec[1]),
        minor: Number(exec[2]),
        patch: Number(exec[3]),
        addon: exec[4],
      }
    }

    return null;
  }

  public sortVersions(a: string, b: string): number {
    const aRgx = Args.versionMatch.exec(a);
    const bRgx  = Args.versionMatch.exec(b);

    for (let i = 1, diff = 0; i < aRgx.length - 1; i++) {
      diff = (!!aRgx[i] ? Number(aRgx[i]) : 0) - (!!bRgx[i] ? Number(bRgx[i]) : 0);
      if (diff !== 0) {
        return 1;
      }
    }
    return (aRgx[aRgx.length-1] ?? '').localeCompare(bRgx[bRgx.length-1] ?? '')
  }

  public async validateVersion(): Promise<void> {
      const currentVersionString = await git.getLatestVersionTag();
      const currentVersion = this.parseVersion(currentVersionString);
      if (!currentVersion) {
        return;
      }
      const newVersionString = await this.getNextVersion(currentVersionString, false);
      const newVersion = this.parseVersion(newVersionString)!;

      if (currentVersion.major < newVersion.major) {
        return;
      } else if (currentVersion.major > newVersion.major) {
        throw new Error(`New version is not higher. old: ${currentVersionString} | new: ${newVersionString}`);
      }
      if (currentVersion.minor < newVersion.minor) {
        return;
      } else if (currentVersion.minor > newVersion.minor) {
        throw new Error(`New version is not higher. old: ${currentVersionString} | new: ${newVersionString}`);
      }
      if (currentVersion.patch < newVersion.patch) {
        return;
      } else if (currentVersion.patch > newVersion.patch) {
        throw new Error(`New version is not higher. old: ${currentVersionString} | new: ${newVersionString}`);
      }
      
      throw new Error(`New version is not higher. old: ${currentVersionString} | new: ${newVersionString}`);
  }
}

export const args = new Args();
for (let prop in args) {
  if (typeof args[prop] === 'function') {
    args[prop] = args[prop].bind(args);
  }
}