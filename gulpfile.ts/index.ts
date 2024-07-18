import * as path from "path";
import { args } from "./args";
import { FoundryVTT } from "./foundy-vtt";
import { build, compileReadme, preBuildValidation, watch } from "./tasks";

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
    publish();
    break;
  }
  case 'reupload': {
    reupload();
    break;
  }
  case 'updateZipManifestForGithub': {
    updateZipManifestForGithub();
    break;
  }
  case 'updateExternalManifestForGithub': {
    updateExternalManifestForGithub();
    break;
  }

  default: {
    // throw new Error(`Unknown command: ${process.execArgv.join(' ')}`)
  }
}
function publish() {
  throw new Error("Function not implemented.");
}

function reupload() {
  throw new Error("Function not implemented.");
}

function updateZipManifestForGithub() {
  throw new Error("Function not implemented.");
}

function updateExternalManifestForGithub() {
  throw new Error("Function not implemented.");
}

