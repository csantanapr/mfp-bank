(function(g, define) {
    // Check for AMD loader on global namespace.
    var _def = g.define;
/* jslint strict: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name) && !defining.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (defined.hasOwnProperty(depName) ||
                           waiting.hasOwnProperty(depName) ||
                           defining.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());

define("../vendor/almond", function(){});

// Safe console implementation.
define('aph/console',[],function() {
    

    // Shorter variables for common objects.
    var win = window;


    // Cache original console functions. This way we can call them for our use
    // and roll back any changes to the `console` object when the session stops.
    var backupConsole = {};
    var _cacheConsole = function() {
        try {  // Avoid undefined members access errors.
            for(var key in win.console) {
                backupConsole[key] = win.console[key];
            }
        } catch(e) {}
    };
    // On Phonegap "console" is only fulfilled when all preparations are done.
    // Bind to "deviceready" the old way to avoid loading dependencies.
    document.addEventListener("deviceready", _cacheConsole, false);


    // Helper for calling any original console functions.
    var callConsole = function(method, args) {
        try {
            // This method *works* everywhere.
            // Note: console methods have to be called with this == original console object.
            // Otherwise they will be silent or throw `TypeError`.
            Function.prototype.apply.apply(backupConsole[method], [win.console, args]);
        } catch(e) {
            // Fall back to usual console call. This may be needed with Weinre.
            try {
                win.console[method].apply(win.console, args);
            } catch(e) {}
        }
    };


    /* Provide equivalents of all common console functions.
     * These are for internal use to prevent crashing client app.
     * safeConsole is not meant to replace window.console as it
     * doesn't implement all console features.
     */
    var safeConsole = {
        _o: backupConsole  // Original console object.
    };

    // Use factory function + function names list for better minification.
    var _loggerFactory = function(level) {
        return function() {
            callConsole(level, arguments);
        };
    };
    var funNames = ["log", "info", "warn", "error"];
    for(var i=0; i<funNames.length; i++) {
        var name = funNames[i];
        safeConsole[name] = _loggerFactory(name);
    }

    return safeConsole;
});

/* This module defines Apphance namespace.
 * All exports are attached to the "lib" object below.
 * It's the only way to expose any features to the client application.
 */
define('aph/pub',["aph/console"], function(Console) {
    

    // This is a publicly accessible library object.
    var lib = {};

    // Stub all API functions to avoid crashing client application.
    // This pre-populated stub library is used when dependencies fail
    // or some browser features are misssing.
    lib.startSession = function(config, callback) {
        if(typeof callback === "function") {
            callback();
        }
    };
    lib.stopSession = lib.isReady = lib.isSetUp = lib.feedback = lib.guard = lib.bug = function() {};

    // Instead of empty functions stub with safe-console loggers.
    lib.log = Console.log;
    lib.info = Console.info;
    lib.warn = Console.warn;
    lib.error = Console.error;

    return lib;
});

/* Zepto v1.0-3-g342d490 - zepto event ajax - zeptojs.com/license */


