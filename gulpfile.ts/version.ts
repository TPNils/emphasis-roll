export interface Version {
  major: number;
  minor: number;
  patch: number;
  addon?: string;
}

type VersionNrString = `${number}` | `${number}.${number}` | `${number}.${number}.${number}` | `${number}.${number}.${number}-${string}`;
export type VersionString = VersionNrString | `v${VersionNrString}` | `V${VersionNrString}`;

const versionMatch = /^v?(\d{1,})(?:\.(\d{1,})(?:\.(\d{1,})(?:-(.+))?)?)?$/i;
export namespace Version {
  export function isVersionString(versionStr: string): versionStr is VersionString {
    return versionMatch.test(versionStr);
  }

  export function parse(versionStr: string): Version {
    const match = versionMatch.exec(versionStr);
    if (!match) {
      throw new Error(`Invalid version format. Expected: "v0", "v0.0", "v0.0.0" or "v0.0.0-addon"`)
    }

    const version: Version = {
      major: Number(match[1]),
      minor: match[2] ? Number(match[2]) : 0,
      patch: match[3] ? Number(match[3]) : 0,
    };

    if (match[4]) {
      version.addon = match[4];
    }

    return version;
  }

  export function toString(version: Version): VersionString {
    let versionStr = `v${version.major}.${version.minor}.${version.patch}`;
    if (version.addon) {
      versionStr += `-${version.addon}`;
    }
    return versionStr as VersionString;
  }

  export function sort(a: string | Version, b: string | Version): number {
    let versionA: Version;
    let versionB: Version;
    try {
      versionA = typeof a === 'string' ? parse(a) : a;
      versionB = typeof b === 'string' ? parse(b) : b;
    } catch {
      return (typeof a === 'string' ? a : toString(a)).localeCompare(typeof b === 'string' ? b : toString(b));
    }

    let diff: number;
    for (const key of ['major', 'minor', 'patch']) {
      diff = versionA[key] - versionB[key];
      if (diff > 0) {
        return 1;
      }
      if (diff < 0) {
        return -1;
      }
    }

    return (versionA.addon ?? '').localeCompare(versionB.addon ?? '');
  }
}