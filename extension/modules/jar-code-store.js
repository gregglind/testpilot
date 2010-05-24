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
  dump("instantiating jar store.\n");
  let baseDirName = "TestPilotExperimentFiles"; // this should go in pref?
  this._init( baseDirectory );
  this._baseDir = null;
  this._zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
  dump("done instantiating jar store.\n");
}
JarStore.prototype = {
  _init: function( baseDirectory ) {
    let dir = Cc["@mozilla.org/file/directory_service;1"].
      getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    dir.append(baseDirectory);
    this._baseDir = dir;
    if( !this._baseDir.exists() || !this._baseDir.isDirectory() ) {
      // if it doesn't exist, create
      this._baseDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
    }
  },

  downloadJar: function( jarUrl, filename ) {
    dump("Attempting to download a JAR!\n");
    let file = this._baseDir;
    file.append(filename); // todo does this modify basedir?
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
  },

  // 1st question: Where do we put the jar files so they'll be accessible?
  //jar:http://www.mozilla.org/projects/security/components/capsapp.jar!/getprefs.html

  // Question 2:Can we use that jar url scheme to access files inside the jar without
  // unzipping it?
  // (Apparently using channel or local XHR to that url to read it maybe?)

  // Question 3: But do we need to register jars with chrome manifest to be
  // able to refer to them by url?


  // nsIZipReader and nsIZipEntry are what I want.

  // nsiZipReader.getEntry() and pass it to nsiZipReader.getInputStream(),
  // then read out of the input stream.

  // It's also got a getCertificatePrincipal(), though that requires
  // Firefox 3.7?

  // Question 4:  I do an XHR to get the JAR file, then I have to write it
  // to disk -- how do I do that?
  // (with a nsIFileOutputStream?

  /*
   * # var file = Components.classes["@mozilla.org/file/local;1"]
#             .createInstance(Components.interfaces.nsILocalFile);
# file.initWithPath("C:\\filename.html");
   */

  resolveModule: function(root, path) {
    // used by cuddlefish.  What's root?

    // must return a path... which gets passed to getFile.
    // todo what do we return if we can't find a match?
  },

  getFile: function(path) {
    // used externally by cuddlefish; takes the path and returns
    // {contents: data}.
    let zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                .createInstance(Ci.nsIZipReader);
    // todo get nsIFile for that zip file based on path.
    zipReader.open(theZipFile);
    // todo get entry name from path...

    if (!zipReader.hasEntry(zipEntryName)) {
      // handle error
    }
    let iStream = zipReader.getInputStream(zipEntryName);
    // duhh how do we read an input stream now?
    let str = {};
    iStream.readString(-1, str);
    iStream.close();
    zipReader.close();
    return {contents: str.value};
  },

  getFileModifiedDate: function() {
    // used by remote experiment loader
  },

  listAllFiles: function() {
    // used by remote experiment loader
  }
};

exports.JarStore = JarStore;
