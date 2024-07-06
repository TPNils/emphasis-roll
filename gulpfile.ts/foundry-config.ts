import * as fs from 'fs-extra';
import * as path from 'path';
import { args } from './args';

interface FoundryConfigFileJson {
  [key: string]: {
    dataPath: string;
    foundryPath: string;
  }
}

export interface FoundryConfigJson {
  runInstanceKey: string;
  dataPath?: string;
  foundryPath?: string;
}

class FoundryConfig {

  public exists(): Boolean {
    return fs.existsSync(path.resolve(process.cwd(), 'foundryconfig.json'));
  }

  public getFoundryConfig(runInstanceKey?: string): FoundryConfigJson[] {
    if (!runInstanceKey) {
      runInstanceKey = args.getFoundryInstanceName();
    }
    const configPath = path.resolve(process.cwd(), 'foundryconfig.json');
    const responses: FoundryConfigJson[] = [];
  
    if (fs.existsSync(configPath)) {
      const file: FoundryConfigFileJson = fs.readJSONSync(configPath);
      if (runInstanceKey && runInstanceKey in file) {
        responses.push({
          runInstanceKey: runInstanceKey,
          ...file[runInstanceKey]
        });
      } else {
        for (const key in file) {
          if (typeof file[key] === 'object') {
            responses.push({
              runInstanceKey: key,
              ...file[key]
            });
          }
        }
      }
    }

    return responses;
  }

}

export const foundryConfig = new FoundryConfig();
for (let prop in foundryConfig) {
  if (typeof foundryConfig[prop] === 'function') {
    foundryConfig[prop] = foundryConfig[prop].bind(foundryConfig);
  }
}