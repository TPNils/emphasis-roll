import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as sass from 'sass';

import { ChildProcess } from 'child_process';
import { args } from './args';
import { Git } from './git';
import { FoundryVTT } from './foundy-vtt';
import { Version } from './version';
import { TsCompiler } from './ts-compiler';
import { TsConfig } from './ts-config';

function findMostCommonDir(files: Iterable<string>): string {
  const dirs = new Set<string>();
  for (const file of files) {
    dirs.add(path.dirname(file));
  }

  let mostCommonDir: string | null = null;
  for (const dir of dirs) {
    mostCommonDir = dir;
    break;
  }
  if (mostCommonDir == null) {
    return '';
  }

  for (const dir of dirs) {
    const maxLength = Math.min(mostCommonDir.length, dir.length);
    let lastCommonCharIndex = 0;
    for (; lastCommonCharIndex < maxLength; lastCommonCharIndex++) {
      if (mostCommonDir[lastCommonCharIndex] !== dir[lastCommonCharIndex]) {
        break;
      }
    }
    mostCommonDir = mostCommonDir.substring(0, lastCommonCharIndex);
  }

  try {
    return fs.statSync(mostCommonDir)?.isDirectory() ? mostCommonDir : path.dirname(mostCommonDir)
  } catch {
    // File does not exist
    return path.dirname(mostCommonDir);
  }
}

async function cleanDir(dir: string): Promise<void> {
  const promises: Promise<any>[] = [];
  for (const file of await fsPromises.readdir(dir)) {
    promises.push(fsPromises.rm(path.join(dir, file), {recursive: true}));
  }
  await Promise.all(promises);
}

async function processFile(inputPath: string, outDir: string, rootDir: string): Promise<void> {
  let outputPath = path.join(outDir, path.relative(rootDir, inputPath));
  const ext = path.extname(inputPath).toLowerCase();
  switch (ext) {
    case '.sass':
    case '.scss': {
      outputPath = outputPath.replace(/\.s[ac]ss$/i, '.css');
      break;
    }
  }

  // If file is deleted, delete output
  if (!fs.existsSync(inputPath)) {
    if (fs.existsSync(outputPath)) {
      await fsPromises.rm(outputPath, {recursive: true});
    }
    return;
  }

  switch (ext) {
    case '.sass':
    case '.scss': {
      const compileResult = await sass.compileAsync(inputPath);
      await fsPromises.mkdir(path.dirname(outputPath), {recursive: true});
      await fsPromises.writeFile(outputPath, compileResult.css);
      break;
    }
    // case '.less': {
    //   // TODO
    //   throw new Error('TODO less compiler not supported yet')
    // }
    default: {
      await fsPromises.mkdir(path.dirname(outputPath), {recursive: true});
      const inputStream = fs.createReadStream(inputPath);
      const outputStream = fs.createWriteStream(outputPath);
      inputStream.pipe(outputStream, {end: true});
      await new Promise<void>((resolve, reject) => {
        outputStream.on('finish', resolve);
        outputStream.on('error', reject);
      });
    }
  }
}

export function preBuildValidation() {
  // Pre-build validation
  const tsConfig = TsConfig.getTsConfig();
  const outDir = path.resolve(path.dirname(tsConfig.path), tsConfig.config.compilerOptions?.outDir ?? 'dist');
  const allFiles = TsConfig.getAllFiles(tsConfig);
  const rootDir = tsConfig.config.compilerOptions?.rootDir ?? findMostCommonDir(allFiles);
  const inputFilesInOutDir: string[] = [];
  for (const file of allFiles) {
    if (file.startsWith(outDir)) {
      inputFilesInOutDir.push(file);
    }
  }
  if (inputFilesInOutDir.length > 0) {
    throw new Error(`No input files are allowed in the output dir.\nOutput dir:${outDir}\nConflicting input files:${inputFilesInOutDir.map(f => `\n- ${f}`)}`)
  }

  return {tsConfig, outDir, rootDir};
}

