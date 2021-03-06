module.exports = {
  files: null,

  _giveMeReferenceToFile: function(f, refile) {
    if (undefined === refile) {
      refile = false;
    }

    f = env.dirname + '/' + f;

    var methodsLog = new Packages.java.io.File(f);

    if (!methodsLog.canWrite()) {
      if (!methodsLog.exists()) {
        console.log(f);
        methodsLog.createNewFile();
      } else {
        // fuck, no puedo escribir!
        if (!refile) {
          return this._giveMeReferenceToFile(f + '-2', true);
        }
        return false;
      }
    }

    return methodsLog;
  },


  process: function(publish) {
    var me = this;
    this.publish = publish;
    this.log = this.publish.log;
    this.files = {};

    this.publish.kinds.file.data.forEach(function(doclet) {
      me.processFileDoclet(doclet);
    });

    for (var i in this.publish.kinds) {
      if (this.publish.kinds.hasOwnProperty(i)) {
        if (i !== 'file') {
          this.publish.log.dbg('Processing Kind ' + i);
          this.publish.kinds[i].data.forEach(function(doclet) {
            me.processDoclet(doclet);
          });
          this.publish.log.dbg('-- Kind ' + i + ' Processed');
        }
      }
    }

    return this.files;
  },

  processFileDoclet: function(doclet) {
    if (doclet.meta && doclet.meta.filename) {
      if (doclet.meta.path) {
        var f = doclet.meta.path + '/' + doclet.meta.filename;
      } else {
        f = doclet.meta.filename;
      }

      doclet.meta.htmlFile = f.replace(/[:\/\\"'~$<>\.]/g, '_') + '.html';
      // because all path is parsed in the filename, this can exceed the 255 length of filename
      if (doclet.meta.htmlFile.length > 200) {
        var i = doclet.meta.htmlFile.length - 200;
        doclet.meta.htmlFile = doclet.meta.htmlFile.substr(i);
      }


      this.files[f] = doclet.meta;
      this.files[f].description = doclet.description;
    }
  },

  processDoclet: function(doclet) {
    var methodName = 'kind' +
      doclet.kind.charAt(0).toUpperCase() +
      doclet.kind.substring(1).toLowerCase(),
      template = false;

    if (typeof(this[methodName]) === 'function') {
      template = this[methodName](doclet) || false;
    } else {
      template = this.defaultKind(doclet) || false;
    }

    // template deberia ser [kind].tmpl si existe se usa si no se usa un 
    // default a menos que el metodo kindModule devuelva false
    if (template !== false) {
      if (template === true || (typeof template !== 'string')) {
        var templateName = doclet.kind;
      } else {
        templateName = template;
      }

      var fOutputName = (doclet.kind === 'interface') ?
        doclet.longname + '.html' :
        this.publish.helper.longnameToUrl[doclet.longname];

      this.publish.log.dbg('--- Generating doclet kind: ' + doclet.kind + ' | ' + doclet.longname);

      this.publish.generate(
        doclet.name,
        doclet,
        fOutputName,
        templateName
      );
      // toca generar si hay template asociado!
      // this.publish.generate(doclet.name, doclet, doclet.kind, template);
    }
  },

  kindEvent: function(doclet) {
    var name1 = doclet.longname,
      name2;

    if (name1.indexOf('#event') !== -1) {
      name2 = name1.replace('#event:', '.event:');
    } else if (name1.indexOf('.event:') !== -1) {
      name2 = name1.replace('.event:', '#event:');
    } else {
      name2 = false;
    }

    doclet.triggeredBy = this.publish.find({
      kind: 'function',
      fires: {
        'has': name1
      }
    });
    if (name2) {
      doclet.triggeredBy = doclet.triggeredBy.concat(this.publish.find({
        kind: 'function',
        fires: {
          'has': name2
        }
      }));
    }
    doclet.triggeredBy = doclet.triggeredBy.sort(this.publish.sortMethods.sortByName);

    doclet.listenedBy = this.publish.find({
      kind: 'function',
      listen: {
        'has': name1
      }
    });
    if (name2) {
      doclet.listenedBy = doclet.listenedBy.concat(this.publish.find({
        kind: 'function',
        listen: {
          'has': name2
        }
      }));
    }
    doclet.listenedBy = doclet.listenedBy.sort(this.publish.sortMethods.sortByName);

    return false; // no html por cada event
  },

  kindModule: function(doclet) {


    return true; // usa template por default para este kind
  },

  kindNamespace: function(doclet) {

    doclet.namespaces = this.publish.find({
      kind: 'namespace',
      memberof: doclet.longname
    });

    // namespace classes
    doclet.classes = this.publish.find({
      kind: 'class',
      memberof: doclet.longname
    });

    // namespace interfaces
    doclet.interfaces = this.publish.find({
      kind: 'interface',
      memberof: doclet.longname
    });

    // namespace constants
    doclet.constants = this.publish.find({
      kind: 'constant',
      memberof: doclet.longname
    });

    // namespace static properties
    doclet.staticMembers = this.publish.find({
      kind: 'member',
      memberof: doclet.longname,
      scope: 'static'
    });

    // namespace static properties
    doclet.staticMethods = this.publish.find({
      kind: 'function',
      memberof: doclet.longname,
      scope: 'static'
    });

    // class events
    doclet.events = this.publish.find({
      kind: 'event',
      memberof: doclet.longname
    }).sort(this.publish.sortMethods.sortByName);

    return true;
  },

  kindMixin: function(doclet) {
    this.kindClass(doclet);
    return 'class';
  },

  kindClass: function(doclet) {
    doclet.namespaces = this.publish.find({
      kind: 'namespace',
      memberof: doclet.longname
    });

    this._classFinds(doclet);
    /*
        this._classBorrowed(doclet);
        this._classMixesNBorrowed(doclet);
		
        this._classExtends(doclet);
        */
    return true;
  },

  _classFinds: function(doclet) {
    // class constants
    doclet.constants = this.publish.find({
      kind: 'constant',
      memberof: doclet.longname
    });


    // class static methods
    doclet.staticMethods = this.publish.find({
      kind: 'function',
      memberof:
      /*(doclet.mixes && doclet.mixes.length) ? 
						[doclet.longname].concat(doclet.mixes) :  // ya no hace falta */
        doclet.longname,
      scope: 'static'
    });
    //		this._genMethodList(doclet, doclet.staticMethods);

    // class methods
    doclet.methods = this.publish.find({
      kind: 'function',
      memberof:
      /*(doclet.mixes && doclet.mixes.length) ? 
						[doclet.longname].concat(doclet.mixes) :  // ya no hace falta */
        doclet.longname,
      scope: 'instance'
    });
    //		this._genMethodList(doclet, doclet.methods);

    // class static members
    doclet.staticMembers = this.publish.find({
      kind: 'member',
      memberof:
      /*(doclet.mixes && doclet.mixes.length) ? 
						[doclet.longname].concat(doclet.mixes) : // ya no hace falta */
        doclet.longname,
      scope: 'static'
    });
    //		this._genPropertyList(doclet, doclet.staticMembers);

    // class properties
    doclet.members = this.publish.find({
      kind: 'member',
      memberof:
      /*(doclet.mixes && doclet.mixes.length) ? 
						[doclet.longname].concat(doclet.mixes) :  // ya no hace falta */
        doclet.longname,
      scope: 'instance'
    });
    //		this._genPropertyList(doclet, doclet.members);

    // class events
    doclet.events = this.publish.find({
      kind: 'event',
      memberof: doclet.longname
    }).sort(this.publish.sortMethods.sortByName);
  },

  _genMethodList: function(doclet, list) {
    if (!doclet.methodList) {
      doclet.methodList = [];
    }

    list.forEach(function(method) {
      doclet.methodList.push(method.name);
    });
  },

  _genPropertyList: function(doclet, list) {
    if (!doclet.propertyList) {
      doclet.propertyList = [];
    }

    list.forEach(function(property) {
      doclet.propertyList.push(property.name);
    });
  },

  _classExtends: function(doclet) {
    var me = this;

    //me.log.dbg('** Check augments: ' + doclet.longname);

    if (doclet.augments && doclet.augments.length > 0) {

      //me.log.dbg('** Check augments: ' + doclet.longname + ' extends from ', doclet.augments);

      if (!doclet.methodList) {
        doclet.methodList = [];
      }
      //me.log.dbg('** Check augments: ' + doclet.longname + ' methods ', doclet.methodList);
      //me.log.dbg('** Check augments: ' + doclet.longname + ' propertys ', doclet.propertyList);

      for (var i = 0; i < doclet.augments.length; i++) {

        this._insertMethodOf(doclet.augments[i], doclet);
        this._insertPropertyOf(doclet.augments[i], doclet);

      }
    }
  },

  _insertMethodOf: function(parentClassName, doclet) {
    parentClassName = parentClassName.toString();
    var me = this,
      methods = this.publish.find({
        memberof: parentClassName,
        kind: 'function'
      });

    methods.forEach(function(method) {
      if (method.memberof === parentClassName) { // Evito procesar una clase q ya ha pasado por este metodo

        //me.log.dbg('** Check methods augments: ' + doclet.longname + 
        //	' check method: ' + parentClassName + '.'+ method.name);
        if (doclet.methodList.indexOf(method.name) === -1) {

          //me.log.dbg('** Agregando Method Borrow: ' + method.name + ' a ' + doclet.longname);

          if (method.scope === 'static') {
            doclet.staticMethods.push(method);
          } else if (method.scope === 'instance') {
            doclet.methods.push(method);
          }
        } else {
          //me.log.dbg('** Check augments: ' + doclet.longname + ' method: ' + method.name + ' overwrited');
        }
      }
    });

    // recursion al abuelo...
    var parentClass = this.publish.find({
      longname: parentClassName,
      kind: 'class'
    });
    if (parentClass && parentClass.length > 0) {
      parentClass = parentClass[0];
    }

    this.log.dbg('ABUELO!' + parentClassName + ' augments: ' + parentClass.augments);
    if (parentClass.augments && parentClass.augments.length > 0) {
      for (var i = 0; i < parentClass.augments.length; i++) {
        this._insertMethodOf(parentClass.augments[i], doclet);
      }
    }
  },

  _insertPropertyOf: function(parentClassName, doclet) {
    parentClassName = parentClassName.toString();
    var me = this,
      propertys = this.publish.find({
        memberof: parentClassName,
        kind: 'member'
      });

    propertys.forEach(function(property) {
      //me.log.dbg('** Check properties augments: ' + doclet.longname +
      //				' check property: ' + parentClassName + '.'+ property.name);
      if (doclet.propertyList.indexOf(property.name) === -1) {

        //me.log.dbg('** Agregando Property Borrow: ' + property.name + ' a ' + doclet.longname);

        if (property.scope === 'static') {
          doclet.staticMembers.push(property);
        } else if (property.scope === 'instance') {
          doclet.members.push(property);
        }
      } else {
        //me.log.dbg('** Check augments: ' + doclet.longname + ' property: ' + property.name + ' overwrited');
      }
    });

    // recursion al abuelo...
    var parentClass = this.publish.find({
      longname: parentClassName,
      kind: 'class'
    });
    if (parentClass && parentClass.length > 0) {
      parentClass = parentClass[0];
    }

    this.log.dbg('ABUELO!' + parentClassName + ' augments: ' + parentClass.augments);
    if (parentClass.augments && parentClass.augments.length > 0) {
      for (var i = 0; i < parentClass.augments.length; i++) {
        this._insertPropertyOf(parentClass.augments[i], doclet);
      }
    }
  },

  _classBorrowed: function(doclet) {
    // get borrowed properties and methods and corresponding borrowers
    if (doclet.comment) {
      var m = doclet.comment.match(/@borrows ([^\s]+)/ig);

      if (m && m.length) {
        doclet.borrowed = [];
        doclet.borrowers = [];

        for (var j = 0, p = m.length; j < p; j++) {

          var borrowed = m[j]
            .replace('@borrows ', '')
            .replace(/[^#]+#([^#])/i, '$1');

          var borrower = m[j]
            .replace('@borrows ', '')
            .replace(/([^#])#[^#]+/i, '$1');

          doclet.borrowed.push(borrowed);
          doclet.borrowers.push(borrower);
        }
      }
    }
  },

  _classMixesNBorrowed: function(doclet) {
    // mark mixed and borrowed properties and methods
    if (doclet.mixes && doclet.mixes.length) {
      for (var i = 0, n = doclet.mixes.length; i < n; ++i) {
        // find mixin methods
        var mixedMethods = this.publish.find({
          kind: 'function',
          memberof: doclet.mixes[i],
          scope: 'instance'
        });

        // find mixin properties
        var mixedMembers = this.publish.find({
          kind: 'member',
          memberof: doclet.mixes[i],
          scope: 'instance'
        });

        // mixed methods lookup table
        var mixedMethodNames = [],
          mixedMemberNames = [];

        mixedMethods.forEach(function(method) {
          mixedMethodNames.push(method.name);
        });

        mixedMembers.forEach(function(prop) {
          mixedMemberNames.push(prop.name);
        });

        // check each instance method
        doclet.methods.forEach(function(method) {
          if (mixedMethodNames.indexOf(method.name) > -1) {
            method.mixed = true;
            method.borrower = doclet.mixes[i];
          }

          if (doclet.borrowed) {
            var index = doclet.borrowed.indexOf(method.name);
            if (index > -1) {
              method.borrowed = true;
              method.borrower = doclet.borrowers[index];
            }
          }
        });

        // check each instance property
        doclet.members.forEach(function(prop) {
          if (mixedMemberNames.indexOf(prop.name) > -1) {
            prop.mixed = true;
            prop.borrower = doclet.mixes[i];
          }

          if (doclet.borrowed) {
            var index = doclet.borrowed.indexOf(prop.name);
            if (index > -1) {
              prop.borrowed = true;
              prop.borrower = doclet.borrowers[index];
            }
          }
        });
      }
    }
  },

  _generateSRCFilesPages: function() {
    var sortedFiles = {},
      fkeys = [];
    for (var k in this.files) {
      if (this.files.hasOwnProperty(k)) {
        fkeys.push(k);
      }
    }
    fkeys.sort();
    for (var i = 0, n = fkeys.length; i < n; ++i) {
      sortedFiles[fkeys[i]] = this.files[fkeys[i]];
    }

    // generate files index
    if (this.files) {
      this.publish.generate(
        'Files',
        this.files,
        'file_index.html',
        'file_index'
      );

      // generate pages for each file
      var filename;
      for (filename in this.files) {
        if (this.files.hasOwnProperty(filename)) {
          this.publish.generate(
            filename, {
              info: this.publish.info,
              code: this.publish.fs.readFileSync(
                env.dirname + '/' + filename,
                env.opts.encoding
              )
            },
            this.files[filename].htmlFile,
            'file'
          );
        }
      }
    }
  },

  defaultKind: function(doclet) {
    return false;
  }

};