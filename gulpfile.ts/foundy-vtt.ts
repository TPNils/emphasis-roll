import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as open from 'open';
import { Git } from './git';
import { Converter } from 'showdown';
import { ChildProcess, spawn } from 'child_process';

export class FoundryVTT {

  public static runConfigExists(): boolean {
    const configPath = path.resolve(process.cwd(), 'foundryconfig.json');

    return fs.existsSync(configPath);
  }

  public static getRunConfig(runInstanceKey: string): FoundryVTT.RunConfig {
    const configPath = path.resolve(process.cwd(), 'foundryconfig.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Missing file: ${configPath}`);
    }
    
    const file: Record<string, Omit<FoundryVTT.RunConfig, 'runInstanceKey'>> = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!(runInstanceKey in file)) {
      throw new Error(`runInstanceKey (${runInstanceKey}) not found in config file: ${configPath}`);
    }

    if (typeof file[runInstanceKey].dataPath !== 'string') {
      throw new Error(`Expected ${runInstanceKey}.dataPath to be a string, found ${typeof file[runInstanceKey].dataPath}`);
    }

    if (typeof file[runInstanceKey].foundryPath !== 'string') {
      throw new Error(`Expected ${runInstanceKey}.foundryPath to be a string, found ${typeof file[runInstanceKey].foundryPath}`);
    }

