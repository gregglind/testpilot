/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono X <jono@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


function JarStore() {
  dump("Trying to instantiate jar store.\n");
  try {
  let baseDirName = "TestPilotExperimentFiles"; // this should go in pref?
  this._baseDir = null;
  this._index = {}; // tells us which jar file to look in for each module
  this._lastModified = {}; // tells us when each jar file was last modified
  this._init( baseDirName );
  dump("done instantiating jar store.\n");
  } catch (e) {
    dump("Error instantiating jar store: " + e + "\n");
  }
}
JarStore.prototype = {

  _init: function( baseDirectory ) {
    let dir = Cc["@mozilla.org/file/directory_service;1"].
      getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    dir.append(baseDirectory);
    this._baseDir = dir;
    dump("Directory is " + this._baseDir.path + "\n");
    if( !this._baseDir.exists() || !this._baseDir.isDirectory() ) {
      // if jar storage directory doesn't exist, create it:
      dump("Creating: " + this._baseDir.path + "\n");
      this._baseDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    } else {
      // Process any jar files already on disk from previous runs:
      // Build lookup index of module->jar file and modified dates
      let jarFiles = this._baseDir.directoryEntries;
      dump("Listing directory...\n");
      while(jarFiles.hasMoreElements()) {
        let jarFile = jarFiles.getNext().QueryInterface(Ci.nsIFile);
        // Make sure this is actually a jar file:
        if (jarFile.leafName.indexOf(".jar") != jarFile.leafName.length - 4) {
          continue;
        }
        // TODO should call _verifyJar here, but need a hash to compare it to...
        dump("  --> " + jarFile.path + " (" + jarFile.leafName + ")\n");
        this._lastModified[jarFile.leafName] = jarFile.lastModifiedTime;
        dump("  --> Last modified at " + jarFile.lastModifiedTime + "\n");
        this._indexJar(jarFile);
      }
    }
  },

  _indexJar: function(jarFile) {
    let zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
    zipReader.open(jarFile); // must already be nsIFile
    let entries = zipReader.findEntries(null);
    while(entries.hasMore()) {
      // Find all .js files inside jar file:
      let entry = entries.getNext();
      if (entry.indexOf(".js") == entry.length - 3) {
        // add entry to index
       let moduleName = entry.slice(0, entry.length - 3);
       dump("Storing module in index as " + moduleName + "\n");
       this._index[moduleName] = jarFile.path;
      }
    }
    zipReader.close();
  },

  _verifyJar: function(jarFile, expectedHash) {
    // Compare the jar file's hash to the expected hash from the
    // index file.
    // from https://developer.mozilla.org/en/nsICryptoHash#Computing_the_Hash_of_a_File
    dump("Attempting to verify jarfile vs hash = " + expectedHash + "\n");
    let istream = Cc["@mozilla.org/network/file-input-stream;1"]
                        .createInstance(Ci.nsIFileInputStream);
    // open for reading
    istream.init(jarFile, 0x01, 0444, 0);
    let ch = Cc["@mozilla.org/security/hash;1"]
                   .createInstance(Ci.nsICryptoHash);
    // Use SHA256, it's more secure than MD5:
    ch.init(ch.SHA256);
    // this tells updateFromStream to read the entire file
    const PR_UINT32_MAX = 0xffffffff;
    ch.updateFromStream(istream, PR_UINT32_MAX);
    // pass false here to get binary data back
    let hash = ch.finish(false);

    // return the two-digit hexadecimal code for a byte
    function toHexString(charCode)
    {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    // convert the binary hash data to a hex string.
    let s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
    // s now contains your hash in hex
    dump("Hash of this jar is " + s + "\n");

    return (s == expectedHash);
  },

  saveJarFile: function( filename, rawData, expectedHash ) {
    dump("Saving a JAR file as " + filename + " hash = " + expectedHash + "\n");
    // rawData is a string of binary data representing a jar file
    try {
    let jarFile = this._baseDir.clone();
      // filename may have directories in it; use just the last part
      jarFile.append(filename.split("/").pop());

    // From https://developer.mozilla.org/en/Code_snippets/File_I%2f%2fO#Getting_special_files
    jarFile.createUnique( Ci.nsIFile.NORMAL_FILE_TYPE, 600);
    let stream = Cc["@mozilla.org/network/safe-file-output-stream;1"].
                    createInstance(Ci.nsIFileOutputStream);
    stream.init(jarFile, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate

    stream.write(rawData, rawData.length);
    if (stream instanceof Ci.nsISafeOutputStream) {
      stream.finish();
    } else {
      stream.close();
    }
      dump("Saved file, now verifying...\n");
    // Verify hash; if it's good, index and set last modified time.
    // If not good, remove it.
    if (this._verifyJar(jarFile, expectedHash)) {
      dump("Verification passed.\n");
      this._indexJar(jarFile);
      this._lastModified[jarFile.leafName] = jarFile.lastModifiedTime;
    } else {
      dump("Verification failed.\n");
      console.warn("Bad JAR file, doesn't match hash: " + expectedHash);
      jarFile.remove(false);
    }
    } catch(e) {
      dump("Error in saving jar file: " + e + "\n");
    }
  },

  resolveModule: function(root, path) {
    // Root will be null if require() was done by absolute path.
    if (root != null) {
      dump("Request to resolveModule with root... wut?\n");
      dump("Root = " + root + " , path = " + path + "\n");
    }
    dump("Jar loader is being asked to resolve module root = " +root);
    dump(", path = " + path + "\n");
    if (this._index[path]) {
      let resolvedPath = this._index[path] + "!" + path + ".js";
      dump("Resolving module as " + resolvedPath + "\n");
      return resolvedPath;
    }
    return null;
    // must return a path... which gets passed to getFile.
  },

  getFile: function(path) {
    dump("Jar loader is getting asked to getFile, with path = " + path + "\n");
    // used externally by cuddlefish; takes the path and returns
    // {contents: data}.
    let parts = path.split("!");
    let filePath = parts[0];
    let entryName = parts[1];

    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath(filePath);
    return this._readEntryFromJarFile(file, entryName);
  },

  _readEntryFromJarFile: function(jarFile, entryName) {
    // Reads out content of entry, without unzipping jar file to disk.
    // Open the jar file
    let zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
    zipReader.open(jarFile); // must already be nsIFile
    let rawStream = zipReader.getInputStream(entryName);
    let stream = Cc["@mozilla.org/scriptableinputstream;1"].
      createInstance(Ci.nsIScriptableInputStream);
    stream.init(rawStream);
    try {
      let data = new String();
      let chunk = {};
      do {
        dump("Reading chunk.\n");
        chunk = stream.read(-1);
        dump("Chunk has length " + chunk.length + "\n");
        data += chunk;
      } while (chunk.length > 0);
      dump("Finished reading the stream.\n");
      return {contents: data};
    } catch(e) {
      dump("Error reading from stream: " + e + "\n");
    }
    return null;
  },


  getFileModifiedDate: function(filename) {
    // used by remote experiment loader to know whether we have to redownload
    // a thing or not.
    filename = filename.split("/").pop();
    if (this._lastModified[filename]) {
      return (this._lastModified[filename]);
    } else {
      return 0;
    }
  },

  listAllFiles: function() {
    // used by remote experiment loader
    let x;
    let list = [x for (x in this._index)];
    dump("Listing all files from jar store: " + list + "\n");
    return list;
  }
};

exports.JarStore = JarStore;
