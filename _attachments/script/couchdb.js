//
// couchdb.js
// based on jquery.couch.js (v0.11.0)
// http://svn.apache.org/repos/asf/couchdb/trunk/share/www/script/jquery.couch.js
// de-jQuerying by CEL
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

if (!window.XMLHttpRequest && window.ActiveXObject) {
    XMLHttpRequest = function () {
        return new ActiveXObject("Microsoft.XMLHTTP");
    }
    XMLHttpRequest.prototype = ActiveXObject.prototype;
}

var Couch = (function() {

 function makeQuery(params) {
    var parts = [];
    for (var i in params) {
      parts[parts.length] = i + '=' + encodeURIComponent(params[i]);
    }
    return parts.join('&');
  }


  function ajax(obj, options2, errorMessage, ajaxOptions) {
    var options = {
      successStatus: 200
    };
    for (var i in options2) options[i] = options2[i];
    
    errorMessage = errorMessage || "Unknown error";

    var opt = {
      type: "GET", dataType: "json",
      async: true,
      contentType: "application/x-www-form-urlencoded",
      processData: true,
      beforeSend: function(xhr){
        if(ajaxOptions && ajaxOptions.headers){
          for (var header in ajaxOptions.headers){
            xhr.setRequestHeader(header, ajaxOptions.headers[header]);
          }
        }
      },
      complete: function(req) {
        try {
          var resp = fromJSON(req.responseText);
        } catch (e) {
          resp = {error: "JSON error", reason: e.message};
        } finally {
          if (req.status == options.successStatus) {
            if (options.beforeSuccess) options.beforeSuccess(req, resp);
            if (options.success) options.success(resp);
          } else if (options.error) {
            options.error(req.status, resp && resp.error || errorMessage, resp && resp.reason || "no response");
          } else {
            alert(errorMessage + ": " + resp.reason);
          }
        }
      }
    };
    for (var i in obj) opt[i] = obj[i];
    if (ajaxOptions) for (var i in ajaxOptions) opt[i] = ajaxOptions[i];
    /*
    url, type, data(object||string), contentType, processData(bool),
    dataType("json"), async
    
    */
    
    var xhr = new XMLHttpRequest();
    var url = opt.url;
    var type = opt.type;
    var data = opt.data || "";
    if (data && opt.processData && typeof data != "string") {
      data = makeQuery(data);
    }
    if (data && type == "GET") {
      url += "?" + data;
    }
    
    if (opt.username) {
      xhr.open(type, url, opt.async, opt.username, opt.password);
    } else {
      xhr.open(type, url, opt.async);
    }
    
    var sendingData = type in {"POST":1, "PUT":1, "DELETE":1};

    if (data && sendingData) {
      xhr.setRequestHeader("Content-type", opt.contentType);
    }
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        opt.complete(xhr);
        if (opt.async) {
         xhr = null;
        }
      }
    }
    
    xhr.send(sendingData ? data : null);
    
    // for firefox, which does not sync right
    if (!opt.async) {
      opt.complete(xhr);
    }
  }

  function fullCommit(options) {
    var options = options || {};
    if (typeof options.ensure_full_commit !== "undefined") {
      var commit = options.ensure_full_commit;
      delete options.ensure_full_commit;
      return function(xhr) {
        xhr.setRequestHeader("X-Couch-Full-Commit", commit.toString());
      };
    }
  }

  // Convert a options object to an url query string.
  // ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
  function encodeOptions(options) {
    var buf = [];
    if (typeof(options) === "object" && options !== null) {
      for (var name in options) {
        if (name in {"error":1, "success":1, "beforeSuccess":1, "ajaxStart":1})
          continue;
        var value = options[name];
        if (name in {"key":1, "startkey":1, "endkey":1}) {
          value = toJSON(value);
        }
        buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
      }
    }
    return buf.length ? "?" + buf.join("&") : "";
  }

  function toJSON(obj) {
    return obj !== null ? JSON.stringify(obj) : null;
  }

  function fromJSON(str) {
    return str ? JSON.parse(str) : null;
  }

  function encodeDocId(docID) {
    var parts = docID.split("/");
    if (parts[0] == "_design") {
      parts.shift();
      return "_design/" + encodeURIComponent(parts.join('/'));
    }
    return encodeURIComponent(docID);
  }

  function prepareUserDoc(user_doc, new_password, callback) {    
    if (typeof hex_sha1 == "undefined") {
      alert("creating a user doc requires sha1.js to be loaded in the page");
      return;
    }
    var user_prefix = "org.couchdb.user:";
    user_doc._id = user_doc._id || user_prefix + user_doc.name;
    if (new_password) {
      // handle the password crypto
      Couch.newUUID(1, function (salt) {
        user_doc.salt = salt;
        user_doc.password_sha = hex_sha1(new_password + salt);
        next();
      });
    } else {
      next();
    }
    function next() {
      user_doc.type = "user";
      if (!user_doc.roles) {
        user_doc.roles = []
      }
      callback(user_doc);
    }
  }

  var uuidCache = [];

  var Couch = {
    urlPrefix: '',
    activeTasks: function(options) {
      ajax(
        {url: this.urlPrefix + "/_active_tasks"},
        options,
        "Active task status could not be retrieved"
      );
    },

    allDbs: function(options) {
      ajax(
        {url: this.urlPrefix + "/_all_dbs"},
        options,
        "An error occurred retrieving the list of all databases"
      );
    },

    config: function(options, section, option, value) {
      var req = {url: this.urlPrefix + "/_config/"};
      if (section) {
        req.url += encodeURIComponent(section) + "/";
        if (option) {
          req.url += encodeURIComponent(option);
        }
      }
      if (value === null) {
        req.type = "DELETE";
      } else if (value !== undefined) {
        req.type = "PUT";
        req.data = toJSON(value);
        req.contentType = "application/json";
        req.processData = false
      }

      ajax(req, options,
        "An error occurred retrieving/updating the server configuration"
      );
    },
    
    session: function(options) {
      ajax({type: "GET", url: this.urlPrefix + "/_session"},
        options,
        "An error occurred getting session info: "
      );
    },

    userDb: function(callback) {
      Couch.session({
        success: function(resp) {
          var userDb = Couch.db(resp.info.authentication_db);
          callback(userDb);
        }
      });
    },

    signup: function(user_doc, password, options) {      
      options = options || {};
      // prepare user doc based on name and password
      prepareUserDoc(user_doc, password, function (user_doc) {
        Couch.userDb(function(db) {
          db.saveDoc(user_doc, options);
        })
      });
    },
    
    login: function(options) {
      ajax({
        type: "POST", url: this.urlPrefix + "/_session", dataType: "json",
        data: {name: options.name, password: options.password}},
        options,
        "An error occurred logging in: "
      );
    },
    logout: function(options) {
      ajax({
        type: "DELETE", url: this.urlPrefix + "/_session", dataType: "json",
        username: "_", password: "_"},
        options,
        "An error occurred logging out: "
      );
    },

    db: function(name, db_opts) {
      db_opts = db_opts || {};
      var rawDocs = {};
      function maybeApplyVersion(doc) {
        if (doc._id && doc._rev && rawDocs[doc._id] && rawDocs[doc._id].rev == doc._rev) {
          // todo: can we use commonjs require here?
          if (typeof Base64 == "undefined") {
            alert("please include /_utils/script/base64.js in the page for base64 support");
            return false;
          } else {
            doc._attachments = doc._attachments || {};
            doc._attachments["rev-"+doc._rev.split("-")[0]] = {
              content_type :"application/json",
              data : Base64.encode(rawDocs[doc._id].raw)
            }
            return true;
          }
        }
      };
      return {
        name: name,
        uri: this.urlPrefix + "/" + encodeURIComponent(name) + "/",

        compact: function(options) {
          options.successStatus = 202;
          ajax({
              type: "POST", url: this.uri + "_compact",
              data: "", processData: false
            },
            options,
            "The database could not be compacted"
          );
        },
        viewCleanup: function(options) {
          options.successStatus = 202;
          ajax({
              type: "POST", url: this.uri + "_view_cleanup",
              data: "", processData: false
            },
            options,
            "The views could not be cleaned up"
          );
        },
        compactView: function(groupname, options) {
          options.successStatus = 202;
          ajax({
              type: "POST", url: this.uri + "_compact/" + groupname,
              data: "", processData: false
            },
            options,
            "The view could not be compacted"
          );
        },
        create: function(options) {
          options.successStatus = 201;
          ajax({
              type: "PUT", url: this.uri, contentType: "application/json",
              data: "", processData: false
            },
            options,
            "The database could not be created"
          );
        },
        drop: function(options) {
          ajax(
            {type: "DELETE", url: this.uri},
            options,
            "The database could not be deleted"
          );
        },
        info: function(options) {
          ajax(
            {url: this.uri},
            options,
            "Database information could not be retrieved"
          );
        },
        changes: function(since, options) {
          options = options || {};
          // set up the promise object within a closure for this handler
          var timeout = 100, db = this, active = true,
            listeners = [],
            promise = {
            onChange : function(fun) {
              listeners.push(fun);
            },
            stop : function() {
              active = false;
            },
            start : function() { // added by cel
              if (!active) {
                active = true;
                if (1) {
                  getChangesSince();
                }
              }
            }
          };
          // call each listener when there is a change
          function triggerListeners(resp) {
            listeners.forEach(function(listener) {
              listener(resp);
            });
          }
          // when there is a change, call any listeners, then check for another change
          options.success = function(resp) {
            if (!resp) return options.error();
            timeout = 100;
            if (active) {
              since = resp.last_seq;
              triggerListeners(resp);
              getChangesSince();
            };
          };
          options.error = function() {
            if (active) {
              setTimeout(getChangesSince, timeout);
              timeout *= 2;
            }
          };
          // actually make the changes request
          function getChangesSince() {
            options.feed = "longpoll";
            options.since = since;
            options.heartbeat = options.heartbeat || 10 * 1000;
            ajax(
              {url: db.uri + "_changes"+encodeOptions(options)},
              options,
              "Error connecting to "+db.uri+"/_changes."
            );
          }
		  function getSince() {
            db.info({
              success: function(info) {
                since = info.update_seq;
                getChangesSince();
              },
              error: function() {
                timeout *= 2;
                setTimeout(getSince, timeout);
              }
            });
          }
          // start the first request
          if (since) {
            getChangesSince();
          } else {
			timeout = 100;
            getSince();
          }
          return promise;
        },
        allDocs: function(options) {
          ajax(
            {url: this.uri + "_all_docs" + encodeOptions(options)},
            options,
            "An error occurred retrieving a list of all documents"
          );
        },
        allDesignDocs: function(options) {
          options = options || {};
          options.startkey = "_design";
          options.endkey = "_design0";
          this.allDocs(options);
        },
        allApps: function(options) {
          options = options || {};
          var self = this;
          if (options.eachApp) {
            this.allDesignDocs({
              success: function(resp) {
                resp.rows.forEach(function(row) {
                  self.openDoc(doc.id, {
                    success: function(ddoc) {
                      var index, appPath, appName = ddoc._id.split('/');
                      appName.shift();
                      appName = appName.join('/');
                      index = ddoc.couchapp && ddoc.couchapp.index;
                      if (index) {
                        appPath = ['', name, ddoc._id, index].join('/');
                      } else if (ddoc._attachments && ddoc._attachments["index.html"]) {
                        appPath = ['', name, ddoc._id, "index.html"].join('/');
                      }
                      if (appPath) options.eachApp(appName, appPath, ddoc);
                    }
                  });
                });
              }
            });
          } else {
            alert("please provide an eachApp function for allApps()");
          }
        },
        openDoc: function(docId, options, ajaxOptions) {
          options = options || {};
          if (db_opts.attachPrevRev || options.attachPrevRev) {
            options.beforeSuccess = function(req, doc) {
              rawDocs[doc._id] = {
                rev : doc._rev,
                raw : req.responseText
              };
            };
          } else {
            options.beforeSuccess = function(req, doc) {
              if (doc["jquery.couch.attachPrevRev"]) {
                rawDocs[doc._id] = {
                  rev : doc._rev,
                  raw : req.responseText
                };
              }
            };
          }
          ajax({url: this.uri + encodeDocId(docId) + encodeOptions(options)},
            options,
            "The document could not be retrieved",
            ajaxOptions
          );
        },
        saveDoc: function(doc, options) {
          options = options || {};
          var db = this;
          var beforeSend = fullCommit(options);
          if (doc._id === undefined) {
            var method = "POST";
            var uri = this.uri;
          } else {
            var method = "PUT";
            var uri = this.uri + encodeDocId(doc._id);
          }
          
          var versioned = maybeApplyVersion(doc);
          ajax({
            type: method, url: uri + encodeOptions(options),
            contentType: "application/json",
            dataType: "json", data: toJSON(doc),
            complete: function(req) {
              try {
                var resp = fromJSON(req.responseText);
              } catch (e) {
                resp = {error: "JSON error", reason: e.message};
              } finally {
                if (req.status == 200 || req.status == 201 || req.status==202) {
                  doc._id = resp.id;
                  doc._rev = resp.rev;
                  if (versioned) {
                    db.openDoc(doc._id, {
                      attachPrevRev : true,
                      success : function(d) {
                        doc._attachments = d._attachments;
                        if (options.success) options.success(resp);
                      }
                    });
                  } else {
                    if (options.success) options.success(resp);
                  }
                } else if (options.error) {
                  options.error(req.status, resp.error, resp.reason);
                } else {
                  alert("The document could not be saved: " + resp.reason);
                }
              }
            }},
            options,
            "The document could not be saved: "
          );
        },
        bulkSave: function(docs, options) {
          options.successStatus = 201;
          options.beforeSend = fullCommit(options);
          ajax({
              type: "POST",
              url: this.uri + "_bulk_docs" + encodeOptions(options),
              contentType: "application/json", data: toJSON(docs)
            },
            options,
            "The documents could not be saved"
          );
        },
        removeDoc: function(doc, options) {
          ajax({
              type: "DELETE",
              url: this.uri +
                   encodeDocId(doc._id) +
                   encodeOptions({rev: doc._rev})
            },
            options,
            "The document could not be deleted"
          );
        },
        bulkRemove: function(docs, options){
          docs.docs.forEach(function (doc) {
            doc._deleted = true;
          });
          options.successStatus = 201;
          ajax({
              type: "POST",
              url: this.uri + "_bulk_docs" + encodeOptions(options),
              data: toJSON(docs)
            },
            options,
            "The documents could not be deleted"
          );
        },
        copyDoc: function(doc, options, ajaxOptions) {
          options.successStatus = 201,
          options.beforeSuccess = function (req, resp) {
            doc._id = resp.id;
            doc._rev = resp.rev;
          };
          ajax({
              type: "COPY",
              url: this.uri +
                   encodeDocId(doc._id) +
                   encodeOptions({rev: doc._rev})
            },
            options,
            "The document could not be copied",
            ajaxOptions
          );
        },
        query: function(mapFun, reduceFun, language, options) {
          language = language || "javascript";
          if (typeof(mapFun) !== "string") {
            mapFun = mapFun.toSource ? mapFun.toSource() : "(" + mapFun.toString() + ")";
          }
          var body = {language: language, map: mapFun};
          if (reduceFun != null) {
            if (typeof(reduceFun) !== "string")
              reduceFun = reduceFun.toSource ? reduceFun.toSource() : "(" + reduceFun.toString() + ")";
            body.reduce = reduceFun;
          }
          ajax({
              type: "POST",
              url: this.uri + "_temp_view" + encodeOptions(options),
              contentType: "application/json", data: toJSON(body)
            },
            options,
            "An error occurred querying the database"
          );
        },
        list: function(list, view, options) {
          var list = list.split('/');
          var options = options || {};
          var type = 'GET';
          var data = null;
          if (options['keys']) {
            type = 'POST';
            var keys = options['keys'];
            delete options['keys'];
            data = toJSON({'keys': keys });
          }
          ajax({
              type: type,
              data: data,
              url: this.uri + '_design/' + list[0] +
                   '/_list/' + list[1] + '/' + view + encodeOptions(options)
              },
              options, 'An error occured accessing the list'
          );
        },
        view: function(name, options) {
          var name = name.split('/');
          var options = options || {};
          var type = "GET";
          var data= null;
          if (options["keys"]) {
            type = "POST";
            var keys = options["keys"];
            delete options["keys"];
            data = toJSON({ "keys": keys });
          }
          ajax({
              type: type,
              data: data,
              url: this.uri + "_design/" + name[0] +
                   "/_view/" + name[1] + encodeOptions(options)
            },
            options, "An error occurred accessing the view"
          );
        },
        getDbProperty: function(propName, options, ajaxOptions) {
          ajax({url: this.uri + propName + encodeOptions(options)},
            options,
            "The property could not be retrieved",
            ajaxOptions
          );
        },

        setDbProperty: function(propName, propValue, options, ajaxOptions) {
          ajax({
            type: "PUT", 
            url: this.uri + propName + encodeOptions(options),
            data : JSON.stringify(propValue)
          },
            options,
            "The property could not be updated",
            ajaxOptions
          );
        }
      };
    },

    encodeDocId: encodeDocId, 

    info: function(options) {
      ajax(
        {url: this.urlPrefix + "/"},
        options,
        "Server information could not be retrieved"
      );
    },

    replicate: function(source, target, ajaxOptions, repOpts) {
      repOpts.source = source;
      repOpts.target = target;
      if (repOpts.continuous) {
        ajaxOptions.successStatus = 202;
      }
      ajax({
          type: "POST", url: this.urlPrefix + "/_replicate",
          data: JSON.stringify(repOpts),
          contentType: "application/json"
        },
        ajaxOptions,
        "Replication failed"
      );
    },

    newUUID: function(cacheNum, callback) {
      function got() {
        callback && callback(uuidCache.shift());
      }
      if (uuidCache.length) {
        got();
      } else {
        ajax({url: this.urlPrefix + "/_uuids", data: {count: cacheNum || 1}}, {
            success: function(resp) {
              uuidCache = resp.uuids;
              got();
            }
          },
          "Failed to retrieve UUID batch."
        );
      }
    }

  };
  return Couch;
})();
