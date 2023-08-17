/*! @name videojs-sprite-thumbnails @version 2.1.1 @license MIT */
'use strict';

var videojs = require('video.js');
var window = require('global/window');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var videojs__default = /*#__PURE__*/_interopDefaultLegacy(videojs);
var window__default = /*#__PURE__*/_interopDefaultLegacy(window);

/**
 * Set up sprite thumbnails for a player.
 *
 * @function spriteThumbs
 * @param {Player} player
 *        The current player instance.
 * @param {Plugin} plugin
 *        The current spriteThumbnails plugin instance.
 * @param {Object} options
 *        Plugin configuration options.
 */
const spriteThumbs = (player, plugin, options) => {
  let url;
  let height;
  let width;
  let downlink;
  let cached;
  let dl;
  let urls;
  let framesInEachUrl;
  let secondsForEachUrl;
  const navigator = window__default["default"].navigator;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const dom = videojs__default["default"].dom;
  const merge = videojs__default["default"].obj.merge;
  const sprites = {};
  const defaultState = merge({}, plugin.state);
  const controls = player.controlBar;

  // default control bar component tree is expected
  // https://docs.videojs.com/tutorial-components.html#default-component-tree
  const progress = controls && controls.progressControl;
  const seekBar = progress && progress.seekBar;
  const mouseTimeTooltip = seekBar && seekBar.mouseTimeDisplay && seekBar.mouseTimeDisplay.timeTooltip;
  const tooltipEl = mouseTimeTooltip && mouseTimeTooltip.el();
  const tooltipStyleOrig = tooltipEl && tooltipEl.style;
  const hasMultipleSprites = () => urls && urls.length > 0;
  const resetMouseTooltip = () => {
    if (tooltipEl && tooltipStyleOrig) {
      tooltipEl.style = tooltipStyleOrig;
    }
  };
  const computeFramesInEachUrl = () => {
    const sprite = sprites[urls[0]];
    const imgWidth = sprite.naturalWidth;
    const imgHeight = sprite.naturalHeight;
    if (!(sprite && sprite.complete)) {
      return;
    }
    framesInEachUrl = Math.round(imgWidth / width * (imgHeight / height));
    secondsForEachUrl = framesInEachUrl * options.interval;
  };
  const getUrl = position => {
    if (!hasMultipleSprites()) {
      return url;
    }
    // +1 to take out last second of first frame
    const currentFrameNumber = Math.ceil((position + 1) / options.interval);
    if (isNaN(framesInEachUrl)) {
      computeFramesInEachUrl();
    }
    const spriteNumber = Math.ceil(currentFrameNumber / framesInEachUrl);
    return urls[spriteNumber - 1];
  };
  const spritesNotLoaded = () => Object.keys(sprites).length === 0;
  const hijackMouseTooltip = evt => {
    if (spritesNotLoaded()) {
      return;
    }
    const seekBarEl = seekBar.el();
    let position = Math.floor(dom.getPointerPosition(seekBarEl, evt).x * player.duration());
    const currentUrl = getUrl(position);
    const sprite = sprites[currentUrl];
    if (!sprite) {
      return;
    }
    const imgWidth = sprite.naturalWidth;
    const imgHeight = sprite.naturalHeight;
    if (sprite.complete && imgWidth && imgHeight) {
      if (hasMultipleSprites()) {
        position = position % secondsForEachUrl;
      }
      position = position / options.interval;
      const responsive = options.responsive;
      const playerWidth = player.currentWidth();
      const scaleFactor = responsive && playerWidth < responsive ? playerWidth / responsive : 1;
      const columns = imgWidth / width;
      const scaledWidth = width * scaleFactor;
      const scaledHeight = height * scaleFactor;
      const cleft = Math.floor(position % columns) * -scaledWidth;
      const ctop = Math.floor(position / columns) * -scaledHeight;
      const bgSize = `${imgWidth * scaleFactor}px ${imgHeight * scaleFactor}px`;
      const controlsTop = dom.findPosition(controls.el()).top;
      const seekBarTop = dom.findPosition(seekBarEl).top;
      // top of seekBar is 0 position
      const topOffset = -scaledHeight - Math.max(0, seekBarTop - controlsTop);
      const tooltipStyle = {
        backgroundImage: `url("${currentUrl}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${cleft}px ${ctop}px`,
        backgroundSize: bgSize,
        top: `${topOffset}px`,
        color: '#fff',
        textShadow: '1px 1px #000',
        // box-sizing: border-box inherited from .video-js
        border: '1px solid #000',
        // border should not overlay thumbnail area
        width: `${scaledWidth + 2}px`,
        height: `${scaledHeight + 2}px`
      };
      Object.keys(tooltipStyle).forEach(key => {
        tooltipEl.style[key] = tooltipStyle[key];
      });
    }
  };
  const init = () => {
    // if present, merge source config with current config
    const plugName = plugin.name;
    const spriteSource = player.currentSources().find(source => {
      return source.hasOwnProperty(plugName);
    });
    const spriteOpts = spriteSource && spriteSource[plugName];
    if (spriteOpts) {
      plugin.setState(defaultState);
      options = merge(options, spriteOpts);

      // url from source always takes precedence, even if empty
      options.url = spriteOpts.url;
    }

    // update script variables
    url = options.url;
    height = options.height;
    width = options.width;
    downlink = options.downlink;
    dl = !connection || connection.downlink >= downlink;
    cached = !!sprites[url];
    urls = options.urls;
    plugin.setState({
      ready: !!(mouseTimeTooltip && width && height && url && (cached || dl)),
      diagnostics: true
    });
  };
  const loadImage = imgUrl => {
    let msg = `loading ${imgUrl}`;
    if (!sprites[imgUrl]) {
      sprites[imgUrl] = dom.createEl('img', {
        src: imgUrl
      });
    } else {
      msg = `re${msg}`;
    }
    plugin.log.debug(msg);
  };
  plugin.on('statechanged', () => {
    const pstate = plugin.state;
    const spriteEvents = ['mousemove', 'touchmove'];
    const log = plugin.log;
    const debug = log.debug;
    if (pstate.ready) {
      if (hasMultipleSprites()) {
        urls.forEach(loadImage);
        computeFramesInEachUrl();
      } else {
        loadImage(url);
      }
      debug('ready to show thumbnails');
      progress.on(spriteEvents, hijackMouseTooltip);
    } else {
      progress.off(spriteEvents, hijackMouseTooltip);
      resetMouseTooltip();
      if (pstate.diagnostics) {
        debug('resetting');
        ['url', 'width', 'height'].forEach(key => {
          if (!options[key]) {
            log(`no thumbnails ${key} given`);
          }
        });
        if (connection && !dl) {
          log.warn(`connection.downlink < ${downlink}`);
        }
      }
    }
  });

  // load configuration from a source
  player.on('loadstart', init);

  // load plugin configuration
  init();
  player.addClass('vjs-sprite-thumbnails');
};