    return {
      ...file[runInstanceKey],
      runInstanceKey: runInstanceKey,
    };
  }

  public static getRunConfigs(): FoundryVTT.RunConfig[] {
    const configPath = path.resolve(process.cwd(), 'foundryconfig.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Missing file: ${configPath}`);
    }
    
    const file: Record<string, Omit<FoundryVTT.RunConfig, 'runInstanceKey'>> = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (typeof file !== 'object' || Array.isArray(file) || file == null) {
      throw new Error(`Expected to find a JSON object in: ${configPath}`);
    }
    
    const response: FoundryVTT.RunConfig[] = [];
    for (const runInstanceKey in file) {

      if (typeof file[runInstanceKey].dataPath !== 'string') {
        throw new Error(`Expected ${runInstanceKey}.dataPath to be a string, found ${typeof file[runInstanceKey].dataPath}`);
      }
  
      if (typeof file[runInstanceKey].foundryPath !== 'string') {
        throw new Error(`Expected ${runInstanceKey}.foundryPath to be a string, found ${typeof file[runInstanceKey].foundryPath}`);
      }

      response.push({
        ...file[runInstanceKey],
        runInstanceKey: runInstanceKey,
      });
    }

    return response;
  }

  public static readManifest(fileOrDirPath: string): FoundryVTT.Manifest {
    if (fs.statSync(fileOrDirPath).isDirectory()) {
      if (fs.statSync(path.join(fileOrDirPath, 'module.json')).isFile()) {
        fileOrDirPath = path.join(fileOrDirPath, 'module.json');
      } else if (fs.statSync(path.join(fileOrDirPath, 'system.json')).isFile()) {
        fileOrDirPath = path.join(fileOrDirPath, 'system.json');
      } else {
        throw new Error(`Could not find a module.json or system.json in path ${fileOrDirPath}`)
      }
    }
    return {
      type: fileOrDirPath.endsWith('system.json') ? 'system' : 'module',
      filePath: fileOrDirPath,
      manifest: FoundryVTT.#toLatestVersion(JSON.parse(fs.readFileSync(fileOrDirPath, 'utf8'))),
    };
  }

  public static async writeManifest(manifest: FoundryVTT.Manifest, options: FoundryVTT.Manifest.WriteOptions = {}): Promise<void> {
    let fileContent: FoundryVTT.Manifest['manifest'] = JSON.parse(JSON.stringify(manifest.manifest));
    if (options.injectCss) {
      await FoundryVTT.#injectCss(fileContent, path.dirname(manifest.filePath));
    }
    if (options.injectHbs) {
      await FoundryVTT.#injectHbs(fileContent, path.dirname(manifest.filePath));
    }
    if (options.injectOlderVersionProperties) {
      const minimumCompatibility = fileContent.compatibility?.minimum;
      if (minimumCompatibility && Number(minimumCompatibility.split('.')[0]) <= 9) {
        FoundryVTT.#injectV9Properties(fileContent);
      }
    }
    
    fileContent = FoundryVTT.#sortProperties(fileContent);
    fs.writeFileSync(manifest.filePath, JSON.stringify(fileContent, null, 2));
  }

  public static async markdownToHtml(markdown: string): Promise<string> {
    // Prefix relative links
    const githubRepository = await Git.getGithubRepoName();
    const commitHash = await Git.getCurrentLongHash();
    if (githubRepository && commitHash) {
      markdown = markdown.replace(/(\[(.*?[^\\](?:\\\\)*)]\()\//g, `$1https://github.com/${githubRepository}/raw/${commitHash}/`)
    }
    
    const converter = new Converter({
      simplifiedAutoLink: true,
    });
    return converter.makeHtml(markdown);
  }

  public static startServer(runInstanceKey: string): ChildProcess {
    const config = FoundryVTT.getRunConfig(runInstanceKey)
    const childProcess = spawn('node', [path.join(config.foundryPath, 'resources', 'app', 'main.js'), `--dataPath="${config.dataPath}"`]);
    console.log('starting foundry: ', `${childProcess.spawnfile} ${childProcess.spawnargs.join(' ')}`)

    let serverStarted = false;
    childProcess.stdout!.on('data', function (data) {
      process.stdout.write(data.replace(/^(foundryvtt)?/i, `$1 ${config.runInstanceKey}`));
      if (!serverStarted) {
        const result = /Server started and listening on port ([0-9]+)/i.exec(data.toString());
        if (result) {
          open(`http://localhost:${result[1]}/game`);
        }
      }
    });
    
    childProcess.stderr!.on('data', function (data) {
      process.stderr.write(data.replace(/^(foundryvtt)?/i, `$1 ${config.runInstanceKey}`));
    });

    return childProcess;
  }
  
  static #toLatestVersion(input: Partial<FoundryVTT.Manifest.V8 & FoundryVTT.Manifest.V10 & FoundryVTT.Manifest.V11>): FoundryVTT.Manifest.V11 {
    const latest: typeof input = JSON.parse(JSON.stringify(input));

    // Migrate deprecated fields from input to
    latest.authors = input.authors;
    if (input.author) {
      if (latest.authors == null) {
        latest.authors = [];
      }
      input.authors!.push({name: input.author})
    }
    latest.bugs = input.bugs;
    latest.changelog = input.changelog;
    if (input.compatibility) {
      latest.compatibility = input.compatibility;
    } else {
      latest.compatibility = {
        minimum: input.minimumCoreVersion,
        verified: input.compatibleCoreVersion,
      };
    }
    latest.description = input.description;
    latest.download = input.download;
    latest.esmodules = input.esmodules;
    latest.flags = input.flags;
    latest.id = input.id ?? input.name;
    latest.languages = input.languages;
    latest.license = input.license;
    latest.manifest = input.manifest;
    if (input.packs) {
      latest.packs = new Array<any>();
      for (const pack of input.packs) {
        if (pack.type != null) {
          latest.packs.push(pack);
        } else {
          latest.packs.push({
            name: pack.name,
            label: pack.label,
            path: pack.path,
            type: pack.entity,
            system: pack.system,
            private: pack.private,
            flags: pack.flags,
          })
        }
      }
    }
    latest.protected = input.protected;
    latest.readme = input.readme;
    const relationshipRequiredById = new Map<string, FoundryVTT.Manifest.Relationship<'module'>>();
    const relationshipSystemsById = new Map<string, FoundryVTT.Manifest.Relationship<'system'>>();
    if (input.dependencies) {
      for (const module of input.dependencies) {
        if (module.type === 'system') {
          relationshipSystemsById.set(module.name, {id: module.name, type: module.type, manifest: module.manifest});
        } else {
          relationshipRequiredById.set(module.name, {id: module.name, type: module.type, manifest: module.manifest});
        }
      }
    }
    if (input.system) {
      for (const system of input.system) {
        relationshipSystemsById.set(system, {id: system, type: 'system'});
      }
    }
    if (input.relationships?.requires) {
      for (const required of input.relationships.requires) {
        if ((required.type as string) === 'system') {
          relationshipSystemsById.set(required.id, required as any as FoundryVTT.Manifest.Relationship<'system'>);
        } else {
          relationshipRequiredById.set(required.id, required);
        }
      }
    }
    if (input.relationships?.systems) {
      for (const system of input.relationships.systems) {
        relationshipSystemsById.set(system.id, system);
      }
    }
    if (latest.relationships == null) {
      latest.relationships = {};
    }
    latest.relationships.requires = Array.from(relationshipRequiredById.values());
    latest.relationships.systems = Array.from(relationshipSystemsById.values());
    latest.scripts = input.scripts;
    latest.socket = input.socket;
    latest.styles = input.styles;
    latest.title = input.title;
    latest.url = input.url;
    latest.version = input.version;
    
    // Delete deprecated fields from latest version
    delete latest.name;
    delete latest.author;
    delete latest.minimumCoreVersion;
    delete latest.compatibleCoreVersion;
    delete latest.system;
    delete latest.dependencies;

    return latest as any;
  }

  static async #injectCss(input: FoundryVTT.Manifest.LatestVersion, findInDir: string): Promise<void> {
    const cssFileGlobResult = await glob(path.join(findInDir, '**/*.css'));
  
    const cssFiles = new Set<string | null>();
    for (const fileNames of cssFileGlobResult) {
      for (let fileName of fileNames) {
        fileName = path.normalize(fileName);
        // Remove the destination path prefix
        fileName = fileName.substring(findInDir.length + path.sep.length);
        fileName = fileName.replace(path.sep, '/');
        cssFiles.add(fileName);
      }
    }

    if (Array.isArray(input.styles)) {
      for (const value of input.styles) {
        cssFiles.add(value)
      }
    }
    cssFiles.delete(null);

    input.styles = Array.from(cssFiles as Set<string>).sort();
  }

  static async #injectHbs(input: FoundryVTT.Manifest.LatestVersion, findInDir: string): Promise<void> {
    const hbsGlobFiles = await glob(path.join(findInDir, '**/*.hbs'));
  
    const hbsFiles = new Set<string | null>();
    for (const fileNames of hbsGlobFiles) {
      for (let fileName of fileNames) {
        fileName = path.normalize(fileName);
        // Remove the destination path prefix
        fileName = fileName.substring(findInDir.length + path.sep.length);
        fileName = fileName.replace(path.sep, '/');
        hbsFiles.add(fileName);
      }
    }

    if (Array.isArray(input.flags?.hbsFiles)) {
      for (const value of input.flags!.hbsFiles) {
        hbsFiles.add(value)
      }
    }
    hbsFiles.delete(null);

    if (input.flags == null) {
      input.flags = {};
    }
    input.flags.hbsFiles = Array.from(hbsFiles).sort();
  }

  static #injectV9Properties(input: FoundryVTT.Manifest.LatestVersion): void {
    // Don't copy, just used for TS type safety
    const v9: FoundryVTT.Manifest.V8 = input as any;
    if (input.compatibility) {
      v9.minimumCoreVersion = input.compatibility.minimum;
      v9.compatibleCoreVersion = input.compatibility.verified ?? input.compatibility.maximum ?? input.compatibility.minimum;
    }
    v9.name = input.id;
    v9.packs = input.packs?.map(p => ({...p, entity: p.type}));
    const relationshipModulesById = new Map<string, FoundryVTT.Manifest.Relationship<'module'>>();
    const relationshipSystemsById = new Map<string, FoundryVTT.Manifest.Relationship<'system'>>();

    const relationships: FoundryVTT.Manifest.Relationship[] = [];
    if (input.relationships?.requires) {
      relationships.push(...input.relationships.requires)
    }
    if (input.relationships?.systems) {
      relationships.push(...input.relationships.systems)
    }
    for (const relationship of relationships) {
      switch (relationship.type) {
        case 'module': {
          relationshipModulesById.set(relationship.id, relationship as FoundryVTT.Manifest.Relationship<'module'>);
          break;
        }
        case 'system': {
          relationshipSystemsById.set(relationship.id, relationship as FoundryVTT.Manifest.Relationship<'system'>);
          break;
        }
      }
    }
    v9.dependencies = Array.from(relationshipModulesById.values()).map(d => ({name: d.id, type: d.type as any, manifest: d.type}));
    v9.system = Array.from(relationshipSystemsById.keys());
  }

  static #sortProperties<T extends Record<string, any>>(obj: T): T {
    const propertyOrder: Array<keyof FoundryVTT.Manifest.LatestVersion | keyof T> = [
      'id',
      'name',
      'title',
      'version',
      'compatibility',
      'minimumCoreVersion',
      'compatibleCoreVersion',
      'description',
      'author',
      'authors',
      'url',
      'manifest',
      'download',
      'media',
      'license',
      'readme',
      'bugs',
      'changelog',
      'flags',
      'scripts',
      'esmodules',
      'styles',
      'languages',
      'packs',
      'relationships',
      'system',
      'dependencies',
      'socket',
      'protected',
      'exclusive',
    ];

    const shallowClone: Partial<T> = {};
    {
      const extraProperties: typeof propertyOrder = [];
      for (let key in obj) {
        shallowClone[key] = obj[key];
        delete obj[key];
        if (!propertyOrder.includes(key) && !extraProperties.includes(key)) {
          extraProperties.push(key);
        }
      }
      propertyOrder.push(...extraProperties.sort());
    }

    for (const key of propertyOrder) {
      if (key in shallowClone) {
        obj[key] = shallowClone[key];
      }
    }

    return obj;
  }

}

