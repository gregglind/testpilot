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
  _extractJar: function(jarFile) {
    // Open the jar file
    let zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
    zipReader.open(jarFile); // This is failing???

    // make a directory to extract into:
    let dirName = jarFile.leafName.slice(0, jarFile.leafName.length - 4);
    let dir = this._baseDir.clone();
    dir.append(dirName);
    if (!dir.exists() || !dir.isDirectory()) {
      dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    }

    // loop through all entries, extract any that are js files
    let entries = zipReader.findEntries(null);
    while(entries.hasMore()) {
      let entry = entries.getNext();
      if (entry.indexOf(".js") == entry.length - 3) {
        // add entry to index
        let moduleName = entry.slice(0, entry.length - 3);
        dump("Storing module in index as " + moduleName + "\n");
        this._index[moduleName] = dir.path;

        // extract file
        let file = dir.clone();
        file.append(entry);
        if (!file.exists()) {
          zipReader.extract(entry, file);
        }
      }
    }
    zipReader.close();
  },

  _verifyJar: function(path) {
  // TODO

    return true;
  },

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

      // Build lookup index of module->jar file and modified dates
      let jarFiles = this._baseDir.directoryEntries;
      dump("Listing directory...\n");
      while(jarFiles.hasMoreElements()) {
        let jarFile = jarFiles.getNext().QueryInterface(Ci.nsIFile);
        // Make sure this is actually a jar file:
        if (jarFile.leafName.indexOf(".jar") != jarFile.leafName.length - 4) {
          continue;
        }
        dump("  --> " + jarFile.path + " (" + jarFile.leafName + ")\n");
        this._lastModified[jarFile.leafName] = jarFile.lastModifiedTime;
        dump("  --> Last modified at " + jarFile.lastModifiedTime + "\n");

        // TODO don't extract it if it's already been extracted!!
        // we could A. record a preference,
        // B. delete the jar file once it's extracted, or
        // C. look to see if there's already a directory (might fail if
        // there was a partially completed extraction last time)
        this._extractJar(jarFile);
      }
    }
  },

  downloadJar: function( jarUrl, filename ) {
    dump("Attempting to download jarUrl = " + jarUrl + " to file " + filename + "\n");
    // TODO only download if file has changed since we got it.
    // (OR use the logic we've already got to do the same thing.)
    // TODO set last modified date, and add each jar entry to the index.
    try {
      dump("This._baseDir = " + this._baseDir.path + "\n");
      let file = this._baseDir.clone();
      dump("File is " + file.path + "\n");
      file.append(filename);
      dump("Now file is " + file.path + "\n");
      dump("Basedir is now " + this._baseDir.path + "\n");
    let wbp = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
           .createInstance(Ci.nsIWebBrowserPersist);
    let ios = Cc['@mozilla.org/network/io-service;1']
           .getService(Ci.nsIIOService);
    let uri = ios.newURI(jarUrl, null, null);
    // TODO what flags do I actually want?
    wbp.persistFlags &= ~Ci.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION; // don't save gzipped
    wbp.saveURI(uri, null, null, null, null, file);
    //but that's synchronous?  Can I do it with a callback?
    // and how do I know if something went wrong?
      dump("Finished downloading jar!");
    } catch(e) {
      dump("Error downloading jar: " + e + "\n");
    }
  },

  resolveModule: function(root, path) {
    // TODO what's root and do we need to do anything with it?
    dump("Jar loader is being asked to resolve module root = " +root);
    dump(", path = " + path + "\n");
    if (this._index[path]) {
      let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      file.initWithPath(this._index[path]);
      file.append(path + ".js");
      dump("Resolving module as " + file.path + "\n");
      return file.path;
    }
    // used by cuddlefish.  What's root?
    return null;
    // must return a path... which gets passed to getFile.
  },

  getFile: function(path) {
    dump("Jar loader is getting asked to getFile, with path = " + path + "\n");
    // used externally by cuddlefish; takes the path and returns
    // {contents: data}.
    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath(path);
    dump("File size is " + file.fileSize + "\n");

    let fstream = Cc["@mozilla.org/network/file-input-stream;1"].
                         createInstance(Ci.nsIFileInputStream);
    let cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
                         createInstance(Ci.nsIConverterInputStream);
    fstream.init(file, -1, 0, 0);
    cstream.init(fstream, "UTF-8", 0, 0);
    let data = new String();
    let bytesRead;
    do {
      let chunk = {};
      bytesRead = cstream.readString(-1, chunk);
      data += chunk.value;
    } while (bytesRead);
    cstream.close(); // this closes fstream
    dump("Length of string is " + data.length + "\n");
    // Getting truncated at 8192, which happens to be the default buffer size
    // of the cStream.  Can't be a coincidence.
    return {contents: data};
  },

  getFileModifiedDate: function() {
    // used by remote experiment loader to know whether we have to redownload
    // a thing or not.
    return this._lastModified[jarFile.leafName];
  },

  listAllFiles: function() {
    // used by remote experiment loader
  }
};

exports.JarStore = JarStore;
