define('app',['exports', 'aurelia-framework', 'aurelia-event-aggregator', 'resources/services/http'], function (exports, _aureliaFramework, _aureliaEventAggregator, _http) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.App = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var App = exports.App = (_dec = (0, _aureliaFramework.inject)(_aureliaEventAggregator.EventAggregator, _http.Http), _dec(_class = function () {
		function App(ea, http) {
			_classCallCheck(this, App);

			this.ea = ea;
			this.http = http;

			this.loadingSubscription = this.ea.subscribe('router:navigation:processing', function (event) {
				document.documentElement.classList.add('loading');
			});

			this.navigationSubscription = this.ea.subscribe('router:navigation:success', function (event) {
				document.documentElement.classList.remove('loading');
			});
		}

		App.prototype.attached = function attached() {
			var _this = this;

			var unsplashKey = '4d6fb906f11c473986d67a17526e0949ed4f6b084565793cd88dd4615167cc62';

			this.http.get('https://api.unsplash.com/photos/random?client_id=' + unsplashKey).then(function (data) {
				_this.setBg(data);
			}).catch(function (error) {
				_this.setBg({
					urls: { regular: 'scripts/assets/bg/bg.jpg' },
					user: {
						urls: { html: 'https://unsplash.com/@grakozy' },
						name: 'Greg Rakozy'
					}
				});
			});
		};

		App.prototype.setBg = function setBg(data) {
			var style = document.createElement('style');

			style.type = 'text/css';
			style.innerHTML = '.text--cutout, body {background-image: url(' + data.urls.regular + ')}';

			document.getElementsByTagName('head')[0].appendChild(style);

			var credit = document.createElement('p');

			credit.classList.add('photo-credit');
			credit.innerHTML = 'Photo by <a href="' + data.user.urls.html + '">' + data.user.name + '</a>';

			document.body.appendChild(credit);
		};

		App.prototype.configureRouter = function configureRouter(config, router) {
			config.title = 'AndreasLagerkvist.com';
			config.options.pushState = true;
			config.options.hashChange = false;
			config.options.root = '/';

			config.map([{
				route: [''],
				name: 'home',
				moduleId: 'resources/elements/front-page/front-page',
				title: ''
			}]);
		};

		return App;
	}()) || _class);
});
define('environment',['exports'], function (exports) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.default = {
		debug: true,
		testing: true,
		root: '/'
	};
});
define('main',['exports', './environment'], function (exports, _environment) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.configure = configure;

	var _environment2 = _interopRequireDefault(_environment);

	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : {
			default: obj
		};
	}

	Promise.config({
		warnings: {
			wForgottenReturn: false
		}
	});

	function configure(aurelia) {
		aurelia.use.standardConfiguration().feature('resources');

		if (_environment2.default.debug) {
			aurelia.use.developmentLogging();
		}

		if (_environment2.default.testing) {
			aurelia.use.plugin('aurelia-testing');
		}

		aurelia.start().then(function () {
			return aurelia.setRoot();
		});
	}
});
define('resources/index',['exports'], function (exports) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.configure = configure;
	function configure(config) {
		config.globalResources(['resources/attributes/parallax', 'resources/attributes/scrollspy', 'resources/attributes/smooth-scroll', 'resources/value-converters/readable']);
	}
});
define('resources/attributes/parallax',['exports', 'aurelia-framework'], function (exports, _aureliaFramework) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.ParallaxCustomAttribute = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var ParallaxCustomAttribute = exports.ParallaxCustomAttribute = (_dec = (0, _aureliaFramework.inject)(Element), _dec(_class = function () {
		function ParallaxCustomAttribute(el) {
			var _this = this;

			_classCallCheck(this, ParallaxCustomAttribute);

			this.el = el;
			this.parallaxAmount = 1.5;

			this.onResize = function (e) {
				_this.winDim = _this.getWindowDimensions();
			};
			this.onScroll = function (e) {
				window.requestAnimationFrame(function () {
					_this.el.style.backgroundPosition = '50% calc(100% + ' + _this.calculateImgPosition() + 'px)';
				});
			};
		}

		ParallaxCustomAttribute.prototype.attached = function attached() {
			this.winDim = this.getWindowDimensions();

			this.el.style.backgroundImage = 'url(' + this.el.getAttribute('parallax') + ')';
			this.el.style.backgroundRepeat = 'no-repeat';
			this.el.style.backgroundSize = 'auto ' + 100 * this.parallaxAmount + '%';
			this.el.style.backgroundPosition = '50% calc(100% + ' + this.calculateImgPosition() + 'px)';

			if (true || window.matchMedia('(min-width: 800px)').matches) {
				window.addEventListener('scroll', this.onScroll);
				window.addEventListener('resize', this.onResize);
			}
		};

		ParallaxCustomAttribute.prototype.detached = function detached() {
			window.removeEventListener('resize', this.onResize);
			window.removeEventListener('scroll', this.onScroll);
		};

		ParallaxCustomAttribute.prototype.createImg = function createImg(src) {
			var img = document.createElement('img');

			img.src = src;

			img.classList.add('parallax');

			img.style.position = 'absolute';
			img.style.left = '50%';
			img.style.bottom = '0';
			img.style.zIndex = '-1';
			img.style.pointerEvents = 'none';
			img.style.width = 'auto';
			img.style.height = 'auto';
			img.style.minWidth = '100%';
			img.style.minHeight = 100 * this.parallaxAmount + '%';
			img.style.maxWidth = 'none';
			img.style.maxHeight = 'none';
			img.style.transform = 'translate(-50%, 0px)';

			return img;
		};

		ParallaxCustomAttribute.prototype.calculateImgPosition = function calculateImgPosition() {
			var elDim = this.el.getBoundingClientRect();
			var percent = 0;

			if (elDim.top >= this.winDim.height) {
				percent = 0;
			} else if (elDim.top + elDim.height <= 0) {
				percent = 1;
			} else {
				var totalScrollDistance = this.winDim.height + elDim.height;
				var scrolledSoFar = totalScrollDistance - elDim.bottom;

				percent = scrolledSoFar / totalScrollDistance;
			}

			var imageExcess = elDim.height * this.parallaxAmount - elDim.height;
			var translateY = imageExcess * percent;

			return translateY;
		};

		ParallaxCustomAttribute.prototype.getWindowDimensions = function getWindowDimensions() {
			var h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

			return {
				height: h
			};
		};

		return ParallaxCustomAttribute;
	}()) || _class);
});
define('resources/attributes/scrollspy',['exports', 'aurelia-framework'], function (exports, _aureliaFramework) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.ScrollspyCustomAttribute = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var ScrollspyCustomAttribute = exports.ScrollspyCustomAttribute = (_dec = (0, _aureliaFramework.inject)(Element), _dec(_class = function () {
		function ScrollspyCustomAttribute(el) {
			var _this = this;

			_classCallCheck(this, ScrollspyCustomAttribute);

			this.el = el;
			this.offset = 200;

			this.onScroll = function (e) {
				window.requestAnimationFrame(function () {
					_this.spy();
				});
			};
		}

		ScrollspyCustomAttribute.prototype.attached = function attached() {
			window.addEventListener('scroll', this.onScroll);

			this.spy();
		};

		ScrollspyCustomAttribute.prototype.detached = function detached() {
			window.removeEventListener('scroll', this.onScroll);
		};

		ScrollspyCustomAttribute.prototype.isInView = function isInView() {
			var winH = window.innerHeight,
			    scrollTop = document.documentElement.scrollTop || document.body.scrollTop,
			    scrollBottom = scrollTop + winH,
			    rect = this.el.getBoundingClientRect(),
			    elTop = rect.top + scrollTop,
			    elBottom = elTop + this.el.offsetHeight;

			return elTop + this.offset < scrollBottom && elBottom > scrollTop;
		};

		ScrollspyCustomAttribute.prototype.spy = function spy() {
			if (this.isInView()) {
				this.el.classList.add('in-view');
				this.el.classList.add('was-in-view');
			} else {
				this.el.classList.remove('in-view');
			}
		};

		return ScrollspyCustomAttribute;
	}()) || _class);
});
define('resources/attributes/smooth-scroll',['exports', 'aurelia-framework', 'velocity-animate'], function (exports, _aureliaFramework, _velocityAnimate) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.SmoothScrollCustomAttribute = undefined;

	var _velocityAnimate2 = _interopRequireDefault(_velocityAnimate);

	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : {
			default: obj
		};
	}

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var SmoothScrollCustomAttribute = exports.SmoothScrollCustomAttribute = (_dec = (0, _aureliaFramework.inject)(Element), _dec(_class = function () {
		function SmoothScrollCustomAttribute(el) {
			var _this = this;

			_classCallCheck(this, SmoothScrollCustomAttribute);

			this.el = el;

			this.onClick = function (e) {
				e.preventDefault();
				_this.scroll();
			};
		}

		SmoothScrollCustomAttribute.prototype.attached = function attached() {
			this.el.addEventListener('click', this.onClick);
			this.target = document.getElementById(this.el.getAttribute('href').substr(1));
		};

		SmoothScrollCustomAttribute.prototype.detached = function detached() {
			this.el.removeEventListener('click', this.onClick);
		};

		SmoothScrollCustomAttribute.prototype.scroll = function scroll() {
			(0, _velocityAnimate2.default)(this.target, 'scroll', {
				duration: 800,
				offset: -100
			});
		};

		return SmoothScrollCustomAttribute;
	}()) || _class);
});
define('resources/services/http',['exports', 'aurelia-framework', 'aurelia-fetch-client'], function (exports, _aureliaFramework, _aureliaFetchClient) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Http = undefined;

	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
		return typeof obj;
	} : function (obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var Http = exports.Http = (_dec = (0, _aureliaFramework.inject)(_aureliaFetchClient.HttpClient), _dec(_class = function () {
		function Http(http) {
			_classCallCheck(this, Http);

			this.http = http;
		}

		Http.prototype.get = function get(url, data) {

			var config = {
				method: 'get',

				Accept: 'application/json'
			};

			return this.http.fetch(url, config).then(function (response) {
				return response.json();
			}).then(function (json) {
				return json;
			});
		};

		Http.prototype.post = function post(url, data) {
			var config = {
				method: 'post',

				Accept: 'application/json'
			};

			if (data && !data.body) {
				config.body = JSON.stringify(data);
			} else if (data && data.body) {
					config.body = data.body;
				}

			return this.http.fetch(url, config).then(function (response) {
				return response.json();
			}).then(function (json) {
				return json;
			});
		};

		Http.prototype.serialize = function serialize(obj, prefix) {
			var str = [];

			for (var p in obj) {
				if (obj.hasOwnProperty(p)) {
					var k = prefix ? prefix + '[' + (Array.isArray(obj) ? '' : p) + ']' : p,
					    v = obj[p];

					str.push((typeof v === 'undefined' ? 'undefined' : _typeof(v)) == 'object' ? this.serialize(v, k) : encodeURIComponent(k) + '=' + encodeURIComponent(v));
				}
			}

			return str.join('&');
		};

		return Http;
	}()) || _class);
});
define('resources/value-converters/readable',['exports'], function (exports) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var ReadableValueConverter = exports.ReadableValueConverter = function () {
		function ReadableValueConverter() {
			_classCallCheck(this, ReadableValueConverter);
		}

		ReadableValueConverter.prototype.toView = function toView(value) {
			var _this = this;

			value = value.replace(/\-/g, ' ');
			value = value.replace(/\b\w/g, function (str) {
				return _this.capitalize(str);
			});
			value = value.replace(/(CSS|JS|WP)/ig, function (str) {
				return str.toUpperCase();
			});

			return this.capitalize(value.replace(/\-/, ' '));
		};

		ReadableValueConverter.prototype.capitalize = function capitalize(str) {
			return str.charAt(0).toUpperCase() + str.slice(1);
		};

		return ReadableValueConverter;
	}();
});
define('resources/elements/about/about',['exports', 'aurelia-framework', '../../services/http'], function (exports, _aureliaFramework, _http) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.About = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var About = exports.About = (_dec = (0, _aureliaFramework.inject)(_http.Http), _dec(_class = function () {
		function About(http) {
			_classCallCheck(this, About);

			this.http = http;
		}

		About.prototype.attached = function attached() {
			var _this = this;

			this.http.get('https://api.github.com/users/powerbuoy').then(function (user) {
				_this.user = user;
			});
		};

		return About;
	}()) || _class);
});
define('resources/elements/front-page/front-page',["exports"], function (exports) {
	"use strict";

	Object.defineProperty(exports, "__esModule", {
		value: true
	});

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var FrontPage = exports.FrontPage = function FrontPage() {
		_classCallCheck(this, FrontPage);
	};
});
define('resources/elements/repos/repos',['exports', 'aurelia-framework', '../../services/http'], function (exports, _aureliaFramework, _http) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Repos = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var Repos = exports.Repos = (_dec = (0, _aureliaFramework.inject)(_http.Http), _dec(_class = function () {
		function Repos(http) {
			_classCallCheck(this, Repos);

			this.http = http;
		}

		Repos.prototype.attached = function attached() {
			var _this = this;

			var ignore = ['fun', 'powerbuoy.github.io', 'SleekHTMLWidget'];

			this.http.get('https://api.github.com/users/powerbuoy/repos').then(function (data) {
				var repos = [];

				data.forEach(function (i) {
					if (ignore.indexOf(i.name) === -1) {
						repos.push(i);
					}
				});

				_this.repos = repos;

				console.dir(repos);
			});
		};

		return Repos;
	}()) || _class);
});
define('text!app.html', ['module'], function(module) { module.exports = "<template>\n\n\t<require from=\"resources/sass/app.css\"></require>\n\n\t<router-view layout-view=\"resources/layouts/default.html\"></router-view>\n\n</template>\n"; });
define('text!resources/layouts/default.html', ['module'], function(module) { module.exports = "<template>\n\n\t<main>\n\n\t\t<slot></slot>\n\n\t</main>\n\n</template>\n"; });
define('text!resources/elements/front-page/front-page.html', ['module'], function(module) { module.exports = "<template>\n\n\t<require from=\"../about/about\"></require>\n\t<require from=\"../repos/repos\"></require>\n\n\t<about></about>\n\t<repos></repos>\n\n</template>\n"; });
define('text!resources/elements/about/about.html', ['module'], function(module) { module.exports = "<template>\n\n\t<figure>\n\n\t\t<img src=\"${user.avatar_url}\">\n\n\t\t<figcaption>\n\n\t\t\t<h1 class=\"text--cutout\">${user.name}</h1>\n\n\t\t\t<nav>\n\t\t\t\t<a href=\"//github.com/powerbuoy\" class=\"icon-github\" title=\"GitHub\"></a>\n\t\t\t\t<a href=\"//stackoverflow.com/users/1074594/powerbuoy\" class=\"icon-stackoverflow\" title=\"StackOverflow\"></a>\n\t\t\t</nav>\n\n\t\t\t<p><strong>${user.login}</strong> ${user.location}</p>\n\n\t\t\t<p>${user.bio}</p>\n\n\t\t</figcaption>\n\n\t</figure>\n\n\t<a href=\"#repos\" smooth-scroll class=\"icon-down\"></a>\n\n</template>\n"; });
define('text!resources/sass/app.css', ['module'], function(module) { module.exports = "@charset \"UTF-8\";\n@font-face {\n  font-family: 'fontello';\n  src: url(\"scripts/icons/font/fontello.eot?30677402\");\n  src: url(\"scripts/icons/font/fontello.eot?30677402#iefix\") format(\"embedded-opentype\"), url(\"scripts/icons/font/fontello.woff2?30677402\") format(\"woff2\"), url(\"scripts/icons/font/fontello.woff?30677402\") format(\"woff\"), url(\"scripts/icons/font/fontello.ttf?30677402\") format(\"truetype\"), url(\"scripts/icons/font/fontello.svg?30677402#fontello\") format(\"svg\");\n  font-weight: normal;\n  font-style: normal; }\n\n/* Chrome hack: SVG is rendered more smooth in Windozze. 100% magic, uncomment if you need it. */\n/* Note, that will break hinting! In other OS-es font will be not as sharp as it could be */\n/*\n@media screen and (-webkit-min-device-pixel-ratio:0) {\n  @font-face {\n    font-family: 'fontello';\n    src: url('scripts/icons/font/fontello.svg?30677402#fontello') format('svg');\n  }\n}\n*/\n[class^=\"icon-\"]:before, [class*=\" icon-\"]:before,\n[class^=\"icon-\"]:after, [class*=\" icon-\"]:after {\n  font-family: \"fontello\";\n  font-style: normal;\n  font-weight: normal;\n  speak: none;\n  display: inline-block;\n  text-decoration: inherit;\n  width: 1em;\n  margin-right: .2em;\n  text-align: center;\n  /* opacity: .8; */\n  /* For safety - reset parent styles, that can break glyph codes*/\n  font-variant: normal;\n  text-transform: none;\n  /* fix buttons height, for twitter bootstrap */\n  line-height: 1em;\n  /* Animation center compensation - margins should be symmetric */\n  /* remove if not needed */\n  margin-left: .2em;\n  /* you can be more comfortable with increased icons size */\n  /* font-size: 120%; */\n  /* Font smoothing. That was taken from TWBS */\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  /* Uncomment for 3D effect */\n  /* text-shadow: 1px 1px 1px rgba(127, 127, 127, 0.3); */ }\n\n.icon-facebook:before {\n  content: '\\e800'; }\n\n.icon-facebook.icon--after:before {\n  content: normal; }\n\n.icon-facebook.icon--after:after {\n  content: '\\e800'; }\n\n/* '' */\n.icon-down:before {\n  content: '\\e801'; }\n\n.icon-down.icon--after:before {\n  content: normal; }\n\n.icon-down.icon--after:after {\n  content: '\\e801'; }\n\n/* '' */\n.icon-left:before {\n  content: '\\e802'; }\n\n.icon-left.icon--after:before {\n  content: normal; }\n\n.icon-left.icon--after:after {\n  content: '\\e802'; }\n\n/* '' */\n.icon-right:before {\n  content: '\\e803'; }\n\n.icon-right.icon--after:before {\n  content: normal; }\n\n.icon-right.icon--after:after {\n  content: '\\e803'; }\n\n/* '' */\n.icon-up:before {\n  content: '\\e804'; }\n\n.icon-up.icon--after:before {\n  content: normal; }\n\n.icon-up.icon--after:after {\n  content: '\\e804'; }\n\n/* '' */\n.icon-plus:before {\n  content: '\\e805'; }\n\n.icon-plus.icon--after:before {\n  content: normal; }\n\n.icon-plus.icon--after:after {\n  content: '\\e805'; }\n\n/* '' */\n.icon-minus:before {\n  content: '\\e806'; }\n\n.icon-minus.icon--after:before {\n  content: normal; }\n\n.icon-minus.icon--after:after {\n  content: '\\e806'; }\n\n/* '' */\n.icon-stackoverflow:before {\n  content: '\\e807'; }\n\n.icon-stackoverflow.icon--after:before {\n  content: normal; }\n\n.icon-stackoverflow.icon--after:after {\n  content: '\\e807'; }\n\n/* '' */\n.icon-download:before {\n  content: '\\e808'; }\n\n.icon-download.icon--after:before {\n  content: normal; }\n\n.icon-download.icon--after:after {\n  content: '\\e808'; }\n\n/* '' */\n.icon-ok:before {\n  content: '\\e80b'; }\n\n.icon-ok.icon--after:before {\n  content: normal; }\n\n.icon-ok.icon--after:after {\n  content: '\\e80b'; }\n\n/* '' */\n.icon-cancel:before {\n  content: '\\e80c'; }\n\n.icon-cancel.icon--after:before {\n  content: normal; }\n\n.icon-cancel.icon--after:after {\n  content: '\\e80c'; }\n\n/* '' */\n.icon-twitter:before {\n  content: '\\f099'; }\n\n.icon-twitter.icon--after:before {\n  content: normal; }\n\n.icon-twitter.icon--after:after {\n  content: '\\f099'; }\n\n/* '' */\n.icon-github:before {\n  content: '\\f09b'; }\n\n.icon-github.icon--after:before {\n  content: normal; }\n\n.icon-github.icon--after:after {\n  content: '\\f09b'; }\n\n/* '' */\n.icon-linkedin:before {\n  content: '\\f0e1'; }\n\n.icon-linkedin.icon--after:before {\n  content: normal; }\n\n.icon-linkedin.icon--after:after {\n  content: '\\f0e1'; }\n\n/* '' */\n.icon-spinner:before {\n  content: '\\f110'; }\n\n.icon-spinner.icon--after:before {\n  content: normal; }\n\n.icon-spinner.icon--after:after {\n  content: '\\f110'; }\n\n/* '' */\n/*! normalize.css v2.1.3 | MIT License | git.io/normalize */\n/* ==========================================================================\n   HTML5 display definitions\n   ========================================================================== */\n/**\n * Correct `block` display not defined in IE 8/9.\n */\narticle,\naside,\ndetails,\nfigcaption,\nfigure,\nfooter,\nheader,\nhgroup,\nmain,\nnav,\nsection,\nsummary {\n  display: block; }\n\n/**\n * Correct `inline-block` display not defined in IE 8/9.\n */\naudio,\ncanvas,\nvideo {\n  display: inline-block; }\n\n/**\n * Prevent modern browsers from displaying `audio` without controls.\n * Remove excess height in iOS 5 devices.\n */\naudio:not([controls]) {\n  display: none;\n  height: 0; }\n\n/**\n * Address `[hidden]` styling not present in IE 8/9.\n * Hide the `template` element in IE, Safari, and Firefox < 22.\n */\n[hidden],\ntemplate {\n  display: none; }\n\n/* ==========================================================================\n   Base\n   ========================================================================== */\n/**\n * 1. Set default font family to sans-serif.\n * 2. Prevent iOS text size adjust after orientation change, without disabling\n *    user zoom.\n */\nhtml {\n  font-family: sans-serif;\n  /* 1 */\n  -ms-text-size-adjust: 100%;\n  /* 2 */\n  -webkit-text-size-adjust: 100%;\n  /* 2 */ }\n\n/**\n * Remove default margin.\n */\nbody {\n  margin: 0; }\n\n/* ==========================================================================\n   Links\n   ========================================================================== */\n/**\n * Remove the gray background color from active links in IE 10.\n */\na {\n  background: transparent; }\n\n/**\n * Address `outline` inconsistency between Chrome and other browsers.\n */\na:focus {\n  outline: thin dotted; }\n\n/**\n * Improve readability when focused and also mouse hovered in all browsers.\n */\na:active,\na:hover {\n  outline: 0; }\n\n/* ==========================================================================\n   Typography\n   ========================================================================== */\n/**\n * Address variable `h1` font-size and margin within `section` and `article`\n * contexts in Firefox 4+, Safari 5, and Chrome.\n */\nh1 {\n  font-size: 2em;\n  margin: 0.67em 0; }\n\n/**\n * Address styling not present in IE 8/9, Safari 5, and Chrome.\n */\nabbr[title] {\n  border-bottom: 1px dotted; }\n\n/**\n * Address style set to `bolder` in Firefox 4+, Safari 5, and Chrome.\n */\nb,\nstrong {\n  font-weight: bold; }\n\n/**\n * Address styling not present in Safari 5 and Chrome.\n */\ndfn {\n  font-style: italic; }\n\n/**\n * Address differences between Firefox and other browsers.\n */\nhr {\n  box-sizing: content-box;\n  height: 0; }\n\n/**\n * Address styling not present in IE 8/9.\n */\nmark {\n  background: #ff0;\n  color: #000; }\n\n/**\n * Correct font family set oddly in Safari 5 and Chrome.\n */\ncode,\nkbd,\npre,\nsamp {\n  font-family: monospace, serif;\n  font-size: 1em; }\n\n/**\n * Improve readability of pre-formatted text in all browsers.\n */\npre {\n  white-space: pre-wrap; }\n\n/**\n * Set consistent quote types.\n */\nq {\n  quotes: \"\\201C\" \"\\201D\" \"\\2018\" \"\\2019\"; }\n\n/**\n * Address inconsistent and variable font size in all browsers.\n */\nsmall {\n  font-size: 80%; }\n\n/**\n * Prevent `sub` and `sup` affecting `line-height` in all browsers.\n */\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline; }\n\nsup {\n  top: -0.5em; }\n\nsub {\n  bottom: -0.25em; }\n\n/* ==========================================================================\n   Embedded content\n   ========================================================================== */\n/**\n * Remove border when inside `a` element in IE 8/9.\n */\nimg {\n  border: 0; }\n\n/**\n * Correct overflow displayed oddly in IE 9.\n */\nsvg:not(:root) {\n  overflow: hidden; }\n\n/* ==========================================================================\n   Figures\n   ========================================================================== */\n/**\n * Address margin not present in IE 8/9 and Safari 5.\n */\nfigure {\n  margin: 0; }\n\n/* ==========================================================================\n   Forms\n   ========================================================================== */\n/**\n * Define consistent border, margin, and padding.\n */\nfieldset {\n  border: 1px solid #c0c0c0;\n  margin: 0 2px;\n  padding: 0.35em 0.625em 0.75em; }\n\n/**\n * 1. Correct `color` not being inherited in IE 8/9.\n * 2. Remove padding so people aren't caught out if they zero out fieldsets.\n */\nlegend {\n  border: 0;\n  /* 1 */\n  padding: 0;\n  /* 2 */ }\n\n/**\n * 1. Correct font family not being inherited in all browsers.\n * 2. Correct font size not being inherited in all browsers.\n * 3. Address margins set differently in Firefox 4+, Safari 5, and Chrome.\n */\nbutton,\ninput,\nselect,\ntextarea {\n  font-family: inherit;\n  /* 1 */\n  font-size: 100%;\n  /* 2 */\n  margin: 0;\n  /* 3 */ }\n\n/**\n * Address Firefox 4+ setting `line-height` on `input` using `!important` in\n * the UA stylesheet.\n */\nbutton,\ninput {\n  line-height: normal; }\n\n/**\n * Address inconsistent `text-transform` inheritance for `button` and `select`.\n * All other form control elements do not inherit `text-transform` values.\n * Correct `button` style inheritance in Chrome, Safari 5+, and IE 8+.\n * Correct `select` style inheritance in Firefox 4+ and Opera.\n */\nbutton,\nselect {\n  text-transform: none; }\n\n/**\n * 1. Avoid the WebKit bug in Android 4.0.* where (2) destroys native `audio`\n *    and `video` controls.\n * 2. Correct inability to style clickable `input` types in iOS.\n * 3. Improve usability and consistency of cursor style between image-type\n *    `input` and others.\n */\nbutton,\nhtml input[type=\"button\"],\ninput[type=\"reset\"],\ninput[type=\"submit\"] {\n  -webkit-appearance: button;\n  /* 2 */\n  cursor: pointer;\n  /* 3 */ }\n\n/**\n * Re-set default cursor for disabled elements.\n */\nbutton[disabled],\nhtml input[disabled] {\n  cursor: default; }\n\n/**\n * 1. Address box sizing set to `content-box` in IE 8/9/10.\n * 2. Remove excess padding in IE 8/9/10.\n */\ninput[type=\"checkbox\"],\ninput[type=\"radio\"] {\n  box-sizing: border-box;\n  /* 1 */\n  padding: 0;\n  /* 2 */ }\n\n/**\n * 1. Address `appearance` set to `searchfield` in Safari 5 and Chrome.\n * 2. Address `box-sizing` set to `border-box` in Safari 5 and Chrome\n *    (include `-moz` to future-proof).\n */\ninput[type=\"search\"] {\n  -webkit-appearance: textfield;\n  /* 1 */\n  /* 2 */\n  box-sizing: content-box; }\n\n/**\n * Remove inner padding and search cancel button in Safari 5 and Chrome\n * on OS X.\n */\ninput[type=\"search\"]::-webkit-search-cancel-button,\ninput[type=\"search\"]::-webkit-search-decoration {\n  -webkit-appearance: none; }\n\n/**\n * Remove inner padding and border in Firefox 4+.\n */\nbutton::-moz-focus-inner,\ninput::-moz-focus-inner {\n  border: 0;\n  padding: 0; }\n\n/**\n * 1. Remove default vertical scrollbar in IE 8/9.\n * 2. Improve readability and alignment in all browsers.\n */\ntextarea {\n  overflow: auto;\n  /* 1 */\n  vertical-align: top;\n  /* 2 */ }\n\n/* ==========================================================================\n   Tables\n   ========================================================================== */\n/**\n * Remove most spacing between table cells.\n */\ntable {\n  border-collapse: collapse;\n  border-spacing: 0; }\n\n/**\n * @arrow\n *\n * Adds an arrow to an element\n *\n * @param\t\tposition\t$position: where the arrow should be added; left/top/right/bottom\n * @param\t\tunit\t\t$size: size of arrow (20px for example)\n * @param\t\tcolor\t\t$background: the arrow's background color\n * @param\t\tunit\t\t$border-width: the width of the arrow's border\n * @param\t\tcolor\t\t$border-color: color of the border\n * @param\t\tpercent\t\t$align: how to align the arrow (left|10px|50% etc)\n */\n/**\n * @card-flip\n *\n * Use on a container with two children, the first child will be visible and on hover the container will rotate to reveal the second child\n *\n * @param\tbool\t$hover: whether to rotate the \"card\" on hover (you may wanna do this manually)\n * @param:\tstring\t$rotate: X or Y - in which direction to rotate\n */\ndl.key-val dt {\n  display: inline;\n  font-weight: bold; }\n\ndl.key-val dt:after {\n  content: \": \"; }\n\ndl.key-val dd {\n  display: inline;\n  margin: 0; }\n\ndl.key-val dd:after {\n  content: \"\\a\";\n  white-space: pre; }\n\n/**\n * @device\n *\n * Turns an element into a mobile device (Nexus 5-looking)\n *\n * @param\tunit\t$width: the width of the device\n * @param\tcolor\t$color: color of the device\n * @param\tbool\t$h: whether to set height (if used on an img height should be auto)\n */\n.osx-dock > * {\n  opacity: 1;\n  -webkit-transform: scale(1);\n          transform: scale(1);\n  -webkit-transition: all 0.25s ease-out;\n  transition: all 0.25s ease-out; }\n\n.osx-dock:hover > *,\n.osx-dock.active > * {\n  opacity: .6;\n  -webkit-transform: scale(0.9);\n          transform: scale(0.9); }\n\n.osx-dock:hover > :hover,\n.osx-dock.active > .active {\n  opacity: 1;\n  -webkit-transform: scale(1.1);\n          transform: scale(1.1); }\n\n/***\n    title: Background Colors\n    section: Colors\n    description: Use to apply a background color to an element. Add your colors to the $bg-colors array in config/bg-colors.scss.\n    example:\n        <div class=\"bg--white\">I have a white background color</div>\n***/\n.bg--white {\n  background-color: #fff; }\n\n.bg--x-lightgray {\n  background-color: #f9f9f9; }\n\n.bg--darkgray {\n  background-color: #666; }\n\n.bg--bluegray {\n  background-color: #68788C; }\n\n.bg--green {\n  background-color: #1FBB82; }\n\n.bg--orange {\n  background-color: #F99922; }\n\n.bg--pink {\n  background-color: #FF2570; }\n\n.bg--purple {\n  background-color: #4d1676; }\n\n.bg--magenta {\n  background-color: #ac3f79; }\n\n.bg--yellow {\n  background-color: #fce561; }\n\n/***\n    title: Background Overlay\n    section: Layout\n    description: Use together with a background image to create a dark tint on top of the image. You can optionally use bg-overlay--hover if you want a hover effect. Every defined $bg-color is also available as a bg-overlay--color. You can also use @include bg-overlay($color, $hoverEffect = false).\n    example:\n        <header class=\"card bg-overlay--hover color--white\" style=\"background-image:url(http://lorempixel.com/1200/600/nature)\">\n            <h2>I'm a box</h2>\n            <p>With some content</p>\n        </header>\n***/\n.bg-overlay {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay:before {\n    background: rgba(0, 0, 0, 0.4);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay:before {\n        min-height: 500%; } }\n  .bg-overlay > * {\n    position: relative; }\n  .bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--hover:before {\n      background: rgba(0, 0, 0, 0.4);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--hover:hover:before {\n      background: rgba(0, 0, 0, 0.7); }\n\n.bg-overlay--white {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--white:before {\n    background: rgba(255, 255, 255, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--white:before {\n        min-height: 500%; } }\n  .bg-overlay--white > * {\n    position: relative; }\n  .bg-overlay--white.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--white.bg-overlay--hover:before {\n      background: rgba(255, 255, 255, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--white.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--white.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--white.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--white.bg-overlay--hover:hover:before {\n      background: rgba(255, 255, 255, 0.7); }\n\n.bg-overlay--x-lightgray {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--x-lightgray:before {\n    background: rgba(249, 249, 249, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--x-lightgray:before {\n        min-height: 500%; } }\n  .bg-overlay--x-lightgray > * {\n    position: relative; }\n  .bg-overlay--x-lightgray.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--x-lightgray.bg-overlay--hover:before {\n      background: rgba(249, 249, 249, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--x-lightgray.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--x-lightgray.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--x-lightgray.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--x-lightgray.bg-overlay--hover:hover:before {\n      background: rgba(249, 249, 249, 0.7); }\n\n.bg-overlay--darkgray {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--darkgray:before {\n    background: rgba(102, 102, 102, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--darkgray:before {\n        min-height: 500%; } }\n  .bg-overlay--darkgray > * {\n    position: relative; }\n  .bg-overlay--darkgray.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--darkgray.bg-overlay--hover:before {\n      background: rgba(102, 102, 102, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--darkgray.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--darkgray.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--darkgray.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--darkgray.bg-overlay--hover:hover:before {\n      background: rgba(102, 102, 102, 0.7); }\n\n.bg-overlay--bluegray {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--bluegray:before {\n    background: rgba(104, 120, 140, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--bluegray:before {\n        min-height: 500%; } }\n  .bg-overlay--bluegray > * {\n    position: relative; }\n  .bg-overlay--bluegray.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--bluegray.bg-overlay--hover:before {\n      background: rgba(104, 120, 140, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--bluegray.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--bluegray.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--bluegray.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--bluegray.bg-overlay--hover:hover:before {\n      background: rgba(104, 120, 140, 0.7); }\n\n.bg-overlay--green {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--green:before {\n    background: rgba(31, 187, 130, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--green:before {\n        min-height: 500%; } }\n  .bg-overlay--green > * {\n    position: relative; }\n  .bg-overlay--green.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--green.bg-overlay--hover:before {\n      background: rgba(31, 187, 130, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--green.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--green.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--green.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--green.bg-overlay--hover:hover:before {\n      background: rgba(31, 187, 130, 0.7); }\n\n.bg-overlay--orange {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--orange:before {\n    background: rgba(249, 153, 34, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--orange:before {\n        min-height: 500%; } }\n  .bg-overlay--orange > * {\n    position: relative; }\n  .bg-overlay--orange.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--orange.bg-overlay--hover:before {\n      background: rgba(249, 153, 34, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--orange.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--orange.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--orange.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--orange.bg-overlay--hover:hover:before {\n      background: rgba(249, 153, 34, 0.7); }\n\n.bg-overlay--pink {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--pink:before {\n    background: rgba(255, 37, 112, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--pink:before {\n        min-height: 500%; } }\n  .bg-overlay--pink > * {\n    position: relative; }\n  .bg-overlay--pink.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--pink.bg-overlay--hover:before {\n      background: rgba(255, 37, 112, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--pink.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--pink.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--pink.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--pink.bg-overlay--hover:hover:before {\n      background: rgba(255, 37, 112, 0.7); }\n\n.bg-overlay--purple {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--purple:before {\n    background: rgba(77, 22, 118, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--purple:before {\n        min-height: 500%; } }\n  .bg-overlay--purple > * {\n    position: relative; }\n  .bg-overlay--purple.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--purple.bg-overlay--hover:before {\n      background: rgba(77, 22, 118, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--purple.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--purple.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--purple.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--purple.bg-overlay--hover:hover:before {\n      background: rgba(77, 22, 118, 0.7); }\n\n.bg-overlay--magenta {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--magenta:before {\n    background: rgba(172, 63, 121, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--magenta:before {\n        min-height: 500%; } }\n  .bg-overlay--magenta > * {\n    position: relative; }\n  .bg-overlay--magenta.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--magenta.bg-overlay--hover:before {\n      background: rgba(172, 63, 121, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--magenta.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--magenta.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--magenta.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--magenta.bg-overlay--hover:hover:before {\n      background: rgba(172, 63, 121, 0.7); }\n\n.bg-overlay--yellow {\n  background-position: center top;\n  background-repeat: no-repeat;\n  background-size: cover;\n  display: block;\n  position: relative;\n  overflow: hidden; }\n  .bg-overlay--yellow:before {\n    background: rgba(252, 229, 97, 0.5);\n    display: block;\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .bg-overlay--yellow:before {\n        min-height: 500%; } }\n  .bg-overlay--yellow > * {\n    position: relative; }\n  .bg-overlay--yellow.bg-overlay--hover {\n    background-position: center top;\n    background-repeat: no-repeat;\n    background-size: cover;\n    display: block;\n    position: relative;\n    overflow: hidden; }\n    .bg-overlay--yellow.bg-overlay--hover:before {\n      background: rgba(252, 229, 97, 0.5);\n      display: block;\n      content: \"\";\n      position: absolute;\n      left: 0;\n      top: 0;\n      right: 0;\n      bottom: 0; }\n      @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n        .bg-overlay--yellow.bg-overlay--hover:before {\n          min-height: 500%; } }\n    .bg-overlay--yellow.bg-overlay--hover > * {\n      position: relative; }\n    .bg-overlay--yellow.bg-overlay--hover:before {\n      -webkit-transition: all 0.25s ease-out;\n      transition: all 0.25s ease-out; }\n    .bg-overlay--yellow.bg-overlay--hover:hover:before {\n      background: rgba(252, 229, 97, 0.7); }\n\n/***\n    title: Button\n    section: Buttons\n    description: Use to create buttons. Buttons come in various sizes and colors. Add more colors and customize your buttons in config/button.scss. You can also use @include button;\n    example:\n        <p><a href=\"#\" class=\"button\">I'm a normal button</a></p>\n        <p><button class=\"button--ghost\">Button elements automatically look like buttons</button></p>\n        <p><input type=\"submit\" value=\"Submit inputs too!\"></p>\n        <p><button class=\"button--wide\">Full width!</button></p>\n        <p><a href=\"#\" class=\"button\">Continue</a> <a href=\"#\" class=\"button button--gray button--ghost\">Cancel</a></p>\n        <p><a href=\"#\" class=\"button button--small\">Small button</a></p>\n        <p><a href=\"#\" class=\"button button--large\">Large button</a></p>\n***/\n.button {\n  background-color: #1FBB82;\n  border: 1px solid transparent;\n  display: inline-block;\n  vertical-align: middle;\n  box-sizing: border-box;\n  padding: 1.2rem 5.4rem;\n  font-size: 0.875rem;\n  line-height: 1.2;\n  color: #fff;\n  font-weight: bold;\n  font-style: normal;\n  text-transform: none;\n  text-decoration: none;\n  text-align: center;\n  letter-spacing: 0;\n  border-radius: 2rem;\n  -webkit-transition: all 0.25s ease-out;\n  transition: all 0.25s ease-out;\n  text-shadow: none;\n  box-shadow: none; }\n  .button:hover {\n    background-color: #1ba573; }\n  .button:active {\n    background-color: #188f64; }\n  .button[class*=\"icon-\"]:empty:not([value]) {\n    padding-left: 1.2rem;\n    padding-right: 1.2rem; }\n  .button a,\n  .button a:hover {\n    color: #fff;\n    text-decoration: none; }\n  .button:hover {\n    color: #fff;\n    text-decoration: none; }\n\n.button--ghost {\n  background-color: transparent;\n  color: #1FBB82;\n  border: 1px solid #1FBB82; }\n  .button--ghost:hover {\n    background-color: #1FBB82;\n    color: #fff; }\n\n.button--white {\n  background-color: #fff;\n  color: black;\n  border: 1px solid transparent; }\n  .button--white:hover {\n    background-color: #f2f2f2; }\n  .button--white:active {\n    background-color: #e6e6e6; }\n  .button--white:hover {\n    color: black; }\n  .button--white.button--ghost {\n    background-color: transparent;\n    color: #fff;\n    border: 1px solid #fff; }\n    .button--white.button--ghost:hover {\n      background-color: #fff;\n      color: black; }\n\n.button--green {\n  background-color: #1FBB82;\n  border: 1px solid transparent; }\n  .button--green:hover {\n    background-color: #1ba573; }\n  .button--green:active {\n    background-color: #188f64; }\n  .button--green.button--ghost {\n    background-color: transparent;\n    color: #1FBB82;\n    border: 1px solid #1FBB82; }\n    .button--green.button--ghost:hover {\n      background-color: #1FBB82;\n      color: #fff; }\n\n.button--pink {\n  background-color: #FF2570;\n  border: 1px solid transparent; }\n  .button--pink:hover {\n    background-color: #ff0c5f; }\n  .button--pink:active {\n    background-color: #f10053; }\n  .button--pink.button--ghost {\n    background-color: transparent;\n    color: #FF2570;\n    border: 1px solid #FF2570; }\n    .button--pink.button--ghost:hover {\n      background-color: #FF2570;\n      color: #fff; }\n\n.button--facebook {\n  background-color: #446CB9;\n  border: 1px solid transparent; }\n  .button--facebook:hover {\n    background-color: #3d61a6; }\n  .button--facebook:active {\n    background-color: #365694; }\n  .button--facebook.button--ghost {\n    background-color: transparent;\n    color: #446CB9;\n    border: 1px solid #446CB9; }\n    .button--facebook.button--ghost:hover {\n      background-color: #446CB9;\n      color: #fff; }\n\n.button--linkedin {\n  background-color: #3D91C6;\n  border: 1px solid transparent; }\n  .button--linkedin:hover {\n    background-color: #3583b4; }\n  .button--linkedin:active {\n    background-color: #2f75a1; }\n  .button--linkedin.button--ghost {\n    background-color: transparent;\n    color: #3D91C6;\n    border: 1px solid #3D91C6; }\n    .button--linkedin.button--ghost:hover {\n      background-color: #3D91C6;\n      color: #fff; }\n\n.button--small {\n  font-size: 0.875rem;\n  padding: 0.96rem 4.32rem; }\n\n.button--large {\n  font-size: 1.2rem; }\n\n.button--wide {\n  display: block;\n  width: 100%; }\n\n/***\n    title: Card\n    section: Layout\n    description: A simple box/card. Should be used with the bg-classes (transparent by default).\n    example:\n        <div class=\"card bg--white\">I'm a shadowed card</div>\n***/\n.card {\n  display: block;\n  margin-bottom: 2rem;\n  padding: 2rem;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24); }\n\n/***\n    title: Cols\n    section: Grid\n    description: Use to align elements in rows and columns. Perfect for use on ul/li setups or indeed any parent/child markup. Use bp--modifiers to set number of columns in different widths. Customize gutter and breakpoints in config file. You can also use ul {@include cols(3)}. Note! You might wanna use the flex component instead nowadays.\n    example:\n        <ul class=\"cols cols--2--bp-medium cols--3--bp-large\">\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> I'm two columns</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> In low resolution</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> But three columns</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> In high</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> Resolutions</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> Cool?</li>\n        </ul>\n***/\n/**\n * @col\n *\n * FLoats elements into columns\n *\n * @param\tint\t\t$num: how many columns\n * @param\tunit\t$gutter: space between columns\n * @param\tstring\t$selector: child-selector\n */\n/**\n * @col\n *\n * A single column\n *\n * @param\tint\t\t$num: how many items per row\n * @param\tunit\t$gutter: space between cols\n */\n.cols {\n  clear: both; }\n  .cols:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  .cols > * {\n    margin-bottom: 2rem; }\n\nul.cols,\nul[class*=\"cols--\"] {\n  margin-left: 0;\n  padding-left: 0;\n  list-style: none; }\n\n.cols--2 {\n  clear: both; }\n  .cols--2:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  .cols--2 > * {\n    float: left;\n    box-sizing: border-box;\n    width: calc(50% - 1rem);\n    margin-right: 2rem;\n    width: calc(49.5% - 1rem) \\9; }\n    .cols--2 > *:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .cols--2 > * {\n        width: calc(49.5% - 1rem); } }\n    .cols--2 > *:not(:nth-child(2n)) {\n      margin-right: 2rem; }\n    .cols--2 > *:nth-child(2n) {\n      margin-right: 0; }\n  .cols--2 > *:nth-child(2n) + * {\n    clear: both; }\n  .cols--2 > *:not(:nth-child(2n)) + * {\n    clear: none; }\n\n.cols--3 {\n  clear: both; }\n  .cols--3:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  .cols--3 > * {\n    float: left;\n    box-sizing: border-box;\n    width: calc(33.33333% - 1.33333rem);\n    margin-right: 2rem;\n    width: calc(33% - 1.33333rem) \\9; }\n    .cols--3 > *:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n    @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n      .cols--3 > * {\n        width: calc(33% - 1.33333rem); } }\n    .cols--3 > *:not(:nth-child(3n)) {\n      margin-right: 2rem; }\n    .cols--3 > *:nth-child(3n) {\n      margin-right: 0; }\n  .cols--3 > *:nth-child(3n) + * {\n    clear: both; }\n  .cols--3 > *:not(:nth-child(3n)) + * {\n    clear: none; }\n\n@media (min-width: 760px) {\n  .cols--2--bp-medium {\n    clear: both; }\n    .cols--2--bp-medium:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n    .cols--2--bp-medium > * {\n      float: left;\n      box-sizing: border-box;\n      width: calc(50% - 1rem);\n      margin-right: 2rem;\n      width: calc(49.5% - 1rem) \\9; }\n      .cols--2--bp-medium > *:after {\n        content: \"\";\n        display: table;\n        clear: both; } }\n    @media all and (min-width: 760px) and (-ms-high-contrast: none), (min-width: 760px) and (-ms-high-contrast: active) {\n      .cols--2--bp-medium > * {\n        width: calc(49.5% - 1rem); } }\n\n@media (min-width: 760px) {\n      .cols--2--bp-medium > *:not(:nth-child(2n)) {\n        margin-right: 2rem; }\n      .cols--2--bp-medium > *:nth-child(2n) {\n        margin-right: 0; }\n    .cols--2--bp-medium > *:nth-child(2n) + * {\n      clear: both; }\n    .cols--2--bp-medium > *:not(:nth-child(2n)) + * {\n      clear: none; } }\n\n@media (min-width: 760px) {\n  .cols--3--bp-medium {\n    clear: both; }\n    .cols--3--bp-medium:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n    .cols--3--bp-medium > * {\n      float: left;\n      box-sizing: border-box;\n      width: calc(33.33333% - 1.33333rem);\n      margin-right: 2rem;\n      width: calc(33% - 1.33333rem) \\9; }\n      .cols--3--bp-medium > *:after {\n        content: \"\";\n        display: table;\n        clear: both; } }\n    @media all and (min-width: 760px) and (-ms-high-contrast: none), (min-width: 760px) and (-ms-high-contrast: active) {\n      .cols--3--bp-medium > * {\n        width: calc(33% - 1.33333rem); } }\n\n@media (min-width: 760px) {\n      .cols--3--bp-medium > *:not(:nth-child(3n)) {\n        margin-right: 2rem; }\n      .cols--3--bp-medium > *:nth-child(3n) {\n        margin-right: 0; }\n    .cols--3--bp-medium > *:nth-child(3n) + * {\n      clear: both; }\n    .cols--3--bp-medium > *:not(:nth-child(3n)) + * {\n      clear: none; } }\n\n@media (min-width: 1020px) {\n  .cols--2--bp-large {\n    clear: both; }\n    .cols--2--bp-large:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n    .cols--2--bp-large > * {\n      float: left;\n      box-sizing: border-box;\n      width: calc(50% - 1rem);\n      margin-right: 2rem;\n      width: calc(49.5% - 1rem) \\9; }\n      .cols--2--bp-large > *:after {\n        content: \"\";\n        display: table;\n        clear: both; } }\n    @media all and (min-width: 1020px) and (-ms-high-contrast: none), (min-width: 1020px) and (-ms-high-contrast: active) {\n      .cols--2--bp-large > * {\n        width: calc(49.5% - 1rem); } }\n\n@media (min-width: 1020px) {\n      .cols--2--bp-large > *:not(:nth-child(2n)) {\n        margin-right: 2rem; }\n      .cols--2--bp-large > *:nth-child(2n) {\n        margin-right: 0; }\n    .cols--2--bp-large > *:nth-child(2n) + * {\n      clear: both; }\n    .cols--2--bp-large > *:not(:nth-child(2n)) + * {\n      clear: none; } }\n\n@media (min-width: 1020px) {\n  .cols--3--bp-large {\n    clear: both; }\n    .cols--3--bp-large:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n    .cols--3--bp-large > * {\n      float: left;\n      box-sizing: border-box;\n      width: calc(33.33333% - 1.33333rem);\n      margin-right: 2rem;\n      width: calc(33% - 1.33333rem) \\9; }\n      .cols--3--bp-large > *:after {\n        content: \"\";\n        display: table;\n        clear: both; } }\n    @media all and (min-width: 1020px) and (-ms-high-contrast: none), (min-width: 1020px) and (-ms-high-contrast: active) {\n      .cols--3--bp-large > * {\n        width: calc(33% - 1.33333rem); } }\n\n@media (min-width: 1020px) {\n      .cols--3--bp-large > *:not(:nth-child(3n)) {\n        margin-right: 2rem; }\n      .cols--3--bp-large > *:nth-child(3n) {\n        margin-right: 0; }\n    .cols--3--bp-large > *:nth-child(3n) + * {\n      clear: both; }\n    .cols--3--bp-large > *:not(:nth-child(3n)) + * {\n      clear: none; } }\n\n/***\n    title: Container\n    section: Layout\n    description: Centers an element on the screen at a width of $site-width. Containers should be direct decendants of body/main (any full width element actually) and don't work properly when nested like this. You can also use @include container;\n    example:\n        <div class=\"container bg--white\">\n            <h1>I'm centered</h1>\n            <p>In the middle of the page</p>\n        </div>\n***/\n.container {\n  margin-left: 1.5rem;\n  margin-right: 1.5rem; }\n  @media (min-width: 900px) {\n    .container {\n      max-width: 800px;\n      margin-left: auto;\n      margin-right: auto; } }\n\n/***\n    title: Forms\n    section: Forms\n    description: Form styling.\n    example:\n        <form method=\"post\" action=\"\">\n            <p>\n                <label>\n                    Name<br>\n                    <input type=\"text\" name=\"name\" placeholder=\"eg. John Doe\">\n                </label>\n            </p>\n            <p>\n                <label>\n                    Email<br>\n                    <input type=\"email\" name=\"email\" placeholder=\"eg. john.doe@example.com\">\n                </label>\n            </p>\n            <p>\n                <label>\n                    Sex<br>\n                    <select name=\"sex\">\n                        <option value=\"f\">Female</option>\n                        <option value=\"m\">Male</option>\n                    </select>\n                </label>\n            </p>\n            <p>\n                <label>\n                    Age<br>\n                    <input type=\"range\" name=\"age\" min=\"1\" max=\"150\">\n                </label>\n            </p>\n            <p>\n                <label>\n                    Message<br>\n                    <textarea name=\"message\" rows=\"3\" cols=\"60\" placeholder=\"Write your message here\"></textarea>\n                </label>\n            </p>\n            <p><input type=\"submit\" value=\"Go\"></p>\n        </form>\n***/\np.message.success {\n  color: #060; }\n\np.message.error {\n  color: #600; }\n\nform {\n  margin: 0; }\n  form strong.error {\n    display: block;\n    margin-top: 0.5rem;\n    color: #600; }\n  form abbr,\n  form abbr[title] {\n    color: #600;\n    border-bottom: 0; }\n\n.form__field,\n.captcha-wrap {\n  margin-bottom: 1rem; }\n\nlabel {\n  display: block; }\n  label span.value {\n    float: right; }\n\ninput[type=text], input[type=password], input[type=search], input[type=email], input[type=url], input[type=tel], input[type=number], input[type=date], input[type=month], input[type=week], input[type=time], input[type=datetime], input[type=datetime-local], input[type=color], textarea {\n  background: transparent;\n  display: inline-block;\n  vertical-align: middle;\n  box-sizing: border-box;\n  width: 100%;\n  margin: 0;\n  padding: 0.5rem 0;\n  font-size: 0.875rem;\n  color: #333;\n  line-height: normal;\n  -webkit-appearance: none;\n     -moz-appearance: none;\n          appearance: none;\n  border: 1px solid #d8d8d8;\n  border-radius: false; }\n  input[type=text]:hover, input[type=text]:focus, input[type=password]:hover, input[type=password]:focus, input[type=search]:hover, input[type=search]:focus, input[type=email]:hover, input[type=email]:focus, input[type=url]:hover, input[type=url]:focus, input[type=tel]:hover, input[type=tel]:focus, input[type=number]:hover, input[type=number]:focus, input[type=date]:hover, input[type=date]:focus, input[type=month]:hover, input[type=month]:focus, input[type=week]:hover, input[type=week]:focus, input[type=time]:hover, input[type=time]:focus, input[type=datetime]:hover, input[type=datetime]:focus, input[type=datetime-local]:hover, input[type=datetime-local]:focus, input[type=color]:hover, input[type=color]:focus, textarea:hover, textarea:focus {\n    border-color: #bfbfbf; }\n\ninput:-webkit-autofill,\ninput:-webkit-autofill:hover,\ninput:-webkit-autofill:focus,\ninput:-webkit-autofill:active {\n  -webkit-transition: background-color 6000s linear 0s;\n  transition: background-color 6000s linear 0s;\n  -webkit-text-fill-color: #333; }\n\ninput[type=search]::-webkit-search-decoration, input[type=search]::-webkit-search-cancel-button, input[type=search]::-webkit-search-results-button, input[type=search]::-webkit-search-results-decoration {\n  display: none; }\n\ninput[type=radio],\ninput[type=checkbox] {\n  margin: 0 0.4em 0 0; }\n  [dir=rtl] input[type=radio], [dir=rtl]\n  input[type=checkbox] {\n    margin-right: 0;\n    margin-left: 0.4em; }\n\ntextarea {\n  resize: y;\n  max-width: 100%; }\n\n::-webkit-input-placeholder {\n  color: #999; }\n\n::-moz-placeholder {\n  color: #999; }\n\n:-ms-input-placeholder {\n  color: #999; }\n\n::placeholder {\n  color: #999; }\n\ninput[type=submit],\nbutton {\n  background-color: #1FBB82;\n  border: 1px solid transparent;\n  display: inline-block;\n  vertical-align: middle;\n  box-sizing: border-box;\n  padding: 1.2rem 5.4rem;\n  font-size: 0.875rem;\n  line-height: 1.2;\n  color: #fff;\n  font-weight: bold;\n  font-style: normal;\n  text-transform: none;\n  text-decoration: none;\n  text-align: center;\n  letter-spacing: 0;\n  border-radius: 2rem;\n  -webkit-transition: all 0.25s ease-out;\n  transition: all 0.25s ease-out;\n  text-shadow: none;\n  box-shadow: none;\n  outline: 0;\n  line-height: normal; }\n  input[type=submit]:hover,\n  button:hover {\n    background-color: #1ba573; }\n  input[type=submit]:active,\n  button:active {\n    background-color: #188f64; }\n  input[type=submit][class*=\"icon-\"]:empty:not([value]),\n  button[class*=\"icon-\"]:empty:not([value]) {\n    padding-left: 1.2rem;\n    padding-right: 1.2rem; }\n  input[type=submit] a,\n  input[type=submit] a:hover,\n  button a,\n  button a:hover {\n    color: #fff;\n    text-decoration: none; }\n  input[type=submit]:hover,\n  button:hover {\n    color: #fff;\n    text-decoration: none; }\n\nselect {\n  -webkit-appearance: none;\n     -moz-appearance: none;\n          appearance: none;\n  background: transparent url(\"assets/svg/select-arrow.svg\") no-repeat calc(100% - 1rem) 50%;\n  background-size: 0.5rem auto;\n  box-sizing: border-box;\n  width: 100%;\n  padding: 0.5rem 1.5rem 0.5rem 0;\n  font-size: 0.875rem;\n  color: #333;\n  line-height: normal;\n  border: 1px solid #d8d8d8;\n  border-radius: 0; }\n\ninput[type=range] {\n  -webkit-appearance: none;\n     -moz-appearance: none;\n          appearance: none;\n  background: transparent;\n  width: 100%;\n  height: 1.5rem;\n  padding: 0;\n  border: 0; }\n  input[type=range]::-webkit-slider-runnable-track {\n    background: #1FBB82; }\n  input[type=range]::-ms-track {\n    background: #1FBB82;\n    color: #1FBB82; }\n  input[type=range]::-ms-fill-lower {\n    background: #1FBB82;\n    color: #1FBB82; }\n  input[type=range]::-ms-fill-upper {\n    background: #1FBB82;\n    color: #1FBB82; }\n  input[type=range]::-moz-range-track {\n    background: #1FBB82; }\n  input[type=range]::-webkit-slider-thumb {\n    background: #fff; }\n  input[type=range]::-moz-range-thumb {\n    background: #fff; }\n  input[type=range]::-ms-thumb {\n    background: #fff; }\n  input[type=range]:focus {\n    outline: 0; }\n  input[type=range]::-moz-focus-outer {\n    border: 0; }\n  input[type=range]::-webkit-slider-runnable-track {\n    -webkit-appearance: none;\n            appearance: none;\n    width: 100%;\n    height: 0.25rem;\n    padding: 0;\n    border: 0;\n    outline: 0;\n    border-radius: 0.2rem; }\n    input[type=range]::-webkit-slider-runnable-track:focus {\n      outline: 0; }\n  input[type=range]::-ms-track {\n    appearance: none;\n    width: 100%;\n    height: 0.25rem;\n    padding: 0;\n    border: 0;\n    outline: 0;\n    border-radius: 0.2rem; }\n    input[type=range]::-ms-track:focus {\n      outline: 0; }\n  input[type=range]::-ms-fill-lower {\n    appearance: none;\n    width: 100%;\n    height: 0.25rem;\n    padding: 0;\n    border: 0;\n    outline: 0;\n    border-radius: 0.2rem; }\n    input[type=range]::-ms-fill-lower:focus {\n      outline: 0; }\n  input[type=range]::-ms-fill-upper {\n    appearance: none;\n    width: 100%;\n    height: 0.25rem;\n    padding: 0;\n    border: 0;\n    outline: 0;\n    border-radius: 0.2rem; }\n    input[type=range]::-ms-fill-upper:focus {\n      outline: 0; }\n  input[type=range]::-moz-range-track {\n    -moz-appearance: none;\n         appearance: none;\n    width: 100%;\n    height: 0.25rem;\n    padding: 0;\n    border: 0;\n    outline: 0;\n    border-radius: 0.2rem; }\n    input[type=range]::-moz-range-track:focus {\n      outline: 0; }\n  input[type=range]::-webkit-slider-thumb {\n    -webkit-appearance: none;\n            appearance: none;\n    width: 1.5rem;\n    height: 1.5rem;\n    border: 0.25rem solid #1FBB82;\n    box-shadow: 0 0.2rem 0.2rem rgba(0, 0, 0, 0.2);\n    cursor: pointer;\n    outline: 0;\n    border-radius: 50%;\n    margin-top: -0.625rem; }\n    input[type=range]::-webkit-slider-thumb:focus {\n      outline: 0; }\n  input[type=range]::-moz-range-thumb {\n    -moz-appearance: none;\n         appearance: none;\n    width: 1.5rem;\n    height: 1.5rem;\n    border: 0.25rem solid #1FBB82;\n    box-shadow: 0 0.2rem 0.2rem rgba(0, 0, 0, 0.2);\n    cursor: pointer;\n    outline: 0;\n    border-radius: 50%; }\n    input[type=range]::-moz-range-thumb:focus {\n      outline: 0; }\n  input[type=range]::-ms-thumb {\n    appearance: none;\n    width: 1.5rem;\n    height: 1.5rem;\n    border: 0.25rem solid #1FBB82;\n    box-shadow: 0 0.2rem 0.2rem rgba(0, 0, 0, 0.2);\n    cursor: pointer;\n    outline: 0;\n    border-radius: 50%;\n    transform: translateY(0.25rem); }\n    input[type=range]::-ms-thumb:focus {\n      outline: 0; }\n\n/***\n    title: Group\n    section: Layout\n    description: Use this class to add margin-bottom to an element.\n    example:\n        <div class=\"card bg--white group--x-large\">\n            <h2>I have margin</h2>\n            <p>More than usual</p>\n        </div>\n***/\n.group {\n  margin-bottom: 1rem; }\n  .group--large {\n    margin-bottom: 1rem;\n    margin-bottom: 2rem; }\n  .group--x-large {\n    margin-bottom: 2rem; }\n    @media (min-width: 760px) {\n      .group--x-large {\n        margin-bottom: 4rem; } }\n\n/***\n    title: Headings\n    section: Typography\n    description: Use to create headings. H1-H6 automatically get the correct styling, however you can use the heading--X classes to make non-headings look like headings, and headings of one size appear to have a different size. You can also use @include heading;\n    example:\n        <h1 class=\"heading--4\">I'm a H1 but look like a H4</h1>\n        <h3>I'm a normal H3</h3>\n        <p class=\"heading--1\">I'm not a heading at all!</p>\n***/\nh1, h2, h3, h4, h5, h6, .heading--1, .heading--2, .heading--3, .heading--4, .heading--5, .heading--6 {\n  display: block;\n  margin: 0 0 1rem;\n  font-weight: 600;\n  font-size: 6.2rem;\n  line-height: 0.9;\n  font-family: \"Montserrat\", sans-serif;\n  color: #111;\n  letter-spacing: -0.01em; }\n  h1 a, h2 a, h3 a, h4 a, h5 a, h6 a, .heading--1 a, .heading--2 a, .heading--3 a, .heading--4 a, .heading--5 a, .heading--6 a {\n    color: #111; }\n    h1 a:hover, h2 a:hover, h3 a:hover, h4 a:hover, h5 a:hover, h6 a:hover, .heading--1 a:hover, .heading--2 a:hover, .heading--3 a:hover, .heading--4 a:hover, .heading--5 a:hover, .heading--6 a:hover {\n      color: #d7466d; }\n\nh2,\n.heading--2 {\n  font-size: 6.2rem; }\n\nh3,\n.heading--3 {\n  font-size: 1.6rem; }\n\nh4,\n.heading--4 {\n  font-size: 1.4rem; }\n\nh5,\n.heading--5 {\n  font-size: 1.2rem; }\n\nh6,\n.heading--6 {\n  font-size: 1rem; }\n\n/* @media (max-width: 759px) {\n\th1,\n\t.heading--1 {\n\t\tfont-size: $font-size-h1 * .8;\n\t}\n\n\th2,\n\t.heading--2 {\n\t\tfont-size: $font-size-h2 * .8;\n\t}\n\n\th3,\n\t.heading--3 {\n\t\tfont-size: $font-size-h3 * .8;\n\t}\n} */\n/***\n    title: Icon\n    section: Icons\n    description: Use to add icons to elements. Icons added to empty elements will have zero spacing around them whereas icons added to elements with content will have some spacing. Add icons to the icons.json file (using fontello.com) and Gulp takes care of the rest.\n    example:\n        <p>\n            <a href=\"#\" class=\"icon-facebook\">Facebook</a>\n            <a href=\"#\" class=\"icon-twitter\">Twitter</a>\n            <a href=\"#\" class=\"icon-facebook icon--round\" title=\"Facebook\"></a>\n            <a href=\"#\" class=\"icon-twitter icon--round\" title=\"Twitter\"></a>\n            <button class=\"icon-search\">Find</button>\n            <a href=\"#\" class=\"icon-right icon--after\">Icon after text</a>\n        </p>\n\n        <ul class=\"cols cols--2\">\n            <li class=\"icon-facebook icon--above\">Facebook</li>\n            <li class=\"icon-twitter icon--above\">Twitter</li>\n        </ul>\n***/\n/**\n * Some icon tweaks and margins\n */\n[class*=\"icon-\"]:before, [class*=\"icon-\"]:after {\n  text-decoration: none; }\n\n[class*=\"icon-\"]:before {\n  margin: 0 0.4em 0 0; }\n\n[class*=\"icon-\"].icon--after:after {\n  margin: 0 0 0 0.4em; }\n\n[class*=\"icon-\"]:empty:after, [class*=\"icon-\"]:empty:before {\n  margin: 0; }\n\n/**\n * Large icon\n */\n.icon--large:before, .icon--large.icon--after:after {\n  font-size: 2em; }\n\n/**\n * Icon Above\n */\n[class*=\"icon-\"].icon--above {\n  display: inline-block;\n  text-align: center; }\n  [class*=\"icon-\"].icon--above:before {\n    display: block;\n    margin: 0 auto 0.5rem;\n    font-size: 2em; }\n\n[class*=\"icon-\"].icon--after.icon--below {\n  display: inline-block;\n  text-align: center; }\n  [class*=\"icon-\"].icon--after.icon--below:after {\n    display: block;\n    margin: 0 auto;\n    font-size: 2em; }\n\n/**\n * Spinner\n */\n@-webkit-keyframes spin {\n  0% {\n    -webkit-transform: rotate(0);\n            transform: rotate(0); }\n  100% {\n    -webkit-transform: rotate(360deg);\n            transform: rotate(360deg); } }\n@keyframes spin {\n  0% {\n    -webkit-transform: rotate(0);\n            transform: rotate(0); }\n  100% {\n    -webkit-transform: rotate(360deg);\n            transform: rotate(360deg); } }\n\n.icon-spinner:before,\n.icon-spinner.icon--after:after {\n  -webkit-animation: spin 1.5s infinite linear;\n          animation: spin 1.5s infinite linear; }\n\n/**\n * Round icon\n * TODO: icon--round should be exactly like buttons (with :hover/:active --ghost and different colors)\n */\n[class*=\"icon-\"].icon--round {\n  display: inline-block;\n  text-decoration: none;\n  /* &:hover:before,\n\t&.icon--after:hover:after {\n\t\tbackground: rgba($irc, .2);\n\t\tcolor: $irc;\n\t} */\n  /* &--ghost:hover:before,\n\t\t&--ghost.icon--after:hover:after {\n\t\t\tbackground: rgba($icon-round-color, .2);\n\t\t} */ }\n  [class*=\"icon-\"].icon--round:hover {\n    text-decoration: none; }\n  [class*=\"icon-\"].icon--round:before, [class*=\"icon-\"].icon--round.icon--after:after {\n    background: #369;\n    width: 2.2em;\n    height: 2.2em;\n    text-align: center;\n    color: #fff;\n    text-shadow: none;\n    display: -webkit-inline-box;\n    display: -ms-inline-flexbox;\n    display: inline-flex;\n    -webkit-box-align: center;\n        -ms-flex-align: center;\n            align-items: center;\n    -webkit-box-pack: center;\n        -ms-flex-pack: center;\n            justify-content: center;\n    border-radius: 50%;\n    -webkit-transition: all 0.2s ease-out;\n    transition: all 0.2s ease-out; }\n  [class*=\"icon-\"].icon--round.icon--above, [class*=\"icon-\"].icon--round.icon--below {\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex; }\n  [class*=\"icon-\"].icon--round--ghost:before, [class*=\"icon-\"].icon--round--ghost.icon--after:after {\n    background: transparent;\n    color: #369;\n    border: 1px solid #369; }\n\n/* a.icon--round:hover,\na:hover .icon--round {\n\t&:before,\n\t&.icon--after:after {\n\t\tborder-radius: .2rem;\n\t}\n} */\n/**\n * Icon colors\n */\n[class*=\"icon-\"].icon--white:before {\n  color: #fff; }\n\n[class*=\"icon-\"].icon--after.icon--white:after {\n  color: #fff; }\n\n[class*=\"icon-\"].icon--round--white {\n  /* &:hover:before {\n\t\t\t\tbackground-color: rgba(nth($color, 2), .2);\n\t\t\t\tcolor: nth($color, 2);\n\t\t\t}\n\n\t\t\t&.icon--round--ghost:hover:before {\n\t\t\t\tbackground-color: rgba(nth($color, 2), .2);\n\t\t\t} */ }\n  [class*=\"icon-\"].icon--round--white:before {\n    background-color: #fff; }\n  [class*=\"icon-\"].icon--round--white.icon--round--ghost:before {\n    background-color: transparent;\n    color: #fff;\n    border-color: #fff; }\n\n[class*=\"icon-\"].icon--green:before {\n  color: #1FBB82; }\n\n[class*=\"icon-\"].icon--after.icon--green:after {\n  color: #1FBB82; }\n\n[class*=\"icon-\"].icon--round--green {\n  /* &:hover:before {\n\t\t\t\tbackground-color: rgba(nth($color, 2), .2);\n\t\t\t\tcolor: nth($color, 2);\n\t\t\t}\n\n\t\t\t&.icon--round--ghost:hover:before {\n\t\t\t\tbackground-color: rgba(nth($color, 2), .2);\n\t\t\t} */ }\n  [class*=\"icon-\"].icon--round--green:before {\n    background-color: #1FBB82; }\n  [class*=\"icon-\"].icon--round--green.icon--round--ghost:before {\n    background-color: transparent;\n    color: #1FBB82;\n    border-color: #1FBB82; }\n\n[class*=\"icon-\"].icon--gray:before {\n  color: #9b9b9b; }\n\n[class*=\"icon-\"].icon--after.icon--gray:after {\n  color: #9b9b9b; }\n\n[class*=\"icon-\"].icon--round--gray {\n  /* &:hover:before {\n\t\t\t\tbackground-color: rgba(nth($color, 2), .2);\n\t\t\t\tcolor: nth($color, 2);\n\t\t\t}\n\n\t\t\t&.icon--round--ghost:hover:before {\n\t\t\t\tbackground-color: rgba(nth($color, 2), .2);\n\t\t\t} */ }\n  [class*=\"icon-\"].icon--round--gray:before {\n    background-color: #9b9b9b; }\n  [class*=\"icon-\"].icon--round--gray.icon--round--ghost:before {\n    background-color: transparent;\n    color: #9b9b9b;\n    border-color: #9b9b9b; }\n\n/***\n    title: Images\n    section: Images\n    description: Various helper classes for styling images.\n    example:\n        <img src=\"http://placehold.it/100x100\" class=\"img--round\"> <img src=\"http://placehold.it/100x100\" class=\"img--rounded\">\n***/\n.img--round {\n  border-radius: 50%; }\n\n.img--rounded {\n  border-radius: .4rem; }\n\n.img--grayscale {\n  -webkit-filter: grayscale(100%);\n          filter: grayscale(100%); }\n\n.img--wide {\n  display: block;\n  width: 100%; }\n\n/***\n    title: Inline Grid\n    section: Grid\n    description: Uses inline-block to create a grid. Useful if you dynamically toggle elemens in the grid and need them to adapt to new positions. Note that @inline-grid sets the child element's font-size back to $font-size-default.\n    example:\n        <ul class=\"inline-grid inline-grid--2--bp-medium\"><li>Two column grid</li><li>Two column grid</li><li>Two column grid</li><li>Two column grid</li></ul>\n***/\n.inline-grid {\n  font-size: 0;\n  margin-left: -1rem;\n  margin-right: -1rem; }\n  .inline-grid > * {\n    font-size: 1rem;\n    display: inline-block;\n    vertical-align: top;\n    width: 100%;\n    margin: 0 1rem;\n    width: calc(100% - 2rem); }\n\nul.inline-grid,\nul[class*=\"inline-grid--\"] {\n  margin-left: 0;\n  padding-left: 0;\n  list-style: none; }\n\n.inline-grid--2 > * {\n  width: calc(50% - 2rem); }\n\n.inline-grid--3 > * {\n  width: calc(33.33333% - 2rem); }\n\n@media (min-width: 760px) {\n  .inline-grid--2--bp-medium > * {\n    width: calc(50% - 2rem); } }\n\n@media (min-width: 760px) {\n  .inline-grid--3--bp-medium > * {\n    width: calc(33.33333% - 2rem); } }\n\n@media (min-width: 1020px) {\n  .inline-grid--2--bp-large > * {\n    width: calc(50% - 2rem); } }\n\n@media (min-width: 1020px) {\n  .inline-grid--3--bp-large > * {\n    width: calc(33.33333% - 2rem); } }\n\n/***\n    title: Link\n    section: Links\n    description: Link styling. You can use the link class to make anything look like a link.\n    example:\n        <a href=\"#\">Normal link</a>\n        <span class=\"link\">Not a link at all</span>\n        <a href=\"#\" class=\"link--neutral\">Link that looks like text</a>\n        <a href=\"#\" class=\"link--underline\">Link with underline</a>\n***/\na,\n.link {\n  cursor: pointer;\n  color: #e0708e;\n  text-decoration: none; }\n  a:hover,\n  .link:hover {\n    color: #d7466d;\n    text-decoration: none; }\n  a[role=button]:focus, a[href^=\"#\"]:focus,\n  .link[role=button]:focus,\n  .link[href^=\"#\"]:focus {\n    outline: 0; }\n\n.link--neutral {\n  color: inherit;\n  text-decoration: none; }\n  .link--neutral:hover {\n    color: inherit;\n    text-decoration: none; }\n\n.link--neutral--hover {\n  color: inherit; }\n  .link--neutral--hover:hover {\n    color: #d7466d;\n    text-decoration: none; }\n\n.link--no-underline {\n  text-decoration: none; }\n  .link--no-underline:hover {\n    text-decoration: none; }\n\n.link--underline {\n  text-decoration: underline; }\n  .link--underline:hover {\n    text-decoration: none; }\n\n/***\n    title: List\n    section: Lists\n    description: Various classes you can use on lists, or list like markup.\n    example:\n        <h2>Pipe separated</h2>\n        <ul class=\"list--pipe-separated\">\n            <li>Pipes</li>\n            <li>Separate</li>\n            <li>Me</li>\n        </ul>\n        <h2>Inline list</h2>\n        <ul class=\"list--inline text--center\">\n            <li>Inline list</li>\n            <li>Inline list</li>\n            <li>Inline list</li>\n            <li>Inline list</li>\n        </ul>\n***/\n.list--pipe-separated {\n  margin-left: 0;\n  padding-left: 0;\n  list-style: none; }\n  .list--pipe-separated > * {\n    display: inline-block; }\n    .list--pipe-separated > *:not(:last-child):after {\n      content: \" | \";\n      margin: 0 0.5rem; }\n\n.list--inline {\n  margin-left: 0;\n  list-style: none; }\n  .list--inline > * {\n    display: inline-block;\n    margin-right: 0.5rem;\n    margin-bottom: 0.5rem; }\n  .text--center .list--inline > *, .list--inline.text--center > * {\n    margin: 0 0.25rem 0.5rem; }\n\n.list--border {\n  margin-left: 0;\n  padding-left: 0;\n  list-style: none; }\n  .list--border > :not(:last-child) {\n    margin-bottom: 0.5rem;\n    padding-bottom: 0.5rem;\n    border-bottom: 1px solid #d8d8d8; }\n\n.list--plain {\n  margin-left: 0;\n  list-style: none; }\n  .list--plain--margin {\n    margin-left: 0;\n    list-style: none; }\n    .list--plain--margin > * {\n      margin-bottom: 0.5rem; }\n\n.pane__overlay {\n  background: transparent;\n  position: fixed;\n  left: 0;\n  top: 0;\n  right: 0;\n  height: 100%;\n  z-index: 100;\n  -webkit-transform: translateX(-100%);\n          transform: translateX(-100%);\n  -webkit-transition: background 0.2s 0s ease-out, -webkit-transform 0s 0.2s linear;\n  transition: background 0.2s 0s ease-out, -webkit-transform 0s 0.2s linear;\n  transition: background 0.2s 0s ease-out, transform 0s 0.2s linear;\n  transition: background 0.2s 0s ease-out, transform 0s 0.2s linear, -webkit-transform 0s 0.2s linear; }\n  .pane__overlay.open {\n    background: rgba(0, 0, 0, 0.4);\n    -webkit-transform: translateX(0);\n            transform: translateX(0);\n    z-index: 101;\n    -webkit-transition: background 0.2s ease-out, -webkit-transform 0s linear;\n    transition: background 0.2s ease-out, -webkit-transform 0s linear;\n    transition: transform 0s linear, background 0.2s ease-out;\n    transition: transform 0s linear, background 0.2s ease-out, -webkit-transform 0s linear; }\n\n.pane {\n  background: #fff;\n  position: fixed;\n  left: 0;\n  top: 0;\n  height: 100%;\n  z-index: 100;\n  width: 80%;\n  max-width: 30rem;\n  -webkit-transform: translateX(-100%);\n          transform: translateX(-100%);\n  -webkit-transition: -webkit-transform 0.2s 0.2s ease-out;\n  transition: -webkit-transform 0.2s 0.2s ease-out;\n  transition: transform 0.2s 0.2s ease-out;\n  transition: transform 0.2s 0.2s ease-out, -webkit-transform 0.2s 0.2s ease-out; }\n  .pane--right {\n    left: auto;\n    right: 0;\n    -webkit-transform: translateX(100%);\n            transform: translateX(100%); }\n    .pane--right .pane__toggle {\n      left: auto;\n      right: 100%; }\n  .pane.open {\n    -webkit-transform: translateX(0);\n            transform: translateX(0);\n    z-index: 101; }\n  .pane__toggle {\n    position: absolute;\n    left: 100%;\n    top: 1rem; }\n\n.popup {\n  background: rgba(0, 0, 0, 0.4);\n  position: fixed;\n  left: 0;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  z-index: 99;\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-align: center;\n      -ms-flex-align: center;\n          align-items: center;\n  -webkit-box-pack: center;\n      -ms-flex-pack: center;\n          justify-content: center;\n  opacity: 0;\n  -webkit-transform: translateY(-100%);\n          transform: translateY(-100%);\n  -webkit-transition: opacity 0.2s 0s ease-out, -webkit-transform 0s 0.2s linear;\n  transition: opacity 0.2s 0s ease-out, -webkit-transform 0s 0.2s linear;\n  transition: transform 0s 0.2s linear, opacity 0.2s 0s ease-out;\n  transition: transform 0s 0.2s linear, opacity 0.2s 0s ease-out, -webkit-transform 0s 0.2s linear; }\n  .popup:target, .popup.open {\n    -webkit-transition: opacity 0.2s 0s ease-out, -webkit-transform 0s 0s linear;\n    transition: opacity 0.2s 0s ease-out, -webkit-transform 0s 0s linear;\n    transition: transform 0s 0s linear, opacity 0.2s 0s ease-out;\n    transition: transform 0s 0s linear, opacity 0.2s 0s ease-out, -webkit-transform 0s 0s linear;\n    opacity: 1;\n    -webkit-transform: translateY(0);\n            transform: translateY(0); }\n  .popup__close {\n    position: absolute;\n    right: 1rem;\n    top: 1rem;\n    z-index: 1;\n    font-size: 3rem;\n    line-height: 1rem;\n    color: #fff;\n    text-decoration: none;\n    -webkit-transform: scale(1);\n            transform: scale(1); }\n    .popup__close:hover {\n      -webkit-transform: scale(1.1);\n              transform: scale(1.1);\n      color: #fff;\n      text-decoration: none; }\n  .popup__box {\n    background: #fff;\n    width: 80%;\n    max-width: 45rem;\n    max-height: 90%;\n    position: relative;\n    overflow: auto;\n    padding: 2rem;\n    border-radius: .5rem; }\n    .popup__box .popup__close {\n      color: inherit; }\n      .popup__box .popup__close:hover {\n        color: inherit; }\n\n/***\n    title: Primary/Secondary\n    section: Grid\n    description: Super basic primary/secondary content columns when you really don't need an entire grid system.\n    example:\n        <div>\n            <div class=\"primary-content\">\n                <p>Primary content here</p>\n            </div>\n            <div class=\"secondary-content\">\n                <p>Secondary content here</p>\n            </div>\n        </div>\n        <div>\n            <div class=\"secondary-content\">\n                <p>Reversed order here</p>\n            </div>\n            <div class=\"primary-content\">\n                <p>Primary content here</p>\n            </div>\n        </div>\n***/\n@media (min-width: 1020px) {\n  .primary-content {\n    width: calc(70% - 2rem);\n    float: left; }\n    .primary-content:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n  .secondary-content {\n    width: calc(30% - 2rem);\n    float: left; }\n    .secondary-content:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n  .primary-content + .secondary-content {\n    margin-left: 4rem; }\n  .secondary-content + .primary-content {\n    margin-left: 4rem; }\n  .primary-content + .secondary-content + * {\n    clear: both; }\n  .secondary-content + .primary-content + * {\n    clear: both; }\n  .primary-secondary:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  .primary-secondary > * {\n    width: calc(70% - 2rem);\n    float: left;\n    margin-right: 4rem; }\n    .primary-secondary > *:after {\n      content: \"\";\n      display: table;\n      clear: both; }\n  .primary-secondary > :last-child {\n    width: calc(30% - 2rem);\n    float: left;\n    margin-right: 0; }\n    .primary-secondary > :last-child:after {\n      content: \"\";\n      display: table;\n      clear: both; } }\n\n@media (max-width: 1019px) {\n  .primary-content,\n  .secondary-content,\n  .primary-secondary > * {\n    margin-bottom: 1rem; } }\n\n/**\n * @section\n *\n * Creates a full width section with centered content based on preferred site width\n */\n/**\n * @section-centering\n *\n * Takes care of centering the section content using padding and calc\n */\n/**\n * @section-right\n *\n * Positions an element at the right edge of the inner content of the section\n */\n/**\n * @section-left\n *\n * Positions an element at the left edge of the inner content of the section\n */\n/**\n * @section-bottom\n *\n * Positions an element at the bottom edge of the inner content of the section\n */\n/**\n * @section-top\n *\n * Positions an element at the top edge of the inner content of the section\n */\n/**\n * @section-inner\n *\n * Creates a section within a section, so you can have an article as section, and article header as an inner section for example\n *\n * @param\tstring\t$align: top/bottom; if you want to pull it up towards the top or down towards the bottom\n */\n/***\n    title: Section\n    section: Layout\n    description: Creates a full width section with centered content (based on $site-width). Sections should be direct decendants of body/main (any full width element actually) and don't work properly nested like in the styleguide (that's why it looks broken here).\n    example:\n        <div class=\"section bg--white\">\n            <h2>I'm a section</h2>\n            <p>With some content</p>\n        </div>\n***/\n.section {\n  display: block;\n  position: relative;\n  margin: 0;\n  padding-top: 3rem;\n  padding-bottom: 3rem;\n  /*\t@media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t} */\n  padding-left: 1.5rem;\n  padding-right: 1.5rem; }\n  .section:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  @media (min-width: 900px) {\n    .section {\n      padding-left: calc(50% - 400px + 0rem); } }\n  @media (min-width: 900px) {\n    .section {\n      padding-right: calc(50% - 400px + 0rem); } }\n  .section__inner {\n    margin-left: -1.5rem;\n    margin-right: -1.5rem;\n    padding-left: 1.5rem;\n    padding-right: 1.5rem;\n    padding-top: 3rem;\n    padding-bottom: 3rem;\n    margin-top: 3rem;\n    margin-bottom: 3rem;\n    /* @media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t\tmargin-top: $section-padding--bp-medium;\n\t\tmargin-bottom: $section-padding--bp-medium;\n\n\t\t@if ($align == top) {\n\t\t\tmargin-top: -$section-padding--bp-medium;\n\t\t}\n\t\t@if ($align == bottom) {\n\t\t\tmargin-bottom: -$section-padding--bp-medium;\n\t\t}\n\t} */ }\n    @media (min-width: 900px) {\n      .section__inner {\n        box-sizing: border-box;\n        width: 100vw;\n        position: relative;\n        left: 50%;\n        -webkit-transform: translateX(-50%);\n                transform: translateX(-50%);\n        margin-left: 0;\n        margin-right: 0;\n        padding-left: calc(50vw - 400px);\n        padding-right: calc(50vw - 400px); } }\n    .section__inner--top {\n      margin-left: -1.5rem;\n      margin-right: -1.5rem;\n      padding-left: 1.5rem;\n      padding-right: 1.5rem;\n      padding-top: 3rem;\n      padding-bottom: 3rem;\n      margin-top: 3rem;\n      margin-bottom: 3rem;\n      margin-top: -3rem;\n      /* @media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t\tmargin-top: $section-padding--bp-medium;\n\t\tmargin-bottom: $section-padding--bp-medium;\n\n\t\t@if ($align == top) {\n\t\t\tmargin-top: -$section-padding--bp-medium;\n\t\t}\n\t\t@if ($align == bottom) {\n\t\t\tmargin-bottom: -$section-padding--bp-medium;\n\t\t}\n\t} */ }\n      @media (min-width: 900px) {\n        .section__inner--top {\n          box-sizing: border-box;\n          width: 100vw;\n          position: relative;\n          left: 50%;\n          -webkit-transform: translateX(-50%);\n                  transform: translateX(-50%);\n          margin-left: 0;\n          margin-right: 0;\n          padding-left: calc(50vw - 400px);\n          padding-right: calc(50vw - 400px); } }\n    .section__inner--bottom {\n      margin-left: -1.5rem;\n      margin-right: -1.5rem;\n      padding-left: 1.5rem;\n      padding-right: 1.5rem;\n      padding-top: 3rem;\n      padding-bottom: 3rem;\n      margin-top: 3rem;\n      margin-bottom: 3rem;\n      margin-bottom: -3rem;\n      /* @media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t\tmargin-top: $section-padding--bp-medium;\n\t\tmargin-bottom: $section-padding--bp-medium;\n\n\t\t@if ($align == top) {\n\t\t\tmargin-top: -$section-padding--bp-medium;\n\t\t}\n\t\t@if ($align == bottom) {\n\t\t\tmargin-bottom: -$section-padding--bp-medium;\n\t\t}\n\t} */ }\n      @media (min-width: 900px) {\n        .section__inner--bottom {\n          box-sizing: border-box;\n          width: 100vw;\n          position: relative;\n          left: 50%;\n          -webkit-transform: translateX(-50%);\n                  transform: translateX(-50%);\n          margin-left: 0;\n          margin-right: 0;\n          padding-left: calc(50vw - 400px);\n          padding-right: calc(50vw - 400px); } }\n  .section--slanted {\n    -webkit-clip-path: polygon(0 3rem, 100% 0, 100% calc(100% - 3rem), 0 100%);\n            clip-path: polygon(0 3rem, 100% 0, 100% calc(100% - 3rem), 0 100%);\n    padding-top: 6rem;\n    padding-bottom: 6rem; }\n    .section--slanted-top {\n      -webkit-clip-path: polygon(0 3rem, 100% 0, 100% 100%, 0 100%);\n              clip-path: polygon(0 3rem, 100% 0, 100% 100%, 0 100%);\n      padding-top: 6rem; }\n    .section--slanted-bottom {\n      -webkit-clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3rem), 0 100%);\n              clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3rem), 0 100%);\n      padding-bottom: 6rem; }\n\n.separated--bottom {\n  padding-bottom: 1rem;\n  margin-bottom: 2rem;\n  border-bottom: 1px solid #d8d8d8; }\n\n.separated--top {\n  padding-top: 1rem;\n  margin-top: 2rem;\n  border-top: 1px solid #d8d8d8; }\n\n.strike-through {\n  display: table;\n  width: 100%;\n  overflow: hidden;\n  border-spacing: 0; }\n  .strike-through:before, .strike-through:after {\n    display: table-cell;\n    content: \"\";\n    width: 50%;\n    border-top: 1px solid #d8d8d8;\n    -webkit-transform: translateY(50%) translateX(-1rem);\n            transform: translateY(50%) translateX(-1rem); }\n  .strike-through:after {\n    -webkit-transform: translateY(50%) translateX(1rem);\n            transform: translateY(50%) translateX(1rem); }\n\n/***\n    title: Text\n    section: Typography\n    description: Various helper classes for working with text.\n    example:\n        <p class=\"text--center\">This text is centered and <strong class=\"text--upper\">upper case</strong></p>\n***/\n.text {\n  margin: 0;\n  font-size: 1rem;\n  line-height: 1.6;\n  font-family: \"Lato\", sans-serif;\n  color: #111;\n  word-wrap: break-word;\n  font-weight: 300;\n  letter-spacing: 0; }\n\n.text--upper {\n  text-transform: uppercase; }\n\n.text--center {\n  text-align: center; }\n\n.text--left {\n  text-align: left; }\n\n.text--right {\n  text-align: right; }\n\n.text--small {\n  font-size: 0.875rem; }\n\n.text--large {\n  font-size: 1.2rem; }\n\n.text--ellipsis {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis; }\n\n/***\n    title: Text Colors\n    section: Colors\n    description: Use to give an element's text a different color. This class affects everything, including headings and links.\n    example:\n        <div class=\"bg--blue color--white\">\n            <h2>I have white</h2>\n            <p>Text text text text text text text text text text text text text</p>\n        </div>\n***/\n.color--white,\nh1.color--white,\nh2.color--white,\nh3.color--white,\nh4.color--white,\nh5.color--white,\nh6.color--white,\n.heading--1.color--white,\n.heading--2.color--white,\n.heading--3.color--white,\n.heading--4.color--white,\n.heading--5.color--white,\n.heading--6.color--white,\na.color--white,\n.link.color--white {\n  color: #fff; }\n\n.color--white h1, .color--white h2, .color--white h3, .color--white h4, .color--white h5, .color--white h6, .color--white .heading--1, .color--white .heading--2, .color--white .heading--3, .color--white .heading--4, .color--white .heading--5, .color--white .heading--6,\n.color--white a:not(.button),\n.color--white .link {\n  color: #fff; }\n\n.color--green,\nh1.color--green,\nh2.color--green,\nh3.color--green,\nh4.color--green,\nh5.color--green,\nh6.color--green,\n.heading--1.color--green,\n.heading--2.color--green,\n.heading--3.color--green,\n.heading--4.color--green,\n.heading--5.color--green,\n.heading--6.color--green,\na.color--green,\n.link.color--green {\n  color: #1FBB82; }\n\n.color--green h1, .color--green h2, .color--green h3, .color--green h4, .color--green h5, .color--green h6, .color--green .heading--1, .color--green .heading--2, .color--green .heading--3, .color--green .heading--4, .color--green .heading--5, .color--green .heading--6,\n.color--green a:not(.button),\n.color--green .link {\n  color: #1FBB82; }\n\ndiv.video,\n.entry-content-asset {\n  position: relative;\n  padding-bottom: 56.25%;\n  /* 16:9 */\n  padding-top: 25px;\n  height: 0;\n  margin-bottom: 1rem; }\n  div.video iframe,\n  .entry-content-asset iframe {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%; }\n\n.pull-left {\n  float: left; }\n\n.pull-right {\n  float: right; }\n\n.clearfix:after {\n  content: \"\";\n  display: table;\n  clear: both; }\n\n.clear {\n  clear: both; }\n\n.aligncenter {\n  display: block;\n  margin: 0 auto 1rem; }\n\n@media (min-width: 760px) {\n  .alignleft {\n    float: left;\n    width: auto;\n    margin: 0 1rem 1rem 0; }\n  .alignright {\n    float: right;\n    width: auto;\n    margin: 0 0 1rem 1rem; } }\n\n.wp-caption {\n  background: #eaeaea;\n  display: block;\n  width: 100%;\n  max-width: 100%;\n  margin: 0 0 1rem; }\n  .wp-caption img {\n    display: block;\n    width: 100%; }\n  .wp-caption figcaption {\n    padding: .5rem; }\n\ndiv.gallery {\n  margin-left: -0.5rem !important;\n  margin-right: -0.5rem !important; }\n  div.gallery dl.gallery-item {\n    margin-top: 0 !important;\n    margin-bottom: 1rem;\n    padding-left: 0.5rem;\n    padding-right: 0.5rem;\n    position: relative;\n    overflow: hidden; }\n    div.gallery dl.gallery-item dt a {\n      display: block;\n      margin-bottom: 0.5rem; }\n      div.gallery dl.gallery-item dt a img {\n        display: block;\n        border: 0 !important; }\n\n/***\n    title: Flex\n    section: Grid\n    description: Use to align elements in rows and columns. Perfect for use on ul/li setups or indeed any parent/child markup. Use bp--modifiers to set number of columns in different widths. Customize gutter and breakpoints in config file. You can also use ul {@include flex-grid(3)}.\n    example:\n        <ul class=\"flex--2--bp-medium flex--3--bp-large\">\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> I'm two columns</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> In low resolution</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> But three columns</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> In high</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> Resolutions</li>\n            <li><img src=\"http://placehold.it/320x240\" class=\"img--wide\"> Cool?</li>\n        </ul>\n***/\nul[class*=\"flex--\"] {\n  margin-left: 0;\n  padding-left: 0;\n  list-style: none; }\n\n[class*=\"flex--\"] > * {\n  margin-bottom: 2rem; }\n\n.flex--2 {\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-align: stretch;\n      -ms-flex-align: stretch;\n          align-items: stretch;\n  -webkit-box-pack: justify;\n      -ms-flex-pack: justify;\n          justify-content: space-between;\n  -ms-flex-wrap: wrap;\n      flex-wrap: wrap; }\n  .flex--2 > * {\n    min-width: calc(50% - 1rem);\n    max-width: calc(50% - 1rem);\n    -webkit-box-flex: 0;\n        -ms-flex: 0 0 calc(50% - 1rem);\n            flex: 0 0 calc(50% - 1rem);\n    margin-bottom: 2rem; }\n\n.flex--3 {\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-align: stretch;\n      -ms-flex-align: stretch;\n          align-items: stretch;\n  -webkit-box-pack: justify;\n      -ms-flex-pack: justify;\n          justify-content: space-between;\n  -ms-flex-wrap: wrap;\n      flex-wrap: wrap; }\n  .flex--3 > * {\n    min-width: calc(33.33333% - 1.33333rem);\n    max-width: calc(33.33333% - 1.33333rem);\n    -webkit-box-flex: 0;\n        -ms-flex: 0 0 calc(33.33333% - 1.33333rem);\n            flex: 0 0 calc(33.33333% - 1.33333rem);\n    margin-bottom: 2rem; }\n\n@media (min-width: 760px) {\n  .flex--2--bp-medium {\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-align: stretch;\n        -ms-flex-align: stretch;\n            align-items: stretch;\n    -webkit-box-pack: justify;\n        -ms-flex-pack: justify;\n            justify-content: space-between;\n    -ms-flex-wrap: wrap;\n        flex-wrap: wrap; }\n    .flex--2--bp-medium > * {\n      min-width: calc(50% - 1rem);\n      max-width: calc(50% - 1rem);\n      -webkit-box-flex: 0;\n          -ms-flex: 0 0 calc(50% - 1rem);\n              flex: 0 0 calc(50% - 1rem);\n      margin-bottom: 2rem; } }\n\n@media (min-width: 760px) {\n  .flex--3--bp-medium {\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-align: stretch;\n        -ms-flex-align: stretch;\n            align-items: stretch;\n    -webkit-box-pack: justify;\n        -ms-flex-pack: justify;\n            justify-content: space-between;\n    -ms-flex-wrap: wrap;\n        flex-wrap: wrap; }\n    .flex--3--bp-medium > * {\n      min-width: calc(33.33333% - 1.33333rem);\n      max-width: calc(33.33333% - 1.33333rem);\n      -webkit-box-flex: 0;\n          -ms-flex: 0 0 calc(33.33333% - 1.33333rem);\n              flex: 0 0 calc(33.33333% - 1.33333rem);\n      margin-bottom: 2rem; } }\n\n@media (min-width: 1020px) {\n  .flex--2--bp-large {\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-align: stretch;\n        -ms-flex-align: stretch;\n            align-items: stretch;\n    -webkit-box-pack: justify;\n        -ms-flex-pack: justify;\n            justify-content: space-between;\n    -ms-flex-wrap: wrap;\n        flex-wrap: wrap; }\n    .flex--2--bp-large > * {\n      min-width: calc(50% - 1rem);\n      max-width: calc(50% - 1rem);\n      -webkit-box-flex: 0;\n          -ms-flex: 0 0 calc(50% - 1rem);\n              flex: 0 0 calc(50% - 1rem);\n      margin-bottom: 2rem; } }\n\n@media (min-width: 1020px) {\n  .flex--3--bp-large {\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-align: stretch;\n        -ms-flex-align: stretch;\n            align-items: stretch;\n    -webkit-box-pack: justify;\n        -ms-flex-pack: justify;\n            justify-content: space-between;\n    -ms-flex-wrap: wrap;\n        flex-wrap: wrap; }\n    .flex--3--bp-large > * {\n      min-width: calc(33.33333% - 1.33333rem);\n      max-width: calc(33.33333% - 1.33333rem);\n      -webkit-box-flex: 0;\n          -ms-flex: 0 0 calc(33.33333% - 1.33333rem);\n              flex: 0 0 calc(33.33333% - 1.33333rem);\n      margin-bottom: 2rem; } }\n\n/**\n * Border box\n */\n*,\n:before,\n:after {\n  box-sizing: border-box; }\n\n/**\n * General styling\n */\nhtml {\n  background: #fefefe;\n  font-size: 100%; }\n\nbody {\n  font-size: 1rem;\n  line-height: 1.6;\n  font-family: \"Lato\", sans-serif;\n  font-weight: 300;\n  letter-spacing: 0;\n  color: #111;\n  /*\tword-wrap: break-word;\n\thyphens: auto;\n\t-webkit-font-smoothing: antialiased; */ }\n\n/**\n * Paragraphs, lists, quotes etc\n */\np {\n  margin: 0 0 1rem; }\n\nul,\nol {\n  margin: 0 0 1rem 2rem;\n  padding: 0; }\n\ndl {\n  margin: 0 0 1rem; }\n\nblockquote,\nq {\n  font-size: 1.2rem;\n  margin: 0; }\n\npre {\n  background: #9b9b9b;\n  margin: 0 0 1rem;\n  padding: 1rem;\n  max-height: 20rem;\n  overflow: auto; }\n\n/**\n * Inline elements\n */\nsmall {\n  font-size: 0.875rem; }\n\n/**\n * Images, iframes etc\n */\nimg,\nsvg {\n  max-width: 100%;\n  height: auto; }\n\nhr {\n  clear: both;\n  margin: 1rem 0;\n  padding: 0;\n  height: 0;\n  border: 0;\n  border-top: 1px solid #d8d8d8; }\n  @media (min-width: 760px) {\n    hr {\n      margin: 2rem 0; } }\n\n.text--cutout {\n  background: url(\"scripts/assets/bg/bg.jpg\") no-repeat 50% top;\n  background-size: cover;\n  background-attachment: fixed;\n  background-image: none;\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  color: #fff;\n  padding-bottom: 1rem; }\n\nh1,\n.heading--1,\nh2,\n.heading--2 {\n  font-weight: 900; }\n  @media (max-width: 759px) {\n    h1,\n    .heading--1,\n    h2,\n    .heading--2 {\n      font-size: 3rem; } }\n\nprogress {\n  -webkit-appearance: none;\n     -moz-appearance: none;\n          appearance: none;\n  display: block;\n  width: 100%;\n  height: .25rem;\n  border: 0; }\n  progress::-webkit-progress-bar {\n    background: #eaeaea;\n    border-radius: 0; }\n  progress::-moz-progress-bar {\n    background: #F99922;\n    border-radius: 0; }\n  progress::-webkit-progress-value {\n    background: #F99922;\n    border-radius: 0;\n    -webkit-transition: width 0.25s ease-out;\n    transition: width 0.25s ease-out; }\n\n[scrollspy] > * {\n  -webkit-transform: translateY(1rem);\n          transform: translateY(1rem);\n  opacity: 0;\n  -webkit-transition: opacity 0.75s ease-out, -webkit-transform 0.75s ease-out;\n  transition: opacity 0.75s ease-out, -webkit-transform 0.75s ease-out;\n  transition: transform 0.75s ease-out, opacity 0.75s ease-out;\n  transition: transform 0.75s ease-out, opacity 0.75s ease-out, -webkit-transform 0.75s ease-out; }\n  [scrollspy] > *:nth-child(1) {\n    -webkit-transition-delay: .5s;\n            transition-delay: .5s; }\n  [scrollspy] > *:nth-child(2) {\n    -webkit-transition-delay: 1.25s;\n            transition-delay: 1.25s; }\n  [scrollspy] > *:nth-child(3) {\n    -webkit-transition-delay: 1.5s;\n            transition-delay: 1.5s; }\n  [scrollspy] > *:nth-child(4) {\n    -webkit-transition-delay: 1.75s;\n            transition-delay: 1.75s; }\n  [scrollspy] > *:nth-child(5) {\n    -webkit-transition-delay: 2s;\n            transition-delay: 2s; }\n\n[scrollspy].was-in-view > * {\n  opacity: 1;\n  -webkit-transform: translateY(0);\n          transform: translateY(0); }\n\nabout {\n  display: block;\n  position: relative;\n  margin: 0;\n  padding-top: 3rem;\n  padding-bottom: 3rem;\n  /*\t@media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t} */\n  padding-left: 1.5rem;\n  padding-right: 1.5rem;\n  background: -webkit-linear-gradient(top, #fff, #fff 50%, #eaeaea);\n  background: linear-gradient(to bottom, #fff, #fff 50%, #eaeaea);\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-align: start;\n      -ms-flex-align: start;\n          align-items: flex-start;\n  -webkit-box-pack: center;\n      -ms-flex-pack: center;\n          justify-content: center;\n  -webkit-box-orient: vertical;\n  -webkit-box-direction: normal;\n      -ms-flex-direction: column;\n          flex-direction: column;\n  min-height: calc(100vh + 3rem);\n  margin-bottom: -3rem;\n  -webkit-clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3rem), 0 100%);\n          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3rem), 0 100%);\n  padding-bottom: 6rem; }\n  about:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  @media (min-width: 900px) {\n    about {\n      padding-left: calc(50% - 400px + 0rem); } }\n  @media (min-width: 900px) {\n    about {\n      padding-right: calc(50% - 400px + 0rem); } }\n  about > a.icon-down {\n    position: absolute;\n    left: 50%;\n    bottom: 3rem;\n    -webkit-transform: translateX(-50%);\n            transform: translateX(-50%);\n    font-size: 3rem;\n    color: inherit;\n    opacity: .5;\n    -webkit-transition: all 0.25s ease-out;\n    transition: all 0.25s ease-out; }\n    about > a.icon-down:hover {\n      opacity: 1;\n      color: #e0708e; }\n  @media (max-width: 759px) {\n    about figure {\n      text-align: center; } }\n  @media (min-width: 760px) {\n    about figure {\n      display: -webkit-box;\n      display: -ms-flexbox;\n      display: flex;\n      -webkit-box-align: center;\n          -ms-flex-align: center;\n              align-items: center;\n      -webkit-box-pack: justify;\n          -ms-flex-pack: justify;\n              justify-content: space-between; } }\n  @media (min-width: 1020px) {\n    about figure {\n      -webkit-transform: translateX(-10rem);\n              transform: translateX(-10rem); } }\n  about figure img {\n    border-radius: 50%;\n    border: 0.5rem solid #fff;\n    box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);\n    width: 10rem;\n    margin: 0 0 1rem; }\n    @media (min-width: 760px) {\n      about figure img {\n        width: 20rem;\n        margin: 0 4rem 0 0; } }\n  about figure figcaption {\n    -webkit-box-flex: 1;\n        -ms-flex: 1;\n            flex: 1; }\n    about figure figcaption h1 {\n      margin: 0 0 -1rem -.3rem; }\n    about figure figcaption nav {\n      letter-spacing: 0.5rem;\n      position: relative;\n      z-index: 1; }\n      about figure figcaption nav a {\n        display: inline-block;\n        color: inherit;\n        font-size: 1.2rem;\n        opacity: .6;\n        -webkit-transition: all 0.25s ease-out;\n        transition: all 0.25s ease-out; }\n        about figure figcaption nav a:hover {\n          opacity: 1;\n          color: #e0708e; }\n      @media (min-width: 760px) {\n        about figure figcaption nav {\n          float: right; } }\n    about figure figcaption nav + p {\n      opacity: .5; }\n      about figure figcaption nav + p strong {\n        display: block; }\n\n@-webkit-keyframes rotate-bg {\n  0% {\n    background-position: 0vw 50%; }\n  100% {\n    background-position: 100vw 50%; } }\n\n@keyframes rotate-bg {\n  0% {\n    background-position: 0vw 50%; }\n  100% {\n    background-position: 100vw 50%; } }\n\nhtml:before {\n  background: -webkit-linear-gradient(left, #FF2570, #4d1676, #ac3f79, #fce561, #FF2570);\n  background: linear-gradient(to right, #FF2570, #4d1676, #ac3f79, #fce561, #FF2570);\n  display: block;\n  content: \"\";\n  height: .2rem;\n  position: fixed;\n  left: 0;\n  top: 0;\n  right: 0;\n  z-index: 102;\n  pointer-events: none;\n  opacity: 0;\n  -webkit-transition: opacity 0s ease-out;\n  transition: opacity 0s ease-out;\n  -webkit-animation: rotate-bg 1s linear infinite;\n          animation: rotate-bg 1s linear infinite; }\n\nhtml.loading:before {\n  opacity: 1; }\n\n.photo-credit {\n  margin: 0;\n  text-align: center;\n  color: #fff;\n  font-size: 0.875rem; }\n\nbody {\n  background: url(scripts/assets/bg/bg.jpg) no-repeat 50% top;\n  background-size: cover;\n  background-attachment: fixed;\n  background-image: none;\n  padding-bottom: 1rem; }\n\nrepo {\n  display: block;\n  position: relative;\n  margin: 0;\n  padding-top: 3rem;\n  padding-bottom: 3rem;\n  /*\t@media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t} */\n  padding-left: 1.5rem;\n  padding-right: 1.5rem; }\n  repo:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  @media (min-width: 900px) {\n    repo {\n      padding-left: calc(50% - 400px + 0rem); } }\n  @media (min-width: 900px) {\n    repo {\n      padding-right: calc(50% - 400px + 0rem); } }\n\nrepos {\n  display: block;\n  position: relative;\n  margin: 0;\n  padding-top: 3rem;\n  padding-bottom: 3rem;\n  /*\t@media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t} */\n  padding-left: 1.5rem;\n  padding-right: 1.5rem;\n  padding-top: 6rem; }\n  repos:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  @media (min-width: 900px) {\n    repos {\n      padding-left: calc(50% - 400px + 0rem); } }\n  @media (min-width: 900px) {\n    repos {\n      padding-right: calc(50% - 400px + 0rem); } }\n  @media (min-width: 760px) {\n    repos {\n      display: -webkit-box;\n      display: -ms-flexbox;\n      display: flex;\n      -webkit-box-align: stretch;\n          -ms-flex-align: stretch;\n              align-items: stretch;\n      -webkit-box-pack: justify;\n          -ms-flex-pack: justify;\n              justify-content: space-between;\n      -ms-flex-wrap: wrap;\n          flex-wrap: wrap; }\n      repos:after {\n        display: none; } }\n  repos h2 {\n    margin-bottom: 4rem;\n    -webkit-box-flex: 0;\n        -ms-flex: 0 0 100%;\n            flex: 0 0 100%;\n    color: #fff;\n    text-align: center; }\n  repos article {\n    background: #fff;\n    -webkit-box-flex: 0;\n        -ms-flex: 0 0 calc(50% - 1rem);\n            flex: 0 0 calc(50% - 1rem);\n    margin: 0 0 2rem;\n    padding: 2rem;\n    box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2); }\n    repos article nav {\n      letter-spacing: 0.5rem; }\n      repos article nav a {\n        display: inline-block;\n        color: inherit;\n        font-size: 1.2rem;\n        opacity: .6;\n        -webkit-transition: all 0.25s ease-out;\n        transition: all 0.25s ease-out; }\n        repos article nav a:hover {\n          opacity: 1;\n          color: #e0708e; }\n\n#site-header {\n  display: block;\n  position: relative;\n  margin: 0;\n  padding-top: 3rem;\n  padding-bottom: 3rem;\n  /*\t@media (min-width: 760px) {\n\t\tpadding-top: $section-padding--bp-medium;\n\t\tpadding-bottom: $section-padding--bp-medium;\n\t} */\n  padding-left: 1.5rem;\n  padding-right: 1.5rem;\n  padding-top: 1rem;\n  padding-bottom: 1rem;\n  position: absolute;\n  left: 0;\n  top: 0;\n  right: 0;\n  z-index: 99;\n  display: none; }\n  #site-header:after {\n    content: \"\";\n    display: table;\n    clear: both; }\n  @media (min-width: 900px) {\n    #site-header {\n      padding-left: calc(50% - 400px + 0rem); } }\n  @media (min-width: 900px) {\n    #site-header {\n      padding-right: calc(50% - 400px + 0rem); } }\n  #site-header h1 {\n    margin: 0;\n    font-size: 0.875rem;\n    font-weight: 600; }\n    #site-header h1 strong {\n      font-size: 1rem;\n      display: block;\n      font-weight: 900; }\n    #site-header h1 small {\n      color: #eaeaea; }\n"; });
define('text!resources/elements/repos/repos.html', ['module'], function(module) { module.exports = "<template>\n\n\t<h2 id=\"repos\">My Projects</h2>\n\n\t<article repeat.for=\"repo of repos\">\n\n\t\t<h3>${repo.name | readable}</h3>\n\n\t\t<p>Lorem ipsum dolor sit amet consequetuer lipsumus dolrimus.</p>\n\n\t\t<nav>\n\t\t\t<a href=\"${repo.html_url}/archive/master.zip\" class=\"icon-download\" title=\"Download\"></a>\n\t\t\t<a href=\"${repo.html_url}\" class=\"icon-github\" title=\"GitHub\"></a>\n\t\t</nav>\n\n\t</article>\n\n</template>\n"; });
//# sourceMappingURL=app-bundle.js.map