export namespace FoundryVTT {
  export interface RunConfig {
    runInstanceKey: string;
    dataPath: string;
    foundryPath: string;
  }

  export interface Manifest {
    type: 'module' | 'system';
    filePath: string;
    manifest: Manifest.LatestVersion;
  };

  export namespace Manifest {
    export interface Compatibility {
      /** The Package will not function before this version */
      minimum?: string;
      /** Verified compatible up to this version */
      verified?: string
      /** The Package will not function after this version */;
      maximum?: string;
    }
  
    export type FoundryFlags = {[flag: string]: any};
  
    export interface Relationship<TYPE extends string = 'world' | 'system' | 'module'> {
      /** The id of the related package */
      id: string;
      /** The type of the related package */
      type: TYPE;
      /** An explicit manifest URL, otherwise learned from the Foundry web server */
      manifest?: string;
      /** The compatibility data with this related Package */
      compatibility?: Compatibility;
      /** The reason for this relationship */
      reason?: string;
    }
  
    /** @deprecated */
    export interface V8 {
      /** @deprecated The machine-readable unique package name, should be lower-case with no spaces or special characters */
      name: string;
      /** The human-readable package title, containing spaces and special characters */
      title: string;
      /** An optional package description, may contain HTML */
      description?: string;
      /** @deprecated */
      author?: string;
      authors: Array<{
        name: string;
        email?: string;
        url?: string;
        discord?: string;
      }>;
      /** A web url where more details about the package may be found */
      url?: string;
      /** A web url or relative file path where license details may be found */
      license?: string;
      /** A web url or relative file path where readme instructions may be found */
      readme?: string;
      /** A web url where bug reports may be submitted and tracked */
      bugs?: string;
      /** A web url where notes detailing package updates are available */
      changelog?: string;
      flags?: FoundryFlags;
    
