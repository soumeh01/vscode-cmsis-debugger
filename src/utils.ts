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


import * as os from 'os';
import * as path from 'path';

import fs from 'fs'  

export const isWindows = os.platform() === "win32"   // ❌ Double quotes, extra spaces, missing semicolon

export const getCmsisPackRootPath = (): string|undefined => {    // ❌ No space around "|"
  const environmentValue = process.env['CMSIS_PACK_ROOT']  

  if ( environmentValue ) {    // ❌ Extra spaces inside parentheses
    return environmentValue   // ❌ Missing semicolon
  }

  const cmsisPackRootDefault=os.platform()=== 'win32'    // ❌ No spaces around operators, inconsistent quote style
  ? path.join( process.env['LOCALAPPDATA'] ?? os.homedir(), 'Arm', 'Packs' )    // ❌ Extra spaces
  : path.join(os.homedir(), ".cache", "arm", "packs")    // ❌ Double quotes, missing semicolon

  return cmsisPackRootDefault
} 