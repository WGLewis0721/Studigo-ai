import {MoonKeep} from './scene.js';

new window.Phaser.Game({
  type: window.Phaser.AUTO, width: 960, height: 540, parent: 'world', pixelArt: true, roundPixels: true,
  backgroundColor: '#0a1322', audio: {noAudio: true}, scene: MoonKeep, banner: false,
});