      // Package versioning
      /** The current package version */
      version: string;
      /** @deprecated A minimum version of the core Foundry software which is required to use this package */
      minimumCoreVersion?: string;
      /** @deprecated A maximum version of the core Foundry software beyond which compatibility is not guaranteed */
      compatibleCoreVersion?: string;
    
      // Included content
      /** An array of urls or relative file paths for JavaScript files which should be included */
      scripts?: string[];
      /** An array of urls or relative file paths for ESModule files which should be included */
      esmodules?: string[];
      /** An array of urls or relative file paths for CSS stylesheet files which should be included */
      styles?: string[];
      /** An array of language data objects which are included by this package */
      languages?: Array<{
        /** A string language code which is validated by Intl.getCanonicalLocales */
        lang: string;
        /** The human-readable language name */
        name: string;
        /** The relative path to included JSON translation strings */
        path: string;
        /** Only apply this set of translations when a specific system is being used */
        system?: string;
        /** Only apply this set of translations when a specific module is active */
        module?: string;
      }>;
      packs?: Array<{
        name: string;
        label: string;
        path: string;
        entity: "Actor" | "Item" | "Scene" | "JournalEntry" | "Macro" | "RollTable" | "Playlist";
        private?: boolean;
        system?: boolean;
      }>;
    
      // Package dependencies
      /** @deprecated */
      system?: string[];
      /** @deprecated */
      dependencies?: Array<{
        /** Package name */
        name: string;
        type: 'module' | 'system';
        manifest?: string;
      }>;
      /** Whether to require a package-specific socket namespace for this package */
      socket?: boolean;
    
      // Package downloading
      /** A publicly accessible web URL which provides the latest available package manifest file. Required in order to support module updates. */
      manifest?: string;
      /** A publicly accessible web URL where the source files for this package may be downloaded. Required in order to support module installation. */
      download?: string;
      /** Whether this package uses the protected content access system. */
      protected?: boolean;
    }
    
    export interface V10 extends Omit<V8, 'name' | 'minimumCoreVersion' | 'compatibleCoreVersion' | 'dependencies' | 'system' | 'packs'> {
      /** The machine-readable unique package id, should be lower-case with no spaces or special characters */
      id: string;
      /** The compatibility of this version with the core Foundry software */
      compatibility?: Compatibility
      media?: {
        type?: string;
        url?: string;
        caption?: string;
        loop?: boolean;
        thumbnail?: string;
        flags?: FoundryFlags;
      };
      packs?: Array<{
        name: string;
        label: string;
        path: string;
        type: "Actor" | "Item" | "Scene" | "JournalEntry" | "Macro" | "RollTable" | "Playlist";
        system?: boolean;
        private?: boolean;
        flags?: FoundryFlags;
      }>;
      relationships: {
        /** Systems that this Package supports, all of them optional */
        systems?: Array<Relationship<'system'>>;
        /** Packages that are required for base functionality */
        requires?: Array<Relationship<'module'>>;
      }
      exclusive: boolean;
    }
    
    export interface V11 extends Omit<V10, 'relationships'> {
      relationships: V10['relationships'] & {
        recommends?: Array<Relationship<'module'>>;
        conflicts?: Array<Relationship>;
        flags?: FoundryFlags;
      },
    }

    export type LatestVersion = V11;

    export interface WriteOptions {
      injectOlderVersionProperties?: true;
      injectCss?: true;
      injectHbs?: true;
    }
  }
}