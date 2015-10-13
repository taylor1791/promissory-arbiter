var fs = require('fs');
var copySync = require('fs-extra').copySync;
var path = require('path');
var handlebars = require('handlebars');
var marked = require('marked');

handlebars.registerHelper('normalize', normalize);
handlebars.registerHelper('markdown', marked);

const order = {
  Topic: 10,
  Subscription: 20,
  subscribe: 30,
  publish: 40,
  Options: 50,
  PublicationPromise: 55,
  unsubscribe: 60,
  resubscribe: 70,
  removePersisted: 80,
  create: 90
};

const templateDir = 'docs/template';

module.exports.publish = publish;

function publish(taffy, opts) {
  var
    template = fs.readFileSync(path.join(templateDir, 'index.html'), 'utf8'),
    data =  {
      pkg: require('../../package.json'),
      readme: parseReadMe(),
      docItems: []
    };

  taffy()
    .filter({memberof: 'Arbiter'})
    .update(addOrder)
    .order('order').each(function(item) {
      data.docItems.push(item);
    });

  var index = handlebars.compile(template)(data);

  createOutput(opts, index, data);
}

function createOutput(opts, index, data) {
  var
    destination = opts.destination,
    staticDest = path.join(opts.destination, '/static');

  fs.mkdir(destination);
  fs.mkdir(staticDest);

  fs.writeFileSync(
    path.join(destination, 'index.html'),
    index,
    'utf8'
  );

  copySync(path.join(templateDir, 'static/'), staticDest);
  copySync(data.pkg.main, path.join(staticDest, 'promissory-arbiter.js'));
}

function addOrder(doc) {
  this.order = order[this.name] || 1000;
  return this;
}

function normalize(str) {
  str = str.charAt(0).toLowerCase() + str.slice(1);
  return str.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase();
}

function camelize(str) {
  str = str.charAt(0).toLowerCase() + str.slice(1);
  return str.replace(/\s+/g, '');
}

function parseReadMe() {
  var readme = fs.readFileSync('README.md', 'utf8');
  var tokens = marked.lexer(readme);
  var parts = {};
  var rendered = {};
  var currentHeading = null;

  tokens.forEach(function(token, i) {
    if (token.type === 'heading') {
      if (token.depth === 1) {
        parts.title = token.text;
      } else {
        currentHeading = camelize(token.text);
      }
    } else {
      if(!parts[currentHeading]) {
        parts[currentHeading] = [];
        parts[currentHeading].links = {};
      }
      parts[currentHeading].push(token);
    }
  });

  for(var section in parts) {
    if (typeof parts[section] === 'object') {
      rendered[section] = marked.parser(parts[section]);
    }
  }

  return rendered;
}


