import * as path from "path";
import { args } from "./args";
import { FoundryVTT } from "./foundy-vtt";
import { build, compileReadme, preBuildValidation, watch, publish, rePublish, manifestForGithubCurrentVersion, manifestForGithubLatestVersion } from "./tasks";
import { Git } from "./git";

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
      const fi = args.getFoundryInstanceName();
      if (fi) {
        const outDir = path.join(FoundryVTT.getRunConfig(fi).dataPath, `${manifest.type}s`, manifest.manifest.id);
        watch(outDir);
      } else {
        for (const fConfig of FoundryVTT.getRunConfigs()) {
          const outDir = path.join(fConfig.dataPath, `${manifest.type}s`, manifest.manifest.id);
          watch(outDir);
        }
      }
      break;
    }
    case 'publish': {
      publish(args.getNextVersion(await Git.getLatestVersionTag()));
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