export async function build(outDir?: string): Promise<void> {
  // Pre-build validation
  const {tsConfig, outDir: tsOutDir, rootDir} = preBuildValidation();
  if (!outDir) {
    outDir = tsOutDir;
  }

  // Pre-build preparation
  await fsPromises.mkdir(outDir, {recursive: true});
  await cleanDir(outDir);

  // Exec build
  TsCompiler.createTsProgram({rootDir}).emit();
  await Promise.all(TsConfig.getNonTsFiles(tsConfig).map(file => processFile(file, outDir!, rootDir)));
}

export async function watch(outDir?: string): Promise<{stop: () => void}> {
  // Pre-watch validation
  const {tsConfig, outDir: tsOutDir, rootDir} = preBuildValidation();
  if (!outDir) {
    outDir = tsOutDir;
  }

  // Pre-watch preparation
  await fsPromises.mkdir(outDir, {recursive: true});
  await cleanDir(outDir);

  // Exec watch
  const tsWatcher = TsCompiler.createTsWatch({rootDir});
  const nonTsWatcher = TsConfig.watchNonTsFiles(tsConfig);
  nonTsWatcher.addListener('add', file => processFile(file, outDir!, rootDir).catch(console.error));
  nonTsWatcher.addListener('change', file => processFile(file, outDir!, rootDir).catch(console.error));
  nonTsWatcher.addListener('unlink', file => processFile(file, outDir!, rootDir).catch(console.error));

  // Find a matching foundry server
  let foundrySpawn: ChildProcess;
  for (const fConfig of FoundryVTT.getRunConfigs()) {
    if (outDir!.includes(path.normalize(fConfig.dataPath))) {
      foundrySpawn = FoundryVTT.startServer(fConfig.runInstanceKey);
      break;
    }
  }

  return {
    stop: () => {
      tsWatcher.close();
      nonTsWatcher.removeAllListeners();
      if (foundrySpawn) {
        foundrySpawn.kill();
      }
    }
  }
}

export async function compileReadme(): Promise<void> {
  const html = await FoundryVTT.markdownToHtml(fs.readFileSync('./README.md', 'utf8'));
  fs.writeFileSync('./README.html', html, 'utf8');
}

export async function manifestForGithubCurrentVersion(): Promise<void> {
  const srcPath = preBuildValidation().rootDir;
  const manifest = FoundryVTT.readManifest(srcPath);
  await Git.setGithubLinks(manifest.manifest, false);
  await FoundryVTT.writeManifest(manifest, {injectCss: true, injectHbs: true, injectOlderVersionProperties: true});
}

export async function manifestForGithubLatestVersion(): Promise<void> {
  const srcPath = preBuildValidation().rootDir;
  const manifest = FoundryVTT.readManifest(srcPath);
  await Git.setGithubLinks(manifest.manifest, true);
  await FoundryVTT.writeManifest(manifest, {injectCss: true, injectHbs: true, injectOlderVersionProperties: true});
}

export async function rePublish(): Promise<void> {
  const currentVersion = await Git.getLatestVersionTag();
  await Git.deleteVersionTag(currentVersion);
  await Git.tagCurrentVersion(currentVersion);
}

export async function publish(): Promise<void> {
  await args.validateVersion();
  await Git.validateCleanRepo();

  const srcPath = preBuildValidation().rootDir;
  const manifest = FoundryVTT.readManifest(srcPath);
  const newVersion = args.getNextVersion(await Git.getLatestVersionTag());
  manifest.manifest.version = Version.toString(newVersion);
  await Git.setGithubLinks(manifest.manifest, false);
  await FoundryVTT.writeManifest(manifest, {injectCss: true, injectHbs: true, injectOlderVersionProperties: true});

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  packageJson.version = manifest.manifest.version;
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2), 'utf8');

  await Git.commitNewVersion(newVersion);
  await Git.push();
  // If for some reason the tag already exists
  await Git.deleteVersionTag(newVersion);
  await Git.tagCurrentVersion(newVersion);
}
