import * as path from "path";
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import { FoundryVTT } from "foundry-vtt-build-tools/src/foundy-vtt";
import { build, compileReadme, preBuildValidation, watch, publish, rePublish, manifestForGithubCurrentVersion, manifestForGithubLatestVersion } from "foundry-vtt-build-tools/src/tasks";
import { Git } from "foundry-vtt-build-tools/src/git";
import { Version } from 'foundry-vtt-build-tools/src/version';

class Args {
  private static args: {
    u?: string; update?: string;
    fi?: string; foundryinstance?: string;
  } = yargs.argv;
 
  public static getNextVersion(currentVersion: Version): Version {
    const version = this.args.update || this.args.u;
    if (!version) {
      throw new Error('Missing version number. Use -u <version> (or --update) to specify a version.');
    }
  
    let targetVersion: Version | null = null;
  
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
  
  public static getFoundryInstanceName(): string | undefined {
    return this.args.foundryinstance ?? this.args.fi;
  }
}

async function start() {
  switch (process.argv[2]) {
    case 'build': {
      build();
      break;
    }
    // case 'buildZip': {
    //   break;
    // }
    case 'compileReadme': {
      compileReadme();
      break;
    }
    case 'watch': {
      const srcDir = preBuildValidation().rootDir;
      const manifest = FoundryVTT.readManifest(srcDir);
      const fi = Args.getFoundryInstanceName();
      if (fi) {
        const outDir = path.join(FoundryVTT.getRunConfig(fi).dataPath, 'Data', `${manifest.type}s`, manifest.manifest.id);
        console.log(outDir)
        watch(outDir);
      } else {
        for (const fConfig of FoundryVTT.getRunConfigs()) {
          const outDir = path.join(fConfig.dataPath, 'Data', `${manifest.type}s`, manifest.manifest.id);
          console.log(outDir)
          // watch(outDir);
        }
      }
      break;
    }
    case 'publish': {
      publish(Args.getNextVersion(await Git.getLatestVersionTag()));
      break;
    }
    case 'reupload': {
      rePublish();
      break;
    }
    case 'updateZipManifestForGithub': {
      manifestForGithubCurrentVersion();
      break;
    }
    case 'updateExternalManifestForGithub': {
      manifestForGithubLatestVersion();
      break;
    }
  
    default: {
      throw new Error(`Unknown command: ${process.execArgv.join(' ')}`)
    }
  }
}

start();