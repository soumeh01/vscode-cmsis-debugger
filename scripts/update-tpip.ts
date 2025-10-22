#!npx tsx

/**
 * Copyright 2025 Arm Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs";
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const yarnLockfile = require("@yarnpkg/lockfile");
import { PackageJson } from "type-fest";

class PackageFile {
    public content: PackageJson;

    constructor(filename: string) {
        const content = fs.readFileSync(filename, "utf8");
        this.content = JSON.parse(content);
    }

    get dependencies() {
        return this.content.dependencies;
    }
}

interface LockFileDependency {
    name: string;
    version: string;
    resolved?: string;
}

abstract class LockFile {
    protected filename: string;
    
    constructor(filename: string) {
        this.filename = filename;
        if (!fs.existsSync(filename)) {
            throw new Error(`Lockfile ${filename} does not exist`);
        }
    }

    abstract getDependencies(): LockFileDependency[];
    abstract getType(): string;
}

class YarnLock extends LockFile {
    private content: Record<string, any>;

    constructor(filename: string) {
        super(filename);
        const content = fs.readFileSync(filename, "utf8");
        const parsedLockfile = yarnLockfile.parse(content);

        if (parsedLockfile.type === "success") {
            this.content = parsedLockfile.object;
        } else {
            throw new Error(`Failed to parse ${filename} due to merge conflicts`);
        }
    }

    getDependencies(): LockFileDependency[] {
        const deps: LockFileDependency[] = [];
        for (const [key, value] of Object.entries(this.content)) {
            // Extract package name from yarn.lock key format (e.g., "package@^1.0.0" -> "package")
            const name = key.split('@')[0];
            deps.push({
                name: name,
                version: value.version || "unknown",
                resolved: value.resolved
            });
        }
        return deps;
    }

    getType(): string {
        return "yarn.lock";
    }
}

class NpmLock extends LockFile {
    private content: any;

    constructor(filename: string) {
        super(filename);
        const content = fs.readFileSync(filename, "utf8");
        this.content = JSON.parse(content);
    }

    getDependencies(): LockFileDependency[] {
        const deps: LockFileDependency[] = [];
        
        // Handle both package-lock.json v1/v2 and v3 formats
        if (this.content.dependencies) {
            this.extractDependenciesRecursive(this.content.dependencies, deps);
        }
        
        if (this.content.packages) {
            // package-lock.json v2/v3 format
            for (const [packagePath, packageInfo] of Object.entries(this.content.packages as Record<string, any>)) {
                if (packagePath === "" || packagePath === "node_modules") continue; // Skip root entry
                
                const name = packagePath.startsWith("node_modules/") 
                    ? packagePath.replace("node_modules/", "")
                    : packagePath;
                
                deps.push({
                    name: name,
                    version: packageInfo.version || "unknown",
                    resolved: packageInfo.resolved
                });
            }
        }
        
        return deps;
    }

    private extractDependenciesRecursive(dependencies: any, deps: LockFileDependency[], prefix = ""): void {
        for (const [name, info] of Object.entries(dependencies)) {
            const fullName = prefix ? `${prefix}/${name}` : name;
            deps.push({
                name: fullName,
                version: (info as any).version,
                resolved: (info as any).resolved
            });
            
            if ((info as any).dependencies) {
                this.extractDependenciesRecursive((info as any).dependencies, deps, fullName);
            }
        }
    }

    getType(): string {
        return "package-lock.json";
    }
}

function detectAndCreateLockFile(lockfilePath?: string): LockFile {
    if (lockfilePath) {
        // User specified a lockfile path
        if (lockfilePath.endsWith('yarn.lock')) {
            return new YarnLock(lockfilePath);
        } else if (lockfilePath.endsWith('package-lock.json')) {
            return new NpmLock(lockfilePath);
        } else {
            throw new Error(`Unsupported lockfile format: ${lockfilePath}`);
        }
    }

    // Auto-detect lockfile
    if (fs.existsSync('yarn.lock')) {
        console.log("📦 Detected yarn.lock - using Yarn lockfile");
        return new YarnLock('yarn.lock');
    } else if (fs.existsSync('package-lock.json')) {
        console.log("📦 Detected package-lock.json - using npm lockfile");
        return new NpmLock('package-lock.json');
    } else {
        throw new Error("No lockfile found. Please ensure either yarn.lock or package-lock.json exists.");
    }
}

async function main() {

    const { package: packageFile, lockfile } = yargs(hideBin(process.argv))
        .usage('Usage: $0 [options]')
        .option('package', {
            alias: 'p',
            description: 'Path to package.json',
            default: 'package.json',
            type: 'string',
        })
        .option('lockfile', {
            alias: 'l',
            description: 'Path to lockfile (yarn.lock or package-lock.json). If not specified, will auto-detect.',
            type: 'string',
        })
        .help('h')
        .version(false)
        .strict()
        .parseSync();
    
    try {
        const lockFile = detectAndCreateLockFile(lockfile);
        const packageJson = new PackageFile(packageFile);

        console.log(`🔍 Analyzing dependencies using ${lockFile.getType()}...\n`);

        if (packageJson.dependencies) {
            console.log("📋 Direct dependencies in package.json:");
            for (const [key, value] of Object.entries(packageJson.dependencies)) {
                console.log(`  ${key}: ${value}`);
            }
            console.log(`  Total: ${Object.keys(packageJson.dependencies).length} direct dependencies\n`);
        }

        const lockDependencies = lockFile.getDependencies();
        console.log(`📦 All dependencies in ${lockFile.getType()}:`);
        
        // Sort dependencies alphabetically for better readability
        const sortedDeps = lockDependencies.sort((a, b) => a.name.localeCompare(b.name));
        
        for (const dep of sortedDeps) {
            console.log(`  ${dep.name}: ${dep.version}`);
        }
        
        console.log(`  Total: ${lockDependencies.length} dependencies (including transitive)\n`);

        // Summary comparison
        const directCount = packageJson.dependencies ? Object.keys(packageJson.dependencies).length : 0;
        const totalCount = lockDependencies.length;
        console.log(`📊 Summary:`);
        console.log(`  Direct dependencies: ${directCount}`);
        console.log(`  Total dependencies: ${totalCount}`);
        console.log(`  Transitive dependencies: ${totalCount - directCount}`);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${errorMessage}`);
        process.exit(1);
    }

}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
