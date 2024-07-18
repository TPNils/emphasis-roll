
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import { Git } from './git';
import { Version } from './version';

class Args {
  private args: {
    u?: string; update?: string;
    fi?: string; foundryinstance?: string;
  } = yargs.argv;
 
  public getNextVersion(currentVersion: Version): Version {
    const version = this.args.update || this.args.u;
    if (!version) {
      throw new Error('Missing version number. Use -u <version> (or --update) to specify a version.');
    }
  
    let targetVersion: Version;
  
    if (Version.isVersionString(version)) {
      targetVersion = Version.parse(version);
    } else {
      if (version.toLowerCase() === 'major') {
        targetVersion = {
          ...currentVersion,
          major: currentVersion.major+1,
        }
      } else if (version.toLowerCase() === 'minor') {
        targetVersion = {
          ...currentVersion,
          minor: currentVersion.minor+1,
        }
      } else if (version.toLowerCase() === 'patch') {
        targetVersion = {
          ...currentVersion,
          patch: currentVersion.patch+1,
        }
      }
    }
  
    if (targetVersion == null) {
      throw new Error(chalk.red('Error: Incorrect version arguments. Accepts the following:\n- major\n- minor\n- patch\n- the following patterns: 1.0.0 | 1.0.0-beta'));
    }
    return targetVersion;
  }
  
  public getFoundryInstanceName(): string | undefined {
    return this.args.foundryinstance ?? this.args.fi;
  }

  public async validateVersion(): Promise<void> {
      const currentVersion = await Git.getLatestVersionTag();
      const newVersion = this.getNextVersion(currentVersion);

      if (currentVersion.major < newVersion.major) {
        return;
      } else if (currentVersion.major > newVersion.major) {
        throw new Error(`New version is not higher. old: ${Version.toString(currentVersion)} | new: ${Version.toString(newVersion)}`);
      }
      if (currentVersion.minor < newVersion.minor) {
        return;
      } else if (currentVersion.minor > newVersion.minor) {
        throw new Error(`New version is not higher. old: ${Version.toString(currentVersion)} | new: ${Version.toString(newVersion)}`);
      }
      if (currentVersion.patch < newVersion.patch) {
        return;
      } else if (currentVersion.patch > newVersion.patch) {
        throw new Error(`New version is not higher. old: ${Version.toString(currentVersion)} | new: ${Version.toString(newVersion)}`);
      }
      
      throw new Error(`New version is not higher. old: ${Version.toString(currentVersion)} | new: ${Version.toString(newVersion)}`);
  }
}

export const args = new Args();
for (let prop in args) {
  if (typeof args[prop] === 'function') {
    args[prop] = args[prop].bind(args);
  }
}