var Zepto = (function() {
  var undefined, key, $, classList, emptyArray = [], slice = emptyArray.slice, filter = emptyArray.filter,
    document = window.document,
    elementDisplay = {}, classCache = {},
    getComputedStyle = document.defaultView.getComputedStyle,
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,

    // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    classSelectorRE = /^\.([\w-]+)$/,
    idSelectorRE = /^#([\w-]*)$/,
    tagSelectorRE = /^[\w-]+$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div')

  zepto.matches = function(element, selector) {
    if (!element || element.nodeType !== 1) return false
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                          element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    var match, parent = element.parentNode, temp = !parent
    if (temp) (parent = tempParent).appendChild(element)
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  function type(obj) {
    return obj == null ? String(obj) :
      class2type[toString.call(obj)] || "object"
  }

  function isFunction(value) { return type(value) == "function" }
  function isWindow(obj)     { return obj != null && obj == obj.window }
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && obj.__proto__ == Object.prototype
  }
  function isArray(value) { return value instanceof Array }
  function likeArray(obj) { return typeof obj.length == 'number' }

  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
  function dasherize(str) {
    return str.replace(/::/g, '/')
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  function children(element) {
    return 'children' in element ?
      slice.call(element.children) :
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overriden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  zepto.fragment = function(html, name, properties) {
    if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
    if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
    if (!(name in containers)) name = '*'

    var nodes, dom, container = containers[name]
    container.innerHTML = '' + html
    dom = $.each(slice.call(container.childNodes), function(){
      container.removeChild(this)
    })
    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function(key, value) {
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        else nodes.attr(key, value)
      })
    }
    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. Note that `__proto__` is not supported on Internet
  // Explorer. This method can be overriden in plugins.
  zepto.Z = function(dom, selector) {
    dom = dom || []
    dom.__proto__ = $.fn
    dom.selector = selector || ''
    return dom
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overriden in plugins.
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overriden in plugins.
  zepto.init = function(selector, context) {
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, juts return it
    else if (zepto.isZ(selector)) return selector
    else {
      var dom
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes. If a plain object is given, duplicate it.
      else if (isObject(selector))
        dom = [isPlainObject(selector) ? $.extend({}, selector) : selector], selector = null
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
      // create a new Zepto collection from the nodes found
      return zepto.Z(dom, selector)
    }
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        extend(target[key], source[key], deep)
      }
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    var deep, args = slice.call(arguments, 1)
    if (typeof target == 'boolean') {
      deep = target
      target = args.shift()
    }
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overriden in plugins.
  zepto.qsa = function(element, selector){
    var found
    return (isDocument(element) && idSelectorRE.test(selector)) ?
      ( (found = element.getElementById(RegExp.$1)) ? [found] : [] ) :
      (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
      slice.call(
        classSelectorRE.test(selector) ? element.getElementsByClassName(RegExp.$1) :
        tagSelectorRE.test(selector) ? element.getElementsByTagName(selector) :
        element.querySelectorAll(selector)
      )
  }

  function filtered(nodes, selector) {
    return selector === undefined ? $(nodes) : $(nodes).filter(selector)
  }

  $.contains = function(parent, node) {
    return parent !== node && parent.contains(node)
  }

  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  function setAttribute(node, name, value) {
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  // access className property while respecting SVGAnimatedString
  function className(node, value){
    var klass = node.className,
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // JSON    => parse if valid
  // String  => self
  function deserializeValue(value) {
    var num
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          !isNaN(num = Number(value)) ? num :
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
  $.trim = function(str) { return str.trim() }

  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }

  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    indexOf: emptyArray.indexOf,
    concat: emptyArray.concat,

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      if (readyRE.test(document.readyState)) callback($)
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    filter: function(selector){
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    not: function(selector){
      var nodes=[]
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    find: function(selector){
      var result, $this = this
      if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    closest: function(selector, context){
      var node = this[0], collection = false
      if (typeof selector == 'object') collection = $(selector)
      while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
        node = node !== context && !isDocument(node) && node.parentNode
      return $(node)
    },
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    contents: function() {
      return this.map(function() { return slice.call(this.childNodes) })
    },
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = null)
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    html: function(html){
      return html === undefined ?
        (this.length > 0 ? this[0].innerHTML : null) :
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        })
    },
    text: function(text){
      return text === undefined ?
        (this.length > 0 ? this[0].textContent : null) :
        this.each(function(){ this.textContent = text })
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && value === undefined) ?
        (this.length == 0 || this[0].nodeType !== 1 ? undefined :
          (name == 'value' && this[0].nodeName == 'INPUT') ? this.val() :
          (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && setAttribute(this, name) })
    },
    prop: function(name, value){
      return (value === undefined) ?
        (this[0] && this[0][name]) :
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        })
    },
    data: function(name, value){
      var data = this.attr('data-' + dasherize(name), value)
      return data !== null ? deserializeValue(data) : undefined
    },
    val: function(value){
      return (value === undefined) ?
        (this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(o){ return this.selected }).pluck('value') :
           this[0].value)
        ) :
        this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        })
    },
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (this.length==0) return null
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    css: function(property, value){
      if (arguments.length < 2 && typeof property == 'string')
        return this[0] && (this[0].style[camelize(property)] || getComputedStyle(this[0], '').getPropertyValue(property))

      var css = ''
      if (type(property) == 'string') {
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    addClass: function(name){
      return this.each(function(idx){
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function(name){
      return this.each(function(idx){
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    toggleClass: function(name, when){
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    scrollTop: function(){
      if (!this.length) return
      return ('scrollTop' in this[0]) ? this[0].scrollTop : this[0].scrollY
    },
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    $.fn[dimension] = function(value){
      var offset, el = this[0],
        Dimension = dimension.replace(/./, function(m){ return m[0].toUpperCase() })
      if (value === undefined) return isWindow(el) ? el['inner' + Dimension] :
        isDocument(el) ? el.documentElement['offset' + Dimension] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var key in node.childNodes) traverseNode(node.childNodes[key], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            argType = type(arg)
            return argType == "object" || argType == "array" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
                 operatorIndex == 1 ? target.firstChild :
                 operatorIndex == 2 ? target :
                 null

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          traverseNode(parent.insertBefore(node, target), function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src)
              window['eval'].call(window, el.innerHTML)
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

window.Zepto = Zepto
'$' in window || (window.$ = Zepto)

;(function($){
  var $$ = $.zepto.qsa, handlers = {}, _zid = 1, specialEvents={},
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
  }
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  function eachEvent(events, fn, iterator){
    if ($.type(events) != "string") $.each(events, iterator)
    else events.split(/\s/).forEach(function(type){ iterator(type, fn) })
  }

  function eventCapture(handler, captureSetting) {
    return handler.del &&
      (handler.e == 'focus' || handler.e == 'blur') ||
      !!captureSetting
  }

  function realEvent(type) {
    return hover[type] || type
  }

  function add(element, events, fn, selector, getDelegate, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
    eachEvent(events, fn, function(event, fn){
      var handler   = parse(event)
      handler.fn    = fn
      handler.sel   = selector
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function(e){
        var related = e.relatedTarget
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del   = getDelegate && getDelegate(fn, event)
      var callback  = handler.del || fn
      handler.proxy = function (e) {
        var result = callback.apply(element, [e].concat(e.data))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      handler.i = set.length
      set.push(handler)
      element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  }
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    eachEvent(events || '', fn, function(event, fn){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }

  $.proxy = function(fn, context) {
    if ($.isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (typeof context == 'string') {
      return $.proxy(fn[context], fn)
    } else {
      throw new TypeError("expected function")
    }
  }

  $.fn.bind = function(event, callback){
    return this.each(function(){
      add(this, event, callback)
    })
  }
  $.fn.unbind = function(event, callback){
    return this.each(function(){
      remove(this, event, callback)
    })
  }
  $.fn.one = function(event, callback){
    return this.each(function(i, element){
      add(this, event, callback, null, function(fn, type){
        return function(){
          var result = fn.apply(element, arguments)
          remove(element, type, fn)
          return result
        }
      })
    })
  }

  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      ignoreProperties = /^([A-Z]|layer[XY]$)/,
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }
  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    $.each(eventMethods, function(name, predicate) {
      proxy[name] = function(){
        this[predicate] = returnTrue
        return event[name].apply(event, arguments)
      }
      proxy[predicate] = returnFalse
    })
    return proxy
  }

  // emulates the 'defaultPrevented' property for browsers that have none
  function fix(event) {
    if (!('defaultPrevented' in event)) {
      event.defaultPrevented = false
      var prevent = event.preventDefault
      event.preventDefault = function() {
        this.defaultPrevented = true
        prevent.call(this)
      }
    }
  }

  $.fn.delegate = function(selector, event, callback){
    return this.each(function(i, element){
      add(element, event, callback, selector, function(fn){
        return function(e){
          var evt, match = $(e.target).closest(selector, element).get(0)
          if (match) {
            evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
            return fn.apply(match, [evt].concat([].slice.call(arguments, 1)))
          }
        }
      })
    })
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.each(function(){
      remove(this, event, callback, selector)
    })
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  $.fn.on = function(event, selector, callback){
    return !selector || $.isFunction(selector) ?
      this.bind(event, selector || callback) : this.delegate(selector, event, callback)
  }
  $.fn.off = function(event, selector, callback){
    return !selector || $.isFunction(selector) ?
      this.unbind(event, selector || callback) : this.undelegate(selector, event, callback)
  }

  $.fn.trigger = function(event, data){
    if (typeof event == 'string' || $.isPlainObject(event)) event = $.Event(event)
    fix(event)
    event.data = data
    return this.each(function(){
      // items in the collection might not be DOM elements
      // (todo: possibly support events on plain old objects)
      if('dispatchEvent' in this) this.dispatchEvent(event)
    })
  }

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, data){
    var e, result
    this.each(function(i, element){
      e = createProxy(typeof event == 'string' ? $.Event(event) : event)
      e.data = data
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback) {
      return callback ?
        this.bind(event, callback) :
        this.trigger(event)
    }
  })

  ;['focus', 'blur'].forEach(function(name) {
    $.fn[name] = function(callback) {
      if (callback) this.bind(name, callback)
      else this.each(function(){
        try { this[name]() }
        catch(e) {}
      })
      return this
    }
  })

  $.Event = function(type, props) {
    if (typeof type != 'string') props = type, type = props.type
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    event.initEvent(type, bubbles, true, null, null, null, null, null, null, null, null, null, null, null, null)
    event.isDefaultPrevented = function(){ return this.defaultPrevented }
    return event
  }

})(Zepto)

;(function($){
  var jsonpID = 0,
      document = window.document,
      key,
      name,
      rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      scriptTypeRE = /^(?:text|application)\/javascript/i,
      xmlTypeRE = /^(?:text|application)\/xml/i,
      jsonType = 'application/json',
      htmlType = 'text/html',
      blankRE = /^\s*$/

  // trigger a custom event and return false if it was cancelled
  function triggerAndReturn(context, eventName, data) {
    var event = $.Event(eventName)
    $(context).trigger(event, data)
    return !event.defaultPrevented
  }

  // trigger an Ajax "global" event
  function triggerGlobal(settings, context, eventName, data) {
    if (settings.global) return triggerAndReturn(context || document, eventName, data)
  }

  // Number of active Ajax requests
  $.active = 0

  function ajaxStart(settings) {
    if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
  }
  function ajaxStop(settings) {
    if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
  }

  // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
  function ajaxBeforeSend(xhr, settings) {
    var context = settings.context
    if (settings.beforeSend.call(context, xhr, settings) === false ||
        triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
      return false

    triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
  }
  function ajaxSuccess(data, xhr, settings) {
    var context = settings.context, status = 'success'
    settings.success.call(context, data, status, xhr)
    triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
    ajaxComplete(status, xhr, settings)
  }
  // type: "timeout", "error", "abort", "parsererror"
  function ajaxError(error, type, xhr, settings) {
    var context = settings.context
    settings.error.call(context, xhr, type, error)
    triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error])
    ajaxComplete(type, xhr, settings)
  }
  // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
  function ajaxComplete(status, xhr, settings) {
    var context = settings.context
    settings.complete.call(context, xhr, status)
    triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
    ajaxStop(settings)
  }

  // Empty function, used as default callback
  function empty() {}

  $.ajaxJSONP = function(options){
    if (!('type' in options)) return $.ajax(options)

    var callbackName = 'jsonp' + (++jsonpID),
      script = document.createElement('script'),
      cleanup = function() {
        clearTimeout(abortTimeout)
        $(script).remove()
        delete window[callbackName]
      },
      abort = function(type){
        cleanup()
        // In case of manual abort or timeout, keep an empty function as callback
        // so that the SCRIPT tag that eventually loads won't result in an error.
        if (!type || type == 'timeout') window[callbackName] = empty
        ajaxError(null, type || 'abort', xhr, options)
      },
      xhr = { abort: abort }, abortTimeout

    if (ajaxBeforeSend(xhr, options) === false) {
      abort('abort')
      return false
    }

    window[callbackName] = function(data){
      cleanup()
      ajaxSuccess(data, xhr, options)
    }

    script.onerror = function() { abort('error') }

    script.src = options.url.replace(/=\?/, '=' + callbackName)
    $('head').append(script)

    if (options.timeout > 0) abortTimeout = setTimeout(function(){
      abort('timeout')
    }, options.timeout)

    return xhr
  }

  $.ajaxSettings = {
    // Default type of request
    type: 'GET',
    // Callback that is executed before request
    beforeSend: empty,
    // Callback that is executed if the request succeeds
    success: empty,
    // Callback that is executed the the server drops error
    error: empty,
    // Callback that is executed on request complete (both: error and success)
    complete: empty,
    // The context for the callbacks
    context: null,
    // Whether to trigger "global" Ajax events
    global: true,
    // Transport
    xhr: function () {
      return new window.XMLHttpRequest()
    },
    // MIME types mapping
    accepts: {
      script: 'text/javascript, application/javascript',
      json:   jsonType,
      xml:    'application/xml, text/xml',
      html:   htmlType,
      text:   'text/plain'
    },
    // Whether the request is to another domain
    crossDomain: false,
    // Default timeout
    timeout: 0,
    // Whether data should be serialized to string
    processData: true,
    // Whether the browser should be allowed to cache GET responses
    cache: true
  }

  function mimeToDataType(mime) {
    if (mime) mime = mime.split(';', 2)[0]
    return mime && ( mime == htmlType ? 'html' :
      mime == jsonType ? 'json' :
      scriptTypeRE.test(mime) ? 'script' :
      xmlTypeRE.test(mime) && 'xml' ) || 'text'
  }

  function appendQuery(url, query) {
    return (url + '&' + query).replace(/[&?]{1,2}/, '?')
  }

  // serialize payload and append it to the URL for GET requests
  function serializeData(options) {
    if (options.processData && options.data && $.type(options.data) != "string")
      options.data = $.param(options.data, options.traditional)
    if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
      options.url = appendQuery(options.url, options.data)
  }

  $.ajax = function(options){
    var settings = $.extend({}, options || {})
    for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

    ajaxStart(settings)

    if (!settings.crossDomain) settings.crossDomain = /^([\w-]+:)?\/\/([^\/]+)/.test(settings.url) &&
      RegExp.$2 != window.location.host

    if (!settings.url) settings.url = window.location.toString()
    serializeData(settings)
    if (settings.cache === false) settings.url = appendQuery(settings.url, '_=' + Date.now())

    var dataType = settings.dataType, hasPlaceholder = /=\?/.test(settings.url)
    if (dataType == 'jsonp' || hasPlaceholder) {
      if (!hasPlaceholder) settings.url = appendQuery(settings.url, 'callback=?')
      return $.ajaxJSONP(settings)
    }

    var mime = settings.accepts[dataType],
        baseHeaders = { },
        protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
        xhr = settings.xhr(), abortTimeout

    if (!settings.crossDomain) baseHeaders['X-Requested-With'] = 'XMLHttpRequest'
    if (mime) {
      baseHeaders['Accept'] = mime
      if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
      xhr.overrideMimeType && xhr.overrideMimeType(mime)
    }
    if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
      baseHeaders['Content-Type'] = (settings.contentType || 'application/x-www-form-urlencoded')
    settings.headers = $.extend(baseHeaders, settings.headers || {})

    xhr.onreadystatechange = function(){
      if (xhr.readyState == 4) {
        xhr.onreadystatechange = empty;
        clearTimeout(abortTimeout)
        var result, error = false
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
          dataType = dataType || mimeToDataType(xhr.getResponseHeader('content-type'))
          result = xhr.responseText

          try {
            // http://perfectionkills.com/global-eval-what-are-the-options/
            if (dataType == 'script')    (1,eval)(result)
            else if (dataType == 'xml')  result = xhr.responseXML
            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
          } catch (e) { error = e }

          if (error) ajaxError(error, 'parsererror', xhr, settings)
          else ajaxSuccess(result, xhr, settings)
        } else {
          ajaxError(null, xhr.status ? 'error' : 'abort', xhr, settings)
        }
      }
    }

    var async = 'async' in settings ? settings.async : true
    xhr.open(settings.type, settings.url, async)

    for (name in settings.headers) xhr.setRequestHeader(name, settings.headers[name])

    if (ajaxBeforeSend(xhr, settings) === false) {
      xhr.abort()
      return false
    }

    if (settings.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.onreadystatechange = empty
        xhr.abort()
        ajaxError(null, 'timeout', xhr, settings)
      }, settings.timeout)

    // avoid sending empty string (#319)
    xhr.send(settings.data ? settings.data : null)
    return xhr
  }

  // handle optional data/success arguments
  function parseArguments(url, data, success, dataType) {
    var hasData = !$.isFunction(data)
    return {
      url:      url,
      data:     hasData  ? data : undefined,
      success:  !hasData ? data : $.isFunction(success) ? success : undefined,
      dataType: hasData  ? dataType || success : success
    }
  }

  $.get = function(url, data, success, dataType){
    return $.ajax(parseArguments.apply(null, arguments))
  }

  $.post = function(url, data, success, dataType){
    var options = parseArguments.apply(null, arguments)
    options.type = 'POST'
    return $.ajax(options)
  }

  $.getJSON = function(url, data, success){
    var options = parseArguments.apply(null, arguments)
    options.dataType = 'json'
    return $.ajax(options)
  }

  $.fn.load = function(url, data, success){
    if (!this.length) return this
    var self = this, parts = url.split(/\s/), selector,
        options = parseArguments(url, data, success),
        callback = options.success
    if (parts.length > 1) options.url = parts[0], selector = parts[1]
    options.success = function(response){
      self.html(selector ?
        $('<div>').html(response.replace(rscript, "")).find(selector)
        : response)
      callback && callback.apply(self, arguments)
    }
    $.ajax(options)
    return this
  }

  var escape = encodeURIComponent

  function serialize(params, obj, traditional, scope){
    var type, array = $.isArray(obj)
    $.each(obj, function(key, value) {
      type = $.type(value)
      if (scope) key = traditional ? scope : scope + '[' + (array ? '' : key) + ']'
      // handle data in serializeArray() format
      if (!scope && array) params.add(value.name, value.value)
      // recurse into nested objects
      else if (type == "array" || (!traditional && type == "object"))
        serialize(params, value, traditional, key)
      else params.add(key, value)
    })
  }

  $.param = function(obj, traditional){
    var params = []
    params.add = function(k, v){ this.push(escape(k) + '=' + escape(v)) }
    serialize(params, obj, traditional)
    return params.join('&').replace(/%20/g, '+')
  }
})(Zepto)
;
define("v/zepto", function(){});

/*
    This is a loader for jQuery to enable its AMD use.
    Actually uses custom build of Zepto.js -- a lighter jQuery alternative.
*/
/* global Zepto */
define('jq',["v/zepto"], function() {
    
    try {  // Don't crash on Zepto missing.
        return Zepto;
    } catch(e) {
        return null;
    }
});

/* This module checks for dependencies needed to run Apphance SDK.
 * It is directly ported from HTML5 SDK. Missing dependencies may
 * actually never happen on Phonegap.
 */
define('aph/deps',[
    "jq",
    "aph/console"
], function($, Console) {
    
    // Verify all necessary dependencies are present.
    return function() {
        try {
            return (
                ($ !== null) && // Sanity check for bundled jQuery.
                !!window.JSON && // Check for native JSON implementation.
                "sessionStorage" in window &&  // Check for WebStorage.
                window.sessionStorage !== null
            );
        } catch(e) {
            Console.warn("Aph: Error during dependency check");
        }
    };
});

/* This module is used as a configuration object for the whole Phonegap SDK.
 * The values below are initial defaults. They're changed during the session
 * starting process and throught the whole session as well.
 * Still, this object is module is considered only the current session's
 * configuration.
 */
define('aph/core',[],function() {
    

    // This is a private, internal scope of the library.
    var scope = {
        vnum: "1919",  // SDK version for ordering.
        vname: "1.9.19",  // Version name - keep in sync with package.json.
        _s: false,  // Is the session started?
        ts: null,  // Timestamp of the session start.
        _li: false,  // Successful login / bootstrapping complete.

        // Fallback values for session configuration.
        mode: "MARKET_MODE", // SDK mode, by default report as anonymous
        perms: "FULL",  // Apphance SDK running permissions.
        level: "INFO",  // Minimal logging level to notice.
        condFilter: {},  // Condition logging filters.
        auth: null,  // User auth info.,
        shake: true, // Reporting with device shake.
        shakeSensitivity: 20, // Change in acceleration that will trigger shake callback
        host: "devops.quality4mobile.com", // Applause SDK Server
        protocol: "https" // Server communication protocol
    };

    return scope;
});

/* Functions ported from original Underscore.js code. */
define('v/us',[],function() {
    

    var objProto = Object.prototype;
    var arrayProto = Array.prototype;
    var funcProto = Function.prototype;
    var toString = objProto.toString;
    var slice = arrayProto.slice;
    var nativeIndexOf = arrayProto.indexOf;
    var nativeMap = arrayProto.map;
    var nativeForEach = arrayProto.forEach;
    var nativeBind = funcProto.bind;
    var nativeSome = arrayProto.some;
    var breaker = {};

    var identity = function(value) {
        return value;
    };

    // Check wether object is a JS array.
    var isArray = function(obj) {
        return toString.call(obj) === '[object Array]';
    };


    // Get globally unique ID, optionally prefixed.
    var _idCounter = 0;
    var uniqueId = function(prefix) {
        var id = ++_idCounter + "";
        return prefix ? prefix + id : id;
    };


    // indexOf implementation for array.
    var indexOf = function(array, item) {
        if(array === null) {
            return -1;
        }

        var i = 0, l = array.length;

        if(nativeIndexOf && array.indexOf === nativeIndexOf) {
            return array.indexOf(item);
        }

        for(; i < l; i++) {
            if (array[i] === item) {
                return i;
            }
        }

        return -1;
    };


    var isUndefined = function(obj) {
        return obj === void 0;
    };


    // A better form of hasOwnProperty.
    var has = function(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    };


    var delay = function(func, wait) {
        var args = slice.call(arguments, 2);
        return setTimeout(function(){
            return func.apply(null, args);
        }, wait);
    };


    var each = function(obj, iterator, context) {
        if (obj === null) {
            return;
        }

        if(nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if(obj.length === +obj.length) {
            for (var i = 0, l = obj.length; i < l; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) {
                    return;
                }
            }
        } else {
            for(var key in obj) {
                if (has(obj, key)) {
                    if(iterator.call(context, obj[key], key, obj) === breaker) {
                        return;
                    }
                }
            }
        }
    };

    var map = function(obj, iterator, context) {
        var results = [];
        if(obj === null) {
            return results;
        }

        if(nativeMap && obj.map === nativeMap) {
            return obj.map(iterator, context);
        }

        each(obj, function(value, index, list) {
            results[results.length] = iterator.call(context, value, index, list);
        });
        return results;
    };

    var bind = function(func, context) {
        if(func.bind === nativeBind && nativeBind) {
            return nativeBind.apply(func, slice.call(arguments, 1));
        }
        var args = slice.call(arguments, 2);
        return function() {
            return func.apply(context, args.concat(slice.call(arguments)));
        };
    };

    var extend = function(obj) {
        each(slice.call(arguments, 1), function(source) {
            if(source) {
                for(var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    var isFunction = function(obj) {
        return typeof obj === 'function';
    };


    var partial = function(func) {
        var boundArgs = slice.call(arguments, 1);
        return function() {
            var args = boundArgs.slice().concat(Array.prototype.slice.call(arguments, 0));
            return func.apply(this, args);
        };
    };

    var any = function(obj, predicate, context) {
        predicate = predicate || identity;
        var result = false;
        if (obj === null) {
            return result;
        }
        if (nativeSome && obj.some === nativeSome) {
            return obj.some(predicate, context);
        }
        each(obj, function(value, index, list) {
            if (result || (result = predicate.call(context, value, index, list))) {
                return breaker;
            }
        });
        return !!result;
      };

    var find = function(obj, predicate, context) {
        var result;
        any(obj, function(value, index, list) {
          if (predicate.call(context, value, index, list)) {
            result = value;
            return true;
          }
        });
        return result;
      };

    return {
        delay: delay,
        find: find,
        any: any,
        map: map,
        bind: bind,
        partial: partial,
        isArray: Array.isArray || isArray,
        indexOf: indexOf,
        isUndef: isUndefined,
        has: has,
        uniqueId: uniqueId,
        each: each,
        extend: extend,
        isFunction: isFunction
    };
});

/*
    This is a loader for base64 to enable its AMD use.
*/
/* jshint bitwise: false */
/* global btoa */
define('b64',[],function() {
    

    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var INVALID_CHARACTER_ERR = (function() {
        // Fabricate a suitable error object.
        try {
            document.createElement('$');
        } catch (error) {
            return error;
        }
    }());

    // Encoder.
    // [https://gist.github.com/999166] by [https://github.com/nignag]
    if(typeof btoa !== "undefined") {  // Try using global btoa first.
        return btoa;
    }

    // Provide fallback implementation.
    return function(input) {
        for (
            // initialize result and counter
            var block, charCode, idx = 0, map = chars, output = '';
            // if the next input index does not exist:
            //   change the mapping table to "="
            //   check if d has no fractional digits
            input.charAt(idx | 0) || (map = '=', idx % 1);
            // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
            output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
            charCode = input.charCodeAt(idx += 3 / 4);
            if (charCode > 0xFF) { throw INVALID_CHARACTER_ERR; }
            block = block << 8 | charCode;
        }
        return output;
    };
});

/* Various utility functions used throughout the whole SDK. */
define('aph/util',["v/us"], function(_) {
    


    /* Get proper timestamp for API interaction.
     * `precise` means don't round up the float value.
     */
    var getTimestamp = function(precise) {
        var ts = ((new Date()).getTime() / 1000);
        if(precise === true) {
            return ts;
        } else {
            return Math.round(ts);
        }
    };


    // Generate random 4-byte string.
    var randomS4 = function() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    };


    /* Extracts "bootstrap" configuration from API response.
     * This configuration is applied onto given parameters object.
     * `data` -- response received from API call.
     * `paramObj` -- object to apply the configuration onto.
     */
    var extractBootstrapInfo = function(paramObj, data) {
        // Shortcuts for minification.
        var bootstrap = "bootstrap";
        var configuration = "configuration";

        if(!!data[bootstrap]) {
            // Whether to run/log or not.
            if(!!data[bootstrap].permissions) {
                paramObj.perms = data[bootstrap].permissions;
            }
            if(!!data[bootstrap][configuration]) {
                // Logging level.
                if(!!data[bootstrap][configuration].logging_level) {
                    paramObj.level = data[bootstrap][configuration].logging_level;
                }
                // Condition filtering.
                if(!!data[bootstrap][configuration].condition_filter) {
                    paramObj.condFilter = data[bootstrap][configuration].condition_filter;
                }
            }
        }
        return paramObj;
    };


    // Safe JSON dump function.
    var dumpJSON = function(obj) {
        try {
            return JSON.stringify(obj);
        } catch(e) {
            return null;
        }
    };

    // Safe JSON load function.
    var loadJSON = function(text) {
        try {
            return JSON.parse(text);
        } catch(e) {
            return null;
        }
    };


    /* Rate limit ensures a function is never called more than every [rate]ms.
     * func - function to rate limit
     * rate - minimum time to wait between function calls
     * async - if async is true, we won't wait (rate) for the function to complete before queueing the next request
     */
    var rateLimit = function(func, rate) {
        var queue = [];
        var currentlyEmptyingQueue = false;

        var emptyQueue = function() {
            if (queue.length) {
                currentlyEmptyingQueue = true;
                _.delay(function() {
                    queue.shift().call();
                    emptyQueue();
                }, rate);
            } else {
                currentlyEmptyingQueue = false;
            }
        };

        return function() {
            // Get arguments into an array.
            var args = _.map(arguments, function(e) { return e; });
            // Call apply so that we can pass in arguments as parameters as opposed to an array.
            queue.push(_.bind.apply(this, [func, this].concat(args)) );
            if (!currentlyEmptyingQueue) { emptyQueue(); }
        };
    };


    // Is the application running in the desktop browser (true) or on a mobile (false).
    var isDesktop = function() {
        var device = window.device;
        if(!device) { return true; }

        return device.name === "desktop" || !device.model;
    };

    // Returns normalized platform string.
    var getPlatform = function() {
        // First check for running in the desktop browser.
        if(isDesktop()) {
            return "desktop";
        }

        // Get platform string from Phonegap.
        var pstr = (window.device.platform || "").toLowerCase();

        // Special cases.
        if(pstr === "wince" || pstr === "win32nt") {
            return "windowsphone";
        }

        // Return normalized string.
        return pstr;
    };


    return {
        timestamp: getTimestamp,
        // Universal no-operation function.
        noOp: function() {},
        rs4: randomS4,
        bootstrap: extractBootstrapInfo,
        dump: dumpJSON,
        load: loadJSON,
        limit: rateLimit,
        platform: getPlatform
    };
});

// BrowserDetect script from: http://www.quirksmode.org/js/detect.html
define('detect',[],function() {
    

    // Shorter variables for common objects.
    var unknown = "Unknown";

    var BrowserDetect = {
        init: function() {
            var that = this;
            that.browser = that.sS(that.dB) || unknown;
            that.version = that.sV(navigator.userAgent) || that.sV(navigator.appVersion) ||
                unknown;
            that.OS = that.sS(that.dOS) || unknown;
        },
        sS: function(data) {
            for (var i = 0; i < data.length; i++) {
                var dataString = data[i].st;
                var dataProp = data[i].prop;
                this.vSS = data[i].vS || data[i].id;
                if (dataString) {
                    if (dataString.indexOf(data[i].sub) !== -1) {
                        return data[i].id;
                    }
                } else if (dataProp) {
                    return data[i].id;
                }
            }
        },
        sV: function(dataString) {
            var index = dataString.indexOf(this.vSS);
            if (index === -1) {
                return;
            }
            return parseFloat(dataString.substring(index + this.vSS.length + 1));
        },
        dB: [{
            st: navigator.userAgent,
            sub: "Chrome",
            id: "Chrome"
        }, {
            st: navigator.userAgent,
            sub: "OmniWeb",
            vS: "OmniWeb/",
            id: "OmniWeb"
        }, {
            st: navigator.vendor,
            sub: "Apple",
            id: "Safari",
            vS: "Version"
        }, {
            prop: window.opera,
            id: "Opera",
            vS: "Version"
        }, {
            st: navigator.vendor,
            sub: "iCab",
            id: "iCab"
        }, {
            st: navigator.vendor,
            sub: "KDE",
            id: "Konqueror"
        }, {
            st: navigator.userAgent,
            sub: "Firefox",
            id: "Firefox"
        }, {
            st: navigator.vendor,
            sub: "Camino",
            id: "Camino"
        }, { // for newer Netscapes (6+)
            st: navigator.userAgent,
            sub: "Netscape",
            id: "Netscape"
        }, {
            st: navigator.userAgent,
            sub: "MSIE",
            id: "Explorer",
            vS: "MSIE"
        }, {
            st: navigator.userAgent,
            sub: "Gecko",
            id: "Mozilla",
            vS: "rv"
        }, { // for older Netscapes (4-)
            st: navigator.userAgent,
            sub: "Mozilla",
            id: "Netscape",
            vS: "Mozilla"
        }],
        dOS: [{
            st: navigator.platform,
            sub: "Win",
            id: "Windows"
        }, {
            st: navigator.platform,
            sub: "Mac",
            id: "Mac"
        }, {
            st: navigator.userAgent,
            sub: "iPhone",
            id: "iPhone/iPod"
        }, {
            st: navigator.platform,
            sub: "Linux",
            id: "Linux"
        }]

    };
    BrowserDetect.init();

    return BrowserDetect;
});

/* Filesystem access abstraction layer.
 * This module provides easier to use functions for common filesystem operations.
 * This includes accessing/reading/writing files and directories inside
 * current Apphance session and offline sessions as well.
 * Image file handling is also a part of this module.
 * Each Filesystem API call is given error callback which logs eventual error
 * to the console. Thus, no FS operations break Apphance operation.
 * Note:
 * All of the filesystem functions are asynchronous and take a callback that
 * is used after the async operation is completed. This callback is used to
 * pass computed value back to the calling code.
 */
define('aph/fs',[
    "v/us",
    "aph/console",
    "aph/core",
    "aph/util"
], function(_, Console, Core, Util) {
    


    // Shorter variables for common objects.
    var win = window;


    // Some constant definitions of paths etc.
    var BUILD_FILE = "build.json";
    var PARAM_FILE = "params.json";
    var MESSAGE_FILE = "messages.json";
    var CONDS_FILE = "conditions.json";
    var OUTBOX_FOLDER = "to_send";
    var IMAGE_FOLDER = "images";
    var FS_TYPE = "TEMPORARY";  // "TEMPORARY", "PERSISTENT"


    // General "error" callback for all File API functions.
    var fileApiError = function(error) {
        Console.error("Aph: Error in filesystem operation.", error);
    };


    /* General "access/create directory" function.
     * `parent` is a parent `DirectoryEntry`.
     * `name` is a directory name to create/access.
     * `success` is a success callback.
     */
    var openDirectory = function(parent, name, success) {
        parent.getDirectory(name, {create: true}, success, fileApiError);
    };

    var getApphanceDirName = function () {
        return "A" + Core.applicationKey.substr(0, 6);
    };

    /* Get access to main Apphance directory in file storage.
     * All other directories and files are contained inside this directory.
     */
    var getApphanceDir = function(success) {
        // Get access to the filesystem and quota.
        win.requestFileSystem(win.LocalFileSystem[FS_TYPE], 0, function(fs) {
            // Get root Apphance directory.
            openDirectory(fs.root, getApphanceDirName(), success);
        }, fileApiError);
    };


    /* Get access to the session container directory.
     * All session directories are inside of it.
     */
    var getSessionContainer = function(success) {
        getApphanceDir(function(dir) {
            openDirectory(dir, "Sessions", success);
        });
    };


    /* Access current session directory.
     * When `sessionId` is defined access an offline session instead of the current one.
     */
    var getSessionDir = function(success, sessionId) {
        getSessionContainer(function(dir) {
            // Fallback to current session's ID (timestamp).
            var name = "" + (sessionId || Core.ts);  // Number -> String.
            openDirectory(dir, name, success);
        });
    };


    /* Get access to session's message outbox folder.
     * Outbox folder is where message files are moved when they're ready to be
     * submitted to Apphance server.
     * If `parent` is specified uses given session directory, otherwise uses current one.
     */
    var getOutboxDir = function(success, parent) {
        // Use given session entry, bail with the result.
        if(!_.isUndef(parent)) {
            return openDirectory(parent, OUTBOX_FOLDER, success);
        }

        getSessionDir(function(dir) {
            openDirectory(dir, OUTBOX_FOLDER, success);
        });
    };


    /* Get list of session's outbox directory contents (entries).
     * Use either given session or current one.
     */
    var readOutboxDir = function(success, parent) {
        getOutboxDir(function(dir) {
            readDirectory(dir, success);
        }, parent);
    };

    /* Get File Entry
     */
    var getFileFromDir = function (dir, name, success) {
        var args = [name, {create: true}, success, fileApiError];
        dir.getFile.apply(dir, args);
    };


    /* Request access to a file entry inside session directory.
     * If `parent` is specified uses given session, otherwise uses current one.
     */
    var getSessionFile = function(name, success, parent) {
        // Use given session entry, bail with the result.
        if(!_.isUndef(parent)) {
            return getFileFromDir(parent, name, success);
        }

        // Access session directory.
        getSessionDir(function(dir) {
            // Access file/request creation.
            getFileFromDir(dir, name, success);
        });
    };


    /* Create writer for a file in current session directory.
     * Creates file if missing.
     */
    var writeFileInSession = function(name, success) {
        getSessionFile(name, function(entry) {
            entry.createWriter(function(writer) {
                // Stay notified about writing errors.
                writer.onerror = fileApiError;
                success(writer);
            }, fileApiError);
        });
    };


    // Reads text file contents from a given FileEntry.
    var readFileEntry = function(entry, success) {
        // Access low level file object, bind to a reader.
        entry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = onFileRead;
            reader.readAsText(file);
        }, fileApiError);

        // Proceed with file contents.
        function onFileRead(evt) {
            var text = evt.target.result;
            // Call success callback with file contents.
            success(text);
        }
    };


    // Shortcut function for reading given directory (via entry) contents.
    var readDirectory = function(entry, success) {
        var reader = entry.createReader();
        reader.readEntries(success, fileApiError);
    };


    /* Moves message file from current session to the designated outbox folder.
     * This is usually done after the message file is too big or a crash happened.
     */
    var messagesToOutbox = function(success) {
        // Go into outbox folder.
        getOutboxDir(function(dir) {
            // Now get entry of current message file.
            getSessionFile(MESSAGE_FILE, function(entry) {
                // Name for the file in outbox.
                var name = Util.timestamp() + "_" + entry.name;
                // Do the move.
                entry.moveTo(dir, name, success, fileApiError);
            });
        });
    };


    /* Browser compatible file writing function. Used in Ripple etc.
     * This is needed because Phonegap FileWriter consumes text
     * but browser requires Blob objects.
     * writer - FileWriter object.
     * content - text content to write to file.
     */
    var _compatWrite = function(writer, content) {
        // For browser use intermediary Blob object.
        if(win.tinyHippos !== undefined) {
            var blob = new Blob([content], {type: "text/plain"});
            writer.write(blob);
            return;
        }

        // For device with Phonegap use standard method.
        writer.write(content);
    };


    /* Store current sessions parameters in a file.
     * `content` should be a serialized parameters object.
     */
    var writeParams = function(content) {
        writeFileInSession(PARAM_FILE, function(writer) {
            _compatWrite(writer, content);
        });
    };


    // Read session parameters file. Either from `parent` or current session.
    var readParams = function(success, parent) {
        getSessionFile(PARAM_FILE, function(entry) {
            readFileEntry(entry, success);
        }, parent);
    };


    /* Write build.json file. Use Apphance dir as this is not related to session.
     */
    var writeBuild = function (data) {
        getApphanceDir(function (dir) {
            getFileFromDir(dir, BUILD_FILE, function (entry) {
                entry.createWriter(function(writer) {
                    writer.onerror = fileApiError;
                    _compatWrite(writer, JSON.stringify(data));
                }, fileApiError);
            });
        });
    };


    /* Read build.json file, it contains launch count number
     * Use Apphance dir as this is not related to session.
     */
    var readBuild = function (success) {
        getApphanceDir(function (dir) {
            getFileFromDir(dir, BUILD_FILE, function (entry) {
                readFileEntry(entry, function (text) {
                    success(JSON.parse(text || '{}'));
                });
            });
        });
    };


    /* Stores conditions data inside session directory.
     * This should be used only for initial condition data.
     * `content` is a serialized conditions object.
     */
    var writeConds = function(content) {
        writeFileInSession(CONDS_FILE, function(writer) {
            _compatWrite(writer, content);
        });
    };


    // Read initial conditions stored for a given or current session.
    var readConds = function(success, parent) {
        getSessionFile(CONDS_FILE, function(entry) {
            readFileEntry(entry, success);
        }, parent);
    };


    /* Append message to current session's message file.
     * Create this file if missing. Write header if file is empty.
     * `content` should be a serialized message object.
     * Note:
     * The message file is actually hand-crafted JSON file. Empty message file
     * is opened with a header -- an JS array opening bracket.
     * Then each line is a single message object with a comma.
     * When message file is finally read it is closed with a footer -- JS
     * array closing bracket.
     */
    var writeMessage = function(content, success) {
        writeFileInSession(MESSAGE_FILE, function(writer) {
            // Call after successful write.
            writer.onwrite = success;

            var toSave = "";  // Avoid multiple writes.

            if(!writer.length) {  // Empty file -> start with the header.
                toSave += "[\n";
            } else {  // Some messages already there, append, not overwrite.
                writer.seek(writer.length);
            }

            // Write single message row.
            toSave += content;
            // Provide proper separation.
            toSave += ",\n";
            // Do the write.
            _compatWrite(writer, toSave);
        });
    };
    // Rate-limit appending to message file to prevent
    // race condition issues with seeking to the end of file.
    var limitedWriteMessage = Util.limit(writeMessage, 50);


    /* Get access to session's images folder.
     * Image files are used to store screenshot during bug reporting.
     * If `parent` is specified uses given session, otherwise uses current one.
     */
    var getImageDir = function(success, parent) {
        // Use given session entry, bail with the result.
        if(!_.isUndef(parent)) {
            return openDirectory(parent, IMAGE_FOLDER, success);
        }

        getSessionDir(function(dir) {
            openDirectory(dir, IMAGE_FOLDER, success);
        });
    };


    /* Requests access to an image file entry (either for reading or writing).
     * If `parent` is specified uses given session, otherwise uses current one.
     */
    var getImageFile = function(name, success, parent) {
        getImageDir(function(dir) {
            // Access file entry.
            dir.getFile(name, {create: true}, success, fileApiError);
        }, parent);
    };


    /* Read image files contents.
     * If `parent` is specified uses given session, otherwise uses current one.
     */
    var readImageFile = function(name, success, parent) {
        getImageFile(name, function(entry) {
            readFileEntry(entry, success);
        }, parent);
    };


    // Creates writer object for a file inside image directory.
    var writeImageFile = function(name, success) {
        getImageFile(name, function(entry) {
            // Open file for writing.
            entry.createWriter(function(writer) {
                writer.onerror = fileApiError;
                success(writer);
            });
        });
    };


    /* Saves image content from an issue inside special images directory.
     * `name` is an image file desired name.
     * `content` is serialized image data.
     */
    var writeIssueImage = function(name, content, success) {
        // Write like an usual text file.
        writeImageFile(name, function(writer) {
            writer.onwrite = success;
            _compatWrite(writer, content);
        });
    };


    /* Deletes image file given by name.
     * If `parent` is specified uses given session, otherwise uses current one.
     */
    var deleteIssueImage = function(name, success, parent) {
        success = success || Util.noOp;

        getImageFile(name, function(entry) {
            entry.remove(success, fileApiError);
        }, parent);
    };


    return {
        getContainer: getSessionContainer,
        sessionDir: getSessionDir,
        fileError: fileApiError,
        readFile: readFileEntry,
        writeParams: writeParams,
        readParams: readParams,
        writeConds: writeConds,
        readConds: readConds,
        writeMessage: limitedWriteMessage,
        messagesToOutbox: messagesToOutbox,
        readDir: readDirectory,
        readOutbox: readOutboxDir,
        issueImg: writeIssueImage,
        deleteImg: deleteIssueImage,
        readImg: readImageFile,
        readBuild: readBuild,
        writeBuild: writeBuild,
        // Exposed for debug/testing.
        _gSF: getSessionFile,
        _gADN: getApphanceDirName
    };
});

/* global device */
/* Handling environment conditions: gathering, watching etc.
 *
 * Note: it's really important that functions gathering conditions for
 * a given category are named exactly like this category.
 * This way `initial` functions automagically works -- is uses category names
 * to get gathering function from this module's scope.
 */
define('aph/conds',[
    "aph/core",
    "detect",
    "jq",
    "aph/util",
    "aph/fs",
    "v/us"
], function(Core, Detect, $, Util, FS, _) {
    

    // For easier cross-referencing in this module, put condition gathering functions in one object.
    var funs = {};
    // Cache for condition watching functions.
    // This works as a simple event handling system. Mapping function to a
    // category name allows this function to be called when conditions
    // in this category change.
    var watchers = {};
    // Condition polling interval, for categories requiring continuous polling.
    var POLL_INTERVAL = 60 * 1000;


    // Safe getter for window.screen attributes. This is to avoid "undefined" errors.
    var screenGet = function(name) {
        var s = window.screen;
        if(!!s) {
            return s[name];
        }
    };


    // Cache for locale data. This is to be filled with meaningful data
    // when Phonegap responds to async-request.
    var _locale = null;
    // Gather system conditions.
    funs.system = function() {
        return {
            device: {
                // When no device model can be detected, fall back to browser detection.
                model: device.model || (Detect.browser + " " + Detect.version),
                // Same as in model, fall back to User Agent string.
                id: device.uuid || navigator.userAgent
            },
            os: {
                name: device.platform,
                version: device.version,
                phonegap: device.cordova
            },
            locale: _locale
        };
    };


    // Gather screen (viewport) conditions.
    funs.screen = function() {
        return {
            // Screen size.
            width: screenGet("width"),
            height: screenGet("height"),
            // Screen parameters
            density: window.devicePixelRatio,
            colors: screenGet("pixelDepth"),
            // Internal WebView viewport size.
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            rotation: window.orientation
        };
    };


    /* Gather network connection info.
     * Use `source` to provide data source to this formatting function.
     * Otherwise direct call to Phonegap API will be made.
     */
    funs.networking = function(source) {
        var conn = window.Connection;

        // Translate Phonegap string to Apphance string.
        var interfaceMap = {};
        interfaceMap[conn.CELL] = (interfaceMap[conn.CELL_2G] =
            interfaceMap[conn.CELL_3G] = interfaceMap[conn.CELL_4G] = "mobile");
        interfaceMap[conn.ETHERNET] = "tether";
        interfaceMap[conn.WIFI] = "wifi";

        var type = source || navigator.connection.type;

        return {
            "active-interface": interfaceMap[type]
        };
    };


    // Gather telephony info.
    funs.telephony = function() {
        var info = {};

        var conn = window.Connection;
        var type = navigator.connection.type;

        if(type === conn.CELL || type === conn.CELL_2G ||
                type === conn.CELL_3G || type === conn.CELL_4G) {
            info["network-type"] = type;
        }

        return info;
    };


    // Cache for power info. Works like with the "locale" category.
    var _battery;
    /* Gather power info.
     * Use `source` to provide data source to this formatting function.
     * Otherwise direct call to Phonegap API will be made.
     */
    funs.power = function(source) {
        source = source || _battery;
        var info = {};

        if(!!source) {
            var level = source.level;
            var plugged = source.isPlugged;

            // Get charged/charging/discharging state.
            var state = null;
            if(plugged) {
                if(level === 100) {
                    state = "charged";
                } else {
                    state = "charging";
                }
            } else {
                state = "battery";
            }
            info.state = state;

            // No capacity info, just charging level.
            info.battery = {
                level: level
            };
        }

        return info;
    };


    // Cache for async-gathered location info. This will be filled when
    // first async call to geolocation API succeeds.
    var _coords;
    // Gather location condition using either given coords object (`source`) or a cached one.
    funs.location = function(source) {
        source = source || _coords;
        var info = {};

        if(!!source) {  // Provide parameters only when coords are present.
            info.geo = {
                latitude: source.latitude || null,
                longitude: source.longitude || null,
                altitude: source.altitude || null
            };

            // Location anonymization in production mode.
            // Throw out all decimal places after the first one.
            if(Core.mode === "MARKET_MODE") {
                info.geo.latitude = Number((info.geo.latitude).toFixed(1));
                info.geo.longitude = Number((info.geo.longitude).toFixed(1));
            }

            if(!!source.accuracy) {
                info.geo.accuracy = {
                    horizontal: source.accuracy,
                    vertical: source.accuracy
                };
            }
        }

        return info;
    };

    // Return object with conditions info from all categories.
    var getAllConds = function() {
        var result = {};

        for(var name in funs) {
            result[name] = funs[name]();
        }

        return result;
    };


    /* Filter given condition object (`source`) with filters from session configuration.
     * Passing "true" for `addSystem` forces inclusion of the "system" category.
     */
    var filterConds = function(source, addSystem) {
        var result = {};

        _.each(Core.condFilter, function(enabled, cat) {
            if(!enabled) {
                // Client doesn't want this category.
                return;
            }

            // Only include non-empty categories.
            var catObj = source[cat];
            if(!!catObj) {
                result[cat] = catObj;
            }
        });

        // Apply special case for system category (add anyway if requested).
        if(addSystem && !result.system) {
            result.system = funs.system();
        }

        result.build = _build;

        return result;
    };


    // Return initial conditions object.
    var getInitial = function() {
        return filterConds(getAllConds(), true);
    };


    /** Callbacks for async API used to gather conditions info.
     ** These functions fill up "cache" variables further up in this module.
     **/

    // OS locale API callback.
    var _gatherLocale = function() {
        // Bail if no globalization API available.
        if(!navigator.globalization) { return; }

        navigator.globalization.getLocaleName(function(loc) {
            _locale = loc.value;
        }, Util.noOp);
    };

    // Geolocation API callback.
    var _gatherCoords = function(callback) {
        if(!callback) {
            throw new Error('callback is required');
        }
        navigator.geolocation.getCurrentPosition(function(position) {
            // Bail on empty data.
            if(!position) { return; }

            var OldCoords = _.extend({}, _coords);
            // Save received position in cache.
            _coords = position.coords;
            if(!!callback) {
                callback(_coords, OldCoords);
            }
        }, Util.noOp, {timeout: 1000});
    };

    // Cache for connection type.
    var _connType;
    // Gather connection type info and notify given callback about changes.
    var _gatherConnection = function(callback) {
        var oldVal = _connType;
        var newVal = navigator.connection.type;

        // Notify watcher if present.
        if(!!callback) {
            callback(newVal, oldVal);
        }

        // Update cache.
        _connType = newVal;
    };

    // Cache Build condition
    var _build = {};
    // Update Build condition
    // WARNING: `_gatherBuild` will increase launch count by 1 every time it's run.
    // It's designed to be run at every launch only once.
    var _gatherBuild = function () {
        FS.readBuild(function (data) {
            data.count = (data.count || 0) + 1;
            FS.writeBuild(data);
            _build.installation = data.count === 1;
            _build.launch_count = data.count;

        });

    };
    /** End callbacks **/

    // Subscribe given watcher function ('callback') to async condition category (`name`).
    var registerWatcher = function(name, callback) {
        watchers[name] = callback;
    };

    // Unsubscribe (one or all) async condition watcher.
    var unregisterWatcher = function(name) {
        if(!name) { // No name specified, reset all.
            watchers = {};
        } else {
            watchers[name] = null;
        }
    };


    var _pollId = null;
    // Continuously gather async condition data for categories requiring manual polling.
    var startPolling = function() {
        // Do a clean up first to avoid multiple polling processes.
        stopPolling();

        _gatherLocale();
        _gatherBuild();

        // Bind to event for battery status. This needs to be done after
        // "deviceready", otherwise binding won't work.
        $(window).on("batterystatus", function(data) {
            _battery = data;
            // Notify watcher if present.
            if(!!watchers.battery) {
                watchers.battery(data);
            }
        }, false);

        // Save interval ID for cleanup.
        _pollId = setInterval(function() {
            // Poll for geolocation data.
            _gatherCoords(watchers.location);
            // Poll for networking data.
            _gatherConnection(watchers.networking);
        }, POLL_INTERVAL);
    };

    // Break condition polling timers. This stops manual polling for conditions.
    var stopPolling = function() {
        // Stop timer.
        if(_pollId !== null) {
            clearInterval(_pollId);
        }
    };


    return {
        initial: getInitial,
        filter: filterConds,
        all: getAllConds,
        register: registerWatcher,
        unregister: unregisterWatcher,
        poll: startPolling,
        cleanUp: stopPolling,
        // Expose condition categories for tests.
        f: funs
    };
});

define('aph/net',[
    "jq",
    "v/us",
    "aph/core",
    "b64",
    "aph/util",
    "aph/conds",
    "aph/console"
], function($, _, Core, b64encode, Util, Conds, Console) {
    


    // Apphance server API endpoint.
    var getUrl = function (end) {
        return Core.protocol + "://" + Core.host + "/device/" + end;
    };

    /* Make a call to Apphance server -- expects options object:
     *
     * kind -- event kind (e.g. identify, login).
     * data -- message contents (an object to be serialized).
     * success -- callback on successful call.
     * error -- callback on failed call.
     * headers -- additional headers to attach.
     */
    var callServer = function(options) {
        // Cache query error string for logging.
        var queryError = function(code) {
            Console.error("Aph: remote query (" + options.kind + ") error: " + code);
        };

        return $.ajax({
            type: "POST",
            contentType: "application/json",
            url: getUrl(options.kind),
            data: Util.dump(options.data),
            headers: options.headers || {},  // Additional request headers.
            dataType: "json",  // Expect JSON response.
            global: false,  // Don't trigger global AJAX events.

            // AJAX call successful.
            success: function(data) {
                if(data.status === "OK") {
                    // Call success callback if specified.
                    if(_.isFunction(options.success)) {
                        options.success(data);
                    }
                } else {
                    // Internal error (not call error).
                    var status = data.status;
                    queryError(status);
                    if(_.isFunction(options.error)) {
                        options.error(status);
                    }
                }
            },

            // AJAX call failure.
            error: function() {
                // Call error callback if specified.
                var status = "CALL_ERROR";
                queryError(status);
                if(_.isFunction(options.error)) {
                    options.error(status);
                }
            }
        });
    };


    /* Execute identification step with Apphance server.
     * Not data validation is done here in either direction.
     */
    var identify = function(successCallback, errorCallback) {
        return callServer({
            kind: "identify",
            data: {
                application_key: Core.applicationKey,
                mode: Core.mode,
                library_version: {
                    number: Core.vnum,
                    name: Core.vname
                },
                application_version: Core.app_version
            },
            success: successCallback,
            error: errorCallback
        });
    };


    /* Execute login step with Apphance server.
     * When `params` is defined uses it instead of `Core` module.
     * This allows to support other sessions than current (active) one.
     */
    var login = function(successCallback, errorCallback, conds, params) {
        // Use given session params or fallback to active one.
        params = params || Core;
        conds = conds || Conds.initial();

        return callServer({
            kind: "login",
            headers: {
                "Authorization": "Basic " + getAuthString(params)
            },
            data: {
                application_key: params.applicationKey,
                mode: params.mode,
                library_version: {
                    number: params.vnum,
                    name: params.vname
                },
                application_version: params.app_version,
                // Use session initialization timestmap. It's important
                // for offline sessions. Fall back to current timestamp.
                timestamp: params.ts || Util.timestamp(),
                initial_condition: conds
            },
            success: successCallback,
            error: errorCallback
        });
    };


    /* Prepare authorization string for login step.
     * When `params` is defined uses it instead of `Core` module.
     */
    var getAuthString = function(params) {
        var auth;

        // Fall back to `Core` if user not stored in given params.
        if(!!params && !!params.auth && !!params.auth.email) {
            auth = params.auth;
        } else {
            auth = Core.auth;
        }

        try {
            // Use empty password if none stored.
            return b64encode(auth.email + ":" + (auth.password || ""));
        } catch(e) {
            return "";
        }
    };


    /* Send in-session messages (crash, problem, log, condition).
     * When `params` is defined uses it instead of `Core` module.
     * This allows to support other sessions than current (active) one.
     */
    var message = function(msg_list, successCallback, errorCallback, params) {
        // Don't allow empty messages/non-arrays.
        if(!msg_list || !_.isArray(msg_list) || !msg_list.length) {
            if(_.isFunction(errorCallback)) {
                errorCallback("VALUE_ERROR");
            }
            return;
        }

        // Use given session params or fallback to active one.
        params = params || Core;

        return callServer({
            kind: "messages",
            data: {
                session_key: params.session_key,
                // Generate unique packet ID.
                packet_id: _.uniqueId(Util.rs4()),
                messages: msg_list
            },
            success: successCallback,
            error: errorCallback
        });
    };


    /* Send issue attachment to a given Blobstore URL.
     * `content` is serialized image content.
     */
    var image = function(url, content, successCallback, errorCallback) {
        // Generate some random boundary string.
        var boundary = Util.rs4();
        // Attach boundary to a proper content type header.
        var contentType = "multipart/form-data; boundary=" + boundary;

        // Make special "raw" request.
        $.ajax({
            url: url,
            type: "POST",
            processData: false,  // Don't encode form fields.
            contentType: contentType,
            // Hand-craft request body.
            data: wrapImageContent(content, boundary),
            global: false,
            success: successCallback,
            error: errorCallback
        });
    };


    /* Prepate multipart/form-data request by hand.
     * This is needed because the flow of Blob/BlobBuilder and FormData
     * is not supported on all platforms.
     */
    var wrapImageContent = function(content, boundary) {
        // Opening line.
        var data = "--" + boundary + "\r\n";
        // Headers describing attached file.
        data += 'Content-Disposition: form-data; name="resource"; filename="image.png"\r\n';
        data += 'Content-Type: image/png\r\n';
        data += 'Content-Transfer-Encoding: base64\r\n';
        data += '\r\n';

        // Matching closing line.
        // We need to remove "data:image/png;base64," it will be handled
        // by server using Content-Transfer-Encoding header value.
        data += content.substring(22) + '\r\n--' + boundary + '--';

        return data;
    };


    return {
        identify: identify,
        login: login,
        message: message,
        image: image,
        // Exported only for unit testing.
        _gAS: getAuthString,
        _cS: callServer,
        _wIC: wrapImageContent,
        _gU: getUrl
    };
});

/* Formatting functions for in-session messages.
 * Issues, logs and conditions packets are prepared here before being sent
 * to the server.
 */
define('aph/msg',["aph/util"], function(Util) {
    

    // Prepares single message irrespective of its `group`.
    var prepareMessage = function(data, group) {
        return {
            group: group,
            timestamp: Util.timestamp(true),
            data: data
        };
    };


    // Prepare LOG message.
    var formatLog = function(data) {
        // Ignore empty calls.
        if(data === undefined) { return; }

        // Fill missing fields.
        data.type = data.type || "DEBUG";
        data.level = data.level || "VERBOSE";
        data.tag = data.tag || "";
        data.message = data.message || "";

        // Return proper Message object of LOG group.
        return prepareMessage(data, "LOG");
    };


    // Prepare ISSUE message.
    var formatIssue = function(data) {
        // Ignore empty calls.
        if(data === undefined) { return; }

        // Fill missing fields.
        data.type = data.type || "CRASH";
        data.message = data.message || "";
        // Fall back to auto-generated unique ID.
        data.issue_id = data.issue_id || ("i" + Util.rs4());
        // Assume no attachments by default.
        data.num_attachments = data.num_attachments || 0;

        // Return proper Message object of ISSUE group.
        return prepareMessage(data, "ISSUE");
    };


    // Prepare CONDITION message.
    var formatCondition = function(data) {
        // Ignore empty calls.
        if(data === undefined) { return; }

        // Not much to do here, just pass gathered conditions.
        return prepareMessage(data, "CONDITION");
    };


    return {
        log: formatLog,
        issue: formatIssue,
        condition: formatCondition
    };
});

/* This module provides high-level functions for data storage
 * It's used to store in-session messages (issues, logs, conditions).
 * Rotating the message file and scheduling its submission is handled here as well.
 * Additionally this module prepares images (bug report screenshots) data
 * to be sent to the Apphance server.
 */
define('aph/store',[
    "aph/console",
    "aph/util",
    "aph/net",
    "aph/fs",
    "aph/core",
    "v/us"
], function(Console, Util, Net, FS, Core, _) {
    


    var MESSAGE_LIMIT = 10 * 1024;  // Message buffer size in bytes.


    /* Persist properly formatted Message object (be it log, issue or condition)
     * for future submission to Apphance server.
     */
    var storeMessage = function(msg) {
        // Ignore empty/malformed messages
        if(!msg || typeof msg !== "object" || !msg.group) { return; }

        // Verify message group, ignore unknown ones.
        var group = msg.group;
        if(group !== "LOG" && group !== "ISSUE" && group !== "CONDITION") {
            return;
        }

        // Write message to session file.
        var data = Util.dump(msg);
        if(group === "ISSUE") {  // Submit crashes/problems immediately.
            FS.writeMessage(data, scheduleMsgSubmit);
        } else {  // Otherwise watch message file for going over the limit.
            FS.writeMessage(data, limitWatcher);
        }

    };


    /* A 'watcher' for message file size. Going over limit shall trigger:
     * 1. Message file transfer to the "outbox" directory.
     * 2. Transfer of outbox messages to the server.
     */
    var limitWatcher = function(evt) {
        var writer = evt.target;
        if(writer.length >= MESSAGE_LIMIT) {
            // Move current message file to session's outbox folder.
            // On success submit it to the server.
            scheduleMsgSubmit();
        }
    };


    // Schedules submission of the current session's message file.
    var scheduleMsgSubmit = function() {
        // Move file from main session dir to outbox.
        FS.messagesToOutbox(function(entry) {
            // Don't send messages without active session.
            if(!Core.session_key) {
                Console.info("Aph: Outside of session. Won't submit messages.");
                return;
            }

            // Send file to the server.
            submitFile(entry, function() {
                // On success remove the file.
                entry.remove(Util.noOp, FS.fileError);
            });
        });
    };


    /* Reads and submits message file (from given FileEntry) to the server.
     * When `params` is defined uses it instead of `Core` module.
     * This is to support offline sessions (any non-current session).
     */
    var submitFile = function(entry, success, params) {
        // After successful message file submit.
        var _afterSubmit = function(response) {
            // Submit stored images.
            if(!params) {
                submitImages(response.upload_urls);
            } else {
                // Working on offline session --  get access to its directory first.
                FS.sessionDir(function(dir) {
                    submitImages(response.upload_urls, dir);
                }, params.ts);
            }

            // Proceed with the after-message-sent callback.
            success(response);
        };

        FS.readFile(entry, function(text) {
            // Message file is by design "hand-crafted", it's usually not
            // a proper JSON form. Start by fixing this issue.
            var fixed = closeMsgFile(text);
            var obj = Util.load(fixed);

            // Bail if content is still messed up.
            if(!obj) { return; }

            // Send message packet.
            Net.message(obj, _afterSubmit, Util.noOp, params);
        });
    };


    // Properly finishes message file contents to complete proper JSON array.
    var closeMsgFile = function(content) {
        content = content.trimRight();
        // If the line ends with a coma, delete it and close with square bracket
        // meaning the end of JSON array.
        return content.replace(/,$/, "]");
    };


    /* Submit image attachments (screenshot) to previously sent bug reports.
     * When `parent` is defined it is used as a main session directory.
     * This is to support offline sessions (any non-current session).
     */
    var submitImages = function(issues, parent) {
        // No URLs in response, just ignore it.
        if(!issues) { return; }

        for(var key in issues) {  // Handle each issue separetely.
            var urls = issues[key];
            // "urls" can be either a single string or a list of strings -- the horror!
            // Single string means a single image, list means 2+ images.
            if(!_.isArray(urls)) {
                // Submit single image.
                submitSingleImage(key, 1, urls, parent);
            } else {
                // Loop over and submit multiple images.
                for(var i=0; i<urls.length; i++) {
                    submitSingleImage(key, i+1, urls[i], parent);
                }
            }
        }
    };


    /* Submit single issue attachment (screenshot).
     * The only information we have is issue ID and number of image attachment
     * But we can easily reconstruct image file name.
     * "num" -- sequential number of attachment, starting from 1 (one)!
     * "url" -- target URL for file upload.
     * When `parent` is defined it is used as a main session directory.
     */
    var submitSingleImage = function(issueId, num, url, parent) {
        var name = issueId + "_" + num;

        var uploadError = function() {
            Console.warn("Aph: Error during image submission: " + name);
        };

        var uploadSuccess = function() {
            // Upload complete, remove the file.
            FS.deleteImg(name, null, parent);
        };

        // Access image file.
        FS.readImg(name, function(result) {
            // Submit image file to the server.
            Net.image(url, result, uploadSuccess, uploadError);
        }, parent);
    };


    return {
        message: storeMessage,
        submit: submitFile,
        // Pass-through exports.
        params: FS.writeParams,
        conds: FS.writeConds,
        issueImg: FS.issueImg,
        deleteImg: FS.deleteImg
    };
});

/* Custom logging functions for the client application to use.
 * Calling these functions creates "LOG" messages that are eventually
 * sent to the Apphance server.
 */
define('aph/log',[
    "v/us",
    "aph/console",
    "aph/msg",
    "aph/core",
    "aph/store"
], function(_, Console, Msg, Core, Store) {
    


    // For easier minification.
    var levelLog = "log";
    var levelInfo = "info";
    var levelWarn = "warn";
    var levelError = "error";

    // Logging levels order of importance.
    var levelOrder = ["VERBOSE", "INFO", "WARNING", "ERROR", "FATAL"];

    // Mapping from browser console levels to Apphance logging levels.
    var levelMap = {};
    levelMap[levelLog] = levelOrder[0];
    levelMap[levelInfo] = levelOrder[1];
    levelMap[levelWarn] = levelOrder[2];
    levelMap[levelError] = levelOrder[3];
    // FATAL is not used.


    // Uses session config to tell whether provided logging level is passed to the server.
    var isLevelVisible = function(name) {
        // Index of minimal visible level.
        var filterIndex = _.indexOf(levelOrder, Core.level);
        // Index of a given level.
        var levelIndex = _.indexOf(levelOrder, name);

        return filterIndex <= levelIndex;
    };


    // Factory for Apphance-enabled logging functions.
    var getConsoleFunction = function(name) {
        return function(arg1) {
            var text;
            try {  // Flatten arguments if multiple passed.
                text = Array.prototype.join.call(arguments, " ");
            } catch(e) {  // Fall back to single (first) argument.
                text = arg1;
            }

            // Apphance protocol compatible level for this logging function.
            var levelName = levelMap[name];

            // Send message only if the level is sufficient.
            if(isLevelVisible(levelName)) {
                // Format LOG message for sending.
                var logMessage = Msg.log({
                    level: levelName,
                    message: text
                });

                // Store message in a queue.
                Store.message(logMessage);
            }

            // Pass log execution to original function (don't hide logs).
            // "this" doesn't really matter here.
            Console[name].apply(Console, arguments);
        };
    };


    // Cache custom logging functions.
    var consoleLog = getConsoleFunction(levelLog);
    var consoleInfo = getConsoleFunction(levelInfo);
    var consoleWarn = getConsoleFunction(levelWarn);
    var consoleError = getConsoleFunction(levelError);


    return {
        // Expose patched logging functions.
        log: consoleLog,
        info: consoleInfo,
        warn: consoleWarn,
        error: consoleError,
        // Expose for tests.
        _iLV: isLevelVisible
    };
});

/*
 TraceKit - Cross brower stack traces - github.com/occ/TraceKit
 MIT license
*/
/* jshint strict: true */
define('v/tracekit',['require','v/us'],function(require) {
    
    // Shorter variables for common objects.
    var win = window;
    var nav = navigator;
    var doc = document;


    var _ = require("v/us");
    var _has = _.has;


    // Define TraceKit namespace object.
    var TraceKit = {
        // Intercept window errors.
        cWE: true
    };

    // Global reference to slice.
    var _slice = [].slice;
    var UNKNOWN_FUNCTION = '';


    /**
     * TraceKit.wrap: Wrap any function in a TraceKit reporter
     * Example: func = TraceKit.wrap(func);
     *
     * @param {Function} func Function to be wrapped
     * @return {Function} The wrapped func
     */
    TraceKit.wrap = function traceKitWrapper(func) {
        function wrapped() {
            try {
                return func.apply(this, arguments);
            } catch (e) {
                TraceKit.report(e);
                throw e;
            }
        }
        return wrapped;
    };

    /**
     * TraceKit.report: cross-browser processing of unhandled exceptions
     *
     * Syntax:
     *   TraceKit.report.subscribe(function(stackInfo) { ... })
     *   TraceKit.report.unsubscribe(function(stackInfo) { ... })
     *   TraceKit.report(exception)
     *   try { ...code... } catch(ex) { TraceKit.report(ex); }
     *
     * Supports:
     *   - Firefox: full stack trace with line numbers, plus column number
     *              on top frame; column number is not guaranteed
     *   - Opera:   full stack trace with line and column numbers
     *   - Chrome:  full stack trace with line and column numbers
     *   - Safari:  line and column number for the top frame only; some frames
     *              may be missing, and column number is not guaranteed
     *   - IE:      line and column number for the top frame only; some frames
     *              may be missing, and column number is not guaranteed
     *
     * In theory, TraceKit should work on all of the following versions:
     *   - IE5.5+ (only 8.0 tested)
     *   - Firefox 0.9+ (only 3.5+ tested)
     *   - Opera 7+ (only 10.50 tested; versions 9 and earlier may require
     *     Exceptions Have Stacktrace to be enabled in opera:config)
     *   - Safari 3+ (only 4+ tested)
     *   - Chrome 1+ (only 5+ tested)
     *   - Konqueror 3.5+ (untested)
     *
     * Requires TraceKit.cST.
     *
     * Tries to catch all unhandled exceptions and report them to the
     * subscribed handlers. Please note that TraceKit.report will rethrow the
     * exception. This is REQUIRED in order to get a useful stack trace in IE.
     * If the exception does not reach the top of the browser, you will only
     * get a stack trace from the point where TraceKit.report was called.
     *
     * Handlers receive a stackInfo object as described in the
     * TraceKit.cST docs.
     */
    TraceKit.report = (function reportModuleWrapper() {
        var handlers = [],
            lastException = null,
            lastExceptionStack = null;

        /**
         * Add a crash handler.
         * @param {Function} handler
         */
        function subscribe(handler) {
            installGlobalHandler();
            handlers.push(handler);
        }

        /**
         * Remove a crash handler.
         * @param {Function} handler
         */
        function unsubscribe(handler) {
            for (var i = handlers.length - 1; i >= 0; --i) {
                if (handlers[i] === handler) {
                    handlers.splice(i, 1);
                }
            }
        }

        /**
         * Dispatch stack information to all handlers.
         * @param {Object.<string, *>} stack
         */
        function notifyHandlers(stack, windowError) {
            var exception = null;
            if (windowError && !TraceKit.cWE) {
                return;
            }
            for (var i in handlers) {
                if (_has(handlers, i)) {
                    try {
                        handlers[i].apply(null, [stack].concat(_slice.call(arguments, 2)));
                    } catch (inner) {
                        exception = inner;
                    }
                }
            }

            if (exception) {
                throw exception;
            }
        }

        var _oldOnerrorHandler, _onErrorHandlerInstalled;

        /**
         * Ensures all global unhandled exceptions are recorded.
         * Supported by Gecko and IE.
         * @param {string} message Error message.
         * @param {string} url URL of script that generated the exception.
         * @param {(number|string)} lineNo The line number at which the error
         * occurred.
         */
        function traceKitWindowOnError(message, url, lineNo) {
            var stack = null;

            if (lastExceptionStack) {
                TraceKit.cST.aSTWIE(lastExceptionStack, url, lineNo, message);
                stack = lastExceptionStack;
                lastExceptionStack = null;
                lastException = null;
            } else {
                var location = {
                    'url': url,
                    'line': lineNo
                };
                location.func = UNKNOWN_FUNCTION;
                location.context = null;
                stack = {
                    'mode': 'onerror',
                    'message': message,
                    'url': doc.location.href,
                    'stack': [location],
                    'useragent': nav.userAgent
                };
            }

            notifyHandlers(stack, 'from window.onerror');

            if (_oldOnerrorHandler) {
                return _oldOnerrorHandler.apply(this, arguments);
            }

            return false;
        }

        function installGlobalHandler ()
        {
            if (_onErrorHandlerInstalled === true) {
                return;
            }
            _oldOnerrorHandler = win.onerror;
            win.onerror = traceKitWindowOnError;
            _onErrorHandlerInstalled = true;
        }

        /**
         * Reports an unhandled Error to TraceKit.
         * @param {Error} ex
         */
        function report(ex) {
            var args = _slice.call(arguments, 1);
            if (lastExceptionStack) {
                if (lastException === ex) {
                    return; // already caught by an inner catch block, ignore
                } else {
                    var s = lastExceptionStack;
                    lastExceptionStack = null;
                    lastException = null;
                    notifyHandlers.apply(null, [s, null].concat(args));
                }
            }

            var stack = TraceKit.cST(ex);
            lastExceptionStack = stack;
            lastException = ex;

            // If the stack trace is incomplete, wait for 2 seconds for
            // slow slow IE to see if onerror occurs or not before reporting
            // this exception; otherwise, we will end up with an incomplete
            // stack trace
            win.setTimeout(function () {
                if (lastException === ex) {
                    lastExceptionStack = null;
                    lastException = null;
                    notifyHandlers.apply(null, [stack, null].concat(args));
                }
            }, (stack.incomplete ? 2000 : 0));

            throw ex; // re-throw to propagate to the top level (and cause window.onerror)
        }

        report.subscribe = subscribe;
        report.unsubscribe = unsubscribe;
        return report;
    }());

    // XXX: Original: computeStackTrace.
    /**
     * TraceKit.cST: cross-browser stack traces in JavaScript
     *
     * Syntax:
     *   s = TraceKit.cST.ofCaller([depth])
     *   s = TraceKit.cST(exception) // consider using TraceKit.report instead (see below)
     * Returns:
     *   s.name              - exception name
     *   s.message           - exception message
     *   s.stack[i].url      - JavaScript or HTML file URL
     *   s.stack[i].func     - function name, or empty for anonymous functions (if guessing did not work)
     *   s.stack[i].args     - arguments passed to the function, if known
     *   s.stack[i].line     - line number, if known
     *   s.stack[i].column   - column number, if known
     *   s.stack[i].context  - an array of source code lines; the middle element corresponds to the correct line#
     *   s.mode              - 'stack', 'stacktrace', 'multiline', 'callers', 'onerror', or 'failed' -- method used to collect the stack trace
     *
     * Supports:
     *   - Firefox:  full stack trace with line numbers and unreliable column
     *               number on top frame
     *   - Opera 10: full stack trace with line and column numbers
     *   - Opera 9-: full stack trace with line numbers
     *   - Chrome:   full stack trace with line and column numbers
     *   - Safari:   line and column number for the topmost stacktrace element
     *               only
     *   - IE:       no line numbers whatsoever
     *
     * Tries to guess names of anonymous functions by looking for assignments
     * in the source code. In IE and Safari, we have to guess source file names
     * by searching for function bodies inside all page scripts. This will not
     * work for scripts that are loaded cross-domain.
     * Here be dragons: some function names may be guessed incorrectly, and
     * duplicate functions may be mismatched.
     *
     * TraceKit.cST should only be used for tracing purposes.
     * Logging of unhandled exceptions should be done with TraceKit.report,
     * which builds on top of TraceKit.cST and provides better
     * IE support by utilizing the window.onerror event to retrieve information
     * about the top of the stack.
     *
     * Note: In IE and Safari, no stack trace is recorded on the Error object,
     * so cST instead walks its *own* chain of callers.
     * This means that:
     *  * in Safari, some methods may be missing from the stack trace;
     *  * in IE, the topmost function in the stack trace will always be the
     *    caller of cST.
     *
     * This is okay for tracing (because you are likely to be calling
     * cST from the function you want to be the topmost element
     * of the stack trace anyway), but not okay for logging unhandled
     * exceptions (because your catch block will likely be far away from the
     * inner function that actually caused the exception).
     *
     * Tracing example:
     *     function trace(message) {
     *         var stackInfo = TraceKit.cST.ofCaller();
     *         var data = message + "\n";
     *         for(var i in stackInfo.stack) {
     *             var item = stackInfo.stack[i];
     *             data += (item.func || '[anonymous]') + "() in " + item.url + ":" + (item.line || '0') + "\n";
     *         }
     *         if (window.console)
     *             console.info(data);
     *         else
     *             alert(data);
     *     }
     */
    TraceKit.cST = (function computeStackTraceWrapper() {
        var debug = false;

        // XXX: Note: Removed remote source fetching for brevity.

        /**
         * Escapes special characters, except for whitespace, in a string to be
         * used inside a regular expression as a string literal.
         * @param {string} text The string.
         * @return {string} The escaped string literal.
         */
        function escapeRegExp(text) {
            return text.replace(/[\-\[\]{}()*+?.,\\\^$|#]/g, '\\$&');
        }

        /**
         * Escapes special characters in a string to be used inside a regular
         * expression as a string literal. Also ensures that HTML entities will
         * be matched the same as their literal friends.
         * @param {string} body The string.
         * @return {string} The escaped string.
         */
        function escapeCodeAsRegExpForMatchingInsideHTML(body) {
            return escapeRegExp(body).replace('<', '(?:<|&lt;)').replace('>', '(?:>|&gt;)').replace('&', '(?:&|&amp;)').replace('"', '(?:"|&quot;)').replace(/\s+/g, '\\s+');
        }

        /**
         * Determines where a function was defined within the source code.
         * @param {(Function|string)} func A function reference or serialized
         * function definition.
         * @return {?Object.<string, (string|number)>} An object containing
         * the url, line, and column number of the defined function.
         */
        function findSourceByFunctionBody(func) {
            var urls = [win.location.href],
                scripts = doc.getElementsByTagName('script'),
                body,
                code = '' + func,
                codeRE = /^function(?:\s+([\w$]+))?\s*\(([\w\s,]*)\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/,
                eventRE = /^function on([\w$]+)\s*\(event\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/,
                re,
                parts;

            for (var i = 0; i < scripts.length; ++i) {
                var script = scripts[i];
                if (script.src) {
                    urls.push(script.src);
                }
            }

            if (!(parts = codeRE.exec(code))) {
                re = new RegExp(escapeRegExp(code).replace(/\s+/g, '\\s+'));
            }

            // not sure if this is really necessary, but I don’t have a test
            // corpus large enough to confirm that and it was in the original.
            else {
                var name = parts[1] ? '\\s+' + parts[1] : '',
                    args = parts[2].split(',').join('\\s*,\\s*');

                body = escapeRegExp(parts[3]).replace(/;$/, ';?'); // semicolon is inserted if the function ends with a comment.replace(/\s+/g, '\\s+');
                re = new RegExp('function' + name + '\\s*\\(\\s*' + args + '\\s*\\)\\s*{\\s*' + body + '\\s*}');
            }

            // look for an old-school event handler function
            if ((parts = eventRE.exec(code))) {
                var event = parts[1];
                body = escapeCodeAsRegExpForMatchingInsideHTML(parts[2]);

                // look for a function defined in HTML as an onXXX handler
                re = new RegExp('on' + event + '=[\\\'"]\\s*' + body + '\\s*[\\\'"]', 'i');

                // look for ???
                re = new RegExp(body);
            }

            return null;
        }

        // Contents of Exception in various browsers.
        //
        // SAFARI:
        // ex.message = Can't find variable: qq
        // ex.line = 59
        // ex.sourceId = 580238192
        // ex.sourceURL = http://...
        // ex.expressionBeginOffset = 96
        // ex.expressionCaretOffset = 98
        // ex.expressionEndOffset = 98
        // ex.name = ReferenceError
        //
        // FIREFOX:
        // ex.message = qq is not defined
        // ex.fileName = http://...
        // ex.lineNumber = 59
        // ex.stack = ...stack trace... (see the example below)
        // ex.name = ReferenceError
        //
        // CHROME:
        // ex.message = qq is not defined
        // ex.name = ReferenceError
        // ex.type = not_defined
        // ex.arguments = ['aa']
        // ex.stack = ...stack trace...
        //
        // INTERNET EXPLORER:
        // ex.message = ...
        // ex.name = ReferenceError
        //
        // OPERA:
        // ex.message = ...message... (see the example below)
        // ex.name = ReferenceError
        // ex.opera#sourceloc = 11  (pretty much useless, duplicates the info in ex.message)
        // ex.stacktrace = n/a; see 'opera:config#UserPrefs|Exceptions Have Stacktrace'

        /**
         * Computes stack trace information from the stack property.
         * Chrome and Gecko use this property.
         * @param {Error} ex
         * @return {?Object.<string, *>} Stack trace information.
         */
        function computeStackTraceFromStackProp(ex) {
            if (!ex.stack) {
                return null;
            }

            var chrome = /^\s*at (?:((?:\[object object\])?\S+) )?\(?((?:file|http|https):.*?):(\d+)(?::(\d+))?\)?\s*$/i,
                gecko = /^\s*(\S*)(?:\((.*?)\))?@((?:file|http|https).*?):(\d+)(?::(\d+))?\s*$/i,
                lines = ex.stack.split('\n'),
                stack = [],
                parts,
                element,
                reference = /^(.*) is undefined$/.exec(ex.message);

            for (var i = 0, j = lines.length; i < j; ++i) {
                if ((parts = gecko.exec(lines[i]))) {
                    element = {
                        'url': parts[3],
                        'func': parts[1] || UNKNOWN_FUNCTION,
                        'args': parts[2] ? parts[2].split(',') : '',
                        'line': +parts[4],
                        'column': parts[5] ? +parts[5] : null
                    };
                } else if ((parts = chrome.exec(lines[i]))) {
                    element = {
                        'url': parts[2],
                        'func': parts[1] || UNKNOWN_FUNCTION,
                        'line': +parts[3],
                        'column': parts[4] ? +parts[4] : null
                    };
                } else {
                    continue;
                }

                if (!element.func && element.line) {
                    element.func = UNKNOWN_FUNCTION;
                }

                if (element.line) {
                    element.context = null;
                }

                stack.push(element);
            }

            if (stack[0] && stack[0].line && !stack[0].column && reference) {
                stack[0].column = null;
            }

            if (!stack.length) {
                return null;
            }

            return {
                'mode': 'stack',
                'name': ex.name,
                'message': ex.message,
                'url': doc.location.href,
                'stack': stack,
                'useragent': nav.userAgent
            };
        }

        /**
         * Computes stack trace information from the stacktrace property.
         * Opera 10 uses this property.
         * @param {Error} ex
         * @return {?Object.<string, *>} Stack trace information.
         */
        function computeStackTraceFromStacktraceProp(ex) {
            // Access and store the stacktrace property before doing ANYTHING
            // else to it because Opera is not very good at providing it
            // reliably in other circumstances.
            var stacktrace = ex.stacktrace;

            var testRE = / line (\d+), column (\d+) in (?:<anonymous function: ([^>]+)>|([^\)]+))\((.*)\) in (.*):\s*$/i,
                lines = stacktrace.split('\n'),
                stack = [],
                parts;

            for (var i = 0, j = lines.length; i < j; i += 2) {
                if ((parts = testRE.exec(lines[i]))) {
                    var element = {
                        'line': +parts[1],
                        'column': +parts[2],
                        'func': parts[3] || parts[4],
                        'args': parts[5] ? parts[5].split(',') : [],
                        'url': parts[6]
                    };

                    if (!element.func && element.line) {
                        element.func = UNKNOWN_FUNCTION;
                    }
                    if (element.line) {
                        try {
                            element.context = null;
                        } catch (exc) {}
                    }

                    if (!element.context) {
                        element.context = [lines[i + 1]];
                    }

                    stack.push(element);
                }
            }

            if (!stack.length) {
                return null;
            }

            return {
                'mode': 'stacktrace',
                'name': ex.name,
                'message': ex.message,
                'url': doc.location.href,
                'stack': stack,
                'useragent': nav.userAgent
            };
        }

        /**
         * NOT TESTED.
         * Computes stack trace information from an error message that includes
         * the stack trace.
         * Opera 9 and earlier use this method if the option to show stack
         * traces is turned on in opera:config.
         * @param {Error} ex
         * @return {?Object.<string, *>} Stack information.
         */
        function computeStackTraceFromOperaMultiLineMessage(ex) {
            // Opera includes a stack trace into the exception message. An example is:
            //
            // Statement on line 3: Undefined variable: undefinedFunc
            // Backtrace:
            //   Line 3 of linked script file://localhost/Users/andreyvit/Projects/TraceKit/javascript-client/sample.js: In function zzz
            //         undefinedFunc(a);
            //   Line 7 of inline#1 script in file://localhost/Users/andreyvit/Projects/TraceKit/javascript-client/sample.html: In function yyy
            //           zzz(x, y, z);
            //   Line 3 of inline#1 script in file://localhost/Users/andreyvit/Projects/TraceKit/javascript-client/sample.html: In function xxx
            //           yyy(a, a, a);
            //   Line 1 of function script
            //     try { xxx('hi'); return false; } catch(ex) { TraceKit.report(ex); }
            //   ...

            var lines = ex.message.split('\n');
            if (lines.length < 4) {
                return null;
            }

            var lineRE1 = /^\s*Line (\d+) of linked script ((?:file|http|https)\S+)(?:: in function (\S+))?\s*$/i,
                lineRE2 = /^\s*Line (\d+) of inline#(\d+) script in ((?:file|http|https)\S+)(?:: in function (\S+))?\s*$/i,
                lineRE3 = /^\s*Line (\d+) of function script\s*$/i,
                stack = [],
                scripts = doc.getElementsByTagName('script'),
                inlineScriptBlocks = [],
                parts,
                i,
                len;

            for (i in scripts) {
                if (_has(scripts, i) && !scripts[i].src) {
                    inlineScriptBlocks.push(scripts[i]);
                }
            }

            for (i = 2, len = lines.length; i < len; i += 2) {
                var item = null;
                if ((parts = lineRE1.exec(lines[i]))) {
                    item = {
                        'url': parts[2],
                        'func': parts[3],
                        'line': +parts[1]
                    };
                } else if ((parts = lineRE2.exec(lines[i]))) {
                    item = {
                        'url': parts[3],
                        'func': parts[4]
                    };

                } else if ((parts = lineRE3.exec(lines[i]))) {
                    var url = win.location.href.replace(/#.*$/, ''),
                        line = parts[1];
                    item = {
                        'url': url,
                        'line': line,
                        'func': ''
                    };
                }

                if (item) {
                    if (!item.func) {
                        item.func = UNKNOWN_FUNCTION;
                    }

                    item.context = [lines[i + 1]];

                    stack.push(item);
                }
            }
            if (!stack.length) {
                return null; // could not parse multiline exception message as Opera stack trace
            }

            return {
                'mode': 'multiline',
                'name': ex.name,
                'message': lines[0],
                'url': doc.location.href,
                'stack': stack,
                'useragent': nav.userAgent
            };
        }

        // XXX: Original: augmentStackTaceWithInitialElement.
        /**
         * Adds information about the first frame to incomplete stack traces.
         * Safari and IE require this to get complete data on the first frame.
         * @param {Object.<string, *>} stackInfo Stack trace information from
         * one of the compute* methods.
         * @param {string} url The URL of the script that caused an error.
         * @param {(number|string)} lineNo The line number of the script that
         * caused an error.
         * @param {string=} message The error generated by the browser, which
         * hopefully contains the name of the object that caused the error.
         * @return {boolean} Whether or not the stack information was
         * augmented.
         */
        function aSTWIE(stackInfo, url, lineNo, message) {
            var initial = {
                'url': url,
                'line': lineNo
            };

            if (initial.url && initial.line) {
                stackInfo.incomplete = false;

                if (!initial.func) {
                    initial.func = UNKNOWN_FUNCTION;
                }

                if (!initial.context) {
                    initial.context = null;
                }

                var reference = / '([^']+)' /.exec(message);
                if (reference) {
                    initial.column = null;
                }

                if (stackInfo.stack.length > 0) {
                    if (stackInfo.stack[0].url === initial.url) {
                        if (stackInfo.stack[0].line === initial.line) {
                            return false; // already in stack trace
                        } else if (!stackInfo.stack[0].line && stackInfo.stack[0].func === initial.func) {
                            stackInfo.stack[0].line = initial.line;
                            stackInfo.stack[0].context = initial.context;
                            return false;
                        }
                    }
                }

                stackInfo.stack.unshift(initial);
                stackInfo.partial = true;
                return true;
            } else {
                stackInfo.incomplete = true;
            }

            return false;
        }

        /**
         * Computes stack trace information by walking the arguments.caller
         * chain at the time the exception occurred. This will cause earlier
         * frames to be missed but is the only way to get any stack trace in
         * Safari and IE. The top frame is restored by
         * {@link aSTWIE}.
         * @param {Error} ex
         * @return {?Object.<string, *>} Stack trace information.
         */
        function computeStackTraceByWalkingCallerChain(ex, depth) {
            var functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i,
                stack = [],
                funcs = {},
                recursion = false,
                parts,
                item,
                source;

            for (var curr = computeStackTraceByWalkingCallerChain.caller; curr && !recursion; curr = curr.caller) {
                if (curr === cST || curr === TraceKit.report) {
                    // console.log('skipping internal function');
                    continue;
                }

                item = {
                    'url': null,
                    'func': UNKNOWN_FUNCTION,
                    'line': null,
                    'column': null
                };

                if (curr.name) {
                    item.func = curr.name;
                } else if ((parts = functionName.exec(curr.toString()))) {
                    item.func = parts[1];
                }

                if ((source = findSourceByFunctionBody(curr))) {
                    item.url = source.url;
                    item.line = source.line;

                    var reference = / '([^']+)' /.exec(ex.message || ex.description);
                    if (reference) {
                        item.column = null;
                    }
                }

                if (funcs['' + curr]) {
                    recursion = true;
                }else{
                    funcs['' + curr] = true;
                }

                stack.push(item);
            }

            if (depth) {
                // console.log('depth is ' + depth);
                // console.log('stack is ' + stack.length);
                stack.splice(0, depth);
            }

            var result = {
                'mode': 'callers',
                'name': ex.name,
                'message': ex.message,
                'url': doc.location.href,
                'stack': stack,
                'useragent': nav.userAgent
            };
            aSTWIE(result, ex.sourceURL || ex.fileName, ex.line || ex.lineNumber, ex.message || ex.description);
            return result;
        }

        /**
         * Computes a stack trace for an exception.
         * @param {Error} ex
         * @param {(string|number)=} depth
         */
        function cST(ex, depth) {
            var stack = null;
            depth = (depth === null ? 0 : +depth);

            try {
                // This must be tried first because Opera 10 *destroys*
                // its stacktrace property if you try to access the stack
                // property first!!
                stack = computeStackTraceFromStacktraceProp(ex);
                if (stack) {
                    return stack;
                }
            } catch (e) {
                if (debug) {
                    throw e;
                }
            }

            try {
                stack = computeStackTraceFromStackProp(ex);
                if (stack) {
                    return stack;
                }
            } catch (e) {
                if (debug) {
                    throw e;
                }
            }

            try {
                stack = computeStackTraceFromOperaMultiLineMessage(ex);
                if (stack) {
                    return stack;
                }
            } catch (e) {
                if (debug) {
                    throw e;
                }
            }

            try {
                stack = computeStackTraceByWalkingCallerChain(ex, depth + 1);
                if (stack) {
                    return stack;
                }
            } catch (e) {
                if (debug) {
                    throw e;
                }
            }

            return {
                'mode': 'failed'
            };
        }

        /**
         * Logs a stacktrace starting from the previous call and working down.
         * @param {(number|string)=} depth How many frames deep to trace.
         * @return {Object.<string, *>} Stack trace information.
         */
        function computeStackTraceOfCaller(depth) {
            depth = (depth === null ? 0 : +depth) + 1; // "+ 1" because "ofCaller" should drop one frame
            try {
                throw new Error();
            } catch (ex) {
                return cST(ex, depth + 1);
            }

            return null;
        }

        cST.aSTWIE = aSTWIE;
        cST.ofCaller = computeStackTraceOfCaller;

        return cST;
    }());

    /**
     * Extends support for global error handling for asynchronous browser
     * functions. Adopted from Closure Library's errorhandler.js
     */
    (function extendToAsynchronousCallbacks() {
        var _helper = function _helper(fnName) {
            var originalFn = win[fnName];
            win[fnName] = function traceKitAsyncExtension() {
                // Make a copy of the arguments
                var args = _slice.call(arguments);
                var originalCallback = args[0];
                if (typeof (originalCallback) === 'function') {
                    args[0] = TraceKit.wrap(originalCallback);
                }
                // IE < 9 doesn't support .call/.apply on setInterval/setTimeout, but it
                // also only supports 2 argument and doesn't care what "this" is, so we
                // can just call the original function directly.
                if (originalFn.apply) {
                    return originalFn.apply(this, args);
                } else {
                    return originalFn(args[0], args[1]);
                }
            };
        };

        _helper('setTimeout');
        _helper('setInterval');
    }());


    return TraceKit;
});

/* This module takes care of intercepting unhandled crashes in the client
 * application code. Provides functions for catching exceptions, formatting
 * the stacktrace info and preparing Apphance "crash" message.
 */
define('aph/crash',[
    "v/tracekit",
    "aph/msg",
    "aph/core",
    "jq",
    "aph/log",
    "aph/util",
    "aph/console",
    "aph/store",
    "v/us"
], function(TK, Msg, Core, $, Log, Util, Console, Store, _) {
    


    // Cache reference to previously defined onerror handler.
    // This way after the session is finished we can do the clean up.
    var _oldOneError;
    try {
        _oldOneError = window.onerror;
    } catch(e) {}


    /* Attach to window "onerror" event using TraceKit library.
     * This way we can intercept unhandled client application crashes.
     */
    var interceptCrashes = function() {
        // Enable TraceKit, give it error callback.
        TK.report.subscribe(handleError);
    };


    /* Function called by TraceKit when it catches the exception.
     * It receives special `stackInfo` object containing all the info about
     * the crash.
     */
    var handleError = function(stackInfo) {
        var rawStack = stackInfo.stack;
        var traceBack, line, funName;

        // No stack frames where collected, ignore this error.
        if(!rawStack || rawStack.length < 1) { return; }

        // Try extracting needed data from TraceKit info object.
        if(stackInfo.mode === "onerror") {  // For window "onerror" events.
            // There is always one frame.
            traceBack = formatFrame(rawStack[0]);
        } else {  // For normal error catching.
            // Join multiple frames to get traceback.
            traceBack = "";
            _.each(rawStack, function(frame) {
                // Ignore unimportant frames.
                if(!checkFrame(frame)) { return; }

                traceBack += formatFrame(frame) + "\n";
            });
        }

        // Error location: line number and function.
        line = rawStack[0].line;
        funName = rawStack[0].func;

        // Prepare ISSUE (CRASH) message.
        var issueMessage = Msg.issue({
            message: stackInfo.message,
            debug_info: {
                file: stackInfo.url,
                line: line,
                stacktrace: traceBack,
                "function": funName
            }
        });

        // Store message in current session's message queue.
        Store.message(issueMessage);
    };


    var _rAph = /apphance\.(min\.)?js/;
    /* Detects frames that shouldn't be included in final traceback, i.e.
     * frames from Apphance SDK components or exclusion list (TODO).
     * Return `true` for important frame and `false` for frame to be excluded.
     */
    var checkFrame = function(frame) {
        // Ignore empty frames.
        if(!frame) { return; }

        // Ignore frames in built Apphance library.
        return !_rAph.test(frame.url);
    };


    /* Format traceback line.
     * Output format is:
     * <url> : <line number> , <column number>   <function name>
     * Column number and/or function name may be missing if TraceKit has
     * no information about it.
     */
    var formatFrame = function(frame) {
        // Disregard empty frame objects.
        if(!frame) { return ""; }

        var line;

        // Start with source file URL and line where error occurred.
        line = frame.url + ":" + frame.line;

        // Add column number if present.
        if(frame.column) {
            line += "," + frame.column;
        }

        // Visually separate location from function name.
        line += "\t\t\t";

        // Add function name if present.
        if(frame.func) {
            line += frame.func;
        } else {
            line += "(unknown function)";
        }

        return line;
    };


    // Stop intercepting errors and restore original state.
    var stopIntercept = function() {
        TK.report.unsubscribe(handleError);

        // Restore original onerror function.
        try {
            window.onerror = _oldOneError;
        } catch(e) {}
    };


    /* Handle exception manually provided by client application developer.
     * For the full traceback to be present `exc` has to be an `Error` object.
     * Passing a string will have limited results.
     */
    var reportException = function(exc) {
        // String instead of Error -- just pass as an "error" log message.
        if(typeof exc === "string") {
            return Log.error(exc);
        }

        try {
            // Pass exception through TraceKit so it's parsed to a stackInfo
            // object and then passed to `handleError`.
            TK.report(exc);
        } catch(e2) {
            // As in Raven.js: TraceKit is transparent (re-throws exceptions)
            // we suppress caught exceptions and only throw different ones,
            // i.e. due to internal errors in TraceKit or Apphance SDK.
            if(e2 !== exc) {
                throw e2;
            }
        }
    };


    // Guard function by wrapping it with exception handler.
    var guardFun = function(fun) {
        // If provided object is not a function return empty function & log.
        if(!_.isFunction(fun)) {
            Console.error("Aph: Tried to guard object that isn't a function.");
            return Util.noOp;
        }

        return function() {
            // Call given function usually...
            try {
                // "this" is internal function object.
                fun.apply(this, arguments);
            } catch(e) {  // ... report any exception via TraceKit.
                reportException(e);
            }
        };
    };


    return {
        start: interceptCrashes,
        stop: stopIntercept,
        report: reportException,
        guard: guardFun,
        // Expose for testing purposes.
        _hE: handleError,
        _fF: formatFrame,
        _cF: checkFrame
    };
});

/* This module handles persisting (in WebStorage), loading and clearing
 * current session's parameters.
 * It allows the client application to reload/navigate without starting
 * new Apphance session each time.
 * The persisted state is cleared each time the application exits.
 */
define('aph/state',[
    "aph/core",
    "aph/store",
    "aph/util"
], function(Core, Store, Util) {
    


    // Storage key for session state.
    var stateKey = "aph:state";


    // Save session state to use the same settings throughout whole application.
    var saveState = function() {
        // WebStorage requires string value.
        var data = Util.dump(Core);

        // Use the most compatible syntax.
        window.sessionStorage.setItem(stateKey, data);
        // Save session parameters to a file as well.
        Store.params(data);
    };


    // Clear stored session state.
    var clearState = function() {
        window.sessionStorage.removeItem(stateKey);
    };


    // Load previously initialized session.
    var loadState = function() {
        var data = window.sessionStorage.getItem(stateKey);
        if(!data) { return; }  // No session stored.

        return Util.load(data);
    };


    return {
        save: saveState,
        clear: clearState,
        load: loadState,
        // Exposed for testing.
        _sK: stateKey
    };
});

/* This module takes care about processing offline sessions and uploading
 * them to the server.
 * An offline session is either:
 * a) session started without connection to the server (no identify/login process).
 * b) session fully started (with login) but switched to offline due to missing network connection.
 */
define('aph/offline',[
    "aph/fs",
    "aph/core",
    "aph/store",
    "aph/util",
    "aph/console",
    "aph/net",
    "aph/conds"
], function(FS, Core, Store, Util, Console, Net, Conds) {
    


    /* Find previous (offline) sessions
     * Process and submit messages if necessary.
     * Clean processed and empty sessions.
     */
    var syncPreviousSessions = function() {
        // Access Apphance sessions directory.
        FS.getContainer(function(dir) {
            // Read directory contents.
            FS.readDir(dir, processSessions);
        });
    };


    // Work on gathered session directory entries.
    var processSessions = function(sessions) {
        // Filter out current (active) session.
        for(var i=0; i<sessions.length; i++) {
            var entry = sessions[i];
            // Compare with current session's timestamp.
            if(entry.name !== ("" + Core.ts))  {
                // Previous session, can be processed
                processOne(entry);
            }
        }
    };


    // Handle single session case (submission/removal).
    var processOne = function(sessionDir) {
        // Read session parameters.
        FS.readParams(function(paramsText) {
            var params = Util.load(paramsText);

            if(!params || !params.applicationKey) {
                Console.warn("Aph: Incorrect session (no parameters): " +
                    sessionDir.name);
                // This session is incorrect, remove it.
                return removeSession(sessionDir);
            }

            // Session started online, finished offline.
            if(params._li) {
                // Access session's outbox.
                _accessMessages(sessionDir, params);
            } else {
                // Full offline session, needs a login call.
                _upgradeSession(sessionDir, params);
            }
        }, sessionDir);
    };


    // processOne continued: read stored messages and follow through.
    var _accessMessages = function(sessionDir, params) {
        FS.readOutbox(function(entries) {
            if(!entries.length) {
                // Session has no useful info, remove it at once.
                removeSession(sessionDir);
            } else {
                // Session has unsent message files, submit them.
                _submitMessages(entries, params);
            }
        }, sessionDir);
    };


    // processOne continued: read and submit messages to the server.
    var _submitMessages = function(entries, params) {
        for(var i=0; i<entries.length; i++) {
            var entry = entries[i];

            // Submit message file using common function with `Core` overridden.
            Store.submit(entry, _afterSubmitFactory(entry), params);
        }
    };


    /* Clean sent message file. Factory function is needed to pass entry object.
     * Note: Empty session will be automatically deleted on next application run.
     */
    var _afterSubmitFactory = function(entry) {
        return function() {
            entry.remove(Util.noOp, FS.fileError);
        };
    };


    // Remove whole session contents from the filesystem.
    var removeSession = function(entry, success) {
        // Safe callback.
        success = success || Util.noOp;
        entry.removeRecursively(success, FS.fileError);
    };


    // Get offline session through a login step, then continue processing.
    var _upgradeSession = function(sessionDir, params) {
        // Access stored conditions first for login process.
        FS.readConds(function(condsText) {
            var condsObj = Util.load(condsText);

            if(!condsObj) {
                Console.warn("Aph: Incorrect session (no conditions): " +
                    sessionDir.name);
                // Again, incorrect session, remove it.
                return removeSession(sessionDir);
            }

            // Filter retrieved conditions, force system category.
            condsObj = Conds.filter(condsObj, true);

            // Proceed to the login.
            _loginSession(sessionDir, params, condsObj);
        }, sessionDir);
    };


    // Do the login step for fully offline session.
    var _loginSession = function(sessionDir, params, conds) {
        Net.login(function(data) {
            // Make short "after login" step.
            params.session_key = data.session_key;
            params._li = true;
            Util.bootstrap(params, data);

            // Proceed with standard submission flow.
            _accessMessages(sessionDir, params);
        }, Util.noOp, conds, params);
    };


    return {
        sync: syncPreviousSessions
    };
});

/* This modules contains functions for watching continuously changing
 * environment conditions. With a help of `Conds` and `Store` modules
 * this allows for logging of changes in condition throughout Apphance session.
 */
define('aph/watch',[
    "aph/conds",
    "aph/msg",
    "aph/store"
], function(Conds, Msg, Store) {
    


    // Calculate difference between position info, save condition message if necessary.
    var locationWatcher = function(fresh, old) {
        var changeLat = Math.abs(fresh.latitude - old.latitude);
        var changeLon = Math.abs(fresh.longitude - old.longitude);
        var margin = 0.005;

        // Ignore changes too small.
        if(changeLat < margin && changeLon < margin) { return; }

        // Persist this condition change.
        _formatAndStore("location", Conds.f.location(fresh));
    };


    var batteryWatcher = function(info) {
        _formatAndStore("power", Conds.f.power(info));
    };


    var networkingWatcher = function(fresh, old) {
        if(!old || !fresh) { return; }  // Ignore empty initial/new value.
        if(fresh === old) { return; }  // No changes.

        // Persist this condition change.
        _formatAndStore("networking", Conds.f.networking(fresh));
    };


    // Format condition message and send it to storage.
    var _formatAndStore = function(category, data) {
        var condObj = {};
        condObj[category] = data;
        var m = Msg.condition(condObj);
        Store.message(m);
    };


    /* Handle conditions changing during session.
     * Register watcher functions for async conditions.
     * Start polling in `conds` module.
     */
    var startWatching = function() {
        Conds.register("location", locationWatcher);
        Conds.register("battery", batteryWatcher);
        Conds.register("networking", networkingWatcher);

        Conds.poll();
    };


    // Stop watching for conditions changes and do a clean up.
    var stopWatching = function() {
        Conds.cleanUp();
        Conds.unregister();
    };


    return {
        start: startWatching,
        stop: stopWatching
    };
});

define('aph/touch',[
    'jq',
    'v/us'
], function ($, _) {
    

    var ongoingTouches = [];
    var offset = {
        x: 0,
        y: 0
    };

    var getRelativePoint = function (x, y) {
        return {
            x: x - offset.x,
            y: y - offset.y
        };
    };

    var getCoordinates = function (touch) {
        var idx = ongoingTouchIndexById(touch.identifier);

        if (idx < 0) {
            return null;
        }

        var begin = getRelativePoint(
            ongoingTouches[idx].clientX,
            ongoingTouches[idx].clientY
        );

        var end = getRelativePoint(
            touch.clientX,
            touch.clientY
        );

        return {
            begin: begin,
            end: end,
            idx: idx
        };

    };

    var copyTouch = function (touch) {
        return {
            identifier: touch.identifier,
            clientX: touch.clientX,
            clientY: touch.clientY
        };
    };

    var ongoingTouchIndexById = function (idToFind) {
        for (var i = 0; i < ongoingTouches.length; i++) {
            if (ongoingTouches[i].identifier === idToFind) {
                return i;
            }
        }
        return -1; // not found
    };

    var touchIsInsideArea = function (touch, width, height) {
        return touch.clientX-offset.x > 0 &&
               touch.clientY-offset.y > 0 &&
               touch.clientX-offset.x < parseInt(width, 10) &&
               touch.clientY-offset.y < parseInt(height, 10);
    };

    var handleTouch = function (element, callback, event, handler) {
        event.preventDefault();
        _.each(event.changedTouches, function (touch) {
            // Touch is inside handler element
            if (touchIsInsideArea(touch, element.width, element.height)) {
                // Touch type specific code
                handler(touch);
            }
        });
    };

    ////////////////////
    // Touch Handlers //
    ////////////////////
    var handleStart = function (element, callback, evt) {
        handleTouch(element, callback, evt, function (touch) {
            // Add touch to current touches
            ongoingTouches.push(copyTouch(touch));
            // Call callback with only `begin` param
            var begin = getRelativePoint(touch.clientX, touch.clientY);
            callback(begin);
        });
    };

    var handleMove = function (element, callback, evt) {
        handleTouch(element, callback, evt, function (touch) {
            // Get `begin` and `end` coordinates of touch move.
            var coords = getCoordinates(touch);
            if (coords) {
                // Call handler callback, probably draw something
                callback(coords.begin, coords.end);

                // swap in the new touch record; we must copy touch first, as
                // it can be garbage-collected by native webview (on iOS this
                // touch object is removed, thus we provide wrong coordinates
                // for next move events)
                ongoingTouches.splice(coords.idx, 1, copyTouch(touch));
            } else {
                console.log("can't figure out which touch to continue");
            }
        });
    };

    var handleEnd = function (element, callback, evt) {
        handleTouch(element, callback, evt, function (touch) {
            // Get `begin` and `end` coordinates of touch move.
            var coords = getCoordinates(touch);
            if (coords) {
                // Call handler callback, probably draw something
                callback(coords.begin, coords.end);

                // remove touch; we're done
                ongoingTouches.splice(coords.idx, 1);
            } else {
                console.log("can't figure out which touch to continue");
            }
        });
    };

    var handleCancel = function (element, callback, evt) {
        evt.preventDefault();
        // cancel all touches
        ongoingTouches.splice(0, ongoingTouches.length);
    };


    ////////////
    // Events //
    ////////////
    var bindTouchEvents = function (element, callback) {
        element.addEventListener("touchstart", _.partial(handleStart, element, callback), false);
        element.addEventListener("touchmove", _.partial(handleMove, element, callback), false);
        element.addEventListener("touchleave", _.partial(handleEnd, element, callback), false);
        element.addEventListener("touchend", _.partial(handleEnd, element, callback), false);
        element.addEventListener("touchcancel", _.partial(handleCancel, element, callback), false);
    };

    var removeTouchEvents = function (element) {
        element.removeEventListener("touchstart");
        element.removeEventListener("touchmove");
        element.removeEventListener("touchleave");
        element.removeEventListener("touchend");
        element.removeEventListener("touchcancel");
    };


    return {
        register: bindTouchEvents,
        unregister: removeTouchEvents,
        // exposed for tests
        _gc: getCoordinates,
        _ct: copyTouch,
        _tia: touchIsInsideArea,
        _offset: offset,
        _hs: handleStart,
        _hm: handleMove,
        _he: handleEnd,
        _hc: handleCancel,
        _ot: ongoingTouches
    };
});

/*
    html2canvas 0.4.0 <http://html2canvas.hertzen.com>
    Copyright (c) 2013 Niklas von Hertzen (@niklasvh)

    Released under MIT License
*/
define('v/h2c',["v/us"], function(_) {
    

    var _html2canvas = {},
    previousElement,
    computedCSS;

    // For better minification.
    var DOCUMENT = document;
    var WINDOW = window;

    function h2clog() {
        // Removed logging.
    }

    _html2canvas.Util = {};

    _html2canvas.Util.trimText = (function(isNative) {
        return function(input) {
            if (isNative) {
                return isNative.apply(input);
            } else {
                return ((input || '') + '').replace(/^\s+|\s+$/g, '');
            }
        };
    })(String.prototype.trim);

    _html2canvas.Util.parseBackgroundImage = function(value) {
        var whitespace = ' \r\n\t',
            method, definition, prefix, prefix_i, block, results = [],
            c, mode = 0,
            numParen = 0,
            quote, args;

        var appendResult = function() {
            if (method) {
                if (definition.substr(0, 1) === '"') {
                    definition = definition.substr(1, definition.length - 2);
                }
                if (definition) {
                    args.push(definition);
                }
                if (method.substr(0, 1) === '-' && (prefix_i = method.indexOf('-', 1) + 1) > 0) {
                    prefix = method.substr(0, prefix_i);
                    method = method.substr(prefix_i);
                }
                results.push({
                    prefix: prefix,
                    method: method.toLowerCase(),
                    value: block,
                    args: args
                });
            }
            args = []; //for some odd reason, setting .length = 0 didn't work in safari
            method = prefix = definition = block = '';
        };

        appendResult();
        for (var i = 0, ii = value.length; i < ii; i++) {
            c = value[i];
            if (mode === 0 && whitespace.indexOf(c) > -1) {
                continue;
            }
            switch (c) {
                case '"':
                    if (!quote) {
                        quote = c;
                    } else if (quote === c) {
                        quote = null;
                    }
                    break;

                case '(':
                    if (quote) {
                        break;
                    } else if (mode === 0) {
                        mode = 1;
                        block += c;
                        continue;
                    } else {
                        numParen++;
                    }
                    break;

                case ')':
                    if (quote) {
                        break;
                    } else if (mode === 1) {
                        if (numParen === 0) {
                            mode = 0;
                            block += c;
                            appendResult();
                            continue;
                        } else {
                            numParen--;
                        }
                    }
                    break;

                case ',':
                    if (quote) {
                        break;
                    } else if (mode === 0) {
                        appendResult();
                        continue;
                    } else if (mode === 1) {
                        if (numParen === 0 && !method.match(/^url$/i)) {
                            args.push(definition);
                            definition = '';
                            block += c;
                            continue;
                        }
                    }
                    break;
            }

            block += c;
            if (mode === 0) {
                method += c;
            } else {
                definition += c;
            }
        }
        appendResult();

        return results;
    };

    _html2canvas.Util.Bounds = function getBounds(el) {
        var clientRect,
        bounds = {};

        if (el.getBoundingClientRect) {
            clientRect = el.getBoundingClientRect();


            // TODO add scroll position to bounds, so no scrolling of window necessary
            bounds.top = clientRect.top;
            bounds.bottom = clientRect.bottom || (clientRect.top + clientRect.height);
            bounds.left = clientRect.left;

            // older IE doesn't have width/height, but top/bottom instead
            bounds.width = clientRect.width || (clientRect.right - clientRect.left);
            bounds.height = clientRect.height || (clientRect.bottom - clientRect.top);

            return bounds;

        }
    };

    _html2canvas.Util.getCSS = function(el, attribute, index) {
        // return $(el).css(attribute);

        var val,
        isBackgroundSizePosition = attribute.match(/^background(Size|Position)$/);

        function toPX(attribute, val) {
            var rsLeft = el.runtimeStyle && el.runtimeStyle[attribute],
                left,
                style = el.style;

            // Check if we are not dealing with pixels, (Opera has issues with this)
            // Ported from jQuery css.js
            // From the awesome hack by Dean Edwards
            // http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

            // If we're not dealing with a regular pixel number
            // but a number that has a weird ending, we need to convert it to pixels

            if (!/^-?[0-9]+\.?[0-9]*(?:px)?$/i.test(val) && /^-?\d/.test(val)) {

                // Remember the original values
                left = style.left;

                // Put in the new values to get a computed value out
                if (rsLeft) {
                    el.runtimeStyle.left = el.currentStyle.left;
                }
                style.left = attribute === "fontSize" ? "1em" : (val || 0);
                val = style.pixelLeft + "px";

                // Revert the changed values
                style.left = left;
                if (rsLeft) {
                    el.runtimeStyle.left = rsLeft;
                }

            }

            if (!/^(thin|medium|thick)$/i.test(val)) {
                return Math.round(parseFloat(val)) + "px";
            }

            return val;
        }

        if (previousElement !== el) {
            computedCSS = DOCUMENT.defaultView.getComputedStyle(el, null);
        }
        val = computedCSS[attribute];

        if (isBackgroundSizePosition) {
            val = (val || '').split(',');
            val = val[index || 0] || val[0] || 'auto';
            val = _html2canvas.Util.trimText(val).split(' ');

            if (attribute === 'backgroundSize' && (!val[0] || val[0].match(/cover|contain|auto/))) {
                //these values will be handled in the parent function

            } else {
                val[0] = (val[0].indexOf("%") === -1) ? toPX(attribute + "X", val[0]) : val[0];
                if (val[1] === undefined) {
                    if (attribute === 'backgroundSize') {
                        val[1] = 'auto';
                        return val;
                    } else {
                        // IE 9 doesn't return double digit always
                        val[1] = val[0];
                    }
                }
                val[1] = (val[1].indexOf("%") === -1) ? toPX(attribute + "Y", val[1]) : val[1];
            }
        } else if (/border(Top|Bottom)(Left|Right)Radius/.test(attribute)) {
            var arr = val.split(" ");
            if (arr.length <= 1) {
                arr[1] = arr[0];
            }
            arr[0] = parseInt(arr[0], 10);
            arr[1] = parseInt(arr[1], 10);
            val = arr;
        }

        return val;
    };

    _html2canvas.Util.resizeBounds = function(current_width, current_height, target_width, target_height, stretch_mode) {
        var target_ratio = target_width / target_height,
            current_ratio = current_width / current_height,
            output_width, output_height;

        if (!stretch_mode || stretch_mode === 'auto') {
            output_width = target_width;
            output_height = target_height;

        } else {
            if (target_ratio < current_ratio ^ stretch_mode === 'contain') {
                output_height = target_height;
                output_width = target_height * current_ratio;
            } else {
                output_width = target_width;
                output_height = target_width / current_ratio;
            }
        }

        return {
            width: output_width,
            height: output_height
        };
    };

    function backgroundBoundsFactory(prop, el, bounds, image, imageIndex, backgroundSize) {
        var bgposition = _html2canvas.Util.getCSS(el, prop, imageIndex),
            topPos,
            left,
            percentage,
            val;

        if (bgposition.length === 1) {
            val = bgposition[0];

            bgposition = [];

            bgposition[0] = val;
            bgposition[1] = val;
        }

        if (bgposition[0].toString().indexOf("%") !== -1) {
            percentage = (parseFloat(bgposition[0]) / 100);
            left = bounds.width * percentage;
            if (prop !== 'backgroundSize') {
                left -= (backgroundSize || image).width * percentage;
            }

        } else {
            if (prop === 'backgroundSize') {
                if (bgposition[0] === 'auto') {
                    left = image.width;

                } else {
                    if (bgposition[0].match(/contain|cover/)) {
                        var resized = _html2canvas.Util.resizeBounds(image.width, image.height, bounds.width, bounds.height, bgposition[0]);
                        left = resized.width;
                        topPos = resized.height;
                    } else {
                        left = parseInt(bgposition[0], 10);
                    }
                }

            } else {
                left = parseInt(bgposition[0], 10);
            }
        }


        if (bgposition[1] === 'auto') {
            topPos = left / image.width * image.height;
        } else if (bgposition[1].toString().indexOf("%") !== -1) {
            percentage = (parseFloat(bgposition[1]) / 100);
            topPos = bounds.height * percentage;
            if (prop !== 'backgroundSize') {
                topPos -= (backgroundSize || image).height * percentage;
            }

        } else {
            topPos = parseInt(bgposition[1], 10);
        }

        return [left, topPos];
    }

    _html2canvas.Util.BackgroundPosition = function(el, bounds, image, imageIndex, backgroundSize) {
        var result = backgroundBoundsFactory('backgroundPosition', el, bounds, image, imageIndex, backgroundSize);
        return {
            left: result[0],
            top: result[1]
        };
    };
    _html2canvas.Util.BackgroundSize = function(el, bounds, image, imageIndex) {
        var result = backgroundBoundsFactory('backgroundSize', el, bounds, image, imageIndex);
        return {
            width: result[0],
            height: result[1]
        };
    };

    _html2canvas.Util.Extend = function(options, defaults) {
        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                defaults[key] = options[key];
            }
        }
        return defaults;
    };


    /*
     * Derived from jQuery.contents()
     * Copyright 2010, John Resig
     * Dual licensed under the MIT or GPL Version 2 licenses.
     * http://jquery.org/license
     */
    _html2canvas.Util.Children = function(elem) {


        var children;
        try {

            children = (elem.nodeName && elem.nodeName.toUpperCase() === "IFRAME") ? elem.contentDocument || elem.contentWindow.document : (function(array) {
                var ret = [];

                if (array !== null) {

                    (function(first, second) {
                        var i = first.length,
                            j = 0;

                        if (typeof second.length === "number") {
                            for (var l = second.length; j < l; j++) {
                                first[i++] = second[j];
                            }

                        } else {
                            while (second[j] !== undefined) {
                                first[i++] = second[j++];
                            }
                        }

                        first.length = i;

                        return first;
                    })(ret, array);

                }

                return ret;
            })(elem.childNodes);

        } catch (ex) {
            h2clog("html2canvas.Util.Children failed with exception: " + ex.message);
            children = [];
        }
        return children;
    };

    _html2canvas.Util.Font = (function() {

        var fontData = {};

        return function(font, fontSize, doc) {
            if (fontData[font + "-" + fontSize] !== undefined) {
                return fontData[font + "-" + fontSize];
            }

            var container = doc.createElement('div'),
                img = doc.createElement('img'),
                span = doc.createElement('span'),
                sampleText = 'Hidden Text',
                baseline,
                middle,
                metricsObj;

            container.style.visibility = "hidden";
            container.style.fontFamily = font;
            container.style.fontSize = fontSize;
            container.style.margin = 0;
            container.style.padding = 0;

            doc.body.appendChild(container);

            // http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever (handtinywhite.gif)
            img.src = "data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";
            img.width = 1;
            img.height = 1;

            img.style.margin = 0;
            img.style.padding = 0;
            img.style.verticalAlign = "baseline";

            span.style.fontFamily = font;
            span.style.fontSize = fontSize;
            span.style.margin = 0;
            span.style.padding = 0;

            span.appendChild(doc.createTextNode(sampleText));
            container.appendChild(span);
            container.appendChild(img);
            baseline = (img.offsetTop - span.offsetTop) + 1;

            container.removeChild(span);
            container.appendChild(doc.createTextNode(sampleText));

            container.style.lineHeight = "normal";
            img.style.verticalAlign = "super";

            middle = (img.offsetTop - container.offsetTop) + 1;
            metricsObj = {
                baseline: baseline,
                lineWidth: 1,
                middle: middle
            };

            fontData[font + "-" + fontSize] = metricsObj;

            doc.body.removeChild(container);

            return metricsObj;
        };
    })();

    (function() {

        _html2canvas.Generate = {};

        var reGradients = [
            /^(-webkit-linear-gradient)\(([a-z\s]+)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-o-linear-gradient)\(([a-z\s]+)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-webkit-gradient)\((linear|radial),\s((?:\d{1,3}%?)\s(?:\d{1,3}%?),\s(?:\d{1,3}%?)\s(?:\d{1,3}%?))([\w\d\.\s,%\(\)\-]+)\)$/,
            /^(-moz-linear-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?))([\w\d\.\s,%\(\)]+)\)$/,
            /^(-webkit-radial-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?)),\s(\w+)\s([a-z\-]+)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-moz-radial-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?)),\s(\w+)\s?([a-z\-]*)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-o-radial-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?)),\s(\w+)\s([a-z\-]+)([\w\d\.\s,%\(\)]+)\)$/];

        /*
         * TODO: Add IE10 vendor prefix (-ms) support
         * TODO: Add W3C gradient (linear-gradient) support
         * TODO: Add old Webkit -webkit-gradient(radial, ...) support
         * TODO: Maybe some RegExp optimizations are possible ;o)
         */
        _html2canvas.Generate.parseGradient = function(css, bounds) {
            var gradient, i, len = reGradients.length,
                m1, stop, m2, m2Len, step, m3, tl, tr, br, bl;

            for (i = 0; i < len; i += 1) {
                m1 = css.match(reGradients[i]);
                if (m1) {
                    break;
                }
            }

            if (m1) {
                switch (m1[1]) {
                    case '-webkit-linear-gradient':
                    case '-o-linear-gradient':

                        gradient = {
                            type: 'linear',
                            x0: null,
                            y0: null,
                            x1: null,
                            y1: null,
                            colorStops: []
                        };

                        // get coordinates
                        m2 = m1[2].match(/\w+/g);
                        if (m2) {
                            m2Len = m2.length;
                            for (i = 0; i < m2Len; i += 1) {
                                switch (m2[i]) {
                                    case 'top':
                                        gradient.y0 = 0;
                                        gradient.y1 = bounds.height;
                                        break;

                                    case 'right':
                                        gradient.x0 = bounds.width;
                                        gradient.x1 = 0;
                                        break;

                                    case 'bottom':
                                        gradient.y0 = bounds.height;
                                        gradient.y1 = 0;
                                        break;

                                    case 'left':
                                        gradient.x0 = 0;
                                        gradient.x1 = bounds.width;
                                        break;
                                }
                            }
                        }
                        if (gradient.x0 === null && gradient.x1 === null) { // center
                            gradient.x0 = gradient.x1 = bounds.width / 2;
                        }
                        if (gradient.y0 === null && gradient.y1 === null) { // center
                            gradient.y0 = gradient.y1 = bounds.height / 2;
                        }

                        // get colors and stops
                        m2 = m1[3].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)(?:\s\d{1,3}(?:%|px))?)+/g);
                        if (m2) {
                            m2Len = m2.length;
                            step = 1 / Math.max(m2Len - 1, 1);
                            for (i = 0; i < m2Len; i += 1) {
                                m3 = m2[i].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%|px)?/);
                                if (m3[2]) {
                                    stop = parseFloat(m3[2]);
                                    if (m3[3] === '%') {
                                        stop /= 100;
                                    } else { // px - stupid opera
                                        stop /= bounds.width;
                                    }
                                } else {
                                    stop = i * step;
                                }
                                gradient.colorStops.push({
                                    color: m3[1],
                                    stop: stop
                                });
                            }
                        }
                        break;

                    case '-webkit-gradient':

                        gradient = {
                            type: m1[2] === 'radial' ? 'circle' : m1[2], // TODO: Add radial gradient support for older mozilla definitions
                            x0: 0,
                            y0: 0,
                            x1: 0,
                            y1: 0,
                            colorStops: []
                        };

                        // get coordinates
                        m2 = m1[3].match(/(\d{1,3})%?\s(\d{1,3})%?,\s(\d{1,3})%?\s(\d{1,3})%?/);
                        if (m2) {
                            gradient.x0 = (m2[1] * bounds.width) / 100;
                            gradient.y0 = (m2[2] * bounds.height) / 100;
                            gradient.x1 = (m2[3] * bounds.width) / 100;
                            gradient.y1 = (m2[4] * bounds.height) / 100;
                        }

                        // get colors and stops
                        m2 = m1[4].match(/((?:from|to|color-stop)\((?:[0-9\.]+,\s)?(?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)\))+/g);
                        if (m2) {
                            m2Len = m2.length;
                            for (i = 0; i < m2Len; i += 1) {
                                m3 = m2[i].match(/(from|to|color-stop)\(([0-9\.]+)?(?:,\s)?((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\)/);
                                stop = parseFloat(m3[2]);
                                if (m3[1] === 'from') {
                                    stop = 0.0;
                                }
                                if (m3[1] === 'to') {
                                    stop = 1.0;
                                }
                                gradient.colorStops.push({
                                    color: m3[3],
                                    stop: stop
                                });
                            }
                        }
                        break;

                    case '-moz-linear-gradient':

                        gradient = {
                            type: 'linear',
                            x0: 0,
                            y0: 0,
                            x1: 0,
                            y1: 0,
                            colorStops: []
                        };

                        // get coordinates
                        m2 = m1[2].match(/(\d{1,3})%?\s(\d{1,3})%?/);

                        // m2[1] == 0%   -> left
                        // m2[1] == 50%  -> center
                        // m2[1] == 100% -> right

                        // m2[2] == 0%   -> top
                        // m2[2] == 50%  -> center
                        // m2[2] == 100% -> bottom

                        if (m2) {
                            gradient.x0 = (m2[1] * bounds.width) / 100;
                            gradient.y0 = (m2[2] * bounds.height) / 100;
                            gradient.x1 = bounds.width - gradient.x0;
                            gradient.y1 = bounds.height - gradient.y0;
                        }

                        // get colors and stops
                        m2 = m1[3].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)(?:\s\d{1,3}%)?)+/g);
                        if (m2) {
                            m2Len = m2.length;
                            step = 1 / Math.max(m2Len - 1, 1);
                            for (i = 0; i < m2Len; i += 1) {
                                m3 = m2[i].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%)?/);
                                if (m3[2]) {
                                    stop = parseFloat(m3[2]);
                                    if (m3[3]) { // percentage
                                        stop /= 100;
                                    }
                                } else {
                                    stop = i * step;
                                }
                                gradient.colorStops.push({
                                    color: m3[1],
                                    stop: stop
                                });
                            }
                        }
                        break;

                    case '-webkit-radial-gradient':
                    case '-moz-radial-gradient':
                    case '-o-radial-gradient':

                        gradient = {
                            type: 'circle',
                            x0: 0,
                            y0: 0,
                            x1: bounds.width,
                            y1: bounds.height,
                            cx: 0,
                            cy: 0,
                            rx: 0,
                            ry: 0,
                            colorStops: []
                        };

                        // center
                        m2 = m1[2].match(/(\d{1,3})%?\s(\d{1,3})%?/);
                        if (m2) {
                            gradient.cx = (m2[1] * bounds.width) / 100;
                            gradient.cy = (m2[2] * bounds.height) / 100;
                        }

                        // size
                        m2 = m1[3].match(/\w+/);
                        m3 = m1[4].match(/[a-z\-]*/);
                        if (m2 && m3) {
                            switch (m3[0]) {
                                case 'farthest-corner':
                                case 'cover':
                                    // is equivalent to farthest-corner
                                case '':
                                    // mozilla removes "cover" from definition :(
                                    tl = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    tr = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    br = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    bl = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    gradient.rx = gradient.ry = Math.max(tl, tr, br, bl);
                                    break;
                                case 'closest-corner':
                                    tl = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    tr = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    br = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    bl = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    gradient.rx = gradient.ry = Math.min(tl, tr, br, bl);
                                    break;
                                case 'farthest-side':
                                    if (m2[0] === 'circle') {
                                        gradient.rx = gradient.ry = Math.max(
                                        gradient.cx,
                                        gradient.cy,
                                        gradient.x1 - gradient.cx,
                                        gradient.y1 - gradient.cy);
                                    } else { // ellipse

                                        gradient.type = m2[0];

                                        gradient.rx = Math.max(
                                        gradient.cx,
                                        gradient.x1 - gradient.cx);
                                        gradient.ry = Math.max(
                                        gradient.cy,
                                        gradient.y1 - gradient.cy);
                                    }
                                    break;
                                case 'closest-side':
                                case 'contain':
                                    // is equivalent to closest-side
                                    if (m2[0] === 'circle') {
                                        gradient.rx = gradient.ry = Math.min(
                                        gradient.cx,
                                        gradient.cy,
                                        gradient.x1 - gradient.cx,
                                        gradient.y1 - gradient.cy);
                                    } else { // ellipse

                                        gradient.type = m2[0];

                                        gradient.rx = Math.min(
                                        gradient.cx,
                                        gradient.x1 - gradient.cx);
                                        gradient.ry = Math.min(
                                        gradient.cy,
                                        gradient.y1 - gradient.cy);
                                    }
                                    break;

                                    // TODO: add support for "30px 40px" sizes (webkit only)
                            }
                        }

                        // color stops
                        m2 = m1[5].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)(?:\s\d{1,3}(?:%|px))?)+/g);
                        if (m2) {
                            m2Len = m2.length;
                            step = 1 / Math.max(m2Len - 1, 1);
                            for (i = 0; i < m2Len; i += 1) {
                                m3 = m2[i].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%|px)?/);
                                if (m3[2]) {
                                    stop = parseFloat(m3[2]);
                                    if (m3[3] === '%') {
                                        stop /= 100;
                                    } else { // px - stupid opera
                                        stop /= bounds.width;
                                    }
                                } else {
                                    stop = i * step;
                                }
                                gradient.colorStops.push({
                                    color: m3[1],
                                    stop: stop
                                });
                            }
                        }
                        break;
                }
            }

            return gradient;
        };

        _html2canvas.Generate.Gradient = function(src, bounds) {
            if (bounds.width === 0 || bounds.height === 0) {
                return;
            }

            var canvas = DOCUMENT.createElement('canvas'),
                ctx = canvas.getContext('2d'),
                gradient, grad, i, len;

            canvas.width = bounds.width;
            canvas.height = bounds.height;

            // TODO: add support for multi defined background gradients
            gradient = _html2canvas.Generate.parseGradient(src, bounds);

            if (gradient) {
                if (gradient.type === 'linear') {
                    grad = ctx.createLinearGradient(gradient.x0, gradient.y0, gradient.x1, gradient.y1);

                    for (i = 0, len = gradient.colorStops.length; i < len; i += 1) {
                        try {
                            grad.addColorStop(gradient.colorStops[i].stop, gradient.colorStops[i].color);
                        } catch (e) {
                            h2clog(['failed to add color stop: ', e, '; tried to add: ', gradient.colorStops[i], '; stop: ', i, '; in: ', src]);
                        }
                    }

                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, bounds.width, bounds.height);

                } else if (gradient.type === 'circle') {

                    grad = ctx.createRadialGradient(gradient.cx, gradient.cy, 0, gradient.cx, gradient.cy, gradient.rx);

                    for (i = 0, len = gradient.colorStops.length; i < len; i += 1) {
                        try {
                            grad.addColorStop(gradient.colorStops[i].stop, gradient.colorStops[i].color);
                        } catch (e) {
                            h2clog(['failed to add color stop: ', e, '; tried to add: ', gradient.colorStops[i], '; stop: ', i, '; in: ', src]);
                        }
                    }

                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, bounds.width, bounds.height);

                } else if (gradient.type === 'ellipse') {

                    // draw circle
                    var canvasRadial = DOCUMENT.createElement('canvas'),
                        ctxRadial = canvasRadial.getContext('2d'),
                        ri = Math.max(gradient.rx, gradient.ry),
                        di = ri * 2;

                    canvasRadial.width = canvasRadial.height = di;

                    grad = ctxRadial.createRadialGradient(gradient.rx, gradient.ry, 0, gradient.rx, gradient.ry, ri);

                    for (i = 0, len = gradient.colorStops.length; i < len; i += 1) {
                        try {
                            grad.addColorStop(gradient.colorStops[i].stop, gradient.colorStops[i].color);
                        } catch (e) {
                            h2clog(['failed to add color stop: ', e, '; tried to add: ', gradient.colorStops[i], '; stop: ', i, '; in: ', src]);
                        }
                    }

                    ctxRadial.fillStyle = grad;
                    ctxRadial.fillRect(0, 0, di, di);

                    ctx.fillStyle = gradient.colorStops[i - 1].color;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(canvasRadial, gradient.cx - gradient.rx, gradient.cy - gradient.ry, 2 * gradient.rx, 2 * gradient.ry);

                }
            }

            return canvas;
        };

        _html2canvas.Generate.ListAlpha = function(number) {
            var tmp = "",
                modulus;

            do {
                modulus = number % 26;
                tmp = String.fromCharCode((modulus) + 64) + tmp;
                number = number / 26;
            } while ((number * 26) > 26);

            return tmp;
        };

        _html2canvas.Generate.ListRoman = function(number) {
            var romanArray = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"],
                decimal = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1],
                roman = "",
                v,
                len = romanArray.length;

            if (number <= 0 || number >= 4000) {
                return number;
            }

            for (v = 0; v < len; v += 1) {
                while (number >= decimal[v]) {
                    number -= decimal[v];
                    roman += romanArray[v];
                }
            }

            return roman;

        };

    })();

    function h2cRenderContext(width, height) {
        var storage = [];
        return {
            storage: storage,
            width: width,
            height: height,
            clip: function() {
                storage.push({
                    type: "function",
                    name: "clip",
                    'arguments': arguments
                });
            },
            translate: function() {
                storage.push({
                    type: "function",
                    name: "translate",
                    'arguments': arguments
                });
            },
            fill: function() {
                storage.push({
                    type: "function",
                    name: "fill",
                    'arguments': arguments
                });
            },
            save: function() {
                storage.push({
                    type: "function",
                    name: "save",
                    'arguments': arguments
                });
            },
            restore: function() {
                storage.push({
                    type: "function",
                    name: "restore",
                    'arguments': arguments
                });
            },
            fillRect: function() {
                storage.push({
                    type: "function",
                    name: "fillRect",
                    'arguments': arguments
                });
            },
            createPattern: function() {
                storage.push({
                    type: "function",
                    name: "createPattern",
                    'arguments': arguments
                });
            },
            drawShape: function() {

                var shape = [];

                storage.push({
                    type: "function",
                    name: "drawShape",
                    'arguments': shape
                });

                return {
                    moveTo: function() {
                        shape.push({
                            name: "moveTo",
                            'arguments': arguments
                        });
                    },
                    lineTo: function() {
                        shape.push({
                            name: "lineTo",
                            'arguments': arguments
                        });
                    },
                    arcTo: function() {
                        shape.push({
                            name: "arcTo",
                            'arguments': arguments
                        });
                    },
                    bezierCurveTo: function() {
                        shape.push({
                            name: "bezierCurveTo",
                            'arguments': arguments
                        });
                    },
                    quadraticCurveTo: function() {
                        shape.push({
                            name: "quadraticCurveTo",
                            'arguments': arguments
                        });
                    }
                };

            },
            drawImage: function() {
                storage.push({
                    type: "function",
                    name: "drawImage",
                    'arguments': arguments
                });
            },
            fillText: function() {
                storage.push({
                    type: "function",
                    name: "fillText",
                    'arguments': arguments
                });
            },
            setVariable: function(variable, value) {
                storage.push({
                    type: "variable",
                    name: variable,
                    'arguments': value
                });
            }
        };
    }
    _html2canvas.Parse = function(images, options) {
        WINDOW.scroll(0, 0);

        var element = ((options.elements === undefined) ? DOCUMENT.body : options.elements[0]), // select body by default
            numDraws = 0,
            doc = element.ownerDocument,
            support = _html2canvas.Util.Support(options, doc),
            ignoreElementsRegExp = new RegExp("(" + options.ignoreElements + ")"),
            body = doc.body,
            getCSS = _html2canvas.Util.getCSS,
            pseudoHide = "___html2canvas___pseudoelement",
            hidePseudoElements = doc.createElement('style');

        hidePseudoElements.innerHTML = '.' + pseudoHide + '-before:before { content: "" !important; display: none !important; }' +
            '.' + pseudoHide + '-after:after { content: "" !important; display: none !important; }';

        body.appendChild(hidePseudoElements);

        images = images || {};

        function documentWidth() {
            return Math.max(
            Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth),
            Math.max(doc.body.offsetWidth, doc.documentElement.offsetWidth),
            Math.max(doc.body.clientWidth, doc.documentElement.clientWidth));
        }

        function documentHeight() {
            return Math.max(
            Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight),
            Math.max(doc.body.offsetHeight, doc.documentElement.offsetHeight),
            Math.max(doc.body.clientHeight, doc.documentElement.clientHeight));
        }

        function getCSSInt(element, attribute) {
            var val = parseInt(getCSS(element, attribute), 10);
            return (isNaN(val)) ? 0 : val; // borders in old IE are throwing 'medium' for demo.html
        }

        function renderRect(ctx, x, y, w, h, bgcolor) {
            if (bgcolor !== "transparent") {
                ctx.setVariable("fillStyle", bgcolor);
                ctx.fillRect(x, y, w, h);
                numDraws += 1;
            }
        }

        function textTransform(text, transform) {
            switch (transform) {
                case "lowercase":
                    return text.toLowerCase();
                case "capitalize":
                    return text.replace(/(^|\s|:|-|\(|\))([a-z])/g, function(m, p1, p2) {
                        if (m.length > 0) {
                            return p1 + p2.toUpperCase();
                        }
                    });
                case "uppercase":
                    return text.toUpperCase();
                default:
                    return text;
            }
        }

        function noLetterSpacing(letter_spacing) {
            return (/^(normal|none|0px)$/.test(letter_spacing));
        }

        function drawText(currentText, x, y, ctx) {
            if (currentText !== null && _html2canvas.Util.trimText(currentText).length > 0) {
                ctx.fillText(currentText, x, y);
                numDraws += 1;
            }
        }

        function setTextVariables(ctx, el, text_decoration, color) {
            var align = false,
                bold = getCSS(el, "fontWeight"),
                family = getCSS(el, "fontFamily"),
                size = getCSS(el, "fontSize");

            switch (parseInt(bold, 10)) {
                case 401:
                    bold = "bold";
                    break;
                case 400:
                    bold = "normal";
                    break;
            }

            ctx.setVariable("fillStyle", color);
            ctx.setVariable("font", [getCSS(el, "fontStyle"), getCSS(el, "fontVariant"), bold, size, family].join(" "));
            ctx.setVariable("textAlign", (align) ? "right" : "left");

            if (text_decoration !== "none") {
                return _html2canvas.Util.Font(family, size, doc);
            }
        }

        function renderTextDecoration(ctx, text_decoration, bounds, metrics, color) {
            switch (text_decoration) {
                case "underline":
                    // Draws a line at the baseline of the font
                    // TODO As some browsers display the line as more than 1px if the font-size is big, need to take that into account both in position and size
                    renderRect(ctx, bounds.left, Math.round(bounds.top + metrics.baseline + metrics.lineWidth), bounds.width, 1, color);
                    break;
                case "overline":
                    renderRect(ctx, bounds.left, Math.round(bounds.top), bounds.width, 1, color);
                    break;
                case "line-through":
                    // TODO try and find exact position for line-through
                    renderRect(ctx, bounds.left, Math.ceil(bounds.top + metrics.middle + metrics.lineWidth), bounds.width, 1, color);
                    break;
            }
        }

        function getTextBounds(state, text, textDecoration, isLast) {
            var bounds;
            if (support.rangeBounds) {
                if (textDecoration !== "none" || _html2canvas.Util.trimText(text).length !== 0) {
                    bounds = textRangeBounds(text, state.node, state.textOffset);
                }
                state.textOffset += text.length;
            } else if (state.node && typeof state.node.nodeValue === "string") {
                var newTextNode = (isLast) ? state.node.splitText(text.length) : null;
                bounds = textWrapperBounds(state.node);
                state.node = newTextNode;
            }
            return bounds;
        }

        function textRangeBounds(text, textNode, textOffset) {
            var range = doc.createRange();
            range.setStart(textNode, textOffset);
            range.setEnd(textNode, textOffset + text.length);
            return range.getBoundingClientRect();
        }

        function textWrapperBounds(oldTextNode) {
            var parent = oldTextNode.parentNode,
                wrapElement = doc.createElement('wrapper'),
                backupText = oldTextNode.cloneNode(true);

            wrapElement.appendChild(oldTextNode.cloneNode(true));
            parent.replaceChild(wrapElement, oldTextNode);

            var bounds = _html2canvas.Util.Bounds(wrapElement);
            parent.replaceChild(backupText, wrapElement);
            return bounds;
        }

        function renderText(el, textNode, stack) {
            var ctx = stack.ctx,
                color = getCSS(el, "color"),
                textDecoration = getCSS(el, "textDecoration"),
                textAlign = getCSS(el, "textAlign"),
                metrics,
                textList,
                state = {
                    node: textNode,
                    textOffset: 0
                };

            if (_html2canvas.Util.trimText(textNode.nodeValue).length > 0) {
                textNode.nodeValue = textTransform(textNode.nodeValue, getCSS(el, "textTransform"));
                textAlign = textAlign.replace(["-webkit-auto"], ["auto"]);

                textList = (!options.letterRendering && /^(left|right|justify|auto)$/.test(textAlign) && noLetterSpacing(getCSS(el, "letterSpacing"))) ? textNode.nodeValue.split(/(\b| )/) : textNode.nodeValue.split("");

                metrics = setTextVariables(ctx, el, textDecoration, color);

                if (options.chinese) {
                    textList.forEach(function(word, index) {
                        if (/.*[\u4E00-\u9FA5].*$/.test(word)) {
                            word = word.split("");
                            word.unshift(index, 1);
                            textList.splice.apply(textList, word);
                        }
                    });
                }

                textList.forEach(function(text, index) {
                    var bounds = getTextBounds(state, text, textDecoration, (index < textList.length - 1));
                    if (bounds) {
                        drawText(text, bounds.left, bounds.bottom, ctx);
                        renderTextDecoration(ctx, textDecoration, bounds, metrics, color);
                    }
                });
            }
        }

        function listPosition(element, val) {
            var boundElement = doc.createElement("boundelement"),
                originalType,
                bounds;

            boundElement.style.display = "inline";

            originalType = element.style.listStyleType;
            element.style.listStyleType = "none";

            boundElement.appendChild(doc.createTextNode(val));

            element.insertBefore(boundElement, element.firstChild);

            bounds = _html2canvas.Util.Bounds(boundElement);
            element.removeChild(boundElement);
            element.style.listStyleType = originalType;
            return bounds;
        }

        function elementIndex(el) {
            var i = -1,
                count = 1,
                childs = el.parentNode.childNodes;

            if (el.parentNode) {
                while (childs[++i] !== el) {
                    if (childs[i].nodeType === 1) {
                        count++;
                    }
                }
                return count;
            } else {
                return -1;
            }
        }

        function listItemText(element, type) {
            var currentIndex = elementIndex(element),
                text;
            switch (type) {
                case "decimal":
                    text = currentIndex;
                    break;
                case "decimal-leading-zero":
                    text = (currentIndex.toString().length === 1) ? currentIndex = "0" + currentIndex.toString() : currentIndex.toString();
                    break;
                case "upper-roman":
                    text = _html2canvas.Generate.ListRoman(currentIndex);
                    break;
                case "lower-roman":
                    text = _html2canvas.Generate.ListRoman(currentIndex).toLowerCase();
                    break;
                case "lower-alpha":
                    text = _html2canvas.Generate.ListAlpha(currentIndex).toLowerCase();
                    break;
                case "upper-alpha":
                    text = _html2canvas.Generate.ListAlpha(currentIndex);
                    break;
            }

            text += ". ";
            return text;
        }

        function renderListItem(element, stack, elBounds) {
            var x,
            text,
            ctx = stack.ctx,
                type = getCSS(element, "listStyleType"),
                listBounds;

            if (/^(decimal|decimal-leading-zero|upper-alpha|upper-latin|upper-roman|lower-alpha|lower-greek|lower-latin|lower-roman)$/i.test(type)) {
                text = listItemText(element, type);
                listBounds = listPosition(element, text);
                setTextVariables(ctx, element, "none", getCSS(element, "color"));

                if (getCSS(element, "listStylePosition") === "inside") {
                    ctx.setVariable("textAlign", "left");
                    x = elBounds.left;
                } else {
                    return;
                }

                drawText(text, x, listBounds.bottom, ctx);
            }
        }

        function loadImage(src) {
            var img = images[src];
            if (img && img.succeeded === true) {
                return img.img;
            } else {
                return false;
            }
        }

        function clipBounds(src, dst) {
            var x = Math.max(src.left, dst.left),
                y = Math.max(src.top, dst.top),
                x2 = Math.min((src.left + src.width), (dst.left + dst.width)),
                y2 = Math.min((src.top + src.height), (dst.top + dst.height));

            return {
                left: x,
                top: y,
                width: x2 - x,
                height: y2 - y
            };
        }

        function setZ(zIndex, parentZ) {
            // TODO fix static elements overlapping relative/absolute elements under same stack, if they are defined after them
            var newContext;
            if (!parentZ) {
                newContext = h2czContext(0);
                return newContext;
            }

            if (zIndex !== "auto") {
                newContext = h2czContext(zIndex);
                parentZ.children.push(newContext);
                return newContext;

            }

            return parentZ;
        }

        function renderImage(ctx, element, image, bounds, borders) {

            var paddingLeft = getCSSInt(element, 'paddingLeft'),
                paddingTop = getCSSInt(element, 'paddingTop'),
                paddingRight = getCSSInt(element, 'paddingRight'),
                paddingBottom = getCSSInt(element, 'paddingBottom');

            drawImage(
            ctx,
            image,
            0, //sx
            0, //sy
            image.width, //sw
            image.height, //sh
            bounds.left + paddingLeft + borders[3].width, //dx
            bounds.top + paddingTop + borders[0].width, // dy
            bounds.width - (borders[1].width + borders[3].width + paddingLeft + paddingRight), //dw
            bounds.height - (borders[0].width + borders[2].width + paddingTop + paddingBottom) //dh
            );
        }

        function getBorderData(element) {
            return ["Top", "Right", "Bottom", "Left"].map(function(side) {
                return {
                    width: getCSSInt(element, 'border' + side + 'Width'),
                    color: getCSS(element, 'border' + side + 'Color')
                };
            });
        }

        function getBorderRadiusData(element) {
            return ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(function(side) {
                return getCSS(element, 'border' + side + 'Radius');
            });
        }

        var getCurvePoints = (function(kappa) {

            return function(x, y, r1, r2) {
                var ox = (r1) * kappa, // control point offset horizontal
                    oy = (r2) * kappa, // control point offset vertical
                    xm = x + r1, // x-middle
                    ym = y + r2; // y-middle
                return {
                    topLeft: bezierCurve({
                        x: x,
                        y: ym
                    }, {
                        x: x,
                        y: ym - oy
                    }, {
                        x: xm - ox,
                        y: y
                    }, {
                        x: xm,
                        y: y
                    }),
                    topRight: bezierCurve({
                        x: x,
                        y: y
                    }, {
                        x: x + ox,
                        y: y
                    }, {
                        x: xm,
                        y: ym - oy
                    }, {
                        x: xm,
                        y: ym
                    }),
                    bottomRight: bezierCurve({
                        x: xm,
                        y: y
                    }, {
                        x: xm,
                        y: y + oy
                    }, {
                        x: x + ox,
                        y: ym
                    }, {
                        x: x,
                        y: ym
                    }),
                    bottomLeft: bezierCurve({
                        x: xm,
                        y: ym
                    }, {
                        x: xm - ox,
                        y: ym
                    }, {
                        x: x,
                        y: y + oy
                    }, {
                        x: x,
                        y: y
                    })
                };
            };
        })(4 * ((Math.sqrt(2) - 1) / 3));

        function bezierCurve(start, startControl, endControl, end) {

            var lerp = function(a, b, t) {
                return {
                    x: a.x + (b.x - a.x) * t,
                    y: a.y + (b.y - a.y) * t
                };
            };

            return {
                start: start,
                startControl: startControl,
                endControl: endControl,
                end: end,
                subdivide: function(t) {
                    var ab = lerp(start, startControl, t),
                        bc = lerp(startControl, endControl, t),
                        cd = lerp(endControl, end, t),
                        abbc = lerp(ab, bc, t),
                        bccd = lerp(bc, cd, t),
                        dest = lerp(abbc, bccd, t);
                    return [bezierCurve(start, ab, abbc, dest), bezierCurve(dest, bccd, cd, end)];
                },
                curveTo: function(borderArgs) {
                    borderArgs.push(["bezierCurve", startControl.x, startControl.y, endControl.x, endControl.y, end.x, end.y]);
                },
                curveToReversed: function(borderArgs) {
                    borderArgs.push(["bezierCurve", endControl.x, endControl.y, startControl.x, startControl.y, start.x, start.y]);
                }
            };
        }

        function parseCorner(borderArgs, radius1, radius2, corner1, corner2, x, y) {
            if (radius1[0] > 0 || radius1[1] > 0) {
                borderArgs.push(["line", corner1[0].start.x, corner1[0].start.y]);
                corner1[0].curveTo(borderArgs);
                corner1[1].curveTo(borderArgs);
            } else {
                borderArgs.push(["line", x, y]);
            }

            if (radius2[0] > 0 || radius2[1] > 0) {
                borderArgs.push(["line", corner2[0].start.x, corner2[0].start.y]);
            }
        }

        function drawSide(borderData, radius1, radius2, outer1, inner1, outer2, inner2) {
            var borderArgs = [];

            if (radius1[0] > 0 || radius1[1] > 0) {
                borderArgs.push(["line", outer1[1].start.x, outer1[1].start.y]);
                outer1[1].curveTo(borderArgs);
            } else {
                borderArgs.push(["line", borderData.c1[0], borderData.c1[1]]);
            }

            if (radius2[0] > 0 || radius2[1] > 0) {
                borderArgs.push(["line", outer2[0].start.x, outer2[0].start.y]);
                outer2[0].curveTo(borderArgs);
                borderArgs.push(["line", inner2[0].end.x, inner2[0].end.y]);
                inner2[0].curveToReversed(borderArgs);
            } else {
                borderArgs.push(["line", borderData.c2[0], borderData.c2[1]]);
                borderArgs.push(["line", borderData.c3[0], borderData.c3[1]]);
            }

            if (radius1[0] > 0 || radius1[1] > 0) {
                borderArgs.push(["line", inner1[1].end.x, inner1[1].end.y]);
                inner1[1].curveToReversed(borderArgs);
            } else {
                borderArgs.push(["line", borderData.c4[0], borderData.c4[1]]);
            }

            return borderArgs;
        }

        function calculateCurvePoints(bounds, borderRadius, borders) {

            var x = bounds.left,
                y = bounds.top,
                width = bounds.width,
                height = bounds.height,

                tlh = borderRadius[0][0],
                tlv = borderRadius[0][1],
                trh = borderRadius[1][0],
                trv = borderRadius[1][1],
                brv = borderRadius[2][0],
                brh = borderRadius[2][1],
                blh = borderRadius[3][0],
                blv = borderRadius[3][1],

                topWidth = width - trh,
                rightHeight = height - brv,
                bottomWidth = width - brh,
                leftHeight = height - blv;

            return {
                topLeftOuter: getCurvePoints(
                x,
                y,
                tlh,
                tlv).topLeft.subdivide(0.5),

                topLeftInner: getCurvePoints(
                x + borders[3].width,
                y + borders[0].width,
                Math.max(0, tlh - borders[3].width),
                Math.max(0, tlv - borders[0].width)).topLeft.subdivide(0.5),

                topRightOuter: getCurvePoints(
                x + topWidth,
                y,
                trh,
                trv).topRight.subdivide(0.5),

                topRightInner: getCurvePoints(
                x + Math.min(topWidth, width + borders[3].width),
                y + borders[0].width, (topWidth > width + borders[3].width) ? 0 : trh - borders[3].width,
                trv - borders[0].width).topRight.subdivide(0.5),

                bottomRightOuter: getCurvePoints(
                x + bottomWidth,
                y + rightHeight,
                brh,
                brv).bottomRight.subdivide(0.5),

                bottomRightInner: getCurvePoints(
                x + Math.min(bottomWidth, width + borders[3].width),
                y + Math.min(rightHeight, height + borders[0].width),
                Math.max(0, brh - borders[1].width),
                Math.max(0, brv - borders[2].width)).bottomRight.subdivide(0.5),

                bottomLeftOuter: getCurvePoints(
                x,
                y + leftHeight,
                blh,
                blv).bottomLeft.subdivide(0.5),

                bottomLeftInner: getCurvePoints(
                x + borders[3].width,
                y + leftHeight,
                Math.max(0, blh - borders[3].width),
                Math.max(0, blv - borders[2].width)).bottomLeft.subdivide(0.5)
            };
        }

        function getBorderClip(element, borderPoints, borders, radius, bounds) {
            var backgroundClip = getCSS(element, 'backgroundClip'),
                borderArgs = [];

            switch (backgroundClip) {
                case "content-box":
                case "padding-box":
                    parseCorner(borderArgs, radius[0], radius[1], borderPoints.topLeftInner, borderPoints.topRightInner, bounds.left + borders[3].width, bounds.top + borders[0].width);
                    parseCorner(borderArgs, radius[1], radius[2], borderPoints.topRightInner, borderPoints.bottomRightInner, bounds.left + bounds.width - borders[1].width, bounds.top + borders[0].width);
                    parseCorner(borderArgs, radius[2], radius[3], borderPoints.bottomRightInner, borderPoints.bottomLeftInner, bounds.left + bounds.width - borders[1].width, bounds.top + bounds.height - borders[2].width);
                    parseCorner(borderArgs, radius[3], radius[0], borderPoints.bottomLeftInner, borderPoints.topLeftInner, bounds.left + borders[3].width, bounds.top + bounds.height - borders[2].width);
                    break;

                default:
                    parseCorner(borderArgs, radius[0], radius[1], borderPoints.topLeftOuter, borderPoints.topRightOuter, bounds.left, bounds.top);
                    parseCorner(borderArgs, radius[1], radius[2], borderPoints.topRightOuter, borderPoints.bottomRightOuter, bounds.left + bounds.width, bounds.top);
                    parseCorner(borderArgs, radius[2], radius[3], borderPoints.bottomRightOuter, borderPoints.bottomLeftOuter, bounds.left + bounds.width, bounds.top + bounds.height);
                    parseCorner(borderArgs, radius[3], radius[0], borderPoints.bottomLeftOuter, borderPoints.topLeftOuter, bounds.left, bounds.top + bounds.height);
                    break;
            }

            return borderArgs;
        }

        function parseBorders(element, bounds, borders) {
            var x = bounds.left,
                y = bounds.top,
                width = bounds.width,
                height = bounds.height,
                borderSide,
                bx,
                by,
                bw,
                bh,
                borderArgs,
                // http://www.w3.org/TR/css3-background/#the-border-radius
                borderRadius = getBorderRadiusData(element),
                borderPoints = calculateCurvePoints(bounds, borderRadius, borders),
                borderData = {
                    clip: getBorderClip(element, borderPoints, borders, borderRadius, bounds),
                    borders: []
                };

            for (borderSide = 0; borderSide < 4; borderSide++) {

                if (borders[borderSide].width > 0) {
                    bx = x;
                    by = y;
                    bw = width;
                    bh = height - (borders[2].width);

                    switch (borderSide) {
                        case 0:
                            // top border
                            bh = borders[0].width;

                            borderArgs = drawSide({
                                c1: [bx, by],
                                c2: [bx + bw, by],
                                c3: [bx + bw - borders[1].width, by + bh],
                                c4: [bx + borders[3].width, by + bh]
                            }, borderRadius[0], borderRadius[1],
                            borderPoints.topLeftOuter, borderPoints.topLeftInner, borderPoints.topRightOuter, borderPoints.topRightInner);
                            break;
                        case 1:
                            // right border
                            bx = x + width - (borders[1].width);
                            bw = borders[1].width;

                            borderArgs = drawSide({
                                c1: [bx + bw, by],
                                c2: [bx + bw, by + bh + borders[2].width],
                                c3: [bx, by + bh],
                                c4: [bx, by + borders[0].width]
                            }, borderRadius[1], borderRadius[2],
                            borderPoints.topRightOuter, borderPoints.topRightInner, borderPoints.bottomRightOuter, borderPoints.bottomRightInner);
                            break;
                        case 2:
                            // bottom border
                            by = (by + height) - (borders[2].width);
                            bh = borders[2].width;

                            borderArgs = drawSide({
                                c1: [bx + bw, by + bh],
                                c2: [bx, by + bh],
                                c3: [bx + borders[3].width, by],
                                c4: [bx + bw - borders[2].width, by]
                            }, borderRadius[2], borderRadius[3],
                            borderPoints.bottomRightOuter, borderPoints.bottomRightInner, borderPoints.bottomLeftOuter, borderPoints.bottomLeftInner);
                            break;
                        case 3:
                            // left border
                            bw = borders[3].width;

                            borderArgs = drawSide({
                                c1: [bx, by + bh + borders[2].width],
                                c2: [bx, by],
                                c3: [bx + bw, by + borders[0].width],
                                c4: [bx + bw, by + bh]
                            }, borderRadius[3], borderRadius[0],
                            borderPoints.bottomLeftOuter, borderPoints.bottomLeftInner, borderPoints.topLeftOuter, borderPoints.topLeftInner);
                            break;
                    }

                    borderData.borders.push({
                        args: borderArgs,
                        color: borders[borderSide].color
                    });

                }
            }

            return borderData;
        }

        function createShape(ctx, args) {
            var shape = ctx.drawShape();
            args.forEach(function(border, index) {
                shape[(index === 0) ? "moveTo" : border[0] + "To"].apply(null, border.slice(1));
            });
            return shape;
        }

        function renderBorders(ctx, borderArgs, color) {
            if (color !== "transparent") {
                ctx.setVariable("fillStyle", color);
                createShape(ctx, borderArgs);
                ctx.fill();
                numDraws += 1;
            }
        }

        function renderFormValue(el, bounds, stack) {

            var valueWrap = doc.createElement('valuewrap'),
                cssPropertyArray = ['lineHeight', 'textAlign', 'fontFamily', 'color', 'fontSize', 'paddingLeft', 'paddingTop', 'width', 'height', 'border', 'borderLeftWidth', 'borderTopWidth'],
                textValue,
                textNode;

            cssPropertyArray.forEach(function(property) {
                try {
                    valueWrap.style[property] = getCSS(el, property);
                } catch (e) {
                    // Older IE has issues with "border"
                    h2clog("html2canvas: Parse: Exception caught in renderFormValue: " + e.message);
                }
            });

            valueWrap.style.borderColor = "black";
            valueWrap.style.borderStyle = "solid";
            valueWrap.style.display = "block";
            valueWrap.style.position = "absolute";

            if (/^(submit|reset|button|text|password)$/.test(el.type) || el.nodeName === "SELECT") {
                valueWrap.style.lineHeight = getCSS(el, "height");
            }

            valueWrap.style.top = bounds.top + "px";
            valueWrap.style.left = bounds.left + "px";

            textValue = (el.nodeName === "SELECT") ? (el.options[el.selectedIndex] || 0).text : el.value;
            if (!textValue) {
                textValue = el.placeholder;
            }

            textNode = doc.createTextNode(textValue);

            valueWrap.appendChild(textNode);
            body.appendChild(valueWrap);

            renderText(el, textNode, stack);
            body.removeChild(valueWrap);
        }

        function drawImage(ctx) {
            ctx.drawImage.apply(ctx, Array.prototype.slice.call(arguments, 1));
            numDraws += 1;
        }

        function getPseudoElement(el, which) {
            var elStyle = WINDOW.getComputedStyle(el, which);
            if (!elStyle || !elStyle.content || elStyle.content === "none" || elStyle.content === "-moz-alt-content") {
                return;
            }
            var content = elStyle.content + '',
                first = content.substr(0, 1);
            //strips quotes
            if (first === content.substr(content.length - 1) && first.match(/'|"/)) {
                content = content.substr(1, content.length - 2);
            }

            var isImage = content.substr(0, 3) === 'url',
                elps = DOCUMENT.createElement(isImage ? 'img' : 'span');

            elps.className = pseudoHide + "-before " + pseudoHide + "-after";

            Object.keys(elStyle).filter(indexedProperty).forEach(function(prop) {
                // Prevent assigning of read only CSS Rules, ex. length, parentRule
                try {
                    elps.style[prop] = elStyle[prop];
                } catch (e) {
                    h2clog(['Tried to assign readonly property ', prop, 'Error:', e]);
                }
            });

            if (isImage) {
                elps.src = _html2canvas.Util.parseBackgroundImage(content)[0].args[0];
            } else {
                elps.innerHTML = content;
            }
            return elps;
        }

        function indexedProperty(property) {
            return (isNaN(WINDOW.parseInt(property, 10)));
        }

        function injectPseudoElements(el, stack) {
            var before = getPseudoElement(el, ':before'),
                after = getPseudoElement(el, ':after');
            if (!before && !after) {
                return;
            }

            if (before) {
                el.className += " " + pseudoHide + "-before";
                el.parentNode.insertBefore(before, el);
                parseElement(before, stack, true);
                el.parentNode.removeChild(before);
                el.className = el.className.replace(pseudoHide + "-before", "").trim();
            }

            if (after) {
                el.className += " " + pseudoHide + "-after";
                el.appendChild(after);
                parseElement(after, stack, true);
                el.removeChild(after);
                el.className = el.className.replace(pseudoHide + "-after", "").trim();
            }

        }

        function renderBackgroundRepeat(ctx, image, backgroundPosition, bounds) {
            var offsetX = Math.round(bounds.left + backgroundPosition.left),
                offsetY = Math.round(bounds.top + backgroundPosition.top);

            ctx.createPattern(image);
            ctx.translate(offsetX, offsetY);
            ctx.fill();
            ctx.translate(-offsetX, -offsetY);
        }

        function backgroundRepeatShape(ctx, image, backgroundPosition, bounds, left, top, width, height) {
            var args = [];
            args.push(["line", Math.round(left), Math.round(top)]);
            args.push(["line", Math.round(left + width), Math.round(top)]);
            args.push(["line", Math.round(left + width), Math.round(height + top)]);
            args.push(["line", Math.round(left), Math.round(height + top)]);
            createShape(ctx, args);
            ctx.save();
            ctx.clip();
            renderBackgroundRepeat(ctx, image, backgroundPosition, bounds);
            ctx.restore();
        }

        function renderBackgroundColor(ctx, backgroundBounds, bgcolor) {
            renderRect(
            ctx,
            backgroundBounds.left,
            backgroundBounds.top,
            backgroundBounds.width,
            backgroundBounds.height,
            bgcolor);
        }

        function renderBackgroundRepeating(el, bounds, ctx, image, imageIndex) {
            var backgroundSize = _html2canvas.Util.BackgroundSize(el, bounds, image, imageIndex),
                backgroundPosition = _html2canvas.Util.BackgroundPosition(el, bounds, image, imageIndex, backgroundSize),
                backgroundRepeat = getCSS(el, "backgroundRepeat").split(",").map(function(value) {
                    return value.trim();
                });

            image = resizeImage(image, backgroundSize);

            backgroundRepeat = backgroundRepeat[imageIndex] || backgroundRepeat[0];

            switch (backgroundRepeat) {
                case "repeat-x":
                    backgroundRepeatShape(ctx, image, backgroundPosition, bounds,
                    bounds.left, bounds.top + backgroundPosition.top, 99999, image.height);
                    break;

                case "repeat-y":
                    backgroundRepeatShape(ctx, image, backgroundPosition, bounds,
                    bounds.left + backgroundPosition.left, bounds.top, image.width, 99999);
                    break;

                case "no-repeat":
                    backgroundRepeatShape(ctx, image, backgroundPosition, bounds,
                    bounds.left + backgroundPosition.left, bounds.top + backgroundPosition.top, image.width, image.height);
                    break;

                default:
                    renderBackgroundRepeat(ctx, image, backgroundPosition, {
                        top: bounds.top,
                        left: bounds.left,
                        width: image.width,
                        height: image.height
                    });
                    break;
            }
        }

        function renderBackgroundImage(element, bounds, ctx) {
            var backgroundImage = getCSS(element, "backgroundImage"),
                backgroundImages = _html2canvas.Util.parseBackgroundImage(backgroundImage),
                image,
                imageIndex = backgroundImages.length;

            while (imageIndex--) {
                backgroundImage = backgroundImages[imageIndex];

                if (!backgroundImage.args || backgroundImage.args.length === 0) {
                    continue;
                }

                var key = backgroundImage.method === 'url' ? backgroundImage.args[0] : backgroundImage.value;

                image = loadImage(key);

                // TODO add support for background-origin
                if (image) {
                    renderBackgroundRepeating(element, bounds, ctx, image, imageIndex);
                } else {
                    h2clog("html2canvas: Error loading background:", backgroundImage);
                }
            }
        }

        function resizeImage(image, bounds) {
            if (image.width === bounds.width && image.height === bounds.height) {
                return image;
            }

            var ctx, canvas = doc.createElement('canvas');
            canvas.width = bounds.width;
            canvas.height = bounds.height;
            ctx = canvas.getContext("2d");
            drawImage(ctx, image, 0, 0, image.width, image.height, 0, 0, bounds.width, bounds.height);
            return canvas;
        }

        function setOpacity(ctx, element, parentStack) {
            var opacity = getCSS(element, "opacity") * ((parentStack) ? parentStack.opacity : 1);
            ctx.setVariable("globalAlpha", opacity);
            return opacity;
        }

        function createStack(element, parentStack, bounds) {

            var ctx = h2cRenderContext((!parentStack) ? documentWidth() : bounds.width, (!parentStack) ? documentHeight() : bounds.height),
                stack = {
                    ctx: ctx,
                    zIndex: setZ(getCSS(element, "zIndex"), (parentStack) ? parentStack.zIndex : null),
                    opacity: setOpacity(ctx, element, parentStack),
                    cssPosition: getCSS(element, "position"),
                    borders: getBorderData(element),
                    clip: (parentStack && parentStack.clip) ? _html2canvas.Util.Extend({}, parentStack.clip) : null
                };

            // TODO correct overflow for absolute content residing under a static position
            if (options.useOverflow === true && /(hidden|scroll|auto)/.test(getCSS(element, "overflow")) === true && /(BODY)/i.test(element.nodeName) === false) {
                stack.clip = (stack.clip) ? clipBounds(stack.clip, bounds) : bounds;
            }

            stack.zIndex.children.push(stack);

            return stack;
        }

        function getBackgroundBounds(borders, bounds, clip) {
            var backgroundBounds = {
                left: bounds.left + borders[3].width,
                top: bounds.top + borders[0].width,
                width: bounds.width - (borders[1].width + borders[3].width),
                height: bounds.height - (borders[0].width + borders[2].width)
            };

            if (clip) {
                backgroundBounds = clipBounds(backgroundBounds, clip);
            }

            return backgroundBounds;
        }

        function renderElement(element, parentStack, pseudoElement) {
            var bounds = _html2canvas.Util.Bounds(element),
                image,
                bgcolor = (ignoreElementsRegExp.test(element.nodeName)) ? "#efefef" : getCSS(element, "backgroundColor"),
                stack = createStack(element, parentStack, bounds),
                borders = stack.borders,
                ctx = stack.ctx,
                backgroundBounds = getBackgroundBounds(borders, bounds, stack.clip),
                borderData = parseBorders(element, bounds, borders);

            createShape(ctx, borderData.clip);

            ctx.save();
            ctx.clip();

            if (backgroundBounds.height > 0 && backgroundBounds.width > 0) {
                renderBackgroundColor(ctx, bounds, bgcolor);
                renderBackgroundImage(element, backgroundBounds, ctx);
            }

            ctx.restore();

            borderData.borders.forEach(function(border) {
                renderBorders(ctx, border.args, border.color);
            });

            if (!pseudoElement) {
                injectPseudoElements(element, stack);
            }

            switch (element.nodeName) {
                case "IMG":
                    if ((image = loadImage(element.getAttribute('src')))) {
                        renderImage(ctx, element, image, bounds, borders);
                    } else {
                        h2clog("html2canvas: Error loading <img>:" + element.getAttribute('src'));
                    }
                    break;
                case "INPUT":
                    // TODO add all relevant type's, i.e. HTML5 new stuff
                    // todo add support for placeholder attribute for browsers which support it
                    if (/^(text|url|email|submit|button|reset)$/.test(element.type) && (element.value || element.placeholder).length > 0) {
                        renderFormValue(element, bounds, stack);
                    }
                    break;
                case "TEXTAREA":
                    if ((element.value || element.placeholder || "").length > 0) {
                        renderFormValue(element, bounds, stack);
                    }
                    break;
                case "SELECT":
                    if ((element.options || element.placeholder || "").length > 0) {
                        renderFormValue(element, bounds, stack);
                    }
                    break;
                case "LI":
                    renderListItem(element, stack, backgroundBounds);
                    break;
                case "CANVAS":
                    renderImage(ctx, element, element, bounds, borders);
                    break;
            }

            return stack;
        }

        function isElementVisible(element) {
            return (getCSS(element, 'display') !== "none" && getCSS(element, 'visibility') !== "hidden" && !element.hasAttribute("data-html2canvas-ignore"));
        }

        function parseElement(el, stack, pseudoElement) {

            if (isElementVisible(el)) {
                stack = renderElement(el, stack, pseudoElement) || stack;
                if (!ignoreElementsRegExp.test(el.nodeName)) {
                    _html2canvas.Util.Children(el).forEach(function(node) {
                        if (node.nodeType === 1) {
                            parseElement(node, stack, pseudoElement);
                        } else if (node.nodeType === 3) {
                            renderText(el, node, stack);
                        }
                    });
                }
            }
        }

        function svgDOMRender(body, stack) {
            var img = new Image(),
                docWidth = documentWidth(),
                docHeight = documentHeight(),
                html = "";

            function parseDOM(el) {
                var children = _html2canvas.Util.Children(el),
                    len = children.length,
                    attr,
                    a,
                    alen,
                    elm,
                    i;
                for (i = 0; i < len; i += 1) {
                    elm = children[i];
                    if (elm.nodeType === 3) {
                        // Text node
                        html += elm.nodeValue.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    } else if (elm.nodeType === 1) {
                        // Element
                        if (!/^(script|meta|title)$/.test(elm.nodeName.toLowerCase())) {

                            html += "<" + elm.nodeName.toLowerCase();

                            // add attributes
                            if (elm.hasAttributes()) {
                                attr = elm.attributes;
                                alen = attr.length;
                                for (a = 0; a < alen; a += 1) {
                                    html += " " + attr[a].name + '="' + attr[a].value + '"';
                                }
                            }


                            html += '>';

                            parseDOM(elm);


                            html += "</" + elm.nodeName.toLowerCase() + ">";
                        }
                    }

                }

            }

            parseDOM(body);
            img.src = [
                "data:image/svg+xml,",
                "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' width='" + docWidth + "' height='" + docHeight + "'>",
                "<foreignObject width='" + docWidth + "' height='" + docHeight + "'>",
                "<html xmlns='http://www.w3.org/1999/xhtml' style='margin:0;'>",
            html.replace(/\#/g, "%23"),
                "</html>",
                "</foreignObject>",
                "</svg>"].join("");

            img.onload = function() {
                stack.svgRender = img;
            };

        }

        function init() {
            var stack = renderElement(element, null);

            if (support.svgRendering) {
                svgDOMRender(DOCUMENT.documentElement, stack);
            }

            Array.prototype.slice.call(element.children, 0).forEach(function(childElement) {
                parseElement(childElement, stack);
            });

            stack.backgroundColor = getCSS(DOCUMENT.documentElement, "backgroundColor");
            body.removeChild(hidePseudoElements);
            return stack;
        }

        return init();
    };

    function h2czContext(zindex) {
        return {
            zindex: zindex,
            children: []
        };
    }
    _html2canvas.Preload = function(options) {

        var images = {
            numLoaded: 0, // also failed are counted here
            numFailed: 0,
            numTotal: 0,
            cleanupDone: false
        },
        pageOrigin,
        methods,
        i,
        count = 0,
            element = options.elements[0] || DOCUMENT.body,
            doc = element.ownerDocument,
            domImages = doc.images, // TODO probably should limit it to images present in the element only
            imgLen = domImages.length,
            link = doc.createElement("a"),
            supportCORS = (function(img) {
                return (img.crossOrigin !== undefined);
            })(new Image()),
            timeoutTimer;

        link.href = WINDOW.location.href;
        pageOrigin = link.protocol + link.host;

        function isSameOrigin(url) {
            link.href = url;
            link.href = link.href; // YES, BELIEVE IT OR NOT, that is required for IE9 - http://jsfiddle.net/niklasvh/2e48b/
            var origin = link.protocol + link.host;
            return (origin === pageOrigin);
        }

        function start() {
            h2clog("html2canvas: start: images: " + images.numLoaded + " / " + images.numTotal + " (failed: " + images.numFailed + ")");
            if (!images.firstRun && images.numLoaded >= images.numTotal) {
                h2clog("Finished loading images: # " + images.numTotal + " (failed: " + images.numFailed + ")");

                if (typeof options.complete === "function") {
                    options.complete(images);
                }

            }
        }

        // TODO modify proxy to serve images with CORS enabled, where available

        function proxyGetImage(url, img, imageObj) {
            var callback_name,
            scriptUrl = options.proxy,
                script;

            link.href = url;
            url = link.href; // work around for pages with base href="" set - WARNING: this may change the url

            callback_name = 'html2canvas_' + (count++);
            imageObj.callbackname = callback_name;

            if (scriptUrl.indexOf("?") > -1) {
                scriptUrl += "&";
            } else {
                scriptUrl += "?";
            }
            scriptUrl += 'url=' + encodeURIComponent(url) + '&callback=' + callback_name;
            script = doc.createElement("script");

            WINDOW[callback_name] = function(a) {
                if (a.substring(0, 6) === "error:") {
                    imageObj.succeeded = false;
                    images.numLoaded++;
                    images.numFailed++;
                    start();
                } else {
                    setImageLoadHandlers(img, imageObj);
                    img.src = a;
                }
                WINDOW[callback_name] = undefined; // to work with IE<9  // NOTE: that the undefined callback property-name still exists on the window object (for IE<9)
                try {
                    delete WINDOW[callback_name]; // for all browser that support this
                } catch (ex) {}
                script.parentNode.removeChild(script);
                script = null;
                delete imageObj.script;
                delete imageObj.callbackname;
            };

            script.setAttribute("type", "text/javascript");
            script.setAttribute("src", scriptUrl);
            imageObj.script = script;
            DOCUMENT.body.appendChild(script);

        }

        function loadPseudoElement(element, type) {
            var style = WINDOW.getComputedStyle(element, type),
                content = style.content;
            if (content.substr(0, 3) === 'url') {
                methods.loadImage(_html2canvas.Util.parseBackgroundImage(content)[0].args[0]);
            }
            loadBackgroundImages(style.backgroundImage, element);
        }

        function loadPseudoElementImages(element) {
            loadPseudoElement(element, ":before");
            loadPseudoElement(element, ":after");
        }

        function loadGradientImage(backgroundImage, bounds) {
            var img = _html2canvas.Generate.Gradient(backgroundImage, bounds);

            if (img !== undefined) {
                images[backgroundImage] = {
                    img: img,
                    succeeded: true
                };
                images.numTotal++;
                images.numLoaded++;
                start();
            }
        }

        function invalidBackgrounds(background_image) {
            return (background_image && background_image.method && background_image.args && background_image.args.length > 0);
        }

        function loadBackgroundImages(background_image, el) {
            var bounds;

            _html2canvas.Util.parseBackgroundImage(background_image).filter(invalidBackgrounds).forEach(function(background_image) {
                if (background_image.method === 'url') {
                    methods.loadImage(background_image.args[0]);
                } else if (background_image.method.match(/\-?gradient$/)) {
                    if (bounds === undefined) {
                        bounds = _html2canvas.Util.Bounds(el);
                    }
                    loadGradientImage(background_image.value, bounds);
                }
            });
        }

        function getImages(el) {
            var elNodeType = false;

            // Firefox fails with permission denied on pages with iframes
            try {
                _html2canvas.Util.Children(el).forEach(function(img) {
                    getImages(img);
                });
            } catch (e) {}

            try {
                elNodeType = el.nodeType;
            } catch (ex) {
                elNodeType = false;
                h2clog("html2canvas: failed to access some element's nodeType - Exception: " + ex.message);
            }

            if (elNodeType === 1 || elNodeType === undefined) {
                loadPseudoElementImages(el);
                try {
                    loadBackgroundImages(_html2canvas.Util.getCSS(el, 'backgroundImage'), el);
                } catch (e) {
                    h2clog("html2canvas: failed to get background-image - Exception: " + e.message);
                }
                loadBackgroundImages(el);
            }
        }

        function setImageLoadHandlers(img, imageObj) {
            img.onload = function() {
                if (imageObj.timer !== undefined) {
                    // CORS succeeded
                    WINDOW.clearTimeout(imageObj.timer);
                }

                images.numLoaded++;
                imageObj.succeeded = true;
                img.onerror = img.onload = null;
                start();
            };
            img.onerror = function() {
                if (img.crossOrigin === "anonymous") {
                    // CORS failed
                    WINDOW.clearTimeout(imageObj.timer);

                    // let's try with proxy instead
                    if (options.proxy) {
                        var src = img.src;
                        img = new Image();
                        imageObj.img = img;
                        img.src = src;

                        proxyGetImage(img.src, img, imageObj);
                        return;
                    }
                }

                images.numLoaded++;
                images.numFailed++;
                imageObj.succeeded = false;
                img.onerror = img.onload = null;
                start();
            };
        }

        methods = {
            loadImage: function(src) {
                var img, imageObj;
                if (src && images[src] === undefined) {
                    img = new Image();
                    if (src.match(/data:image\/.*;base64,/i)) {
                        img.src = src.replace(/url\(['"]{0,}|['"]{0,}\)$/ig, '');
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        setImageLoadHandlers(img, imageObj);
                    } else if (isSameOrigin(src) || options.allowTaint === true) {
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        setImageLoadHandlers(img, imageObj);
                        img.src = src;
                    } else if (supportCORS && !options.allowTaint && options.useCORS) {
                        // attempt to load with CORS

                        img.crossOrigin = "anonymous";
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        setImageLoadHandlers(img, imageObj);
                        img.src = src;

                        // work around for https://bugs.webkit.org/show_bug.cgi?id=80028
                        img.customComplete = _.bind(function() {
                            if (!this.img.complete) {
                                this.timer = WINDOW.setTimeout(this.img.customComplete, 100);
                            } else {
                                this.img.onerror();
                            }
                        }, imageObj);
                        img.customComplete();

                    } else if (options.proxy) {
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        proxyGetImage(src, img, imageObj);
                    }
                }

            },
            cleanupDOM: function(cause) {
                var img, src;
                if (!images.cleanupDone) {
                    if (cause && typeof cause === "string") {
                        h2clog("html2canvas: Cleanup because: " + cause);
                    } else {
                        h2clog("html2canvas: Cleanup after timeout: " + options.timeout + " ms.");
                    }

                    for (src in images) {
                        if (images.hasOwnProperty(src)) {
                            img = images[src];
                            if (typeof img === "object" && img.callbackname && img.succeeded === undefined) {
                                // cancel proxy image request
                                WINDOW[img.callbackname] = undefined; // to work with IE<9  // NOTE: that the undefined callback property-name still exists on the window object (for IE<9)
                                try {
                                    delete WINDOW[img.callbackname]; // for all browser that support this
                                } catch (ex) {}
                                if (img.script && img.script.parentNode) {
                                    img.script.setAttribute("src", "about:blank"); // try to cancel running request
                                    img.script.parentNode.removeChild(img.script);
                                }
                                images.numLoaded++;
                                images.numFailed++;
                                h2clog("html2canvas: Cleaned up failed img: '" + src + "' Steps: " + images.numLoaded + " / " + images.numTotal);
                            }
                        }
                    }

                    // cancel any pending requests
                    if (WINDOW.stop !== undefined) {
                        WINDOW.stop();
                    } else if (DOCUMENT.execCommand !== undefined) {
                        DOCUMENT.execCommand("Stop", false);
                    }
                    if (DOCUMENT.close !== undefined) {
                        DOCUMENT.close();
                    }
                    images.cleanupDone = true;
                    if (!(cause && typeof cause === "string")) {
                        start();
                    }
                }
            },

            renderingDone: function() {
                if (timeoutTimer) {
                    WINDOW.clearTimeout(timeoutTimer);
                }
            }
        };

        if (options.timeout > 0) {
            timeoutTimer = WINDOW.setTimeout(methods.cleanupDOM, options.timeout);
        }

        h2clog('html2canvas: Preload starts: finding background-images');
        images.firstRun = true;

        getImages(element);

        h2clog('html2canvas: Preload: Finding images');
        // load <img> images
        for (i = 0; i < imgLen; i += 1) {
            methods.loadImage(domImages[i].getAttribute("src"));
        }

        images.firstRun = false;
        h2clog('html2canvas: Preload: Done.');
        if (images.numTotal === images.numLoaded) {
            start();
        }

        return methods;

    };
    _html2canvas.Renderer = function(parseQueue, options) {

        function createRenderQueue(parseQueue) {
            var queue = [];

            var sortZ = function(zStack) {
                var subStacks = [],
                    stackValues = [];

                zStack.children.forEach(function(stackChild) {
                    if (stackChild.children && stackChild.children.length > 0) {
                        subStacks.push(stackChild);
                        stackValues.push(stackChild.zindex);
                    } else {
                        queue.push(stackChild);
                    }
                });

                stackValues.sort(function(a, b) {
                    return a - b;
                });

                stackValues.forEach(function(zValue) {
                    var index;

                    subStacks.some(function(stack, i) {
                        index = i;
                        return (stack.zindex === zValue);
                    });
                    sortZ(subStacks.splice(index, 1)[0]);

                });
            };

            sortZ(parseQueue.zIndex);

            return queue;
        }

        function getRenderer(rendererName) {
            var renderer;

            if (typeof options.renderer === "string" && _html2canvas.Renderer[rendererName] !== undefined) {
                renderer = _html2canvas.Renderer[rendererName](options);
            } else if (typeof rendererName === "function") {
                renderer = rendererName(options);
            } else {
                throw new Error("Unknown renderer");
            }

            if (typeof renderer !== "function") {
                throw new Error("Invalid renderer defined");
            }
            return renderer;
        }

        return getRenderer(options.renderer)(parseQueue, options, document, createRenderQueue(parseQueue), _html2canvas);
    };

    _html2canvas.Util.Support = function(options, doc) {

        function supportSVGRendering() {
            var img = new Image(),
                canvas = doc.createElement("canvas"),
                ctx = (canvas.getContext === undefined) ? false : canvas.getContext("2d");
            if (ctx === false) {
                return false;
            }
            canvas.width = canvas.height = 10;
            img.src = [
                "data:image/svg+xml,",
                "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'>",
                "<foreignObject width='10' height='10'>",
                "<div xmlns='http://www.w3.org/1999/xhtml' style='width:10;height:10;'>",
                "sup",
                "</div>",
                "</foreignObject>",
                "</svg>"].join("");
            try {
                ctx.drawImage(img, 0, 0);
                canvas.toDataURL();
            } catch (e) {
                return false;
            }
            h2clog('html2canvas: Parse: SVG powered rendering available');
            return true;
        }

        // Test whether we can use ranges to measure bounding boxes
        // Opera doesn't provide valid bounds.height/bottom even though it supports the method.

        function supportRangeBounds() {
            var r, testElement, rangeBounds, rangeHeight, support = false;

            if (doc.createRange) {
                r = doc.createRange();
                if (r.getBoundingClientRect) {
                    testElement = doc.createElement('boundtest');
                    testElement.style.height = "123px";
                    testElement.style.display = "block";
                    doc.body.appendChild(testElement);

                    r.selectNode(testElement);
                    rangeBounds = r.getBoundingClientRect();
                    rangeHeight = rangeBounds.height;

                    if (rangeHeight === 123) {
                        support = true;
                    }
                    doc.body.removeChild(testElement);
                }
            }

            return support;
        }

        return {
            rangeBounds: supportRangeBounds(),
            svgRendering: options.svgRendering && supportSVGRendering()
        };
    };
    var html2canvas = function(elements, opts) {
        elements = (elements.length) ? elements : [elements];
        var queue,
        canvas,
        options = {
            // general
            logging: false,
            elements: elements,
            background: "#fff",

            // preload options
            proxy: null,
            timeout: 0, // no timeout
            useCORS: false, // try to load images as CORS (where available), before falling back to proxy
            allowTaint: false, // whether to allow images to taint the canvas, won't need proxy if set to true

            // parse options
            svgRendering: false, // use svg powered rendering where available (FF11+)
            ignoreElements: "IFRAME|OBJECT|PARAM",
            useOverflow: true,
            letterRendering: false,
            chinese: false,

            // render options

            width: null,
            height: null,
            taintTest: true, // do a taint test with all images before applying to canvas
            renderer: "Canvas"
        };

        options = _html2canvas.Util.Extend(opts, options);

        _html2canvas.logging = options.logging;
        options.complete = function(images) {

            if (typeof options.onpreloaded === "function") {
                if (options.onpreloaded(images) === false) {
                    return;
                }
            }
            queue = _html2canvas.Parse(images, options);

            if (typeof options.onparsed === "function") {
                if (options.onparsed(queue) === false) {
                    return;
                }
            }

            canvas = _html2canvas.Renderer(queue, options);

            if (typeof options.onrendered === "function") {
                options.onrendered(canvas);
            }


        };

        // for pages without images, we still want this to be async, i.e. return methods before executing
        WINDOW.setTimeout(function() {
            _html2canvas.Preload(options);
        }, 0);

        return {
            render: function(queue, opts) {
                return _html2canvas.Renderer(queue, _html2canvas.Util.Extend(opts, options));
            },
            parse: function(images, opts) {
                return _html2canvas.Parse(images, _html2canvas.Util.Extend(opts, options));
            },
            preload: function(opts) {
                return _html2canvas.Preload(_html2canvas.Util.Extend(opts, options));
            },
            log: h2clog
        };
    };

    html2canvas.log = h2clog; // for renderers
    html2canvas.Renderer = {
        Canvas: undefined // We are assuming this will be used
    };
    _html2canvas.Renderer.Canvas = function(options) {

        options = options || {};

        var doc = document,
            safeImages = [],
            testCanvas = DOCUMENT.createElement("canvas"),
            testctx = testCanvas.getContext("2d"),
            canvas = options.canvas || doc.createElement('canvas');


        function createShape(ctx, args) {
            ctx.beginPath();
            args.forEach(function(arg) {
                ctx[arg.name].apply(ctx, arg['arguments']);
            });
            ctx.closePath();
        }

        function safeImage(item) {
            if (safeImages.indexOf(item['arguments'][0].src) === -1) {
                testctx.drawImage(item['arguments'][0], 0, 0);
                try {
                    testctx.getImageData(0, 0, 1, 1);
                } catch (e) {
                    testCanvas = doc.createElement("canvas");
                    testctx = testCanvas.getContext("2d");
                    return false;
                }
                safeImages.push(item['arguments'][0].src);
            }
            return true;
        }

        function isTransparent(backgroundColor) {
            return (backgroundColor === "transparent" || backgroundColor === "rgba(0, 0, 0, 0)");
        }

        function renderItem(ctx, item) {
            switch (item.type) {
                case "variable":
                    ctx[item.name] = item['arguments'];
                    break;
                case "function":
                    if (item.name === "createPattern") {
                        if (item['arguments'][0].width > 0 && item['arguments'][0].height > 0) {
                            try {
                                ctx.fillStyle = ctx.createPattern(item['arguments'][0], "repeat");
                            } catch (e) {
                                h2clog("html2canvas: Renderer: Error creating pattern", e.message);
                            }
                        }
                    } else if (item.name === "drawShape") {
                        createShape(ctx, item['arguments']);
                    } else if (item.name === "drawImage") {
                        if (item['arguments'][8] > 0 && item['arguments'][7] > 0) {
                            if (!options.taintTest || (options.taintTest && safeImage(item))) {
                                ctx.drawImage.apply(ctx, item['arguments']);
                            }
                        }
                    } else {
                        ctx[item.name].apply(ctx, item['arguments']);
                    }
                    break;
            }
        }

        return function(zStack, options, doc, queue, _html2canvas) {

            var ctx = canvas.getContext("2d"),
                storageContext,
                i,
                queueLen,
                newCanvas,
                bounds,
                fstyle;

            canvas.width = canvas.style.width = options.width || zStack.ctx.width;
            canvas.height = canvas.style.height = options.height || zStack.ctx.height;

            fstyle = ctx.fillStyle;
            ctx.fillStyle = (isTransparent(zStack.backgroundColor) && options.background !== undefined) ? options.background : zStack.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = fstyle;


            if (options.svgRendering && zStack.svgRender !== undefined) {
                // TODO: enable async rendering to support this
                ctx.drawImage(zStack.svgRender, 0, 0);
            } else {
                for (i = 0, queueLen = queue.length; i < queueLen; i += 1) {
                    storageContext = queue.splice(0, 1)[0];
                    storageContext.canvasPosition = storageContext.canvasPosition || {};

                    // set common settings for canvas
                    ctx.textBaseline = "bottom";

                    if (storageContext.clip) {
                        ctx.save();
                        ctx.beginPath();
                        // console.log(storageContext);
                        ctx.rect(storageContext.clip.left, storageContext.clip.top, storageContext.clip.width, storageContext.clip.height);
                        ctx.clip();
                    }

                    if (storageContext.ctx.storage) {
                        storageContext.ctx.storage.forEach(_.bind(renderItem, null, ctx));
                    }

                    if (storageContext.clip) {
                        ctx.restore();
                    }
                }
            }

            h2clog("html2canvas: Renderer: Canvas renderer done - returning canvas obj");

            queueLen = options.elements.length;

            if (queueLen === 1) {
                if (typeof options.elements[0] === "object" && options.elements[0].nodeName !== "BODY") {
                    // crop image to the bounds of selected (single) element
                    bounds = _html2canvas.Util.Bounds(options.elements[0]);
                    newCanvas = doc.createElement('canvas');
                    newCanvas.width = bounds.width;
                    newCanvas.height = bounds.height;
                    ctx = newCanvas.getContext("2d");

                    ctx.drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
                    canvas = null;
                    return newCanvas;
                }
            }

            return canvas;
        };
    };

    return {
        run: html2canvas
    };
});



define('aph/screenshots',[
    "v/h2c"
], function(H2C) {
    

    // Reporting constants.
    var THUMB_HEIGHT = 160;

    // Given a large canvas prepare a thumbnail canvas.
    var getThumbnail = function(canvas) {
        var thumb = document.createElement("canvas");

        thumb.height = THUMB_HEIGHT;
        // Compute proportional width.
        thumb.width = Math.floor(THUMB_HEIGHT * canvas.width / canvas.height);

        // Scale big image onto smaller canvas.
        thumb.getContext("2d").drawImage(canvas, 0, 0,
            thumb.width, thumb.height);

        return thumb;
    };

    // Take a single screenshot for report purposes.
    var takeScreenshot = function(source, callback) {
        // Use HTML2Canvas to take whole "body" screenshot.
        H2C.run(source, {
            onrendered: callback
        });
    };

    return {
        thumbnail: getThumbnail,
        screenshot: takeScreenshot,
        _h2c: H2C //exposed for tests
    };
});

/**
 * Adapted from the official plugin text.js
 *
 * Uses UnderscoreJS micro-templates : http://documentcloud.github.com/underscore/#template
 * @author Julien Cabanès <julien@zeeagency.com>
 * @version 0.2
 * 
 * @license RequireJS text 0.24.0 Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
/*jslint regexp: false, nomen: false, plusplus: false, strict: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, window: false, process: false, Packages: false,
  java: false */

(function () {

	define('v/tpl',[],function () {
		return function() {};	
	});
//>>excludeEnd('excludeTpl')
}());


define('v/tpl!t/modal.t', function() {return function(obj) { var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div style="    line-height: 1;    margin: 0;    padding: 0;    border: 0;    outline: 0;    font-size: 100%;    font: inherit;    vertical-align: baseline;    font-family: Arial, Helvetica, sans-serif;    position:fixed;    top:0;    left:0;    bottom:0;    background:white;    width:100%;    z-index:1000;    font-size:12pt;    text-transform: none;">',c,'</div>');}return __p.join('');}});


define('v/tpl!t/annotations.t', function() {return function(obj) { var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('');var ButtonStyleTop='background: #fff; border: 3px solid #0089be; text-align: center; position: absolute; width: 48px; height: 48px; border-radius: 63px; font-weight: bold; font-size: 16px; color: #FFF; text-shadow: 0 1px 0 #03334a;'; __p.push('<div style="position: relative; z-index: 2200; height: 50px; background: rgba(69,69,69,1); background: linear-gradient(to bottom, rgba(69,69,69,1) 0%, rgba(0,0,0,1) 100%);">    <button class="cancel" style="z-index: 1510; position: absolute; top: 5px; left: 5px; padding: 7px 12px; border: 1px solid #085985; text-shadow: 0 1px 0 #03334a; border-radius: 3px; font-weight: bold; font-size: 16px; color: #FFF; background: rgba(0,136,190,1); background: linear-gradient(to bottom, rgba(0,136,190,1) 0%, rgba(8,89,133,1) 100%);" class="_aph_c" type="reset">Cancel</button>    <button class="done" style="z-index: 1510; position: absolute; top: 5px; right: 5px; padding: 7px 12px; border: 1px solid #085985; text-shadow: 0 1px 0 #03334a; border-radius: 3px; font-weight: bold; font-size: 16px; color: #FFF; background: rgba(0,136,190,1); background: linear-gradient(to bottom, rgba(0,136,190,1) 0%, rgba(8,89,133,1) 100%);" class="_aph_r" type="submit">Done</button>    <p style="margin: 0; position: absolute; top: 0; right: 0; left: 0; text-align: center; color: #fff; font-size: 18px; font-weight: bold; line-height: 50px;">Edit screenshot</p></div>  <div style="position: absolute;z-index: 2100; top: 50px; left: 0; right: 0; height: 3px; background-color: #008abf; border-top: 1px solid #1a96c6; border-bottom: 1px solid #0075a3;"></div><div class="annotations" style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 2000; width: 100%; height: 100%;">    <canvas style="width: 100%; height: 100%; background: #dedede; display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;"/>    <button class="pen tool" style="',ButtonStyleTop,'; bottom: 10px; left: 10px"><img style="width: 24px; height: 24px; position: absolute; left: 10px; bottom: 10px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAA3NCSVQICAjb4U/gAAAACXBIWXMAAADdAAAA3QFwU6IHAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAFdQTFRF////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXD3nBAAAABx0Uk5TAAEGCA8dIC8xN0hicHOAiZyhsLa44Ozw9/j7/iUm/vAAAAB7SURBVDjL7c05AoMwEENRwbAlIawOW3T/cwKmHtGmiAo379sG3NnwhJoFrqpIRlIXr68qrLGrGNz/QyyO03HGYhQei0Q52UB7sL//oKO7cRQf6Wl1Fe79en6chevZxLPoPEd7vD5XcJcv5FSnftBzaTOfUW59DrV3KRk7o4EWMqUQI9QAAAAASUVORK5CYII="/></button>    <button class="spray tool" style="',ButtonStyleTop,'; bottom: 10px; left: 68px"><img style="position: absolute; left: 10px; bottom: 10px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABQUlEQVR42rWVPU4DMRSEU9BQU6FdecZ+VhTBIUhPQcVPRUVFw0FQChQoqOkpEJwhF+AaJLRAsWgkhFZIwfZmtxjJsmfep+dd26OmaQZVkTk6ty8NAqjretvAV0nj3gFG3hvYSBr3CojOH6twW5rrBUCSBr7/BWhOaxsBpqPploELFVyjhTydAcHxSoX+kzydAJOq2jFwmQLII28xIMDfqkCO5C0CROf2DPjKBcirTDYgAA8KlkiZLID+itbefxRAlsomAZE8aJ3Y05IulE0CDLg2mcG3CH9RAlA2BzD/CXxG508KAfM0wPnzVstHJd9B2SSA5KQVejTyJhegbBIgGfzzbxfAZYC/ywC8ZJ+DcV1XBq7anSSKr5QpvCpwmHsXydvpNgWwG8indcW1Js/GL9rYuaBDF+BnkpFnmit40YbTNyDsAomRwmcvAAAAAElFTkSuQmCC"/></button>    <button class="clear" style="',ButtonStyleTop,'; bottom: 10px; right: 10px;"><img style="position: absolute; left: 10px; bottom: 10px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAWCAYAAADafVyIAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAMfAAADHwB27V+9AAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAL7SURBVEiJrZXPaxxlGMc/zzuzrj9StFkRoyIEjVk2uzOTMgcPQhsVRC1ULUljq5AKhdaLF08K/gFevHhRNCgBA1sbqhTbCjY9xcsS3JklBHKweqgtkngwuuxs5316SSCmM9lEfU7D+3zf7+d5n2dmXlFVsmJ0dPSBNE3PAh9EUfRjpmgXYbIWq9Vqf5qmPwCPAJeDIHjmfwOEYfigMeaKiFxvt9sHgPestRdrtdqh/wzwff+hJEnmgZ/TND26srLSiaLoY+BdEbng+/5z/xpQqVQGVPUqsFwqlcZbrVaymYui6BNVfUdVvw2C4IU9A4IgeNR13avAT+VyeXJ+fv7WdmEcx5+LyBlr7VytVnt5twAZGRl5fKPnC8PDwyfr9Xq60wbP844DnwGvR1H0Tc8TOI7zBUB/f/9bvcwBoij6SlWngFnf94/2BKRpOgWwtrY2PTEx4fTaABDHcV1V31DVmVqtdmxHQKvV+tUYc9Ba+/Ty8vLMHiBzIjIpItOe553I08nml1ypVAZc170CxKVS6XjWoLPC87yXgLMi8naz2fzyjhNsPiwtLf2mqoeAyurqaj0Mw8JuAKq6DxBr7Z9BEDw1NjbmZgIA4ji+6bruGPBEp9M5V61W7+pR/QkRmd5o1aq1dnF7cXf8KhYXF3/vdrvPishjxpjzg4ODd+eYTwGfAuPAX8B3wH3Aq91ud25oaKgIW2aQYbAf+B74o6+v78jCwkJ7S+4U8JGqvuY4jlhrzwP/KERVL6+vr7+SCwAIw/D+JEkuiUi7UCgcbjQaf/u+f0ZVPxSRI9bae0TkHFDMsbi0IwCgXC7vKxaLF1U13WjD+8BhYD9QB/LmpMDpngCAarXaZ4y5AByw1r7oOM7DqjoL5L1pVlVPxXE8vSsAQBiG93Y6nSeNMRVVnQHcHGmqqifjOJ6BHYacAykkSfILMJBnLiJvNpvN2c2FzCszLxqNRtda+zxwIyN9S0Qmt5rvGQDQarWWjDEHgWtAF7BABxhvNptfb9ffBnJAThX/SQjJAAAAAElFTkSuQmCC"/></button></div>');}return __p.join('');}});


define('v/tpl!t/login.t', function() {return function(obj) { var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div style="height: 3px; background-color: #008abf; border-top: 1px solid #1a96c6; border-bottom: 1px solid #0075a3; margin-bottom: 30px;"></div><div style="text-transform: none;">    <div style="width: 290px; float: left; padding: 20px 0 0 30px;">        <img style="width: 130px;" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMEAAABDCAYAAAAlOmFPAAAJKklEQVR4Xu1dvXfURhDf1ZHERR4xVfxCfCdwQUpSJR2mogxUlNhVSnCVMuEvAJdUOCUVR5kqUFJxdFAY1naS5/dScIS8x0csKTPy6diTpdsPaVen87iyrdXuzG/np52P1Yqv9MKENfyzvSO4LMLZbvgL5+znhsU6MnzCkiEIOkiSZMCT4Gn0hvXFUAxt5PSJe5LEt1/s7m7YyFl2z9lu9y7nwVqdfZb3lTzc3tm56Gos7nMyypRoCwmK5U/6UcQ3xR/iockk+cQdyCte7OycMZFP1fZsr/eKM76oalfPdSJBPTg67wXI8J5viH0hdIbySQKUJzpg34o/xUBHNlWbcDm83AnYfVW7+q4TCerD0nFP6C7FMV8Xe6KvGso3Cep0ify6QoikYxKg/62aMNfXX+yKCRnCr8PVIGCrrsd11X9en6JxfOPOEya298RWHTqvLIdrCWdhHX3p9FGn7EXjTQSkOgJRG0Jg3hAgEszbjJI+xggQCYwhoxvmDQGO/nfTSuXTi+FSGLIT/nxOp/onbFiUlWkM93/ZwLa20di8lGBY17xRnaAuJEv6wYwR5OhP5S/7zg5l41fJEvnPCo2lpmKZYzt1333M1vOZmcZIUKFw5rdAJk+L4xRpU5Mhq9juirEOh5I+lP2vyC2bxN2mcOa/QEYkmMm9QzrmXtSmyCVqkgQ2LlFzrhAi6nglaCxAk6xlrgPjTM9cQNoo7haBZng6PM8487RXKPcosZDX5IFFKVITtKjtXCJAJJjLaSWlTBAgEpigRW3nEgEtElj7g459OWu/2rJgZI0Dms4BE7rbrDNLc16c0sBhFmRwzTwtEqz0er8zxlfNhXEb1dtmWKKIXTR9CQZ1t8cB8hsJu6mzu1TG2PUbdjpZItdZIdu5MLfF8juIBAZozh0JNApnrgtkRAIDAyxq2qaVIIrZFZ2XbXyuBDjWtMKZjwIZkeA4keA9O2MaE7h2hxD+aS6Ra1coJaGla1rRdCZu13KHrANCCozHYNvEIM6D0pQFxbtc8ZL1vJtYqEZwbtKdTVstEth0TPcQAm1BgEjQlpkiOZ0hQCRwBi113BYEtEhg7RvOakzga3Yq6u8lJsiwkHzzpsb1NS35cbRIYJ8fn81imTewC16mMRnbR3Yok0fOEvnICmXjtiY7RCQwMd3DtmBUW3D+57r5nR/vqEKCw3NT9Y9JlI9qNC2Q4b0wVmijK5HABjXpHttiWcVhlbfXQQAcpBIJgISmB+Zi4YwFLDQ9YhFXERjrhhKYggZEAhvUZpwEOvtxdNWuQgKsUNsYM8i2aEOezgn2RFcvuV1rSECBseb0VgyE86NUCVCxOGe8yxbkT2UwfIPMaqxMWSqWaRoXNSMEHCKglR1yOD51TQg0jgCRoPEpIAGaRkCLBBQTaE7TjMUEKHWVuEKptVxgsz3Osy0xAdUJlObwsUHFApk8UpXsUHagmct3AiJpe7hturo12SEigQEJsGlNRKiDBCgOFL9e2hazyjSHAtkAzlj9NrtOJCi1keO7bcLmTbI8jLWRoNu9ZVvMKiVBwjbgnenbRALlA/L4kiD9ftkBv1jlY3l1kQBjOttiVtkUy64Qtpn7lYACYyXbixtYHLMid1QlqD1ytKVt4Fqiem39tyUwtjQBuo0QaAUCWinSVmhCQhIClggQCSyBo9vmBwEtEsxdTGDph1rjAPbi+7SJovGqxBhjky/BznizXtah5VzUSUEtEsxbncC2QGOPA5yv4/ncofzXf9Bo6sgSRa/ZqaIP/819dsh+8mczRdoICTyfQFdEAiRCtcLZ0c9OUZ1AuSYRCTKIfB/IW0qCKoWzKZVwWglKyUAk+EgC83eO6yqWTdQeKhTOylwhKpZNWw1q3lWZH8p3MFYlMJ523GEZhFUC2WmBuBVuirm06hMVb0tgrPR6qAEh0GIEtLJDLdaPRD/GCISL4SJbkL64uc/2BRPv8pAQCY6xkcyr6mkquBN/lzC2lNcxTpJn7L/OY/mYfG7ty9WI4HH4jnFtG840cVcV59Kn5OfsvFZ3Gn67UzvSjC1DFi50uvFVMP4Q9HoHBj8Ag3+e6hjAmtCJzgWcpzrHcfAow4jbpra0wNNslE/nVcmKaA7pvVleR9e4l6VIM8Ux6O58xl7qADEtK5Td71YfvSzjSrd7DQkwMv6nE7qNXCEkf+dkSpSljAhEAh0rqNzm6CS6NRrGVCRAlaBw9gTeOFOsBuUFMhkWt/qoSYArURDEF9DdEXt79zJC5KZuGH8IHjAgRNCNf4Rri/E/wSaRoLKBqzuAQtnEW1h4h1uj0SRBN7zBObs1VQPNV0Xd6qMmARwifB30WIh3g00Mfserwofg11S/DlsMOvEldJPgjNhNjBvg7x9w1SASqG24cosid8Kt0eiRQOUS4dtx8B7xKR0A3OoznQSoR/BpfA0NGlaBB+lDZuQagcHfHLtsuf8BcX7CaxQY68xwlTYlQZ3TQBLkVQXGmUpT5dAMSLEvp/qoCnXZU10Kdo+sBJ+kQfH3IOoQVwKZKJQirWLgdO9MIDCOBw6Ce+Iv8Uw2cFlAMHYRvQ1+E3+LfSLBTEwdCVEXAuFX4TfBifiqnPaU3aExSSA+kOsDWRtaCeqaCeqnMQQw7RmcjK+DMe9v7+7eyccEWD8YZYMYBM53MHAe/Q9jgiHHnHxj0o8GhvNrJmQ4ZC5bbVou2/Hz+hT14xp3HRnGcUEaWLI1Wc74A9sy+fi4S314wsT2ntiaNh9yDIBy5wPj/GoxXh0gjqDskK2lF9yXnjUU83WxJ/qqbt1mU/SyQ2MSYAHpC/Yq+9skK5Td41YfdYo0yxDhkx2f9mw5utDhfAlWhsMUKfyEy8uX8H/RQfAY3aesLZFAZa3a15N+9J5v6D493RqNGQlS96HXuw/Jwsv4u83nptzqoyZBauSjLBH8+g6KYveK5iJbAdI2byFGgCCZSKBt5GUNwfgjvqmbkvTz5LQgwXK4Bvtr7qJ8NkdIzgIJJCJgUWwhfdIniWBJ5zXj0ZeQIg3x/xg7QJboQZYlIhIYkODwi5BskACwPAkeRW9Yv+ilc50u3RqNOQnSPTXgEtm4QocrSQjbcVz96K0E2egY9LLTDHeSnhvtJM0Isc/izvP80Zj/AzUsbsTUZMm0AAAAAElFTkSuQmCC">        <div style="margin: 30px 0 20px; font-size: 15px;">IBM Mobile Quality Assurance,<br/>V 1.0</div>    </div>    <div style="width: 290px; float: left; padding: 20px 0 0 30px;">        ');if(e){; __p.push('            <div style="margin: 0 30px 12px 0; padding: 10px 12px; font-size: 14px; color: #BE4C34; border-radius: 3px; background: #FFEDE9; border: 1px solid #F2BAAE;">Authentication error, please enter correct credentials.</div>        ');}; __p.push('        <form>        <div style="margin: 0 0 20px 0;">            <input type="email" id="_aph_e" style="padding: 7px 10px; border: 1px solid #BBB; border-radius: 3px; font-size: 16px;" placeholder="Email">        </div>        <div style="margin: 0 0 20px 0;">            <input type="password" id="_aph_p" style="padding: 7px 10px; border: 1px solid #BBB; border-radius: 3px; font-size: 16px;" placeholder="Password">        </div>        <div style="margin: 0 0 30px 0; ">            <input style="background: #0089be; background: linear-gradient(to bottom, rgba(0,136,190,1) 0%, rgba(8,89,133,1) 100%); padding: 7px 12px; min-width: 120px; border: 1px solid #085985; border-radius: 3px; font-weight: bold; font-size: 16px; color: #FFF; text-shadow: 0 1px 0 #03334a;" type="submit" value="Log In">        </div>        </form>    </div>    <div style="border-top: 1px solid #ccc; clear: both; margin: 0 30px; padding-top: 20px; font-size: 14px; color: #777;">&copy; IBM Corp. 2001, 2014</div></div>');}return __p.join('');}});


define('v/tpl!t/user.t', function() {return function(obj) { var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div style="height: 3px; background-color: #008abf; border-top: 1px solid #1a96c6; border-bottom: 1px solid #0075a3; margin-bottom: 30px;"></div><div style="text-transform: none; padding: 0 30px;">    <div style="width: 290px; float: left; padding: 20px 0;">        <img style="width: 130px;" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMEAAABDCAYAAAAlOmFPAAAJKklEQVR4Xu1dvXfURhDf1ZHERR4xVfxCfCdwQUpSJR2mogxUlNhVSnCVMuEvAJdUOCUVR5kqUFJxdFAY1naS5/dScIS8x0csKTPy6diTpdsPaVen87iyrdXuzG/np52P1Yqv9MKENfyzvSO4LMLZbvgL5+znhsU6MnzCkiEIOkiSZMCT4Gn0hvXFUAxt5PSJe5LEt1/s7m7YyFl2z9lu9y7nwVqdfZb3lTzc3tm56Gos7nMyypRoCwmK5U/6UcQ3xR/iockk+cQdyCte7OycMZFP1fZsr/eKM76oalfPdSJBPTg67wXI8J5viH0hdIbySQKUJzpg34o/xUBHNlWbcDm83AnYfVW7+q4TCerD0nFP6C7FMV8Xe6KvGso3Cep0ify6QoikYxKg/62aMNfXX+yKCRnCr8PVIGCrrsd11X9en6JxfOPOEya298RWHTqvLIdrCWdhHX3p9FGn7EXjTQSkOgJRG0Jg3hAgEszbjJI+xggQCYwhoxvmDQGO/nfTSuXTi+FSGLIT/nxOp/onbFiUlWkM93/ZwLa20di8lGBY17xRnaAuJEv6wYwR5OhP5S/7zg5l41fJEvnPCo2lpmKZYzt1333M1vOZmcZIUKFw5rdAJk+L4xRpU5Mhq9juirEOh5I+lP2vyC2bxN2mcOa/QEYkmMm9QzrmXtSmyCVqkgQ2LlFzrhAi6nglaCxAk6xlrgPjTM9cQNoo7haBZng6PM8487RXKPcosZDX5IFFKVITtKjtXCJAJJjLaSWlTBAgEpigRW3nEgEtElj7g459OWu/2rJgZI0Dms4BE7rbrDNLc16c0sBhFmRwzTwtEqz0er8zxlfNhXEb1dtmWKKIXTR9CQZ1t8cB8hsJu6mzu1TG2PUbdjpZItdZIdu5MLfF8juIBAZozh0JNApnrgtkRAIDAyxq2qaVIIrZFZ2XbXyuBDjWtMKZjwIZkeA4keA9O2MaE7h2hxD+aS6Ra1coJaGla1rRdCZu13KHrANCCozHYNvEIM6D0pQFxbtc8ZL1vJtYqEZwbtKdTVstEth0TPcQAm1BgEjQlpkiOZ0hQCRwBi113BYEtEhg7RvOakzga3Yq6u8lJsiwkHzzpsb1NS35cbRIYJ8fn81imTewC16mMRnbR3Yok0fOEvnICmXjtiY7RCQwMd3DtmBUW3D+57r5nR/vqEKCw3NT9Y9JlI9qNC2Q4b0wVmijK5HABjXpHttiWcVhlbfXQQAcpBIJgISmB+Zi4YwFLDQ9YhFXERjrhhKYggZEAhvUZpwEOvtxdNWuQgKsUNsYM8i2aEOezgn2RFcvuV1rSECBseb0VgyE86NUCVCxOGe8yxbkT2UwfIPMaqxMWSqWaRoXNSMEHCKglR1yOD51TQg0jgCRoPEpIAGaRkCLBBQTaE7TjMUEKHWVuEKptVxgsz3Osy0xAdUJlObwsUHFApk8UpXsUHagmct3AiJpe7hturo12SEigQEJsGlNRKiDBCgOFL9e2hazyjSHAtkAzlj9NrtOJCi1keO7bcLmTbI8jLWRoNu9ZVvMKiVBwjbgnenbRALlA/L4kiD9ftkBv1jlY3l1kQBjOttiVtkUy64Qtpn7lYACYyXbixtYHLMid1QlqD1ytKVt4Fqiem39tyUwtjQBuo0QaAUCWinSVmhCQhIClggQCSyBo9vmBwEtEsxdTGDph1rjAPbi+7SJovGqxBhjky/BznizXtah5VzUSUEtEsxbncC2QGOPA5yv4/ncofzXf9Bo6sgSRa/ZqaIP/819dsh+8mczRdoICTyfQFdEAiRCtcLZ0c9OUZ1AuSYRCTKIfB/IW0qCKoWzKZVwWglKyUAk+EgC83eO6yqWTdQeKhTOylwhKpZNWw1q3lWZH8p3MFYlMJ523GEZhFUC2WmBuBVuirm06hMVb0tgrPR6qAEh0GIEtLJDLdaPRD/GCISL4SJbkL64uc/2BRPv8pAQCY6xkcyr6mkquBN/lzC2lNcxTpJn7L/OY/mYfG7ty9WI4HH4jnFtG840cVcV59Kn5OfsvFZ3Gn67UzvSjC1DFi50uvFVMP4Q9HoHBj8Ag3+e6hjAmtCJzgWcpzrHcfAow4jbpra0wNNslE/nVcmKaA7pvVleR9e4l6VIM8Ux6O58xl7qADEtK5Td71YfvSzjSrd7DQkwMv6nE7qNXCEkf+dkSpSljAhEAh0rqNzm6CS6NRrGVCRAlaBw9gTeOFOsBuUFMhkWt/qoSYArURDEF9DdEXt79zJC5KZuGH8IHjAgRNCNf4Rri/E/wSaRoLKBqzuAQtnEW1h4h1uj0SRBN7zBObs1VQPNV0Xd6qMmARwifB30WIh3g00Mfserwofg11S/DlsMOvEldJPgjNhNjBvg7x9w1SASqG24cosid8Kt0eiRQOUS4dtx8B7xKR0A3OoznQSoR/BpfA0NGlaBB+lDZuQagcHfHLtsuf8BcX7CaxQY68xwlTYlQZ3TQBLkVQXGmUpT5dAMSLEvp/qoCnXZU10Kdo+sBJ+kQfH3IOoQVwKZKJQirWLgdO9MIDCOBw6Ce+Iv8Uw2cFlAMHYRvQ1+E3+LfSLBTEwdCVEXAuFX4TfBifiqnPaU3aExSSA+kOsDWRtaCeqaCeqnMQQw7RmcjK+DMe9v7+7eyccEWD8YZYMYBM53MHAe/Q9jgiHHnHxj0o8GhvNrJmQ4ZC5bbVou2/Hz+hT14xp3HRnGcUEaWLI1Wc74A9sy+fi4S314wsT2ntiaNh9yDIBy5wPj/GoxXh0gjqDskK2lF9yXnjUU83WxJ/qqbt1mU/SyQ2MSYAHpC/Yq+9skK5Td41YfdYo0yxDhkx2f9mw5utDhfAlWhsMUKfyEy8uX8H/RQfAY3aesLZFAZa3a15N+9J5v6D493RqNGQlS96HXuw/Jwsv4u83nptzqoyZBauSjLBH8+g6KYveK5iJbAdI2byFGgCCZSKBt5GUNwfgjvqmbkvTz5LQgwXK4Bvtr7qJ8NkdIzgIJJCJgUWwhfdIniWBJ5zXj0ZeQIg3x/xg7QJboQZYlIhIYkODwi5BskACwPAkeRW9Yv+ilc50u3RqNOQnSPTXgEtm4QocrSQjbcVz96K0E2egY9LLTDHeSnhvtJM0Isc/izvP80Zj/AzUsbsTUZMm0AAAAAElFTkSuQmCC">        <div style="margin: 30px 0 20px; font-size: 15px;">IBM Mobile Quality Assurance,<br/>V 1.0</div>    </div><p style="color: #777; font-size: 14px; margin: 0;padding: 20px 0 0 0px;">Please select your name from the list:</p>    <div style="width: 290px; float: left; padding: 0px; margin: 20px 0; max-height: 185px; overflow: auto;">       ');for(var i=0; i<u.length; i++){; __p.push('<div style="padding: 7px 0; border-bottom: 1px solid #dedede;" class="row" data-id="',i,'"><div style="">');if(u[i].avatar){; __p.push('<img src="',u[i].avatar,'" style="width: 48px; height: 48px; float: left; border-radius: 52px; ">');}; __p.push('<span style="height: 34px; display: inline-block; padding: 14px 0 0 7px; font-size: 15px; ">',u[i].name||u[i].email,'</span></div></div>');}; __p.push('    </div>    <div style="border-top: 1px solid #ccc; clear: both; padding-top: 20px; font-size: 14px; color: #777;">&copy; IBM Corp. 2001, 2014</div></div>');}return __p.join('');}});


define('v/tpl!t/report.t', function() {return function(obj) { var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div style="position: relative; height: 100%; text-transform: none; z-index: 1500;">    <div style="position: relative; height: 50px; background: rgba(69,69,69,1); background: linear-gradient(to bottom, rgba(69,69,69,1) 0%, rgba(0,0,0,1) 100%);">        <button style="z-index: 1510; position: absolute; top: 5px; left: 5px; padding: 7px 12px; border: 1px solid #085985; text-shadow: 0 1px 0 #03334a; border-radius: 3px; font-weight: bold; font-size: 16px; color: #FFF; background: rgba(0,136,190,1); background: linear-gradient(to bottom, rgba(0,136,190,1) 0%, rgba(8,89,133,1) 100%);" class="_aph_c" type="reset">Cancel</button>        <button style="z-index: 1510; position: absolute; top: 5px; right: 5px; padding: 7px 12px; border: 1px solid #085985; text-shadow: 0 1px 0 #03334a; border-radius: 3px; font-weight: bold; font-size: 16px; color: #FFF; background: rgba(0,136,190,1); background: linear-gradient(to bottom, rgba(0,136,190,1) 0%, rgba(8,89,133,1) 100%);" class="_aph_r" type="submit">Report</button>        <p style="margin: 0; position: absolute; top: 0; right: 0; left: 0; text-align: center; color: #fff; font-size: 18px; font-weight: bold; line-height: 50px;">Report a Problem</p>    </div>    <div style="position: absolute; top: 50px; left: 0; right: 0; height: 3px; background-color: #008abf; border-top: 1px solid #1a96c6; border-bottom: 1px solid #0075a3;"></div>    <div style="background-color: #fff; position: absolute; top: 55px; left: 0; right: 0; bottom: 300px;">        <div style="position: absolute; top: 0px; right: 0px; left: 0px; bottom: 0px;">            <textarea style="position: absolute; padding: 10px 7px; width: 100%; height: 100%; border: 1px solid #BBB; border-radius: 3px; font-size: 16px; font-family: \'HelveticaNeue-Light\', \'HelveticaNeue\', Helvetica, Arial, sans-serif;" placeholder="Describe the problem. Report will include: screenshots, logs, comment."></textarea>        </div>    </div>    <div style="position: absolute; height: 200px; bottom: 0; left: 0; right: 0; background-color: #ddd; border-top: 2px solid #ccc; z-index: 1510; padding-top: 10px; overflow: auto; white-space: nowrap;">        ');if(!i){; __p.push('            <p style="margin: 10px 0 0 0; position: absolute; top: 0; right: 0; left: 0; text-align: center; color: #aaa; font-size: 16px; font-weight: bold; text-shadow: 0 1px 0 #efefef;">                Click screenshot to open annotations editor.            </p>            <div class="_aph_s" style="display: inline-block; position: relative; margin-top: 30px"></div>            <div class="_aph_n" style="height:158px; min-width: 89px; text-shadow: 0 1px 0 #dedede; border-radius: 2px; display:inline-block; margin: 30px 7px 0 7px; border-bottom: 2px solid #999; background: #ccc; font-size: 48px; line-height: 160px; text-align: center; color: #333; font-weight: bold; vertical-align: top;" >+</div>        ');} else {; __p.push('            <p style="margin: 20px 0 0 0; position: absolute; top: 0; right: 0; left: 0; text-align: center; color: #aaa; font-size: 16px; font-weight: bold; text-shadow: 0 1px 0 #efefef;">                Your device does not support<br/>                taking screenshots.            </p>        ');}; __p.push('    </div></div>');}return __p.join('');}});


define('v/tpl!t/thumb.t', function() {return function(obj) { var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div style="display: inline-block; position: relative; margin-left: 7px;"></div>');}return __p.join('');}});

define('aph/templates',[
    "jq",
    "v/tpl!t/modal.t",
    "v/tpl!t/annotations.t",
    "v/tpl!t/login.t",
    "v/tpl!t/user.t",
    "v/tpl!t/report.t",
    "v/tpl!t/thumb.t"
], function ($, tplModal, tplAnnotations, tplLogin, tplUsers, tplReport, tplThumb) {
    

    var wrap = function(content) {
        return tplModal({
            c: content
        });
    };

    var renderLogin = function (data) {
        return wrap(tplLogin(data));
    };

    var renderQuickAuth = function (data) {
        return wrap(tplUsers(data));
    };

    var renderAnnotations = function (data) {
        return wrap(tplAnnotations(data));
    };

    var renderReport = function (data) {
        return wrap(tplReport(data));
    };

    var renderThumb = function (data) {
        return tplThumb(data);
    };

    var getThumbnail = function (thumbnail) {
        var thumb = $(renderThumb());
        thumb.append(thumbnail);
        return thumb;
    };

    return {
        login: renderLogin,
        quickauth: renderQuickAuth,
        annotations: renderAnnotations,
        report: renderReport,
        thumb: renderThumb,
        getThumbnail: getThumbnail
    };
});

define('aph/annotations',[
    'jq',
    "aph/fs",
    "aph/store",
    "aph/touch",
    "aph/screenshots",
    "aph/templates"
], function ($, FS, Store, Touch, Screenshots, Templates) {
    

    var canvas, context;

    /////////////
    // Drawing //
    ////////////
    var Pen = {
        width: 4,
        color: 'red'
    };

    var Spray = {
        width: 20,
        color: 'blue'
    };

    var getTool = function (name) {
        return {
            pen: Pen,
            spray: Spray
        }[name];
    };

    var selectedTool = Pen;

    var drawLine = function (begin, end) {
        if (!end) {
            return;
        }
        context.lineWidth = selectedTool.width;
        context.strokeStyle = selectedTool.color;
        context.beginPath();
        context.moveTo(begin.x, begin.y);
        context.lineTo(end.x, end.y);
        context.stroke();
    };

    /////////////////////////////
    // UI - Annotations Editor //
    /////////////////////////////
    var done = function (editor, thumb, screenshotName) {
        // Store content in a file inside images directory.
        var canvas = getCanvas(editor);
        var newThumb = Screenshots.thumbnail(canvas);
        // XXX: Store.issueImg **MUST** be called before thumb.getContext on
        // iOS6; it's very hard to debug (no logs or traceback) but happens on
        // iOS6 only, and only for worklight projects (on pure cordova it's
        // fine)
        Store.issueImg(screenshotName, canvas.toDataURL());
        thumb.getContext('2d').drawImage(newThumb, 0, 0);
        closeAnnotations(editor);
    };

    var closeAnnotations = function (editor) {
        var canvas = editor.find('canvas')[0];
        Touch.unregister(canvas);
        editor.remove();
    };

    var bindEditorButtons = function (editor, thumb, screenshotName) {
        var penButton = editor.find('button.pen'),
            sprayButton = editor.find('button.spray'),
            doneButton = editor.find('button.done'),
            cancelButton = editor.find('button.cancel'),
            clearButton = editor.find('button.clear');

        doneButton.click(function () {
            done(editor, thumb, screenshotName);
        });

        cancelButton.click(function () {
            closeAnnotations(editor);
        });

        penButton.click(function () {
            setSelectedTool(editor, 'pen');
        });

        sprayButton.click(function () {
            setSelectedTool(editor, 'spray');
        });

        clearButton.click(function () {
            redrawScreenshot(editor);
        });
    };

    var setSelectedTool = function (editor, name) {
        // Reset color of all tools
        editor.find('button.tool').css({'border-color': '#0089be'});
        // Set selected tool boarder to red
        editor.find('button.' + name).css({'border-color': 'red'});
        selectedTool = getTool(name);
    };

    var getCanvas = function (editor) {
        return editor.find('canvas')[0];
    };

    var getContext = function (editor) {
        canvas = getCanvas(editor);
        return canvas.getContext("2d");
    };

    var redrawScreenshot = function (editor) {
        var context = getContext(editor);
        context.save();
        if (editor.screenshot.width !== window.innerWidth &&
            editor.screenshot.height !== window.innerHeight) {
            // Orientation changed!
            context.rotate(90 * Math.PI/180);
            context.translate(0, -window.innerWidth);
        }

        // draw screenshot onto new canvas
        context.drawImage(
            editor.screenshot,
            0, 0, editor.screenshot.width, editor.screenshot.height,
            0, 0, editor.screenshot.width, editor.screenshot.height
        );
        context.restore();
    };

    var orientationChanged = function (editor) {
        var context = getContext(editor);
        var tmpImage = document.createElement('img');
        tmpImage.src = canvas.toDataURL();

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        context = canvas.getContext("2d");
        context.save();

        context.rotate(90 * Math.PI/180);
        context.translate(0, -window.innerWidth);

        context.drawImage(tmpImage, 0, 0);
        context.restore();
    };

    var showAnnotationsEditor = function (image, thumb, screenshotName) {
        var editor = $(Templates.annotations());
        editor.screenshot = image;

        // Create canvas to draw on
        canvas = getCanvas(editor);

        // FIXME: set global context object
        context = getContext(editor);

        // Bind touch events
        Touch.register(canvas, drawLine);

        // Set width & height of the device
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Listen for orientation changes
        window.addEventListener("orientationchange", function () {
            orientationChanged(editor);
        }, false);

        // Draw source screenshot onto editor canvas
        redrawScreenshot(editor);

        setSelectedTool(editor, 'pen');

        // Bing editor buttons clicks
        bindEditorButtons(editor, thumb, screenshotName);

        // Show editor
        $('body').append(editor);
    };

    var readImage = function (thumb, name) {
        // Access image file.
        FS.readImg(name, function(result) {
            var img = new Image();
            img.onload = function () {
                showAnnotationsEditor(this, thumb, name);
            };
            img.src = result;
        });
    };

    return {
        show: readImage,
        _showAnnotationsEditor: showAnnotationsEditor,
        _close: closeAnnotations
    };
});

define('aph/locks',[],function () {
    

    var locks = {};

    var lock = function (name) {
        locks[name] = true;
    };

    var unlock = function (name) {
        locks[name] = false;
    };

    var isLocked = function (name) {
        return locks[name];
    };

    return {
        isLocked: isLocked,
        lock: lock,
        unlock: unlock,
        _locks: locks
    };
});

/* Visible parts of the SDK.
 * This modules deals with displaying modal dialogs (user selection, login, report editor).
 * All dialogs are rendered from templates and attached to the document body.
 */
define('aph/ui',[
    "jq",
    "aph/annotations",
    "aph/templates",
    "aph/util",
    "aph/locks",
    "v/us"
], function($, Annotations, Templates, Util, Locks, _) {
    

    // For better minification.
    var CLICK = "click";
    var PREVENT_DEFAULT = "preventDefault";


    // Provide quick validation alert.
    var _valAlert = function(error) {
        navigator.notification.alert(error, Util.noOp, "Validation error");
    };


    // Display user list and wait for choice.
    var showUserSelector = function(callback, users) {
        // Render HTML template.
        var content = $(Templates.quickauth({
            u: users
        }));

        // Lock bug reporting
        Locks.lock('report');

        // Select all user rows for interaction.
        var rows = $(".row", content);

        // Attach handler to user selection.
        rows[CLICK](_.partial(selectUser, callback, users, content));

        // Attach view to the page.
        $("body").append(content);
    };

    var selectUser = function(callback, users, content) {
        // Get selected user object.
        var user = users[$(this).data("id")];

        // Unlock bug reporting
        Locks.unlock('report');

        // Clean after yourself.
        content.remove();

        // Execute callback with this user.
        callback({
            // Scrape all other info.
            email: user.email
        });
    };

    // Ask user for full credentials.
    var showLoginPrompt = function(callback, error) {
        // Render HTML template.
        var content = $(Templates.login({
            e: error
        }));

        // Lock bug reporting
        Locks.lock('report');

        // Select login form.
        var form = $("form", content);

        // Attach handler to form submission.
        form.on("submit", _.partial(sendLoginRequest, callback, form, content));

        // Attach view to the page.
        $("body").append(content);
    };

    var sendLoginRequest = function(callback, form, content, evt) {
        evt[PREVENT_DEFAULT]();

        // This strange IDs are use to avoid collisions with client apps.
        var email = $("#_aph_e", form).val();
        var password = $("#_aph_p", form).val();

        // Validate form data.
        var result = _validateLogin(email, password);
        if(!!result) {  // Error
            return _valAlert(result);
        }

        // Unlock bug reporting
        Locks.unlock('report');

        // Clean after yourself.
        content.remove();

        // Execute callback with these credentials.
        callback({
            email: email,
            password: password
        });
    };


    // Simple, stupid validation for credentials.
    var _validateLogin = function(email, password) {
        if(!email) {
            return "Please specify your email address.";
        }
        if(!password) {
            return "Password cannot be empty.";
        }
    };

    /* Displays bug report dialog.
     * Depending on clicked button call either success, cancel or next callback.
     * params - currently edited report paremeters.
     */
    var showReportDialog = function(success, cancel, next, params) {
        // Render HTML template.
        var content = $(Templates.report({
            // No screenshots support flag.
            i: params.noImgs
        }));

        // Select UI buttons for event handling.
        var btnCancel = $("._aph_c", content);
        var btnReport = $("._aph_r", content);
        var textArea = $("textarea", content);
        var btnNext = $("._aph_n", content);
        var divThumbs = $("._aph_s", content);

        // Save report description into params.
        textArea.change(function() {
            params.text = textArea.val();
        });

        // Handle "Cancel" button.
        btnCancel[CLICK](function(evt) {
            evt[PREVENT_DEFAULT]();

            cleaner();
            // Abort the report.
            cancel();
        });

        // Handle "New screenshot" button.
        btnNext[CLICK](function(evt) {
            evt[PREVENT_DEFAULT]();

            cleaner();
            // Continue reporting.
            next();
        });

        // Handle "Report button".
        btnReport[CLICK](function(evt) {
            evt[PREVENT_DEFAULT]();

            // Extract problem description.
            var text = $("textarea", content).val();

            // Do some simple validation.
            if(!text || text.length < 10) {
                return _valAlert("Problem description has to be at least 10 characters.");
            }

            cleaner();
            // Accept the report.
            success();
        });

        // Clean after this view.
        var cleaner = function() {
            content.remove();
        };

        // Place thumbnails inside bottom div.
        var thumbList = params.thumbs;
        for(var i=0; i<thumbList.length; i++) {
            var thumbData = thumbList[i];
            var canvas = thumbData.thumb;
            var elem = Templates.getThumbnail(canvas);
            var openAnnotations = _.partial(Annotations.show, canvas, thumbData.name);
            elem.off(CLICK).on(CLICK, openAnnotations);
            divThumbs.append(elem);
        }

        // Attach content to the page.
        $("body").append(content);
    };


    return {
        login: showLoginPrompt,
        selector: showUserSelector,
        report: showReportDialog
    };
});

// Polyfill to handle device shake event.
define('v/shake',["aph/util", "aph/core"], function(Util, Core) {
    

    // Cache long names.
    var accel = "accelerometer";


    // "Inteval" id for Phonegap watcher.
    var watchId = null;
    // Cache for previous acceleration data.
    var old;
    var shakeCallback;


    // Watch accelerometer for changes.
    var startWatch = function(callback) {
        // Prevent multiple watchers running, start by cleaning state.
        stopWatch();

        shakeCallback = callback;

        watchId = navigator[accel].watchAcceleration(function() {
            // On each accelerometer change check for "intensity".
            navigator[accel].getCurrentAcceleration(checkChange, Util.noOp);
        }, Util.noOp, {frequency: 300});
    };


    // Stop watching the accelerometer for a shake gesture.
    var stopWatch = function() {
        if(watchId !== null) {
            navigator[accel].clearWatch(watchId);
            watchId = null;
        }
    };


    // Check wether change that happened is enough to be considered a shake.
    var checkChange = function(data) {
        // Calculate only if old values are cached.
        if(!!old) {
            var change = Math.sqrt(
                Math.pow(old.x - data.x, 2) +
                Math.pow(old.y - data.y, 2) +
                Math.pow(old.z - data.z, 2)
            );

            // This is a shake.
            if(change > Core.shakeSensitivity) {
                // Disable watching to prevent handling multiple times.
                stopWatch();
                // Reset cached values.
                old = null;

                // Resume watching after margin time.
                setTimeout(startWatch, 1000, shakeCallback);

                // Notify callback about shake.
                return shakeCallback && shakeCallback();
            }
        }

        // Cache new acceleration values.
        old = {
            x: data.x,
            y: data.y,
            z: data.z
        };
    };


    return {
        start: startWatch,
        stop: stopWatch
    };
});

/* This modules provides functions for textual user feedback (the feedback feature)
 * and bug reporting as well.
 * Bug reporting invokes report editor. Report contains both textual content
 * and screenshots.
 */
define('aph/problem',[
    "aph/msg",
    "aph/store",
    "aph/ui",
    "aph/screenshots",
    "aph/locks",
    "aph/console",
    "aph/core",
    "v/shake",
    "v/h2c",
    "v/us",
    "aph/util"
], function(Msg, Store, UI, Screenshots, Locks, Console, Core, Shake, H2C, _, Util) {
    

    // For better minifaction.
    var doc = document;


    /* Create either user feedback or problem report.
     * Specifying only "text" part usually means just a textual feedback.
     * Providing attachment number (numAtts) implies full report.
     * Note: No info about screenshot location is being passed here.
     *       It is reconstructed using "issue_id" and "numAtts".
     */
    var createProblem = function(text, issueId, numAtts, type) {
        if(!text) { return; }  // Ignore empty feedbacks.

        // Prepare ISSUE (PROBLEM) message.
        var issueMessage = Msg.issue({
            type: type||"PROBLEM",
            message: text,
            issue_id: issueId,
            num_attachments: numAtts
        });

        // Store message in a queue.
        Store.message(issueMessage);
    };


    /* Create new feedback message (textual problem).
     * This functions exists so we don't expose multi-argument
     * `createProblem` function to the client application.
     */
    var sendFeedback = function(text) {
        if(Core.mode === 'QA_MODE') {
            Console.warn('Feedback reporting is disabled in QA_MODE');
            return;
        }
        createProblem(text, null, null, 'FEEDBACK');
    };


    /* Random seed for unique issue id generation.
     * It will change after every page refresh.
     */
    var _seed = Util.rs4();

    /* Generate session unique (yet incremental) ID for issues.
     * Each issue inside a session has to have an unique ID.
     */
    var getIssueId = function() {
        return _.uniqueId(_seed);
    };

    // Cache for currently edited report parameters. This is to avoid passing
    // loose data between calls/callbacks. It's possible because only one
    // report at a time can be edited.
    var _thisReport = null;

    /* Open user bug reporting flow.
     * This includes taking screenshots and textual description of the issue.
     * Report can contain multiple screenshots or end up cancelled at any
     * step. Accepted report will be stored for submission.
     */
    var doReport = function() {
        if(Core.mode === 'MARKET_MODE') {
            Console.warn('Bug reporting is disabled in MARKET_MODE');
            return;
        }
        // Only one report at a time.
        if(Locks.isLocked('report')) { return; }
        // Mark report in progress.
        Locks.lock('report');

        // If params are present, assume report continuation is requested.
        // Otherwise initialize new report parameters.
        _thisReport = _thisReport || {
            // Mark report with unique report id.
            id: getIssueId(),
            // Screenshots attached to this report.
            imgs: [],
            // Thumbnails of said screenshots (canvas objects).
            thumbs: [],
            // Report description.
            text: "",
            // "No canvas image support" flag.
            noImgs: false
        };

        // Vibrate to notify user something is happening.
        navigator.notification.vibrate(250);

        // Take the first screenshot.
        Screenshots.screenshot(doc.body, afterScreenshot);
    };

    // After screenshot is taken persist it in a file. Prepare a thumbnail as well.
    var afterScreenshot = function(canvas) {
        // Construct name for screenshot file:
        // <issue id>_<consecutive image number>
        var name = _thisReport.id + "_" + (_thisReport.imgs.length + 1);

        // Retrieve image content in dataURL format.
        var data = canvas.toDataURL("image/png");

        // No-operation fallback for old Android (<3.0) devices.
        if(data.length < 22) {
            // Switch the no-images flag.
            _thisReport.noImgs = true;
            // Go directly to report editor.
            return afterSave();
        }

        // Prepare scaled down thumbnail and add to thumb list.
        _thisReport.thumbs.push({
            thumb: Screenshots.thumbnail(canvas),
            name: name
        });

        // Store content in a file inside images directory.
        Store.issueImg(name, data, function() {
            // Add file name to report's images list.
            _thisReport.imgs.push(name);
            // Proceed with report.
            afterSave();
        });
    };

    // Screenshot is saved, go to the report editor.
    var afterSave = function() {
        // Display reporting dialog, pass report parameters.
        UI.report(editFinish, editCancel, editNext, _thisReport);
    };

    // Report cancelled, clean up.
    var editCancel = function() {
        // Remove saved screenshots, if any.
        for(var i=0; i<_thisReport.imgs.length; i++) {
            var name = _thisReport.imgs[i];
            Store.deleteImg(name);
        }

        // Reset report parameters.
        _thisReport = null;
        // Handling finished, unblock reporting.
        Locks.unlock('report');
    };

    // Another cycle is requested.
    var editNext = function() {
        // Unblock reporting so taking next screenshot is possible.
        Locks.unlock('report');
    };

    // User finished report, submit and clean.
    var editFinish = function() {
        // Store accepted report.
        createProblem(_thisReport.text, _thisReport.id, _thisReport.imgs.length);

        // Reset report parameters.
        _thisReport = null;
        // Handling finished, unblock reporting.
        Locks.unlock('report');
    };


    /* Start listening for shakes and follow with problem dialog.
     * Shaking the device would start bug reporting process.
     */
    var start = function() {
        Shake.start(doReport);
    };


    // Stop listening to shake events.
    var stop = function() {
        Shake.stop();
    };


    return {
        feedback: sendFeedback,
        start: start,
        stop: stop,
        // Expose UI reporting feature.
        report: doReport,
        // Testing
        _createProblem: createProblem
    };
});

/* global device */
/* This is the most important module of the Apphance Phonegap SDK.
 * It glues together all other active modules.
 * Here Apphance session is started and stopped.
 * This means configuring the SDK parameters, issuing identification and login
 * calls, intercepting and overriding device APIs etc.
 */
define('aph/session',[
    "aph/core",
    "aph/net",
    "aph/console",
    "aph/pub",
    "aph/util",
    "aph/log",
    "aph/crash",
    "aph/state",
    "aph/store",
    "aph/conds",
    "aph/offline",
    "aph/watch",
    "aph/ui",
    "aph/problem",
    "v/us"
], function(Core, Net, Console, Pub, Util, Log, Crash, State,
        Store, Conds, Offline, Watch, UI, Problem, _) {
    

    // For better minification.
    var MARKET_MODE = "MARKET_MODE";  // This we sent via API.
    var QA_MODE = "QA_MODE";
    var SILENT_MODE = "SILENT_MODE";


    /* Cache for original SDK state.
     * This is used to restore previous state after the session is stopped.
     */
    var oldCore;

    /* Initialize Apphance SDK session.
     * config -- SDK configuration provided by client application.
     * callback -- function to call after session is started.
     */
    var startSession = function(config, callback) {
        if (!_.isFunction(device.getAppVersion)) {
            return _startSession(config, callback);
        }

        device.getAppVersion(function(data){
            config.versionName = data.versionName;
            config.versionNumber = data.versionNumber;
            _startSession(config, callback);
        });

    };

    function _startSession(config, callback) {

        // No callback specified -- pass no-op function down the chain.
        if(!_.isFunction(callback)) {
            callback = Util.noOp;
        }

        // No action -- session already started.
        if(Core._s) { return; }

        // Cache original SDK state.
        oldCore = _.extend({}, Core);

        // Try resuming previous session.
        var prevState = State.load();
        if(!!prevState && prevState.applicationKey) {
            return resumeSession(prevState, callback);
        } else {
            // No session persisted, created a new one.
            return newSession(config, callback);
        }
    }


    // Resume previous session using stored "state" data.
    var resumeSession = function(state, callback) {
        // Copy parameters from saved state to internal configuration.
        _.extend(Core, state);

        // Return control to the client application.
        finishInit(callback);
    };


    // Create a new Apphance session using provided configuration.
    var newSession = function(config, callback) {
        // Save session start timestamp.
        Core.ts = Util.timestamp();

        // Read and apply client configuration.
        configureCore(config);

        // Bail on improper application key.
        if(!Core.applicationKey) {
            return Console.error("Aph: Cannot run without proper application key.");
        }

        // Bail on improper version name.
        if(!Core.app_version.name) {
            return Console.error("Aph: Cannot run without proper version name.");
        }

        // Bail on improper version number.
        if(!Core.app_version.number) {
            return Console.error("Aph: Cannot run without proper version number.");
        }

        // Bail on improper mode as well.
        var mode = Core.mode;
        if(mode !== QA_MODE && mode !== SILENT_MODE && mode !== MARKET_MODE) {
            return Console.error("Aph: Invalid mode string. Choose from: " +
                QA_MODE + ", " + SILENT_MODE + ", " + MARKET_MODE);
        }

        // Gather and store initial conditions.
        var condsData = Util.dump(Conds.all());
        Store.conds(condsData);

        // Send initialization message to the server.
        Net.identify(afterIdentify);  // This doesn't block (async XHR).

        // Return control to the client application.
        finishInit(callback);
    };


    /* Setup core Apphance parameters using user provided configuration.
     * Validate critical parameters.
     */
    var configureCore = function(config) {
        // Extract application key for current platform.
        config = mergeConfig(config);

        Core.applicationKey = config.applicationKey;

        // Set communication host
        Core.host = config.host || Core.host;

        // Set communication protocol
        Core.protocol = config.protocol || Core.protocol;

        // Production / silent / pre-production mode .
        Core.mode = config.mode || Core.mode;

        // Client application version.
        Core.app_version = {
            number: config.versionNumber,
            name: config.versionName
        };

        // Turn on/off problem reporting with shake.
        if(config.shake !== undefined) {
            Core.shake = config.shake;
        }
    };


    /* Validates application keys object.
     * This object maps platform names to platform-specific application keys.
     * A validated application key for current platform is returned.
     */
    var mergeConfig = function(keys) {
        // Read current platform.
        var platform = Util.platform();

        if (!_.isUndef(keys[platform])) {
            // Update main config with platform specific keys
            keys = _.extend(keys, keys[platform]);
        }
        return keys;
    };


    /* Prepare SDK for application usage.
     * Intercept crashes and console logs.
     * Run client application callback in a guarded block.
     */
    var finishInit = function(callback) {
        // Mark that session has started.
        Core._s = true;

        // Persist session parameters.
        State.save();

        // Intercept unhandled errors.
        Crash.start();

        // Start continuous condition watching.
        Watch.start();

        // Attach problem reporting (only in pre-production).
        if(Core.mode !== MARKET_MODE && Core.shake) {
            Problem.start();
        }


        // Call user provided callback, passing reference to Apphance object.
        // Do it inside try/catch block so we intercept unhandled/unguarded errors.
        try {
            callback(Pub);
        } catch(e) {
            Crash.report(e);
        }
    };


    /* Handle successful Identify API call.
     * Extract received configuration, save it and do a login call.
     */
    var afterIdentify = function(data) {
        // Extract data from response: user list for quick authentication.
        Core.users = data.users || [];
        // Store *initial* configuration.
        Util.bootstrap(Core, data);

        // Persist session parameters.
        State.save();

        // Establish user context via auth info, then login.
        getAuthInfo(_loginAuthCallback);
    };

    // After getting auth info try logging in.
    var _loginAuthCallback = function(auth) {
        // Cache given credentials.
        Core.auth = auth;

        // Login with the Apphance server to receive new session ID.
        Net.login(afterLogin, _failedLogin);
    };

    // React to failed login call due to wrong credentials.
    var _failedLogin = function(error) {
        // Ignore other types of errors.
        if(error !== "BAD_CREDENTIALS") { return; }
        // Go straight to login UI (assuming password mode).
        UI.login(_loginAuthCallback, true);
    };


    /* Depending on working mode gets default auth info or asks user for
     * credentials. Uses callback to return `auth` object.
     */
    var getAuthInfo = function(callback) {
        var mode = Core.mode;
        var auth = Core.auth;

        // If already stored return with cached auth info.
        if(!!auth) {
            return callback(auth);
        }

        // In production mode / silent mode use anonymous account.
        if(mode === MARKET_MODE || mode === SILENT_MODE) {
            return callback({
                email: "anonymous@apphance.com",
                password: ""
            });
        }

        /* In pre-production mode ask user for auth info. */
        var users = Core.users;
        if(!!users && users.length) {
            // Use users fetched with Identify call (Quick Auth).
            UI.selector(callback, users);
        } else {
            // Ask for full credentials (Password Auth).
            UI.login(callback);
        }
    };


    /* Handle successful Login API call, thus starting the session.
     * This is the last function before the callback passed by client application is executed.
     */
    var afterLogin = function(data) {
        // Extract data from response: currently started session key.
        Core.session_key = data.session_key;
        // Store *initial* configuration.
        Util.bootstrap(Core, data);

        // Turn on "complete setup" flag.
        Core._li = true;

        // Persist session parameters.
        State.save();

        // Schedule check for previous offline sessions, try re-submitting.
        setTimeout(Offline.sync, 500);
    };


    // Reset internal state from backup.
    var stopSession = function() {
        // Stop intercepting errors.
        Crash.stop();
        // Stop condition watching.
        Watch.stop();
        // Stop problem reporting.
        Problem.stop();

        // Clear saved state.
        State.clear();

        // Restore previous Apphance state.
        for(var key in Core) {
            delete Core[key];
        }
        _.extend(Core, oldCore);
    };


    return {
        start: startSession,
        stop: stopSession,
        // Exposed for testing.
        _rS: resumeSession,
        _nS: newSession,
        _aI: afterIdentify,
        _aL: afterLogin,
        _fI: finishInit,
        _gAI: getAuthInfo,
        _cC: configureCore
    };
});

/* This is the main module of Apphance Phonegap SDK.
 * It is used to load and export all other modules.
 */
define('sdk',['require','aph/console','aph/pub','aph/deps','aph/core','aph/session','aph/log','aph/problem','aph/crash'],function(require) {
    

    // DEBUG: Include debug utilities.
    // require("aph/debug");

    // Load safe console implementation.
    var Console = require("aph/console");
    // Load the library object/namespace.
    // All exported symbols are attached to this object.
    var Pub = require("aph/pub");


    // Check for dependencies -- stop execution if missing.
    var deps = require("aph/deps");
    if(!deps()) {
        Console.error("Aph: Missing dependencies. Bailing out.");
        // Return library object with all features stubbed.
        // This way we don't break client application code even if the
        // library is not initialized.
        return Pub;
    }


    /** Load submodules with concrete symbol definitions. **/

    // Current session configuration object.
    var Core = require("aph/core");
    // Session-related functions (starting, stopping, etc.)
    var Session = require("aph/session");
    // Load logging utilities.
    var Log = require("aph/log");
    // Load problem reporting functions.
    var Problem = require("aph/problem");
    // Load crash interception functions.
    var Crash = require("aph/crash");


    /** Replace stub symbols from `Pub` module with real implementations. **/

    Pub.VERSION = Core.vname;  // Apphance library version.
    Pub.startSession = Session.start;  // Session starting function.
    Pub.stopSession = Session.stop;  // Session stopping function.

    // Is Apphance ready to work: gather logs, intercept crashes etc.
    Pub.isReady = function() {
        return Core._s;
    };
    // Is Apphance completely set up (with login process finished).
    Pub.isSetUp = function() {
        return Core._li;
    };

    // Expose Apphance logging functions.
    // These are equivalents of standard logging functions in a browser environment.
    Pub.log = Log.log;
    Pub.info = Log.info;
    Pub.warn = Log.warn;
    Pub.error = Log.error;

    // Expose textual user feedback function.
    Pub.feedback = Problem.feedback;
    // Expose bug reporting feature (invokes report editor).
    Pub.bug = Problem.report;

    // Expose function guarding feature.
    // Calling `guard` with any function as an argument wraps it with
    // crash-guard. This means any unhandled exception in that function
    // would be logged and won't propate further.
    Pub.guard = Crash.guard;


    // Export the *Apphance* object.
    return Pub;
});

    var lib = require("sdk");
    if(typeof module !== "undefined" && module.exports) {
        // Export Common.js module.
        module.exports = lib;
    } else if(_def) {
        // Define library for global AMD loader.
        (function(define) {
            define(function() { return lib; });
        }(_def));
    } else {
        // Support no-conflict usage.
        var _old = g["MQA"];
        lib.noConflict = function() {
            g["MQA"] = _old;
            return lib;
        };
    }

    // Define library in global namespace.
    g["MQA"] = lib;
}(this));