var version = "2.1.1";

const Plugin = videojs__default["default"].getPlugin('plugin');

/**
 * Default plugin options
 *
 * @param {String} url
 *        Sprite location. Must be set by user.
 * @param {Integer} width
 *        Width in pixels of a thumbnail. Must be set by user.
 * @param {Integer} height
 *        Height in pixels of a thumbnail. Must be set by user.
 * @param {Number} interval
 *        Interval between thumbnail frames in seconds. Default: 1.
 * @param {Integer} responsive
 *        Width of player below which thumbnails are reponsive. Default: 600.
 * @param {Number} downlink
 *        Minimum of NetworkInformation downlink where supported. Default: 1.5.
 *        https://developer.mozilla.org/docs/Web/API/NetworkInformation/downlink
 */
const defaults = {
  url: '',
  width: 0,
  height: 0,
  interval: 1,
  responsive: 600,
  downlink: 1.5,
  urls: []
};

/**
 * An advanced Video.js plugin. For more information on the API
 *
 * See: https://blog.videojs.com/feature-spotlight-advanced-plugins/
 */
class SpriteThumbnails extends Plugin {
  /**
   * Create a SpriteThumbnails plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   */
  constructor(player, options) {
    // the parent class will add player under this.player
    super(player, options);
    this.options = videojs__default["default"].obj.merge(defaults, options);
    this.player.ready(() => {
      spriteThumbs(this.player, this, this.options);
    });
  }
}

// Define default values for the plugin's `state` object here.
SpriteThumbnails.defaultState = {
  ready: false,
  diagnostics: false
};

// Include the version number.
SpriteThumbnails.VERSION = version;

// Register the plugin with video.js.
videojs__default["default"].registerPlugin('spriteThumbnails', SpriteThumbnails);

module.exports = SpriteThumbnails;
