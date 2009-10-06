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
 *   Dan Mills <thunder@mozilla.com>
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

EXPORTED_SYMBOLS = ["MetadataCollector"];

const Cc = Components.classes;
const Ci = Components.interfaces;

const LOCALE_PREF = "general.useragent.locale";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

// This function copied over from Weave:
function Weave_sha1(string) {
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                  createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";

  let hasher = Cc["@mozilla.org/security/hash;1"]
               .createInstance(Ci.nsICryptoHash);
  hasher.init(hasher.SHA1);

  let data = converter.convertToByteArray(string, {});
  hasher.update(data, data.length);
  let rawHash = hasher.finish(false);

  // return the two-digit hexadecimal code for a byte
  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }
  let hash = [toHexString(rawHash.charCodeAt(i)) for (i in rawHash)].join("");
  return hash;
}

let MetadataCollector = {
  // Collects metadata such as what country you're in, what extensions you have installed, etc.
  getExtensions: function MetadataCollector_getExtensions() {
    //http://lxr.mozilla.org/aviarybranch/source/toolkit/mozapps/extensions/public/nsIExtensionManager.idl
    //http://lxr.mozilla.org/aviarybranch/source/toolkit/mozapps/update/public/nsIUpdateService.idl#45
    var ExtManager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
    var nsIUpdateItem = Ci.nsIUpdateItem;
    var items = [];
    var names = [];
    items = ExtManager.getItemList(nsIUpdateItem.TYPE_EXTENSION,{});
    for (var i = 0; i < items.length; ++i) {
      names.push(Weave_sha1( items[i].id ));
    }
    return names;
  },

  getLocation: function MetadataCollector_getLocation() {
    //navitagor.geolocation; // or nsIDOMGeoGeolocation
    // we don't want the lat/long, we just want the country

    return Application.prefs.getValue(LOCALE_PREF, "");
  },

  getVersion: function MetadataCollector_getVersion() {
    return Application.version;
  },

  getOperatingSystem: function MetadataCollector_getOSVersion() {
    let oscpu = Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).oscpu;
    let os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
    return os + " " + oscpu;
  },

  // Number of bookmarks?
  // TODO if we make a GUID for the user, we keep it here.

  getMetadata: function MetadataCollector_getMetadata() {
    return { extensions: MetadataCollector.getExtensions(),
	     location: MetadataCollector.getLocation(),
	     version: MetadataCollector.getVersion(),
             operatingSystem: MetadataCollector.getOperatingSystem() };
  }

};
